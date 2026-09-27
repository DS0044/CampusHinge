import 'package:intl/intl.dart';

enum MessageStatus { sending, sent, failed }

class ChatMessage {
  final String id;
  final String matchId;
  final String senderId;
  final String content;
  final String createdAt;
  final MessageStatus status;

  ChatMessage({
    required this.id,
    required this.matchId,
    required this.senderId,
    required this.content,
    required this.createdAt,
    this.status = MessageStatus.sent,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id']?.toString() ?? '',
      matchId: json['match_id']?.toString() ?? '',
      senderId: json['sender_id']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      createdAt: json['created_at']?.toString() ?? '',
      status: MessageStatus.sent,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'match_id': matchId,
      'sender_id': senderId,
      'content': content,
      'created_at': createdAt,
    };
  }

  String get formattedTime {
    if (createdAt.isEmpty) return '';
    try {
      var str = createdAt.trim();
      if (!str.endsWith('Z') && !RegExp(r'[+-]\d{2}:?\d{2}$').hasMatch(str)) {
        str = '${str.replaceAll(' ', 'T')}Z';
      }
      final date = DateTime.parse(str).toLocal();
      return DateFormat('h:mm a').format(date);
    } catch (_) {
      return '';
    }
  }

  ChatMessage copyWith({
    String? id,
    String? matchId,
    String? senderId,
    String? content,
    String? createdAt,
    MessageStatus? status,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      matchId: matchId ?? this.matchId,
      senderId: senderId ?? this.senderId,
      content: content ?? this.content,
      createdAt: createdAt ?? this.createdAt,
      status: status ?? this.status,
    );
  }
}
