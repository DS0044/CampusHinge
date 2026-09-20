/**
 * Constants and types for Multi-Intent Matching in CampusHinge (Cloudflare Worker)
 */

export const INTENTS = ['dating', 'friendship', 'study', 'activity', 'networking'];

export const PREDEFINED_ACTIVITY_TAGS = [
  'Gym',
  'Badminton',
  'Hiking',
  'Cricket',
  'Football',
  'Running',
  'Cycling',
  'Yoga',
  'Dance',
  'Swimming',
  'Basketball',
  'Table Tennis',
  'Tennis',
  'Volleyball',
  'Martial Arts',
  'Chess',
];

export const CAREER_INTERESTS = [
  'Coding/Tech',
  'Entrepreneurship',
  'Debate/MUN',
  'Fest & events',
];

export const COURSE_GROUPS = {
  tech: [
    'computer science',
    'cse',
    'information technology',
    'it',
    'software engineering',
    'ai & ml',
    'artificial intelligence',
    'machine learning',
    'data science',
    'cybersecurity',
    'cloud computing',
    'bca',
    'mca',
  ],
  electronics: [
    'electronics & communication',
    'ece',
    'electrical & electronics',
    'eee',
    'electrical engineering',
    'robotics',
    'instrumentation',
  ],
  mechanical: [
    'mechanical engineering',
    'me',
    'automobile engineering',
    'aerospace engineering',
    'civil engineering',
    'mechatronics',
  ],
  business: [
    'bba',
    'mba',
    'commerce',
    'b.com',
    'm.com',
    'finance',
    'economics',
    'management',
    'marketing',
  ],
  design: [
    'design',
    'b.des',
    'animation',
    'architecture',
    'ui/ux',
    'graphic design',
  ],
  sciences: [
    'physics',
    'chemistry',
    'mathematics',
    'biotechnology',
    'bioinformatics',
  ],
};

export function areCoursesCompatible(courseA, courseB) {
  if (!courseA || !courseB) return false;
  const a = courseA.toLowerCase().trim();
  const b = courseB.toLowerCase().trim();

  // Exact or substring match
  if (a === b || a.includes(b) || b.includes(a)) {
    return true;
  }

  // Check if they belong to the same course group
  for (const group of Object.values(COURSE_GROUPS)) {
    const aInGroup = group.some((keyword) => a.includes(keyword) || keyword.includes(a));
    const bInGroup = group.some((keyword) => b.includes(keyword) || keyword.includes(b));
    if (aInGroup && bInGroup) {
      return true;
    }
  }

  return false;
}
