import 'dart:io';
import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../models/intent_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/socket_service.dart';

class AuthProvider extends ChangeNotifier {
  User? _currentUser;
  Profile? _myProfile;
  bool _isLoading = false;
  String _errorMessage = '';
  bool _isInitialized = false;

  User? get currentUser => _currentUser;
  Profile? get myProfile => _myProfile;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;
  bool get isInitialized => _isInitialized;

  bool get isAuthenticated => StorageService.hasToken();

  bool get isProfileComplete {
    if (_myProfile != null) {
      return _myProfile!.photos.length >= 2 &&
          _myProfile!.name.trim().isNotEmpty &&
          _myProfile!.branch != null;
    }
    return _currentUser?.profileCompleted == true || _currentUser?.hasProfile == true;
  }

  IntentType get activeIntent {
    if (_myProfile != null) return _myProfile!.activeIntent;
    if (_currentUser != null) return _currentUser!.activeIntent;
    return StorageService.getActiveIntent();
  }

  Future<void> init() async {
    await StorageService.init();
    _currentUser = StorageService.getUser();
    if (isAuthenticated) {
      SocketService.connect();
      await fetchMyProfile();
    }
    _isInitialized = true;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = '';
    notifyListeners();
  }

  Future<bool> signup(String email, {bool acceptedTerms = true}) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      await ApiService.signup(email.trim(), acceptedTerms: acceptedTerms);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> login(String email) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      await ApiService.login(email.trim());
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> signInWithGoogleToken(String idToken) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final res = await ApiService.googleSignIn(credential: idToken);
      if (res['data']?['user'] != null) {
        _currentUser = User.fromJson(res['data']['user']);
      }
      SocketService.connect();
      await fetchMyProfile();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> signInWithCollegeGmail(String email, {String? credential}) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final res = await ApiService.googleSignIn(
        credential: credential ?? 'college_gmail_direct',
        email: email.trim().toLowerCase(),
      );
      if (res['data']?['user'] != null) {
        _currentUser = User.fromJson(res['data']['user']);
      }
      SocketService.connect();
      await fetchMyProfile();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> verifyOtp(String email, String code) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final res = await ApiService.verifyOtp(email.trim(), code.trim());
      if (res['data']?['user'] != null) {
        _currentUser = User.fromJson(res['data']['user']);
      }
      SocketService.connect();
      await fetchMyProfile();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<int?> resendOtp(String email) async {
    try {
      final res = await ApiService.resendOtp(email.trim());
      final cooldown = res['data']?['cooldownSeconds'];
      return cooldown is num ? cooldown.toInt() : 30;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return null;
    }
  }

  Future<void> fetchMyProfile() async {
    try {
      final p = await ApiService.getMyProfile();
      if (p != null) {
        _myProfile = p;
        await StorageService.setActiveIntent(p.activeIntent);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error fetching profile: $e');
    }
  }

  Future<bool> updateProfile(Map<String, dynamic> body, {List<File> newPhotos = const []}) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      List<String> finalPhotos = List<String>.from(body['photos'] ?? _myProfile?.photos ?? []);

      if (newPhotos.isNotEmpty) {
        final uploaded = await ApiService.uploadPhotos(newPhotos);
        finalPhotos.addAll(uploaded);
      }

      body['photos'] = finalPhotos;

      final updated = await ApiService.createOrUpdateProfile(body);
      _myProfile = updated;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> updateActiveIntent(IntentType intent) async {
    if (_myProfile != null) {
      _myProfile = _myProfile!.copyWith(activeIntent: intent);
    }
    notifyListeners();

    try {
      await ApiService.updateActiveIntent(intent);
    } catch (e) {
      debugPrint('Error updating intent: $e');
    }
  }

  Future<void> logout() async {
    SocketService.disconnect();
    await StorageService.clear();
    _currentUser = null;
    _myProfile = null;
    _errorMessage = '';
    notifyListeners();
  }
}
