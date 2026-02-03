# mu-auth-sudo
NPM package for a SPARQL client for mu.semte.ch that overrules access rights in queries through a mu-auth-sudo header.

## Usage
```bash
npm install @lblod/mu-auth-sudo
```

Include the following in your code
```js
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';


//Examples

// To run a regular query

const queryString = `SELECT * FROM { GRAPH ?g { ?s ?p ?o. } } LIMIT 1`;
await query(queryString);

// To pass extra headers

const updateString = `INSERT DATA { GRAPH <http://foo> { <http://bar> <http://baz> <http://boom>. } }`;
const extraHeaders = { 'mu-call-scope-id':  'http://foo/bar', 'other-info'; 'hello' };
await update(updateString, extraHeaders);

// With custom connection options (this should be exceptional, make sure you know what you're doing)

const connectionOptions = { sparqlEndpoint: 'http://the.custom.endpoint/sparql', mayRetry: true,  };

await update(updateString, extraHeaders, connectionOptions);

// Authentication via digest or basic auth
const connectionOptions = { 
  sparqlEndpoint: 'http://the.custom.endpoint/sparql', 
  authUser: "dba",
  authPassword: "mypass",
  authType: "digest"
};

await update(updateString, extraHeaders, connectionOptions);

```

## Typescript usage

The query method allows for specifying the resulting bindings you expect to receive. Additionally, there are special return types for
ASK, CONSTRUCT and DESCRIBE queries.

```ts

const queryString = `SELECT * FROM { GRAPH ?g { ?s ?p ?o. } } LIMIT 1`;
// for SELECT queries, list the variable bindings you ask for in the select as an array of strings
const result = await querySudo<['g', 's', 'p', 'o']>(queryString);
// result shape and bindings are now typed, and will fully autocomplete
result.results.bindins[0].g.value

const queryString = `ASK {?something ?exists "with this value"}`
// for ASK queries, simply specify the literal 'ask' as the generic
const result = await querySudo<'ask'>(queryString)
// result shape is typed
result.boolean

const queryString = `DESCRIBE <http://my-cool.uri/1>`
// for DESCRIBE queries, simply specify the literal 'describe' as the generic
// note, this is fully equivalent to querySudo<['s', 'p', 'v']>
const result = await querySudo<'describe'>(queryString)
// result shape is typed
result.results.bindings[0].s.value

const queryString = `CONSTRUCT {?my ?triple ?pattern. } WHERE {?my ?triple ?pattern .}`
// for CONSTRUCT queries, simply specify the literal 'construct' as the generic
// note, this is fully equivalent to querySudo<['s', 'p', 'v']>
const result = await querySudo<'construct'>(queryString)
// result shape is typed
result.results.bindings[0].s.value
```

If you don't care or don't know the result shape, you can simply leave out the generic. It defaults to `string[]`, which means 
everything except the specific binding names will still be typed, e.g:

```ts

const queryString = `SELECT * FROM { GRAPH ?g { ?s ?p ?o. } } LIMIT 1`;
const result = querySudo(queryString);

// still fully typed
const firstBinding = result.results.bindings[0]

// won't complain, since we haven't specified the precise binding names
const hmmm = firstBinding.banana

// however, the shape of the binding is still typed
const {value, type} = hmmm

```
## Alternative client

Exported under `@lblod/mu-auth-sudo/client` is an alternative interface to the same query and update methods, aimed at ease-of-use without needing to stay compatible with the familiar mu-helper patterns.

It exports 3 ways of using the client:

### `sparql[Select|Ask|Construct|Describe|Update]`

These are simple wrappers around the `querySudo` and `updateSudo` methods.
In contrast to the methods they wrap, they take the `extraHeaders` argument inside the `connectionOptions` object, leading to a slightly cleaner invocation when you want to provide connectionOptions, but don't need any extra headers.

Additionally, by splitting the methods over the various sparql verbs, they eliminate the need for specifying the generic type parameter (except for the select method)

### `mk[Select|Ask|Construct|Describe|Update]`

It's common to need the same connectionOptions for every invocation, especially the `sparqlEndpoint` setting. 
These builder methods allow you to make a preconfigured version of each of the sparql methods.
The preconfigured methods still allow overriding their options.

### `sparqlClient`

Wraps the above 5 builder methods in a single object, allowing you to preconfigure all 5 methods at once.
This makes it easy to use this library for multiple sparql endpoints in the same project, cause it eliminates the need to pass the sparqlEndpoint to every invocation, and keeps things organized.

e.g.:

```ts
const fooClient = sparqlClient({sparqlEndpoint: 'http://foo.com/sparql'});
fooClient.select("SELECT * WHERE {?s ?p ?v.}");
fooClient.update("INSERT DATA {<a> <b> <c>.}")

//etc

const barClient = sparqlClient({sparqlEndpoint: 'http://bar.com/sparql'});
barClient.select("SELECT * WHERE {?s ?p ?v.}", {authUser: "exceptionalOverride"})
```

## Logging

The verbosity of logging can be configured as in the [javascript template](https://github.com/mu-semtech/mu-javascript-template/blob/6ff43eaf51856783c6946e82344e31a3348ce4a3/README.md#logging) through following environment variables:

- `LOG_SPARQL_ALL`: Logging of all executed SPARQL queries, read as well as update (default `true`)
- `LOG_SPARQL_QUERIES`: Logging of executed SPARQL read queries (default: `undefined`). Overrules `LOG_SPARQL_ALL`.
- `LOG_SPARQL_UPDATES`: Logging of executed SPARQL update queries (default `undefined`). Overrules `LOG_SPARQL_ALL`.
- `DEBUG_AUTH_HEADERS`: Debugging of [mu-authorization](https://github.com/mu-semtech/mu-authorization) access-control related headers (default `true`)

Following values are considered true: [`"true"`, `"TRUE"`, `"1"`].

## Retrying
You can tweak system-wide retry parameters. These should be considered internal, but tweaking them may help in extreme scenarios. Use with extreme caution.

- `SUDO_QUERY_RETRY`: System-wide configuration to enable the retry-mechanism (default `'false'`).
                        Warning: this overules eventual source-code specifications (i.e. `connectionOptions = { mayRetry: false }`), so make sure you know what you're doing.
- `SUDO_QUERY_RETRY_MAX_ATTEMPTS`: Specfiy the number of max retry attempts (default: 5)
- `SUDO_QUERY_RETRY_FOR_HTTP_STATUS_CODES`: Specify what returned HTTP status from the database are allowed for retry. (default: `''`). Overriding this list should be considered case by case.
- `SUDO_QUERY_RETRY_FOR_CONNECTION_ERRORS`: Specify what connection errors are allowed for retry. (default: `'ECONNRESET,ETIMEDOUT,EAI_AGAIN'`)
- `SUDO_QUERY_RETRY_TIMEOUT_INCREMENT_FACTOR`: Specify the factor applied to the timeout before the next attempt. Check implementation to see how it is calculated. (default: `'0.3'`)
