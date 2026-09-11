#!/usr/bin/env node
/**
 * CampusHinge Database User Manager
 * Run with:
 *   npm run users            -> List all users in Cloudflare D1
 *   npm run users:delete -- <email_or_id> -> Delete a specific user
 */

const { execSync } = require('child_process');
const path = require('path');

const action = process.argv[2] || 'list';
const target = process.argv[3];

const workerDir = path.resolve(__dirname, '..', 'worker');

function runD1(sql) {
  try {
    const singleLineSql = sql.replace(/\s+/g, ' ').trim().replace(/"/g, '\\"');
    const stdout = execSync(`npx wrangler d1 execute campushinge-db --remote --json --command="${singleLineSql}"`, {
      cwd: workerDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const jsonStart = stdout.indexOf('[');
    const jsonEnd = stdout.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) {
      return [];
    }
    const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
    return parsed[0]?.results || [];
  } catch (err) {
    console.error('Error executing D1 command:', err.stderr ? err.stderr.toString() : err.message);
    process.exit(1);
  }
}

if (action === 'list') {
  console.log('\n🔍 Fetching users from Cloudflare D1 (campushinge-db)...\n');
  const results = runD1(`
    SELECT u.id, u.email, u.email_verified, u.created_at, p.name, p.gender, p.year 
    FROM users u 
    LEFT JOIN profiles p ON p.user_id = u.id 
    ORDER BY u.created_at DESC;
  `);

  console.log(`📊 TOTAL REGISTERED USERS: ${results.length}\n`);
  if (results.length === 0) {
    console.log('No users found.');
  } else {
    console.table(
      results.map((r, i) => ({
        '#': i + 1,
        'Name': r.name || '(No profile)',
        'Email': r.email,
        'Gender': r.gender || '—',
        'Passout': r.year || '—',
        'Verified': r.email_verified ? 'Yes' : 'No',
        'Created (UTC)': r.created_at,
        'User ID': r.id,
      }))
    );
  }
  console.log('\n💡 To delete a user, run:');
  console.log('   npm run users:delete -- "email_or_uuid_here"\n');
} else if (action === 'delete') {
  if (!target) {
    console.error('❌ Please specify an email or User ID to delete.');
    console.log('   Usage: npm run users:delete -- "user@vitbhopal.ac.in"');
    process.exit(1);
  }

  console.log(`\n🗑️ Deleting user "${target}" from Cloudflare D1...\n`);
  const isEmail = target.includes('@');
  const query = isEmail
    ? `DELETE FROM users WHERE email = '${target}';`
    : `DELETE FROM users WHERE id = '${target}';`;

  runD1(query);
  console.log(`✅ Successfully deleted user "${target}" and all their associated data (profile, swipes, matches).\n`);
} else {
  console.log(`Unknown action: ${action}`);
}
