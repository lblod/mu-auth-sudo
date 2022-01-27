import httpContext from 'express-http-context';
import { SparqlClient } from 'sparql-client-2';
import env from 'env-var';

const LOG_SPARQL_QUERIES = process.env.LOG_SPARQL_QUERIES != undefined ? env.get('LOG_SPARQL_QUERIES').asBool() : env.get('LOG_SPARQL_ALL').asBool();
const LOG_SPARQL_UPDATES = process.env.LOG_SPARQL_UPDATES != undefined ? env.get('LOG_SPARQL_UPDATES').asBool() : env.get('LOG_SPARQL_ALL').asBool();
const DEBUG_AUTH_HEADERS = env.get('DEBUG_AUTH_HEADERS').asBool();
const RETRY = env.get('QUERY_RETRY').default('false').asBool();
const RETRY_MAX_ATTEMPTS = env.get('QUERY_RETRY_MAX_ATTEMPTS').default('5').asInt();
const RETRY_ON_HTTP_STATUS_CODES = env.get('QUERY_RETRY_ON_HTTP_STATUS_CODES').default('').asArray();

function sudoSparqlClient( extraHeaders = {}, sparqlEndpoint = process.env.MU_SPARQL_ENDPOINT ) {
  let options = {
    requestDefaults: {
      headers: {
        'mu-auth-sudo': 'true'
      }
    }
  };

  if (httpContext.get('request')) {
    options.requestDefaults.headers['mu-session-id'] = httpContext.get('request').get('mu-session-id');
    options.requestDefaults.headers['mu-call-id'] = httpContext.get('request').get('mu-call-id');
  }

  if(extraHeaders) {
    for(const key of Object.keys(extraHeaders)){
      options.requestDefaults.headers[key] = extraHeaders[key];
    }
  }

  if( DEBUG_AUTH_HEADERS ) {
    console.log(`Headers set on SPARQL client: ${JSON.stringify(options)}`);
  }

  return new SparqlClient(sparqlEndpoint, options);
}

async function executeRawQuery(queryString, extraHeaders = {}, sparqlEndpoint, attempt = 0) {

  if( LOG_SPARQL_QUERIES ) {
    console.log(queryString);
  }

  try {

    const response = await sudoSparqlClient(extraHeaders, sparqlEndpoint).query(queryString).executeRaw();
    return maybeParseJSON(response.body);

  } catch(ex) {

    if(mayRetry(ex, attempt)) {

      attempt += 1;

      const sleepTime = nextAttemptTimeout(attempt);
      console.log(`Sleeping ${sleepTime} ms before next attempt`);
      await new Promise(r => setTimeout(r, sleepTime));

      return await executeRawQuery(queryString, extraHeaders, sparqlEndpoint, attempt);

    } else throw ex;
  }

}

function querySudo(queryString, extraHeaders = {}, sparqlEndpoint) {
  return executeRawQuery(queryString, extraHeaders, sparqlEndpoint);
}

function updateSudo(queryString, extraHeaders = {}, sparqlEndpoint) {
  return executeRawQuery(queryString, extraHeaders, sparqlEndpoint);
}

function maybeParseJSON(body) {
  // Catch invalid JSON
  try {
    return JSON.parse(body);
  } catch (ex) {
    return null;
  }
}

function mayRetry(error, attempt) {

  console.log(`Checking retry allowed for error: ${error} and attempt: ${attempt}`);

  let mayRetry = false;

  if(RETRY && attempt < RETRY_MAX_ATTEMPTS) {
    if(error.code == 'ECONNRESET') {
      mayRetry = true;
    } else if(error.httpStatus & RETRY_ON_HTTP_STATUS_CODES.includes(`${error.httpStatus}`)) {
      mayRetry = true;
    }
  }

  console.log(`Retry allowed? ${mayRetry}`);

  return mayRetry;
}

function nextAttemptTimeout(attempt) {
  //expected to be milliseconds
  return Math.round(Math.exp(0.3 * attempt + 10));
}

const exports = {
  querySudo,
  updateSudo
};

export default exports;

export {
  querySudo,
  updateSudo
}
