/**
 * Multi-Intent Matching Configurations for CampusHinge
 */

export const INTENTS = ['dating', 'friendship', 'study', 'activity', 'networking'] as const;
export type IntentType = typeof INTENTS[number];

export interface IntentConfig {
  id: IntentType;
  label: string;
  discoverTitle: string;
  discoverPill: string;
  description: string;
  icon: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  likeIcon: string;
  likeLabel: string;
  superLikeIcon: string;
  superLikeLabel: string;
  superLikeUnlockHint: string;
}

export const INTENT_CONFIGS: Record<IntentType, IntentConfig> = {
  dating: {
    id: 'dating',
    label: 'Dating',
    discoverTitle: 'Campus Dating',
    discoverPill: 'Dating Matches',
    description: 'Find romantic connections & matches on campus',
    icon: '❤️',
    color: '#ff4d6d',
    badgeBg: 'rgba(255, 77, 109, 0.14)',
    badgeBorder: 'rgba(255, 77, 109, 0.35)',
    likeIcon: '❤️',
    likeLabel: 'Like',
    superLikeIcon: '⭐',
    superLikeLabel: 'Super Like',
    superLikeUnlockHint: 'Unlocked with 4+ shared interests',
  },
  friendship: {
    id: 'friendship',
    label: 'Friendship',
    discoverTitle: 'Campus Friends',
    discoverPill: 'Friends',
    description: 'Make genuine friends & expand your campus circle',
    icon: '👋',
    color: '#ffb703',
    badgeBg: 'rgba(255, 183, 3, 0.14)',
    badgeBorder: 'rgba(255, 183, 3, 0.35)',
    likeIcon: '👋',
    likeLabel: 'Wave',
    superLikeIcon: '⭐',
    superLikeLabel: 'Super Wave',
    superLikeUnlockHint: 'Unlocked with 4+ shared interests',
  },
  study: {
    id: 'study',
    label: 'Study',
    discoverTitle: 'Study Partners',
    discoverPill: 'Study Partners',
    description: 'Find course mates, study buddies & project partners',
    icon: '📚',
    color: '#4cc9f0',
    badgeBg: 'rgba(76, 201, 240, 0.14)',
    badgeBorder: 'rgba(76, 201, 240, 0.35)',
    likeIcon: '📚',
    likeLabel: 'Study Partner',
    superLikeIcon: '⭐',
    superLikeLabel: 'Super Study Partner',
    superLikeUnlockHint: 'Unlocked for same course & adjacent year',
  },
  activity: {
    id: 'activity',
    label: 'Activity',
    discoverTitle: 'Activity & Sports',
    discoverPill: 'Activity Partners',
    description: 'Team up for gym, badminton, football, running & hobbies',
    icon: '⚽',
    color: '#06d6a0',
    badgeBg: 'rgba(6, 214, 160, 0.14)',
    badgeBorder: 'rgba(6, 214, 160, 0.35)',
    likeIcon: '⚽',
    likeLabel: 'Team Up',
    superLikeIcon: '⭐',
    superLikeLabel: 'Super Team Up',
    superLikeUnlockHint: 'Unlocked with 2+ shared activity tags',
  },
  networking: {
    id: 'networking',
    label: 'Networking',
    discoverTitle: 'Campus Network',
    discoverPill: 'Campus Network',
    description: 'Connect across departments, build projects & career contacts',
    icon: '🤝',
    color: '#7209b7',
    badgeBg: 'rgba(114, 9, 183, 0.18)',
    badgeBorder: 'rgba(114, 9, 183, 0.4)',
    likeIcon: '🤝',
    likeLabel: 'Connect',
    superLikeIcon: '⭐',
    superLikeLabel: 'Super Connect',
    superLikeUnlockHint: 'Unlocked for cross-branch or career interests',
  },
};

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

export function getIntentConfig(intent?: string): IntentConfig {
  if (intent && intent in INTENT_CONFIGS) {
    return INTENT_CONFIGS[intent as IntentType];
  }
  return INTENT_CONFIGS.dating;
}
