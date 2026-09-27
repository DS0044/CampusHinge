import 'dart:async';
import 'package:flutter/material.dart';
import '../models/deck_model.dart';
import '../models/intent_model.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';

class DiscoverProvider extends ChangeNotifier {
  List<DiscoverProfile> _deck = [];
  bool _isLoading = false;
  bool _isFetchingMore = false;
  bool _hasMore = true;
  String _errorMessage = '';
  IntentType _activeIntent = IntentType.dating;

  SuperLikeStatus _superLikeStatus = SuperLikeStatus();
  Timer? _cooldownTimer;

  // New match celebration popup
  Profile? _matchedPartner;
  String? _newMatchId;

  List<DiscoverProfile> get deck => _deck;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;
  IntentType get activeIntent => _activeIntent;
  SuperLikeStatus get superLikeStatus => _superLikeStatus;
  Profile? get matchedPartner => _matchedPartner;
  String? get newMatchId => _newMatchId;

  DiscoverProfile? get topProfile => _deck.isNotEmpty ? _deck.first : null;

  void clearMatchCelebration() {
    _matchedPartner = null;
    _newMatchId = null;
    notifyListeners();
  }

  void setIntent(IntentType intent) {
    if (_activeIntent == intent) return;
    _activeIntent = intent;
    _deck.clear();
    _hasMore = true;
    notifyListeners();
    loadDeck();
  }

  Future<void> loadDeck() async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final res = await ApiService.getDiscoverDeck(_activeIntent);
      _deck = List<DiscoverProfile>.from(res['profiles'] ?? []);
      _superLikeStatus = res['super_like'] ?? SuperLikeStatus();
      _startCooldownTimerIfNeeded();
      _hasMore = _deck.isNotEmpty;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _fetchMoreIfNeeded() async {
    if (_deck.length > 3 || _isFetchingMore || !_hasMore) return;
    _isFetchingMore = true;

    try {
      final res = await ApiService.getDiscoverDeck(_activeIntent);
      final List<DiscoverProfile> incoming = List<DiscoverProfile>.from(res['profiles'] ?? []);

      if (incoming.isEmpty) {
        _hasMore = false;
      } else {
        final existingIds = _deck.map((p) => p.profile.userId).toSet();
        final fresh = incoming.where((p) => !existingIds.contains(p.profile.userId)).toList();
        if (fresh.isEmpty) {
          _hasMore = false;
        } else {
          _deck.addAll(fresh);
        }
      }
    } catch (_) {} finally {
      _isFetchingMore = false;
      notifyListeners();
    }
  }

  Future<SwipeResult?> swipe(SwipeAction action) async {
    if (_deck.isEmpty) return null;

    final target = _deck.removeAt(0);
    notifyListeners();

    // Trigger preloading in background
    _fetchMoreIfNeeded();

    try {
      final result = await ApiService.recordSwipe(
        swipedId: target.profile.userId,
        action: action,
        intent: _activeIntent,
      );

      if (action == SwipeAction.superLike) {
        _superLikeStatus = SuperLikeStatus(
          available: false,
          nextAvailableInSeconds: 24 * 3600,
          lastSuperLikeAt: DateTime.now().toIso8601String(),
        );
        _startCooldownTimerIfNeeded();
      }

      if (result.matched) {
        _matchedPartner = result.partner ?? target.profile;
        _newMatchId = result.matchId;
        notifyListeners();
      }

      return result;
    } catch (e) {
      debugPrint('Error recording swipe: $e');
      return null;
    }
  }

  void _startCooldownTimerIfNeeded() {
    _cooldownTimer?.cancel();
    if (_superLikeStatus.available || _superLikeStatus.nextAvailableInSeconds <= 0) return;

    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_superLikeStatus.nextAvailableInSeconds <= 1) {
        _superLikeStatus = _superLikeStatus.copyWith(
          available: true,
          nextAvailableInSeconds: 0,
        );
        timer.cancel();
        notifyListeners();
      } else {
        _superLikeStatus = _superLikeStatus.copyWith(
          nextAvailableInSeconds: _superLikeStatus.nextAvailableInSeconds - 1,
        );
        notifyListeners();
      }
    });
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    super.dispose();
  }
}
