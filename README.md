# mu-auth-sudo
NPM package for a sparql client for mu.semte.ch that overrules access rights in queries through a mu-auth-sudo header.

## Usage
```
npm install @lblod/mu-auth-sudo
```

Include the following in your code
```
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';


//Examples

// To run a normal query

const queryString = `SELECT * FROM { GRAPH ?g { ?s ?p ?o. } } LIMIT 1`;
await query(queryString);

// To pass extra headers

const updateString = `INSERT DATA { GRAPH <http://foo> { <http://bar> <http://baz> <http://boom>. } }`;
const extraHeaders = { 'mu-call-scope-id':  'http://foo/bar', 'other-info'; 'hello' };
await update(updateString, extraHeaders);

// With custom sparqlEndpoint (this should be exceptional, make sure you know what you're doing)

await update(updateString, extraHeaders, 'http://the.sparql.endpoint/sparql');
```

## Logging

The verbosity of logging can be configured as in the [javascript template](https://github.com/mu-semtech/mu-javascript-template/blob/6ff43eaf51856783c6946e82344e31a3348ce4a3/README.md#logging) through following environment variables:

- `LOG_SPARQL_ALL`: Logging of all executed SPARQL queries, read as well as update (default `true`)
- `LOG_SPARQL_QUERIES`: Logging of executed SPARQL read queries (default: `undefined`). Overrules `LOG_SPARQL_ALL`.
- `LOG_SPARQL_UPDATES`: Logging of executed SPARQL update queries (default `undefined`). Overrules `LOG_SPARQL_ALL`.
- `DEBUG_AUTH_HEADERS`: Debugging of [mu-authorization](https://github.com/mu-semtech/mu-authorization) access-control related headers (default `true`)

Following values are considered true: [`"true"`, `"TRUE"`, `"1"`].
