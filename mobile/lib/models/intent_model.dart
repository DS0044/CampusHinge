import 'package:flutter/material.dart';

enum IntentType {
  dating,
  friendship,
  study,
  activity,
  networking;

  static IntentType fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'friendship':
        return IntentType.friendship;
      case 'study':
        return IntentType.study;
      case 'activity':
        return IntentType.activity;
      case 'networking':
        return IntentType.networking;
      case 'dating':
      default:
        return IntentType.dating;
    }
  }

  String get id => name;
}

class IntentConfig {
  final IntentType id;
  final String label;
  final String discoverTitle;
  final String discoverPill;
  final String description;
  final String icon;
  final Color color;
  final Color badgeBg;
  final Color badgeBorder;
  final String likeIcon;
  final String likeLabel;
  final String superLikeIcon;
  final String superLikeLabel;
  final String superLikeUnlockHint;

  const IntentConfig({
    required this.id,
    required this.label,
    required this.discoverTitle,
    required this.discoverPill,
    required this.description,
    required this.icon,
    required this.color,
    required this.badgeBg,
    required this.badgeBorder,
    required this.likeIcon,
    required this.likeLabel,
    required this.superLikeIcon,
    required this.superLikeLabel,
    required this.superLikeUnlockHint,
  });

  static const Map<IntentType, IntentConfig> all = {
    IntentType.dating: IntentConfig(
      id: IntentType.dating,
      label: 'Dating',
      discoverTitle: 'Campus Dating',
      discoverPill: 'Dating Matches',
      description: 'Find romantic connections & matches on campus',
      icon: '❤️',
      color: Color(0xFFFF4D6D),
      badgeBg: Color(0x24FF4D6D),
      badgeBorder: Color(0x59FF4D6D),
      likeIcon: '❤️',
      likeLabel: 'Like',
      superLikeIcon: '⭐',
      superLikeLabel: 'Super Like',
      superLikeUnlockHint: 'Unlocked with 4+ shared interests',
    ),
    IntentType.friendship: IntentConfig(
      id: IntentType.friendship,
      label: 'Friendship',
      discoverTitle: 'Campus Friends',
      discoverPill: 'Friends',
      description: 'Make genuine friends & expand your campus circle',
      icon: '👋',
      color: Color(0xFFFFB703),
      badgeBg: Color(0x24FFB703),
      badgeBorder: Color(0x59FFB703),
      likeIcon: '👋',
      likeLabel: 'Wave',
      superLikeIcon: '⭐',
      superLikeLabel: 'Super Wave',
      superLikeUnlockHint: 'Unlocked with 4+ shared interests',
    ),
    IntentType.study: IntentConfig(
      id: IntentType.study,
      label: 'Study',
      discoverTitle: 'Study Partners',
      discoverPill: 'Study Partners',
      description: 'Find course mates, study buddies & project partners',
      icon: '📚',
      color: Color(0xFF4CC9F0),
      badgeBg: Color(0x244CC9F0),
      badgeBorder: Color(0x594CC9F0),
      likeIcon: '📚',
      likeLabel: 'Study Partner',
      superLikeIcon: '⭐',
      superLikeLabel: 'Super Study Partner',
      superLikeUnlockHint: 'Unlocked for same course & adjacent year',
    ),
    IntentType.activity: IntentConfig(
      id: IntentType.activity,
      label: 'Activity',
      discoverTitle: 'Activity & Sports',
      discoverPill: 'Activity Partners',
      description: 'Team up for gym, badminton, football, running & hobbies',
      icon: '⚽',
      color: Color(0xFF06D6A0),
      badgeBg: Color(0x2406D6A0),
      badgeBorder: Color(0x5906D6A0),
      likeIcon: '⚽',
      likeLabel: 'Team Up',
      superLikeIcon: '⭐',
      superLikeLabel: 'Super Team Up',
      superLikeUnlockHint: 'Unlocked with 2+ shared activity tags',
    ),
    IntentType.networking: IntentConfig(
      id: IntentType.networking,
      label: 'Networking',
      discoverTitle: 'Campus Network',
      discoverPill: 'Campus Network',
      description: 'Connect across departments, build projects & career contacts',
      icon: '🤝',
      color: Color(0xFF7209B7),
      badgeBg: Color(0x2E7209B7),
      badgeBorder: Color(0x667209B7),
      likeIcon: '🤝',
      likeLabel: 'Connect',
      superLikeIcon: '⭐',
      superLikeLabel: 'Super Connect',
      superLikeUnlockHint: 'Unlocked for cross-branch or career interests',
    ),
  };

  static IntentConfig get(dynamic intent) {
    if (intent is IntentType) {
      return all[intent] ?? all[IntentType.dating]!;
    }
    if (intent is String) {
      final type = IntentType.fromString(intent);
      return all[type] ?? all[IntentType.dating]!;
    }
    return all[IntentType.dating]!;
  }
}
