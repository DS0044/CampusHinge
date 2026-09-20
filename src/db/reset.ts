import db from '../config/db';

export function resetDatabase(): void {
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
    DELETE FROM swipe_preferences;
    DELETE FROM interest_popularity;
    DELETE FROM users;
    VACUUM;
  `);

  console.log('✨  All database tables cleared and dataset reset successfully!');
}

if (require.main === module) {
  resetDatabase();
}

export default resetDatabase;
module.exports = resetDatabase;
