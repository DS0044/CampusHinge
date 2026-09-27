/**
 * D1 Database Helper — Drop-in replacement for the better-sqlite3 wrapper.
 *
 * Provides the same `query(db, sql, params)` interface but uses Cloudflare D1.
 * The $1, $2 → ? conversion logic is reused from the original db.js.
 */

import type { QueryResult } from './types.js';

/**
 * Converts Postgres-style $1, $2 placeholders into ? placeholders
 * and re-orders the params array to match positional appearance.
 */
export function processQuery(
  text: string,
  params: unknown[] = []
): { sql: string; params: unknown[] } {
  if (typeof text !== 'string') return { sql: text, params };

  let outSql = '';
  const newParams: unknown[] = [];

  for (let i = 0; i < text.length; i++) {
    if (
      text[i] === '$' &&
      i + 1 < text.length &&
      text[i + 1] >= '0' &&
      text[i + 1] <= '9'
    ) {
      let numStr = '';
      i++;
      while (i < text.length && text[i] >= '0' && text[i] <= '9') {
        numStr += text[i];
        i++;
      }
      i--;

      const index = parseInt(numStr, 10) - 1;
      outSql += '?';
      if (params && index < params.length) {
        newParams.push(params[index]);
      } else {
        newParams.push(null);
      }
    } else {
      outSql += text[i];
    }
  }

  // Convert Postgres interval syntax to SQLite
  outSql = outSql.replace(
    /NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*minutes'/gi,
    "datetime('now', '-$1 minutes')"
  );
  outSql = outSql.replace(
    /NOW\(\)\s*\+\s*INTERVAL\s*'(\d+)\s*days'/gi,
    "datetime('now', '+$1 days')"
  );
  outSql = outSql.replace(/NOW\(\)/gi, "datetime('now')");

  return { sql: outSql, params: newParams };
}

/**
 * Execute a SQL query against D1.
 *
 * @param db   - The D1 binding from c.env.DB
 * @param text - SQL with $1, $2 placeholders
 * @param params - Parameter values
 * @returns {{ rows: T[], changes?: number }}
 */
export async function query<T = Record<string, unknown>>(
  db: D1Database,
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  try {
    const { sql: formattedSql, params: formattedParams } = processQuery(text, params);
    const trimmedUpper = formattedSql.trim().toUpperCase();

    if (
      trimmedUpper.startsWith('SELECT') ||
      trimmedUpper.startsWith('WITH') ||
      trimmedUpper.includes('RETURNING')
    ) {
      const stmt = db.prepare(formattedSql).bind(...formattedParams);
      const result = await stmt.all<T>();
      return { rows: result.results ?? [], changes: result.meta?.changes ?? 0 };
    } else {
      const stmt = db.prepare(formattedSql).bind(...formattedParams);
      const result = await stmt.run();
      return { rows: [], changes: result.meta?.changes ?? 0 };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ D1 Error:', msg, '| SQL:', text);
    throw err;
  }
}
