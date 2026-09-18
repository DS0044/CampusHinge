const db = require('../config/db');
const fs = require('fs');
const path = require('path');

function clearDatabase() {
  console.log('🧹 Clearing all data from SQLite database...');

  db.db.pragma('foreign_keys = OFF');

  const tables = db.db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all();

  console.log(`Found ${tables.length} tables to clear.`);

  for (const { name } of tables) {
    const info = db.db.prepare(`DELETE FROM "${name}"`).run();
    console.log(`  ✓ Cleared ${name} (${info.changes} rows removed)`);
  }

  try {
    db.db.prepare("DELETE FROM sqlite_sequence").run();
  } catch (e) {
    // sqlite_sequence may not exist if no autoincrements were used
  }

  db.db.prepare('VACUUM').run();
  db.db.pragma('foreign_keys = ON');

  console.log('✅ SQLite database successfully cleared and vacuumed.');

  // Clean uploads directory
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (fs.existsSync(uploadsDir)) {
    const entries = fs.readdirSync(uploadsDir);
    let cleanedCount = 0;
    for (const entry of entries) {
      const entryPath = path.join(uploadsDir, entry);
      fs.rmSync(entryPath, { recursive: true, force: true });
      cleanedCount++;
    }
    console.log(`✅ Uploads directory cleaned (${cleanedCount} items removed).`);
  }
}

clearDatabase();
process.exit(0);
