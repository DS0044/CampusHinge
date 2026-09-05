const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../campusapp.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Converts Postgres $1, $2, $3 placeholders into SQLite ? placeholders AND re-orders
 * the parameters array to match the positional appearance in the SQL string.
 */
function processQuery(text, params = []) {
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
      i--; // step back one character since loop increments

      const index = parseInt(numStr, 10) - 1; // $1 -> params[0]
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

  outSql = outSql.replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*minutes'/gi, "datetime('now', '-$1 minutes')");
  outSql = outSql.replace(/NOW\(\)\s*\+\s*INTERVAL\s*'(\d+)\s*days'/gi, "datetime('now', '+$1 days')");
  outSql = outSql.replace(/NOW\(\)/gi, "datetime('now')");

  return { sql: outSql, params: newParams };
}

async function query(text, params = []) {
  try {
    const upperSql = text.toUpperCase();

    if (upperSql.includes('RETURNING')) {
      const parts = text.split(/RETURNING/i);
      const rawMain = parts[0].trim();
      const { sql: mainSql, params: mainParams } = processQuery(rawMain, params);
      const returningCols = parts[1].trim();

      const stmt = db.prepare(mainSql);
      const info = stmt.run(...mainParams);

      let rows = [];
      const tableMatch = rawMain.match(/(?:INSERT INTO|UPDATE)\s+([a-zA-Z0-9_]+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        try {
          // Check all params for matching row or use lastInsertRowid
          for (const param of params) {
            if (param && (typeof param === 'string' || typeof param === 'number')) {
              try {
                rows = db.prepare(`SELECT ${returningCols} FROM ${tableName} WHERE id = ? OR user_id = ? OR LOWER(email) = LOWER(?)`).all(param, param, param);
                if (rows.length > 0) break;
              } catch {
                try {
                  rows = db.prepare(`SELECT ${returningCols} FROM ${tableName} WHERE id = ? OR user_id = ?`).all(param, param);
                  if (rows.length > 0) break;
                } catch {
                  // Ignore column errors
                }
              }
            }
          }
          if (rows.length === 0 && info.lastInsertRowid) {
            rows = db.prepare(`SELECT ${returningCols} FROM ${tableName} WHERE rowid = ?`).all(info.lastInsertRowid);
          }
        } catch (err) {
          console.error('❌ RETURNING fetch error:', err.message);
          rows = [];
        }
      }
      return { rows };
    }

    const { sql: formattedSql, params: formattedParams } = processQuery(text, params);
    const trimmedUpper = formattedSql.trim().toUpperCase();
    
    if (trimmedUpper.startsWith('SELECT')) {
      const stmt = db.prepare(formattedSql);
      const rows = stmt.all(...formattedParams);
      return { rows };
    } else {
      const stmt = db.prepare(formattedSql);
      const info = stmt.run(...formattedParams);
      return { rows: [], changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  } catch (err) {
    console.error('❌  Database Error:', err.message, '| SQL:', text);
    throw err;
  }
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      to_user_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      type TEXT DEFAULT 'like',
      is_seen INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  try {
    db.exec(`ALTER TABLE users ADD COLUMN email_notifications INTEGER DEFAULT 1;`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN profile_completed INTEGER DEFAULT 0;`);
  } catch (e) {
    // Column already exists
  }
} catch (err) {
  console.error('❌  Auto-migration notice:', err.message);
}

console.log('✅  Connected to local SQLite database (campusapp.db)');

module.exports = {
  query,
  processQuery,
  db,
};
