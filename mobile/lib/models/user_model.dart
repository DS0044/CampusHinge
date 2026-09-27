import 'dart:convert';
import 'intent_model.dart';

enum Gender {
  male,
  female,
  nonBinary;

  static Gender fromString(String? val) {
    switch (val?.toLowerCase()) {
      case 'female':
        return Gender.female;
      case 'non_binary':
      case 'nonbinary':
        return Gender.nonBinary;
      case 'male':
      default:
        return Gender.male;
    }
  }

  String toApiString() {
    switch (this) {
      case Gender.female:
        return 'female';
      case Gender.nonBinary:
        return 'non_binary';
      case Gender.male:
        return 'male';
    }
  }

  String get label {
    switch (this) {
      case Gender.female:
        return 'Female';
      case Gender.nonBinary:
        return 'Non-binary';
      case Gender.male:
        return 'Male';
    }
  }
}

enum InterestedIn {
  male,
  female,
  everyone;

  static InterestedIn fromString(String? val) {
    switch (val?.toLowerCase()) {
      case 'male':
        return InterestedIn.male;
      case 'female':
        return InterestedIn.female;
      case 'everyone':
      default:
        return InterestedIn.everyone;
    }
  }

  String toApiString() {
    switch (this) {
      case InterestedIn.male:
        return 'male';
      case InterestedIn.female:
        return 'female';
      case InterestedIn.everyone:
        return 'everyone';
    }
  }

  String get label {
    switch (this) {
      case InterestedIn.male:
        return 'Male';
      case InterestedIn.female:
        return 'Female';
      case InterestedIn.everyone:
        return 'Everyone';
    }
  }
}

class User {
  final String id;
  final String email;
  final String role;
  final String subscriptionStatus;
  final String? subscriptionExpiry;
  final bool isBanned;
  final bool emailNotifications;
  final bool profileCompleted;
  final bool hasProfile;
  final IntentType activeIntent;
  final String? lastActive;
  final String? acceptedTermsAt;
  final String? termsVersion;

  User({
    required this.id,
    required this.email,
    this.role = 'user',
    this.subscriptionStatus = 'free',
    this.subscriptionExpiry,
    this.isBanned = false,
    this.emailNotifications = true,
    this.profileCompleted = false,
    this.hasProfile = false,
    this.activeIntent = IntentType.dating,
    this.lastActive,
    this.acceptedTermsAt,
    this.termsVersion,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? 'user',
      subscriptionStatus: json['subscription_status']?.toString() ?? 'free',
      subscriptionExpiry: json['subscription_expiry']?.toString(),
      isBanned: json['is_banned'] == 1 || json['is_banned'] == true,
      emailNotifications: json['email_notifications'] == 1 || json['email_notifications'] == true,
      profileCompleted: json['profile_completed'] == 1 || json['profile_completed'] == true,
      hasProfile: json['has_profile'] == true || (json['profile_completed'] == 1 || json['profile_completed'] == true),
      activeIntent: IntentType.fromString(json['active_intent']?.toString()),
      lastActive: json['last_active']?.toString(),
      acceptedTermsAt: json['accepted_terms_at']?.toString(),
      termsVersion: json['terms_version']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'role': role,
      'subscription_status': subscriptionStatus,
      'subscription_expiry': subscriptionExpiry,
      'is_banned': isBanned ? 1 : 0,
      'email_notifications': emailNotifications ? 1 : 0,
      'profile_completed': profileCompleted ? 1 : 0,
      'has_profile': hasProfile,
      'active_intent': activeIntent.id,
      'last_active': lastActive,
      'accepted_terms_at': acceptedTermsAt,
      'terms_version': termsVersion,
    };
  }
}

class Profile {
  final String? id;
  final String userId;
  final String name;
  final String? bio;
  final List<String> photos;
  final String? branch;
  final int? year;
  final Gender gender;
  final InterestedIn interestedIn;
  final List<String> interests;
  final List<String> activityTags;
  final IntentType activeIntent;
  final int? age;
  final bool emailNotifications;
  final double? score;
  final bool isLooped;
  final bool profileCompleted;
  final bool hasProfile;

  Profile({
    this.id,
    required this.userId,
    required this.name,
    this.bio,
    this.photos = const [],
    this.branch,
    this.year,
    this.gender = Gender.male,
    this.interestedIn = InterestedIn.everyone,
    this.interests = const [],
    this.activityTags = const [],
    this.activeIntent = IntentType.dating,
    this.age,
    this.emailNotifications = true,
    this.score,
    this.isLooped = false,
    this.profileCompleted = false,
    this.hasProfile = false,
  });

  factory Profile.fromJson(Map<String, dynamic> json) {
    List<String> parseStringList(dynamic val) {
      if (val == null) return [];
      if (val is List) {
        return val.map((e) => e.toString().trim()).where((e) => e.isNotEmpty).toList();
      }
      if (val is String) {
        try {
          final decoded = jsonDecode(val);
          if (decoded is List) {
            return decoded.map((e) => e.toString().trim()).where((e) => e.isNotEmpty).toList();
          }
        } catch (_) {}
      }
      return [];
    }

    return Profile(
      id: json['id']?.toString(),
      userId: json['user_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      bio: json['bio']?.toString(),
      photos: parseStringList(json['photos']),
      branch: json['branch']?.toString(),
      year: json['year'] is num ? (json['year'] as num).toInt() : int.tryParse(json['year']?.toString() ?? ''),
      gender: Gender.fromString(json['gender']?.toString()),
      interestedIn: InterestedIn.fromString(json['interested_in']?.toString()),
      interests: parseStringList(json['interests']),
      activityTags: parseStringList(json['activity_tags']),
      activeIntent: IntentType.fromString(json['active_intent']?.toString()),
      age: json['age'] is num ? (json['age'] as num).toInt() : int.tryParse(json['age']?.toString() ?? ''),
      emailNotifications: json['email_notifications'] == 1 || json['email_notifications'] == true,
      score: (json['score'] is num) ? (json['score'] as num).toDouble() : null,
      isLooped: json['is_looped'] == 1 || json['is_looped'] == true,
      profileCompleted: json['profile_completed'] == 1 || json['profile_completed'] == true,
      hasProfile: json['has_profile'] == true || (json['profile_completed'] == 1 || json['profile_completed'] == true),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'user_id': userId,
      'name': name,
      'bio': bio,
      'photos': photos,
      'branch': branch,
      'year': year,
      'gender': gender.toApiString(),
      'interested_in': interestedIn.toApiString(),
      'interests': interests,
      'activity_tags': activityTags,
      'active_intent': activeIntent.id,
      'email_notifications': emailNotifications,
    };
  }

  Profile copyWith({
    String? id,
    String? userId,
    String? name,
    String? bio,
    List<String>? photos,
    String? branch,
    int? year,
    Gender? gender,
    InterestedIn? interestedIn,
    List<String>? interests,
    List<String>? activityTags,
    IntentType? activeIntent,
    int? age,
    bool? emailNotifications,
    double? score,
    bool? isLooped,
    bool? profileCompleted,
    bool? hasProfile,
  }) {
    return Profile(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      bio: bio ?? this.bio,
      photos: photos ?? this.photos,
      branch: branch ?? this.branch,
      year: year ?? this.year,
      gender: gender ?? this.gender,
      interestedIn: interestedIn ?? this.interestedIn,
      interests: interests ?? this.interests,
      activityTags: activityTags ?? this.activityTags,
      activeIntent: activeIntent ?? this.activeIntent,
      age: age ?? this.age,
      emailNotifications: emailNotifications ?? this.emailNotifications,
      score: score ?? this.score,
      isLooped: isLooped ?? this.isLooped,
      profileCompleted: profileCompleted ?? this.profileCompleted,
      hasProfile: hasProfile ?? this.hasProfile,
    );
  }
}
