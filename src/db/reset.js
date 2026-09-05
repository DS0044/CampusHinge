const db = require('../config/db');

function resetDatabase() {
  console.log('🧹  Resetting CampusHinge dataset...');

  db.db.exec(`
    DELETE FROM notifications;
    DELETE FROM messages;
    DELETE FROM matches;
    DELETE FROM swipes;
    DELETE FROM blocks;
    DELETE FROM reports;
    DELETE FROM subscriptions;
    DELETE FROM profiles;
    DELETE FROM otp_codes;
    DELETE FROM users;
  `);

  console.log('✨  All database tables cleared and dataset reset successfully!');
}

resetDatabase();
