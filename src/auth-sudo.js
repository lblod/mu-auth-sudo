import httpContext from 'express-http-context';
import SC2 from 'sparql-client-2';
import env from 'env-var';

const { SparqlClient } = SC2;

const LOG_SPARQL_QUERIES = process.env.LOG_SPARQL_QUERIES != undefined ? env.get('LOG_SPARQL_QUERIES').asBool() : env.get('LOG_SPARQL_ALL').asBool();
const LOG_SPARQL_UPDATES = process.env.LOG_SPARQL_UPDATES != undefined ? env.get('LOG_SPARQL_UPDATES').asBool() : env.get('LOG_SPARQL_ALL').asBool();
const DEBUG_AUTH_HEADERS = env.get('DEBUG_AUTH_HEADERS').asBool();

function sudoSparqlClient() {
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

  console.log(`Headers set on SPARQL client: ${JSON.stringify(options)}`);

  return new SparqlClient(process.env.MU_SPARQL_ENDPOINT, options);
}

function executeRawQuery(queryString) {
  return sudoSparqlClient().query(queryString).executeRaw().then(response => {
    function maybeParseJSON(body) {
      // Catch invalid JSON
      try {
        return JSON.parse(body);
      } catch (ex) {
        return null;
      }
    }

    return maybeParseJSON(response.body);
  });
}

function querySudo(queryString) {
  if( LOG_SPARQL_QUERIES ) {
    console.log(queryString);
  }
  return executeRawQuery(queryString);
}

function updateSudo(queryString) {
  if( LOG_SPARQL_UPDATES ) {
    console.log(queryString);
  }
  return executeRawQuery(queryString);
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
