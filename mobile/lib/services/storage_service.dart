import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../models/intent_model.dart';

class StorageService {
  static const String _keyToken = 'auth_token';
  static const String _keyUser = 'cached_user';
  static const String _keyIntent = 'active_intent';

  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  static Future<void> setToken(String token) async {
    await init();
    await _prefs?.setString(_keyToken, token);
  }

  static String? getToken() {
    return _prefs?.getString(_keyToken);
  }

  static bool hasToken() {
    final t = getToken();
    return t != null && t.isNotEmpty;
  }

  static Future<void> setUser(User user) async {
    await init();
    await _prefs?.setString(_keyUser, jsonEncode(user.toJson()));
  }

  static User? getUser() {
    final raw = _prefs?.getString(_keyUser);
    if (raw == null) return null;
    try {
      return User.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  static Future<void> setActiveIntent(IntentType intent) async {
    await init();
    await _prefs?.setString(_keyIntent, intent.id);
  }

  static IntentType getActiveIntent() {
    final id = _prefs?.getString(_keyIntent);
    return IntentType.fromString(id);
  }

  static Future<void> clear() async {
    await init();
    await _prefs?.remove(_keyToken);
    await _prefs?.remove(_keyUser);
    await _prefs?.remove(_keyIntent);
  }
}
