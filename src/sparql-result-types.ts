
export type Binding<B extends Array<string>> = {
  [Key in B[number]]: {type: string, value: string}
}

export type SPARQLQueryResult<B extends Array<string>> = {
  head: {
    link: unknown[],
    vars: B
  },
  results: {
    distinct: boolean,
    ordered: boolean,
    bindings: Binding<B>[]
  }
};

export type SPARQLConstructResult = SPARQLQueryResult<['s', 'p', 'v']>;
export type SPARQLDescribeResult = SPARQLQueryResult<['s', 'p', 'v']>

export type SPARQLAskResult = {
  head: { link: unknown[] },
  boolean: boolean
}
type QueryTypes = 'ask'|'construct'|'describe'
export interface ConfigMap  {
  'ask': SPARQLAskResult;
  'construct': SPARQLConstructResult;
  'describe': SPARQLDescribeResult;
};

export type SPARQLQueryConfig = QueryTypes | string[];

export type SPARQLResult<C extends SPARQLQueryConfig> = 
  C extends QueryTypes ? ConfigMap[C] 
    : C extends string[] ? SPARQLQueryResult<C> : never;
