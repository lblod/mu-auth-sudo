import httpContext from 'express-http-context';
import { SparqlClient } from 'sparql-client-2';
import env from 'env-var';

const SUDO_QUERY_RETRY_NON_RESTRICTIVE = env.get('SUDO_QUERY_RETRY_NON_RESTRICTIVE').default('false').asBool();
const LOG_SPARQL_QUERIES = process.env.LOG_SPARQL_QUERIES != undefined ? env.get('LOG_SPARQL_QUERIES').asBool() : env.get('LOG_SPARQL_ALL').asBool();
const LOG_SPARQL_UPDATES = process.env.LOG_SPARQL_UPDATES != undefined ? env.get('LOG_SPARQL_UPDATES').asBool() : env.get('LOG_SPARQL_ALL').asBool();
const DEBUG_AUTH_HEADERS = env.get('DEBUG_AUTH_HEADERS').asBool();

// The following configuration options are considered optional, but may be overriden as a temporary workaround for issues. Thus, a last resort.
const RETRY = env.get('SUDO_QUERY_RETRY').default('false').asBool();
const RETRY_MAX_ATTEMPTS = env.get('SUDO_QUERY_RETRY_MAX_ATTEMPTS').default('5').asInt();
const RETRY_FOR_HTTP_STATUS_CODES = env.get('SUDO_QUERY_RETRY_FOR_HTTP_STATUS_CODES').default('').asArray();
const RETRY_FOR_CONNECTION_ERRORS = env.get('SUDO_QUERY_RETRY_FOR_CONNECTION_ERRORS').default('ECONNRESET,ETIMEDOUT,EAI_AGAIN').asArray();
const RETRY_TIMEOUT_INCREMENT_FACTOR = env.get('SUDO_QUERY_RETRY_TIMEOUT_INCREMENT_FACTOR').default('0.3').asFloat();

function sudoSparqlClient( extraHeaders = {}, connectionOptions = {} ) {

  let sparqlEndpoint = process.env.MU_SPARQL_ENDPOINT;

  if(connectionOptions) {
    sparqlEndpoint = connectionOptions.sparqlEndpoint || sparqlEndpoint;
  }

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

async function executeRawQuery(queryString, extraHeaders = {}, connectionOptions = {}, attempt = 0) {

  try {

    const response = await sudoSparqlClient(extraHeaders, connectionOptions).query(queryString).executeRaw();
    return maybeParseJSON(response.body);

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

function querySudo(queryString, extraHeaders = {}, connectionOptions = {}) {
  if( LOG_SPARQL_QUERIES ) {
    console.log(queryString);
  }
  return executeRawQuery(queryString, extraHeaders, connectionOptions);
}

function updateSudo(queryString, extraHeaders = {}, connectionOptions = {}) {
  if( LOG_SPARQL_UPDATES ) {
    console.log(queryString);
  }
  return executeRawQuery(queryString, extraHeaders, connectionOptions);
}

function maybeParseJSON(body) {
  // Catch invalid JSON
  try {
    return JSON.parse(body);
  } catch (ex) {
    return null;
  }
}

function mayRetry(error, attempt, connectionOptions = {}) {

  console.log(`Checking retry allowed for error: ${error} and attempt: ${attempt}`);

  let mayRetry = false;

  if( !(RETRY || connectionOptions.mayRetry) ) {
    mayRetry = false;
  }
  else if(attempt < RETRY_MAX_ATTEMPTS) {
    if(SUDO_QUERY_RETRY_NON_RESTRICTIVE) {
      mayRetry =true;
    }
    else if(error.code && RETRY_FOR_CONNECTION_ERRORS.includes(error.code)) {
      mayRetry = true;
    } else if(error.httpStatus && RETRY_FOR_HTTP_STATUS_CODES.includes(`${error.httpStatus}`)) {
      mayRetry = true;
    }
  }

  console.log(`Retry allowed? ${mayRetry}`);

  return mayRetry;
}

function nextAttemptTimeout(attempt) {
  //expected to be milliseconds
  return Math.round(Math.exp(RETRY_TIMEOUT_INCREMENT_FACTOR * attempt + 10));
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
