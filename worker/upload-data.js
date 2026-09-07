import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'campusapp.db');
const uploadsDir = path.join(rootDir, 'uploads');

console.log('📦 Starting data sync to Cloudflare...');

// 1. Upload all photos in uploads/ to remote R2 bucket
if (fs.existsSync(uploadsDir)) {
  const userDirs = fs.readdirSync(uploadsDir);
  for (const userDir of userDirs) {
    const userDirPath = path.join(uploadsDir, userDir);
    if (!fs.statSync(userDirPath).isDirectory()) continue;
    
    const files = fs.readdirSync(userDirPath);
    for (const file of files) {
      const filePath = path.join(userDirPath, file);
      const r2Key = `uploads/${userDir}/${file}`;
      console.log(`📤 Uploading ${r2Key} to R2...`);
      try {
        execSync(`npx wrangler r2 object put "campushinge-uploads/${r2Key}" --remote --file="${filePath}"`, {
          cwd: __dirname,
          stdio: 'inherit',
        });
      } catch (err) {
        console.error(`Failed to upload ${r2Key}:`, err.message);
      }
    }
  }
}

// 2. Read users and profiles from local SQLite
const db = new Database(dbPath);
const users = db.prepare('SELECT * FROM users').all();
const profiles = db.prepare('SELECT * FROM profiles').all();

console.log(`Found ${users.length} users and ${profiles.length} profiles to sync.`);

let sql = '-- Seed data exported from campusapp.db\n';

for (const u of users) {
  const emailVerified = u.email_verified ? 1 : 0;
  const emailNotif = u.email_notifications != null ? u.email_notifications : 1;
  const profCompleted = u.profile_completed != null ? u.profile_completed : 0;
  const isBanned = u.is_banned ? 1 : 0;
  const subExpiry = u.subscription_expiry ? `'${u.subscription_expiry}'` : 'NULL';
  const lastActive = u.last_active ? `'${u.last_active}'` : 'NULL';
  const createdAt = u.created_at ? `'${u.created_at}'` : "datetime('now')";
  const updatedAt = u.updated_at ? `'${u.updated_at}'` : "datetime('now')";

  sql += `INSERT OR REPLACE INTO users (id, email, email_verified, role, subscription_status, subscription_expiry, email_notifications, profile_completed, is_banned, last_active, created_at, updated_at) VALUES ('${u.id}', '${u.email}', ${emailVerified}, '${u.role || 'user'}', '${u.subscription_status || 'free'}', ${subExpiry}, ${emailNotif}, ${profCompleted}, ${isBanned}, ${lastActive}, ${createdAt}, ${updatedAt});\n`;
}

for (const p of profiles) {
  let photos = p.photos || '[]';
  // Replace http://localhost:3000/uploads/ with /cdn/uploads/
  photos = photos.replace(/http:\/\/localhost:3000\/uploads\//g, '/cdn/uploads/');
  
  const bio = p.bio ? `'${p.bio.replace(/'/g, "''")}'` : 'NULL';
  const branch = p.branch ? `'${p.branch.replace(/'/g, "''")}'` : 'NULL';
  const year = p.year != null ? p.year : 'NULL';
  const interests = p.interests ? `'${p.interests.replace(/'/g, "''")}'` : "'[]'";
  const createdAt = p.created_at ? `'${p.created_at}'` : "datetime('now')";
  const updatedAt = p.updated_at ? `'${p.updated_at}'` : "datetime('now')";

  sql += `INSERT OR REPLACE INTO profiles (id, user_id, name, bio, photos, branch, year, gender, interested_in, interests, created_at, updated_at) VALUES ('${p.id}', '${p.user_id}', '${p.name.replace(/'/g, "''")}', ${bio}, '${photos.replace(/'/g, "''")}', ${branch}, ${year}, '${p.gender}', '${p.interested_in}', ${interests}, ${createdAt}, ${updatedAt});\n`;
}

const seedFilePath = path.join(__dirname, 'migrations', '0002_seed_data.sql');
fs.writeFileSync(seedFilePath, sql);
console.log(`✅ Generated seed SQL at ${seedFilePath}`);

// 3. Execute seed SQL on remote D1
console.log('🚀 Executing seed SQL on remote D1...');
execSync(`npx wrangler d1 execute campushinge-db --remote --file=migrations/0002_seed_data.sql --yes`, {
  cwd: __dirname,
  stdio: 'inherit',
});

console.log('🎉 Data upload complete!');
