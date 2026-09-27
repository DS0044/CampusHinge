import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config/api_config.dart';
import '../models/user_model.dart';
import '../models/intent_model.dart';
import '../models/deck_model.dart';
import '../models/match_model.dart';
import '../models/message_model.dart';
import '../models/notification_model.dart';
import 'storage_service.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final int? retryAfter;

  ApiException(this.message, {this.statusCode, this.retryAfter});

  @override
  String toString() => message;
}

class ApiService {
  static Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    final token = StorageService.getToken();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  static dynamic _handleResponse(http.Response res) {
    dynamic body;
    try {
      body = jsonDecode(res.body);
    } catch (_) {
      body = {'error': {'message': 'Server returned non-JSON response (${res.statusCode})'}};
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body;
    }

    if (res.statusCode == 401) {
      StorageService.clear();
    }

    final errorMsg = body is Map && body['error'] != null
        ? (body['error']['message'] ?? 'An error occurred')
        : (body is Map && body['message'] != null ? body['message'] : 'Request failed (${res.statusCode})');

    final retryAfter = body is Map && body['error'] is Map ? body['error']['retryAfter'] : null;

    throw ApiException(
      errorMsg.toString(),
      statusCode: res.statusCode,
      retryAfter: retryAfter is num ? retryAfter.toInt() : null,
    );
  }

  // ══════════════════════════════════════════════
  // AUTH ENDPOINTS
  // ══════════════════════════════════════════════

  static Future<Map<String, dynamic>> signup(String email, {bool acceptedTerms = true}) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/auth/signup');
    final res = await http.post(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode({'email': email, 'accepted_terms': acceptedTerms}),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> login(String email) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/auth/login');
    final res = await http.post(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode({'email': email}),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> verifyOtp(String email, String code) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/auth/verify-otp');
    final res = await http.post(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode({'email': email, 'code': code}),
    );
    final data = _handleResponse(res);
    if (data['data'] != null && data['data']['token'] != null) {
      final token = data['data']['token'].toString();
      await StorageService.setToken(token);
      if (data['data']['user'] != null) {
        final user = User.fromJson(data['data']['user']);
        await StorageService.setUser(user);
        await StorageService.setActiveIntent(user.activeIntent);
      }
    }
    return data;
  }

  static Future<Map<String, dynamic>> resendOtp(String email) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/auth/resend-otp');
    final res = await http.post(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode({'email': email}),
    );
    return _handleResponse(res);
  }

  static Future<Map<String, dynamic>> googleSignIn({
    String? credential,
    String? email,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/auth/google');
    final payload = <String, dynamic>{};
    if (credential != null && credential.isNotEmpty) {
      payload['credential'] = credential;
    }
    if (email != null && email.isNotEmpty) {
      payload['email'] = email.trim().toLowerCase();
    }
    final res = await http.post(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode(payload),
    );
    final data = _handleResponse(res);
    if (data['data'] != null && data['data']['token'] != null) {
      final token = data['data']['token'].toString();
      await StorageService.setToken(token);
      if (data['data']['user'] != null) {
        final user = User.fromJson(data['data']['user']);
        await StorageService.setUser(user);
        await StorageService.setActiveIntent(user.activeIntent);
      }
    }
    return data;
  }

  // ══════════════════════════════════════════════
  // PROFILE ENDPOINTS
  // ══════════════════════════════════════════════

  static Future<Profile?> getMyProfile() async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/profile');
    final res = await http.get(uri, headers: _buildHeaders());
    final data = _handleResponse(res);
    final profileData = data['data'] != null
        ? (data['data']['profile'] ?? data['data'])
        : null;
    if (profileData == null) return null;
    return Profile.fromJson(profileData);
  }

  static Future<Profile> createOrUpdateProfile(Map<String, dynamic> body) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/profile');
    final res = await http.post(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode(body),
    );
    final data = _handleResponse(res);
    final profileData = data['data'] ?? data;
    return Profile.fromJson(profileData);
  }

  static Future<Profile> getProfileById(String userId) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/profile/$userId');
    final res = await http.get(uri, headers: _buildHeaders());
    final data = _handleResponse(res);
    return Profile.fromJson(data['data'] ?? data);
  }

  static Future<void> updateActiveIntent(IntentType intent) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/profile/intent');
    final res = await http.patch(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode({'active_intent': intent.id}),
    );
    _handleResponse(res);
    await StorageService.setActiveIntent(intent);
  }

  static Future<List<String>> uploadPhotos(List<File> files) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/profile/upload');
    final request = http.MultipartRequest('POST', uri);

    final token = StorageService.getToken();
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    for (final file in files) {
      final ext = file.path.split('.').last.toLowerCase();
      final mimeType = ext == 'png'
          ? 'image/png'
          : ext == 'webp'
              ? 'image/webp'
              : 'image/jpeg';

      final multipartFile = await http.MultipartFile.fromPath(
        'photos',
        file.path,
        contentType: MediaType.parse(mimeType),
      );
      request.files.add(multipartFile);
    }

    final streamedRes = await request.send();
    final res = await http.Response.fromStream(streamedRes);
    final data = _handleResponse(res);

    if (data['data'] != null) {
      if (data['data']['urls'] is List) {
        return (data['data']['urls'] as List).map((e) => e.toString()).toList();
      }
      if (data['data']['url'] != null) {
        return [data['data']['url'].toString()];
      }
    }
    return [];
  }

  // ══════════════════════════════════════════════
  // DISCOVER & SWIPE ENDPOINTS
  // ══════════════════════════════════════════════

  static Future<Map<String, dynamic>> getDiscoverDeck([IntentType? intent]) async {
    final query = intent != null ? '?intent=${intent.id}' : '';
    final uri = Uri.parse('${ApiConfig.baseUrl}/discover$query');
    final res = await http.get(uri, headers: _buildHeaders());
    final data = _handleResponse(res);

    final payload = data['data'] ?? data;
    final List<DiscoverProfile> profiles = [];

    final rawList = payload['profiles'] ?? payload;
    if (rawList is List) {
      for (final item in rawList) {
        if (item is Map<String, dynamic>) {
          profiles.add(DiscoverProfile.fromJson(item));
        }
      }
    }

    SuperLikeStatus superLikeStatus = SuperLikeStatus();
    if (payload['super_like'] is Map<String, dynamic>) {
      superLikeStatus = SuperLikeStatus.fromJson(payload['super_like']);
    }

    return {
      'profiles': profiles,
      'active_intent': payload['active_intent'],
      'super_like': superLikeStatus,
      'remaining_swipes': payload['remaining_swipes'],
    };
  }

  static Future<SwipeResult> recordSwipe({
    required String swipedId,
    required SwipeAction action,
    IntentType? intent,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/swipe');
    final res = await http.post(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode({
        'swiped_id': swipedId,
        'action': action.toApiString(),
        if (intent != null) 'intent': intent.id,
      }),
    );
    final data = _handleResponse(res);
    return SwipeResult.fromJson(data['data'] ?? data);
  }

  // ══════════════════════════════════════════════
  // MATCHES & MESSAGES ENDPOINTS
  // ══════════════════════════════════════════════

  static Future<List<MatchItem>> getMatches() async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/matches');
    final res = await http.get(uri, headers: _buildHeaders());
    final data = _handleResponse(res);

    final payload = data['data'] ?? data;
    final List<MatchItem> matches = [];

    final rawList = payload is Map && payload['matches'] is List
        ? payload['matches']
        : (payload is List ? payload : []);

    for (final item in rawList) {
      if (item is Map<String, dynamic>) {
        matches.add(MatchItem.fromJson(item));
      }
    }
    return matches;
  }

  static Future<Map<String, dynamic>> getMessages(String matchId) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/messages/$matchId');
    final res = await http.get(uri, headers: _buildHeaders());
    final data = _handleResponse(res);

    final payload = data['data'] ?? data;
    final List<ChatMessage> messages = [];

    if (payload['messages'] is List) {
      for (final item in payload['messages']) {
        if (item is Map<String, dynamic>) {
          messages.add(ChatMessage.fromJson(item));
        }
      }
    }

    Profile? partner;
    if (payload['partner'] is Map<String, dynamic>) {
      partner = Profile.fromJson(payload['partner']);
    }

    return {
      'messages': messages,
      'partner': partner,
      'match': payload['match'],
    };
  }

  static Future<ChatMessage> sendMessage(String matchId, String content) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/messages/$matchId');
    final res = await http.post(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode({'content': content}),
    );
    final data = _handleResponse(res);
    final msgData = data['data'] != null ? data['data']['message'] ?? data['data'] : data;
    return ChatMessage.fromJson(msgData);
  }

  // ══════════════════════════════════════════════
  // NOTIFICATIONS ENDPOINTS
  // ══════════════════════════════════════════════

  static Future<List<AppNotification>> getNotifications() async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/notifications');
    final res = await http.get(uri, headers: _buildHeaders());
    final data = _handleResponse(res);

    final payload = data['data'] ?? data;
    final List<AppNotification> notifs = [];

    final rawList = payload is Map && payload['notifications'] is List
        ? payload['notifications']
        : (payload is List ? payload : []);

    for (final item in rawList) {
      if (item is Map<String, dynamic>) {
        notifs.add(AppNotification.fromJson(item));
      }
    }
    return notifs;
  }

  static Future<int> getUnreadNotificationCount() async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/notifications/unread-count');
    final res = await http.get(uri, headers: _buildHeaders());
    final data = _handleResponse(res);
    final count = data['data'] != null ? data['data']['unread_count'] : 0;
    return (count is num) ? count.toInt() : 0;
  }

  static Future<Profile> getGatedProfile(String targetUserId) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/notifications/gated-profile/$targetUserId');
    final res = await http.get(uri, headers: _buildHeaders());
    final data = _handleResponse(res);
    return Profile.fromJson(data['data'] ?? data);
  }

  static Future<void> markNotificationAsRead(String id) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/notifications/$id/read');
    await http.patch(uri, headers: _buildHeaders());
  }

  static Future<void> markAllNotificationsAsRead() async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/notifications/read-all');
    await http.patch(uri, headers: _buildHeaders());
  }

  // ══════════════════════════════════════════════
  // REPORT & BLOCK
  // ══════════════════════════════════════════════

  static Future<void> reportUser(String reportedId, String reason) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/report');
    final res = await http.post(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode({'reported_id': reportedId, 'reason': reason}),
    );
    _handleResponse(res);
  }

  static Future<void> blockUser(String blockedId) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/block');
    final res = await http.post(
      uri,
      headers: _buildHeaders(),
      body: jsonEncode({'blocked_id': blockedId}),
    );
    _handleResponse(res);
  }
}
