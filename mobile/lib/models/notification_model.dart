import 'dart:convert';
import 'package:intl/intl.dart';

class AppNotification {
  final String id;
  final String fromUserId;
  final String fromUserName;
  final String? fromUserPhoto;
  final String? realName;
  final String type; // 'like', 'message', 'match'
  final bool isRead;
  final bool isSeen;
  final bool isMatched;
  final String? matchId;
  final String createdAt;
  final List<String> sharedInterests;
  final int sharedCount;

  AppNotification({
    required this.id,
    required this.fromUserId,
    required this.fromUserName,
    this.fromUserPhoto,
    this.realName,
    required this.type,
    this.isRead = false,
    this.isSeen = false,
    this.isMatched = false,
    this.matchId,
    required this.createdAt,
    this.sharedInterests = const [],
    this.sharedCount = 0,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    List<String> parseList(dynamic val) {
      if (val == null) return [];
      if (val is List) return val.map((e) => e.toString()).toList();
      if (val is String) {
        try {
          final decoded = jsonDecode(val);
          if (decoded is List) return decoded.map((e) => e.toString()).toList();
        } catch (_) {}
      }
      return [];
    }

    final meta = json['metadata'] is Map<String, dynamic> ? json['metadata'] : {};

    return AppNotification(
      id: json['id']?.toString() ?? '',
      fromUserId: json['from_user_id']?.toString() ?? '',
      fromUserName: json['from_user_name']?.toString() ?? 'Someone',
      fromUserPhoto: json['from_user_photo']?.toString(),
      realName: json['real_name']?.toString(),
      type: json['type']?.toString() ?? 'like',
      isRead: json['is_read'] == 1 || json['is_read'] == true,
      isSeen: json['is_seen'] == 1 || json['is_seen'] == true,
      isMatched: json['is_matched'] == 1 || json['is_matched'] == true,
      matchId: json['match_id']?.toString(),
      createdAt: json['created_at']?.toString() ?? '',
      sharedInterests: parseList(json['shared_interests'] ?? meta['shared_interests']),
      sharedCount: (json['shared_interests_count'] is num)
          ? (json['shared_interests_count'] as num).toInt()
          : (meta['shared_count'] is num)
              ? (meta['shared_count'] as num).toInt()
              : 0,
    );
  }

  String get formattedTime {
    if (createdAt.isEmpty) return '';
    try {
      var str = createdAt.trim();
      if (!str.endsWith('Z') && !RegExp(r'[+-]\d{2}:?\d{2}$').hasMatch(str)) {
        str = '${str.replaceAll(' ', 'T')}Z';
      }
      final date = DateTime.parse(str).toLocal();
      final now = DateTime.now();
      final diff = now.difference(date);

      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return DateFormat('MMM d').format(date);
    } catch (_) {
      return '';
    }
  }

  AppNotification copyWith({
    bool? isRead,
    bool? isSeen,
    bool? isMatched,
    String? matchId,
    String? fromUserName,
  }) {
    return AppNotification(
      id: id,
      fromUserId: fromUserId,
      fromUserName: fromUserName ?? this.fromUserName,
      fromUserPhoto: fromUserPhoto,
      realName: realName,
      type: type,
      isRead: isRead ?? this.isRead,
      isSeen: isSeen ?? this.isSeen,
      isMatched: isMatched ?? this.isMatched,
      matchId: matchId ?? this.matchId,
      createdAt: createdAt,
      sharedInterests: sharedInterests,
      sharedCount: sharedCount,
    );
  }
}
