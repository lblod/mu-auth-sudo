import { querySudo, SPARQLQueryConfig, updateSudo, type ConnectionOptions } from './auth-sudo'

export type ClientOptions = ConnectionOptions & {extraHeaders?: Record<string, string>} 
async function doQuery<C extends SPARQLQueryConfig = string[]>(queryStr: string, opts?: ClientOptions) {
  return querySudo<C>(queryStr, opts?.extraHeaders, opts);
}
export function sparqlSelect<C extends string[]>(queryStr: string, opts?: ClientOptions) {
  return doQuery<C>(queryStr, opts);
}

export function sparqlAsk(queryStr: string, opts?: ClientOptions) {
  return doQuery<'ask'>(queryStr, opts);
}

export async function sparqlConstruct(queryStr: string, opts?: ClientOptions) {
  return doQuery<'construct'>(queryStr, opts);
}

export async function sparqlDescribe(queryStr: string, opts?: ClientOptions) {
  return doQuery<'describe'>(queryStr, opts);
}

export async function sparqlUpdate(queryStr: string, opts?: ClientOptions) {
  return updateSudo(queryStr, opts?.extraHeaders, opts)
}

export function mkSelect(presetOpts?: ClientOptions) { 
  return (queryStr:string, opts?: ClientOptions) => {
    return sparqlSelect(queryStr, {...presetOpts, ...opts});
  }
}

export function mkAsk(presetOpts?: ClientOptions) { 
  return (queryStr:string, opts?: ClientOptions) => {
    return sparqlAsk(queryStr, {...presetOpts, ...opts});
  }
}
export function mkConstruct(presetOpts?: ClientOptions) { 
  return (queryStr:string, opts?: ClientOptions) => {
    return sparqlConstruct(queryStr, {...presetOpts, ...opts});
  }
}
export function mkDescribe(presetOpts?: ClientOptions) { 
  return (queryStr:string, opts?: ClientOptions) => {
    return sparqlDescribe(queryStr, {...presetOpts, ...opts});
  }
}
export function mkUpdate(presetOpts?: ClientOptions) { 
  return (queryStr:string, opts?: ClientOptions) => {
    return sparqlUpdate(queryStr, {...presetOpts, ...opts});
  }
}
/**
 * Create a bundle of sparql query functions with preconfigured options. Each function still allows for all its connectionOptions to be overridden.
 * This allows for a consumer to easily make multiple clients for different endpoints, without having to explicitly pass the endpoint for every invocation.
 *
 * Usage example: 
 * ```ts
 * const fooClient = sparqlClient({sparqlEndpoint: 'http://foo.com/sparql'})
 * const result = fooClient.select('SELECT * WHERE {?s ?p ?v.}')
 * ```
 */
export function sparqlClient(presetOpts?: ClientOptions) {
  return {
    select: mkSelect(presetOpts),
    ask: mkAsk(presetOpts),
    construct: mkConstruct(presetOpts),
    describe: mkDescribe(presetOpts),
    update: mkUpdate(presetOpts)
  }
}

