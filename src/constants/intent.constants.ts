/**
 * Constants and types for Multi-Intent Matching in CampusHinge
 */

export const INTENTS = ['dating', 'friendship', 'study', 'activity', 'networking'] as const;
export type IntentType = typeof INTENTS[number];

export const PREDEFINED_ACTIVITY_TAGS: readonly string[] = [
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
] as const;

export const CAREER_INTERESTS: readonly string[] = [
  'Coding/Tech',
  'Entrepreneurship',
  'Debate/MUN',
  'Fest & events',
] as const;

/**
 * Course compatibility clusters.
 * Students within the same cluster are considered compatible study partners.
 */
export const COURSE_GROUPS: Record<string, string[]> = {
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

/**
 * Check if two course/branch strings are compatible for Study matching.
 */
export function areCoursesCompatible(courseA?: string | null, courseB?: string | null): boolean {
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
