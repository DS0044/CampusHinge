export interface QueryResult<T = any> {
  rows: T[];
  changes?: number;
  lastInsertRowid?: number | bigint;
}

export interface ProcessedQuery {
  sql: string;
  params: unknown[];
}
