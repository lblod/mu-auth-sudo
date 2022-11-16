import httpContext from 'express-http-context';
import env from 'env-var';
import fetch, { Headers, Response } from 'node-fetch';
import DigestFetch from "digest-fetch"

const SPARQL_ENDPOINT : string = env.get('MU_SPARQL_ENDPOINT').required().asString();
const LOG_SPARQL_ALL : string = env.get('LOG_SPARQL_ALL').required().asString();
const LOG_SPARQL_QUERIES : boolean = env.get('LOG_SPARQL_QUERIES').default(LOG_SPARQL_ALL).asBool();
const LOG_SPARQL_UPDATES : boolean = env.get('LOG_SPARQL_UPDATES').default(LOG_SPARQL_ALL).asBool();
const DEBUG_AUTH_HEADERS : boolean = env.get('DEBUG_AUTH_HEADERS').required().asBool();

// The following configuration options are considered optional, but may be overriden as a temporary workaround for issues. Thus, a last resort.
const RETRY = env.get('SUDO_QUERY_RETRY').default('false').asBool();
const RETRY_MAX_ATTEMPTS = env.get('SUDO_QUERY_RETRY_MAX_ATTEMPTS').default('5').asInt();
const RETRY_FOR_HTTP_STATUS_CODES = env.get('SUDO_QUERY_RETRY_FOR_HTTP_STATUS_CODES').default('').asArray();
const RETRY_FOR_CONNECTION_ERRORS = env.get('SUDO_QUERY_RETRY_FOR_CONNECTION_ERRORS').default('ECONNRESET,ETIMEDOUT,EAI_AGAIN').asArray();
const RETRY_TIMEOUT_INCREMENT_FACTOR = env.get('SUDO_QUERY_RETRY_TIMEOUT_INCREMENT_FACTOR').default('0.3').asFloat();

export interface ConnectionOptions {
  sparqlEndpoint?: string
  authUser?: string
  authPassword?: string
  authType?: "basic"|"digest"
  mayRetry?: boolean
}

export interface SPARQLResult {
  head: Record<string,any>
  results?: {
    distinct: boolean
    ordered: boolean
    bindings: Record<string,any>[]
  }
  boolean?: boolean
}

export class HTTPResponseError extends Error {
    httpStatus: number;
    httpStatusText: string;
    constructor(response : Response) {
        super(`HTTP Error Response: ${response.status} ${response.statusText}`);
        this.httpStatus = response.status;
        this.httpStatusText = response.statusText;
    }

}

function defaultHeaders() : Headers {
  const headers = new Headers();
  headers.set('content-type', 'application/x-www-form-urlencoded');
  headers.set('mu-auth-sudo', 'true');
  headers.set('Accept', 'application/sparql-results+json');
  if (httpContext.get('request')) {
    headers.set('mu-session-id', httpContext.get('request').get('mu-session-id'));
    headers.set('mu-call-id', httpContext.get('request').get('mu-call-id'));
  }
  return headers;
}


async function executeRawQuery(queryString: string, extraHeaders: Record<string,string> = {}, connectionOptions: ConnectionOptions = {}, attempt = 0): Promise<SPARQLResult|null> {
  const sparqlEndpoint = connectionOptions.sparqlEndpoint ?? SPARQL_ENDPOINT;
  const headers = defaultHeaders();
  for (const key of Object.keys(extraHeaders)) {
    headers.append(key, extraHeaders[key]);
  }
  if( DEBUG_AUTH_HEADERS ) {
    const stringifiedHeaders = Array.from(headers.entries())
      .filter( ([key]) => key.startsWith('mu-'))
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    console.log(`Headers set on SPARQL client: ${stringifiedHeaders}`);
  }

  try {
    // note that URLSearchParams is used because it correctly encodes for form-urlencoded
    const formData = new URLSearchParams();
    formData.set("query", queryString);
    headers.append('Content-Length', formData.toString().length.toString());

    let response;
    if (connectionOptions.authUser && connectionOptions.authPassword ) {
      const client = new DigestFetch(connectionOptions.authUser, connectionOptions.authPassword, { basic: connectionOptions.authType === 'basic'});
      response = await client.fetch(sparqlEndpoint, {
        method: 'POST',
        body: formData.toString(),
        headers
      });
    }
    else {
      response = await fetch(sparqlEndpoint, {
        method: 'POST',
        body: formData.toString(),
        headers
      });
    }
    if( response.ok ) {
      return await maybeJSON(response);
    }
    else {
      throw new HTTPResponseError(response);
    }
  } catch(ex) {

    if(mayRetry(ex, attempt, connectionOptions)) {

      attempt += 1;

      const sleepTime = nextAttemptTimeout(attempt);
      console.log(`Sleeping ${sleepTime} ms before next attempt`);
      await new Promise(r => setTimeout(r, sleepTime));

      return await executeRawQuery(queryString, extraHeaders, connectionOptions, attempt);

    } else {
      console.log(`Failed Query:
                  ${queryString}`);
      throw ex;
    }
  }
}

async function maybeJSON(response: Response) : Promise<SPARQLResult | null> {
    try {
        return (await response.json())
    }
    catch(e) {
        return null;
    }
}

export function querySudo(queryString: string, extraHeaders : Record<string,string> = {}, connectionOptions : ConnectionOptions = {}) {
  if( LOG_SPARQL_QUERIES ) {
    console.log(queryString);
  }
  return executeRawQuery(queryString, extraHeaders, connectionOptions);
}

export function updateSudo(queryString: string, extraHeaders : Record<string,string> = {}, connectionOptions : ConnectionOptions = {}) {
  if( LOG_SPARQL_UPDATES ) {
    console.log(queryString);
  }
  return executeRawQuery(queryString, extraHeaders, connectionOptions);
}

function mayRetry(error: any, attempt: number, connectionOptions: ConnectionOptions = {}) {

  console.log(`Checking retry allowed for error: ${error} and attempt: ${attempt}`);

  let mayRetry = false;

  if( !(RETRY || connectionOptions.mayRetry) ) {
    mayRetry = false;
  } else if(attempt < RETRY_MAX_ATTEMPTS) {
    if(error.code && RETRY_FOR_CONNECTION_ERRORS.includes(error.code)) {
      mayRetry = true;
    } else if(error.httpStatus && RETRY_FOR_HTTP_STATUS_CODES.includes(`${error.httpStatus}`)) {
      mayRetry = true;
    }
  }

  console.log(`Retry allowed? ${mayRetry}`);

  return mayRetry;
}

function nextAttemptTimeout(attempt: number) {
  // expected to be milliseconds
  return Math.round(Math.exp(RETRY_TIMEOUT_INCREMENT_FACTOR * attempt + 10));
}

const defaultExport = {
  querySudo,
  updateSudo
};

export default defaultExport;
