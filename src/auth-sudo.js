import httpContext from 'express-http-context';
import { SparqlClient } from 'sparql-client-2';
import env from 'env-var';

const LOG_SPARQL_QUERIES = process.env.LOG_SPARQL_QUERIES != undefined ? env.get('LOG_SPARQL_QUERIES').asBool() : env.get('LOG_SPARQL_ALL').asBool();
const LOG_SPARQL_UPDATES = process.env.LOG_SPARQL_UPDATES != undefined ? env.get('LOG_SPARQL_UPDATES').asBool() : env.get('LOG_SPARQL_ALL').asBool();
const DEBUG_AUTH_HEADERS = env.get('DEBUG_AUTH_HEADERS').asBool();

function sudoSparqlClient( extraHeaders = {}, sparqlEndpoint) {
  sparqlEndpoint = sparqlEndpoint || process.env.MU_SPARQL_ENDPOINT;
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

async function executeRawQuery(queryString, extraHeaders = {}, sparqlEndpoint) {

  if( LOG_SPARQL_QUERIES ) {
    console.log(queryString);
  }

  const response = await sudoSparqlClient(extraHeaders, sparqlEndpoint).query(queryString).executeRaw();
  return maybeParseJSON(response.body);

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

const exports = {
  querySudo,
  updateSudo
};

export default exports;

export {
  querySudo,
  updateSudo
}
