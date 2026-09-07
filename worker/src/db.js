/**
 * D1 Database Helper — Drop-in replacement for the better-sqlite3 wrapper.
 *
 * Provides the same `query(db, sql, params)` interface but uses Cloudflare D1.
 * The $1, $2 → ? conversion logic is reused from the original db.js.
 */

/**
 * Converts Postgres-style $1, $2 placeholders into ? placeholders
 * and re-orders the params array to match positional appearance.
 */
export function processQuery(text, params = []) {
  if (typeof text !== 'string') return { sql: text, params };

  let outSql = '';
  const newParams = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '$' && i + 1 < text.length && text[i + 1] >= '0' && text[i + 1] <= '9') {
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
  outSql = outSql.replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*minutes'/gi, "datetime('now', '-$1 minutes')");
  outSql = outSql.replace(/NOW\(\)\s*\+\s*INTERVAL\s*'(\d+)\s*days'/gi, "datetime('now', '+$1 days')");
  outSql = outSql.replace(/NOW\(\)/gi, "datetime('now')");

  return { sql: outSql, params: newParams };
}

/**
 * Execute a SQL query against D1.
 *
 * @param {D1Database} db - The D1 binding from c.env.DB
 * @param {string} text - SQL with $1, $2 placeholders
 * @param {Array} params - Parameter values
 * @returns {{ rows: Array, changes?: number }}
 */
export async function query(db, text, params = []) {
  try {
    const upperSql = text.toUpperCase();

    if (upperSql.includes('RETURNING')) {
      const parts = text.split(/RETURNING/i);
      const rawMain = parts[0].trim();
      const { sql: mainSql, params: mainParams } = processQuery(rawMain, params);
      const returningCols = parts[1].trim();

      const stmt = db.prepare(mainSql).bind(...mainParams);
      await stmt.run();

      // Fetch the row we just inserted/updated
      let rows = [];
      const tableMatch = rawMain.match(/(?:INSERT INTO|UPDATE)\s+([a-zA-Z0-9_]+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        try {
          if (params && params.length > 0 && params[0] != null) {
            try {
              const result = await db.prepare(`SELECT ${returningCols} FROM ${tableName} WHERE id = ?`).bind(params[0]).all();
              rows = result.results || [];
            } catch { /* ignore */ }
          }

          if (rows.length === 0 && params && params.length > 1 && params[1] != null) {
            try {
              const result = await db.prepare(`SELECT ${returningCols} FROM ${tableName} WHERE id = ? OR user_id = ?`).bind(params[1], params[1]).all();
              rows = result.results || [];
            } catch { /* ignore */ }
          }
        } catch { rows = []; }
      }
      return { rows };
    }

    const { sql: formattedSql, params: formattedParams } = processQuery(text, params);
    const trimmedUpper = formattedSql.trim().toUpperCase();

    if (trimmedUpper.startsWith('SELECT') || trimmedUpper.startsWith('WITH')) {
      const stmt = db.prepare(formattedSql).bind(...formattedParams);
      const result = await stmt.all();
      return { rows: result.results || [] };
    } else {
      const stmt = db.prepare(formattedSql).bind(...formattedParams);
      const result = await stmt.run();
      return { rows: [], changes: result.meta?.changes || 0 };
    }
  } catch (err) {
    console.error('❌ D1 Error:', err.message, '| SQL:', text);
    throw err;
  }
}
