import 'user_model.dart';
import 'intent_model.dart';

enum SwipeAction {
  like,
  pass,
  superLike;

  String toApiString() {
    switch (this) {
      case SwipeAction.like:
        return 'like';
      case SwipeAction.pass:
        return 'pass';
      case SwipeAction.superLike:
        return 'super_like';
    }
  }
}

class CompatibilityBreakdown {
  final double interest;
  final double behavioral;
  final double freshness;

  CompatibilityBreakdown({
    this.interest = 0,
    this.behavioral = 0,
    this.freshness = 0,
  });

  factory CompatibilityBreakdown.fromJson(Map<String, dynamic>? json) {
    if (json == null) return CompatibilityBreakdown();
    return CompatibilityBreakdown(
      interest: (json['interest'] is num) ? (json['interest'] as num).toDouble() : 0.0,
      behavioral: (json['behavioral'] is num) ? (json['behavioral'] as num).toDouble() : 0.0,
      freshness: (json['freshness'] is num) ? (json['freshness'] as num).toDouble() : 0.0,
    );
  }
}

class DiscoverProfile {
  final Profile profile;
  final double? compatibilityScore;
  final CompatibilityBreakdown? compatibilityBreakdown;
  final List<String> sharedInterests;
  final List<String> sharedActivityTags;
  final double? intentScore;
  final bool isFallback;
  final bool canSuperLike;
  final String? superLikeReason;

  DiscoverProfile({
    required this.profile,
    this.compatibilityScore,
    this.compatibilityBreakdown,
    this.sharedInterests = const [],
    this.sharedActivityTags = const [],
    this.intentScore,
    this.isFallback = false,
    this.canSuperLike = false,
    this.superLikeReason,
  });

  factory DiscoverProfile.fromJson(Map<String, dynamic> json) {
    final profile = Profile.fromJson(json);

    List<String> parseList(dynamic val) {
      if (val == null) return [];
      if (val is List) return val.map((e) => e.toString()).toList();
      return [];
    }

    return DiscoverProfile(
      profile: profile,
      compatibilityScore: (json['compatibility_score'] is num)
          ? (json['compatibility_score'] as num).toDouble()
          : null,
      compatibilityBreakdown: json['compatibility_breakdown'] is Map<String, dynamic>
          ? CompatibilityBreakdown.fromJson(json['compatibility_breakdown'])
          : null,
      sharedInterests: parseList(json['shared_interests']),
      sharedActivityTags: parseList(json['shared_activity_tags']),
      intentScore: (json['intent_score'] is num)
          ? (json['intent_score'] as num).toDouble()
          : null,
      isFallback: json['is_fallback'] == true,
      canSuperLike: json['can_super_like'] == true,
      superLikeReason: json['super_like_reason']?.toString(),
    );
  }
}

class SuperLikeStatus {
  final bool available;
  final int nextAvailableInSeconds;
  final String? lastSuperLikeAt;

  SuperLikeStatus({
    this.available = true,
    this.nextAvailableInSeconds = 0,
    this.lastSuperLikeAt,
  });

  factory SuperLikeStatus.fromJson(Map<String, dynamic>? json) {
    if (json == null) return SuperLikeStatus();
    return SuperLikeStatus(
      available: json['available'] == true,
      nextAvailableInSeconds: (json['next_available_in_seconds'] is num)
          ? (json['next_available_in_seconds'] as num).toInt()
          : 0,
      lastSuperLikeAt: json['last_super_like_at']?.toString(),
    );
  }

  SuperLikeStatus copyWith({
    bool? available,
    int? nextAvailableInSeconds,
    String? lastSuperLikeAt,
  }) {
    return SuperLikeStatus(
      available: available ?? this.available,
      nextAvailableInSeconds: nextAvailableInSeconds ?? this.nextAvailableInSeconds,
      lastSuperLikeAt: lastSuperLikeAt ?? this.lastSuperLikeAt,
    );
  }
}

class SwipeResult {
  final bool matched;
  final String? matchId;
  final SwipeAction? action;
  final IntentType? intent;
  final bool superLiked;
  final Profile? partner;

  SwipeResult({
    this.matched = false,
    this.matchId,
    this.action,
    this.intent,
    this.superLiked = false,
    this.partner,
  });

  factory SwipeResult.fromJson(Map<String, dynamic> json) {
    return SwipeResult(
      matched: json['matched'] == true,
      matchId: json['match_id']?.toString(),
      superLiked: json['super_liked'] == true,
      intent: json['intent'] != null ? IntentType.fromString(json['intent'].toString()) : null,
      partner: json['partner'] != null ? Profile.fromJson(json['partner']) : null,
    );
  }
}
