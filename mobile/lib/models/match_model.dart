import 'dart:convert';
import 'intent_model.dart';
import 'user_model.dart';

class MatchItem {
  final String id;
  final String user1Id;
  final String user2Id;
  final String partnerId;
  final String partnerName;
  final String? partnerPhoto;
  final List<String> partnerPhotos;
  final String? partnerBranch;
  final int? partnerYear;
  final IntentType intent;
  final bool isUnlocked;
  final String createdAt;
  final String? lastMessage;
  final String? lastMessageAt;
  final int unreadCount;
  final Profile? partnerProfile;

  MatchItem({
    required this.id,
    this.user1Id = '',
    this.user2Id = '',
    required this.partnerId,
    required this.partnerName,
    this.partnerPhoto,
    this.partnerPhotos = const [],
    this.partnerBranch,
    this.partnerYear,
    this.intent = IntentType.dating,
    this.isUnlocked = false,
    required this.createdAt,
    this.lastMessage,
    this.lastMessageAt,
    this.unreadCount = 0,
    this.partnerProfile,
  });

  factory MatchItem.fromJson(Map<String, dynamic> json) {
    final matchId = json['id']?.toString() ?? json['match_id']?.toString() ?? '';
    final partnerId = json['partner_id']?.toString() ?? json['user_id']?.toString() ?? '';
    final partnerName = json['partner_name']?.toString() ??
        json['other_user_name']?.toString() ??
        json['name']?.toString() ??
        'Match';

    List<String> photos = [];
    final rawPhotos = json['partner_photos'] ?? json['photos'];
    if (rawPhotos is List) {
      photos = rawPhotos.map((e) => e.toString()).toList();
    } else if (rawPhotos is String) {
      try {
        final decoded = jsonDecode(rawPhotos);
        if (decoded is List) photos = decoded.map((e) => e.toString()).toList();
      } catch (_) {
        if (rawPhotos.isNotEmpty) photos = [rawPhotos];
      }
    }

    String? singlePhoto = json['partner_photo']?.toString();
    if (singlePhoto == null || singlePhoto.isEmpty) {
      if (photos.isNotEmpty) singlePhoto = photos.first;
    }

    String? lastMsg;
    if (json['last_message'] != null) {
      if (json['last_message'] is Map) {
        lastMsg = json['last_message']['content']?.toString();
      } else {
        lastMsg = json['last_message'].toString();
      }
    } else if (json['lastMessage'] != null) {
      if (json['lastMessage'] is Map) {
        lastMsg = json['lastMessage']['content']?.toString();
      } else {
        lastMsg = json['lastMessage'].toString();
      }
    }

    return MatchItem(
      id: matchId,
      user1Id: json['user1_id']?.toString() ?? '',
      user2Id: json['user2_id']?.toString() ?? '',
      partnerId: partnerId,
      partnerName: partnerName,
      partnerPhoto: singlePhoto,
      partnerPhotos: photos,
      partnerBranch: json['branch']?.toString() ?? json['partner_branch']?.toString(),
      partnerYear: json['year'] is num
          ? (json['year'] as num).toInt()
          : int.tryParse(json['year']?.toString() ?? ''),
      intent: IntentType.fromString(json['intent']?.toString()),
      isUnlocked: json['is_unlocked'] == 1 || json['is_unlocked'] == true,
      createdAt: json['created_at']?.toString() ?? '',
      lastMessage: lastMsg,
      lastMessageAt: json['last_message_at']?.toString(),
      unreadCount: (json['unread_count'] is num) ? (json['unread_count'] as num).toInt() : 0,
      partnerProfile: json['partner'] != null ? Profile.fromJson(json['partner']) : null,
    );
  }

  MatchItem copyWith({
    String? lastMessage,
    String? lastMessageAt,
    int? unreadCount,
    bool? isUnlocked,
  }) {
    return MatchItem(
      id: id,
      user1Id: user1Id,
      user2Id: user2Id,
      partnerId: partnerId,
      partnerName: partnerName,
      partnerPhoto: partnerPhoto,
      partnerPhotos: partnerPhotos,
      partnerBranch: partnerBranch,
      partnerYear: partnerYear,
      intent: intent,
      isUnlocked: isUnlocked ?? this.isUnlocked,
      createdAt: createdAt,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      unreadCount: unreadCount ?? this.unreadCount,
      partnerProfile: partnerProfile,
    );
  }
}
