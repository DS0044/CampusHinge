const crypto = require('crypto');
const db = require('../config/db');

async function seed() {
  console.log('🌱 Seeding sample campus profiles for mobile testing...');

  const sampleUsers = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'ananya.sharma@vitbhopal.ac.in',
      name: 'Ananya Sharma',
      bio: 'Coffee enthusiast & late night coder ☕ | Looking for someone to explore campus cafes with!',
      branch: 'Computer Science',
      year: 3,
      gender: 'female',
      interested_in: 'everyone',
      interests: ['Coffee', 'Coding/Tech', 'Night owl', 'Music', 'Foodie'],
      photos: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'rohan.verma@vitbhopal.ac.in',
      name: 'Rohan Verma',
      bio: 'Gym rat & football fanatic ⚽ | Always down for trekking trips and good street food.',
      branch: 'Mechanical Engg',
      year: 2,
      gender: 'male',
      interested_in: 'everyone',
      interests: ['Gym rat', 'Football', 'Trekking', 'Foodie', 'Anime'],
      photos: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      email: 'priya.patel@vitbhopal.ac.in',
      name: 'Priya Patel',
      bio: 'Bookworm by day, stand-up comedy binger by night 📚🎙️ | Let\'s debate Marvel vs DC.',
      branch: 'Electrical Engg',
      year: 4,
      gender: 'female',
      interested_in: 'everyone',
      interests: ['Bookworm', 'Stand-up comedy', 'Movies & TV', 'Chai person', 'Dog person'],
      photos: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      email: 'aryan.singh@vitbhopal.ac.in',
      name: 'Aryan Singh',
      bio: 'Guitarist in the campus band 🎸 | Chai > Coffee any day. Need someone to vibe to indie music.',
      branch: 'Aerospace Engg',
      year: 1,
      gender: 'male',
      interested_in: 'everyone',
      interests: ['Music', 'Chai person', 'Bollywood', 'Gaming', 'Photography'],
      photos: [
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      email: 'sneha.kulkarni@vitbhopal.ac.in',
      name: 'Sneha Kulkarni',
      bio: 'Dancing is therapy 💃 | Plant parent & weekend trekker. Here for genuine campus friendships!',
      branch: 'Electronics (ECE)',
      year: 2,
      gender: 'female',
      interested_in: 'everyone',
      interests: ['Dance', 'Plant parent', 'Trekking', 'Overthinker', 'Wanderlust'],
      photos: [
        'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80'
      ]
    }
  ];

  for (const u of sampleUsers) {
    await db.query(
      `INSERT INTO users (id, email, email_verified, role, subscription_status, profile_completed)
       VALUES ($1, $2, 1, 'user', 'free', 1)
       ON CONFLICT (id) DO UPDATE SET email_verified = 1, profile_completed = 1`,
      [u.id, u.email]
    );

    const profId = crypto.randomUUID();
    await db.query(
      `INSERT INTO profiles (id, user_id, name, bio, photos, branch, year, gender, interested_in, interests)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id) DO UPDATE SET
         name = excluded.name,
         bio = excluded.bio,
         photos = excluded.photos,
         branch = excluded.branch,
         year = excluded.year,
         gender = excluded.gender,
         interested_in = excluded.interested_in,
         interests = excluded.interests`,
      [
        profId,
        u.id,
        u.name,
        u.bio,
        JSON.stringify(u.photos),
        u.branch,
        u.year,
        u.gender,
        u.interested_in,
        JSON.stringify(u.interests)
      ]
    );
  }

  console.log(`✅ Successfully seeded ${sampleUsers.length} campus profiles!`);
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}

module.exports = { seed };
