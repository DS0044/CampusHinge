const db = require('../config/db');

function initTables() {
  console.log('⏳  Initializing SQLite database tables...');

  db.db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      email_verified INTEGER DEFAULT 0,
      role TEXT DEFAULT 'user',
      subscription_status TEXT DEFAULT 'free',
      subscription_expiry TEXT,
      email_notifications INTEGER DEFAULT 1,
      profile_completed INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      last_active TEXT,
      last_super_like_at TEXT,
      accepted_terms_at TEXT,
      terms_version TEXT DEFAULT '1.0',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      bio TEXT,
      photos TEXT DEFAULT '[]',
      branch TEXT,
      year INTEGER,
      gender TEXT NOT NULL,
      interested_in TEXT NOT NULL,
      interests TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS swipes (
      id TEXT PRIMARY KEY,
      swiper_id TEXT NOT NULL,
      swiped_id TEXT NOT NULL,
      action TEXT NOT NULL,
      is_super_like INTEGER DEFAULT 0,
      shared_interests TEXT DEFAULT '[]',
      shared_interests_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(swiper_id, swiped_id),
      FOREIGN KEY (swiper_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (swiped_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      is_unlocked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user1_id, user2_id),
      FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      razorpay_subscription_id TEXT,
      razorpay_order_id TEXT,
      status TEXT DEFAULT 'pending',
      activated_at TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      reported_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(blocker_id, blocked_id),
      FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      to_user_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      type TEXT DEFAULT 'like',
      metadata TEXT,
      is_seen INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ══════════════════════════════════════════════
    -- MATCHING ALGORITHM TABLES
    -- ══════════════════════════════════════════════

    -- Behavioral learning: tracks tag-level swipe affinities per user
    CREATE TABLE IF NOT EXISTS swipe_preferences (
      user_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, tag)
    );

    -- Interest rarity cache: how many users have each tag
    CREATE TABLE IF NOT EXISTS interest_popularity (
      tag TEXT PRIMARY KEY,
      user_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration alters for existing databases
  const alterStatements = [
    `ALTER TABLE users ADD COLUMN last_active TEXT`,
    `ALTER TABLE users ADD COLUMN last_super_like_at TEXT`,
    `ALTER TABLE users ADD COLUMN accepted_terms_at TEXT`,
    `ALTER TABLE users ADD COLUMN terms_version TEXT`,
    `ALTER TABLE swipes ADD COLUMN is_super_like INTEGER DEFAULT 0`,
    `ALTER TABLE swipes ADD COLUMN shared_interests TEXT DEFAULT '[]'`,
    `ALTER TABLE swipes ADD COLUMN shared_interests_count INTEGER DEFAULT 0`,
    `ALTER TABLE notifications ADD COLUMN metadata TEXT`,
  ];

  for (const stmt of alterStatements) {
    try {
      db.db.exec(stmt);
    } catch {
      // Column already exists — ignore
    }
  }

  console.log('🎉  SQLite schema initialized successfully!');
  process.exit(0);
}

initTables();
