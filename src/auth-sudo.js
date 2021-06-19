import httpContext from 'express-http-context';
import SC2 from 'sparql-client-2';
const { SparqlClient } = SC2;

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
  console.log(queryString);
  return executeRawQuery(queryString);
}

function updateSudo(queryString) {
  console.log(queryString);
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
