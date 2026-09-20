/**
 * Predefined list of student interest tags for CampusHinge.
 */
export const PREDEFINED_INTERESTS: readonly string[] = [
  'Coffee',
  'Chai person',
  'Morning person',
  'Night owl',
  'Bookworm',
  'Foodie',
  'Gym rat',
  'Homebody',
  'Wanderlust',
  'Netflix binger',
  'Music',
  'Bollywood',
  'K-pop',
  'Anime',
  'Stand-up comedy',
  'Gaming',
  'Movies & TV',
  'Coding/Tech',
  'Cricket',
  'Football',
  'Debate/MUN',
  'Dance',
  'Photography',
  'Entrepreneurship',
  'Fest & events',
  'Trekking',
  'Introvert',
  'Extrovert',
  'Overthinker',
  'Dog person',
  'Cat person',
  'Plant parent',
] as const;

export type InterestTag = typeof PREDEFINED_INTERESTS[number];

export const MAX_INTERESTS_LIMIT: number = 6;
