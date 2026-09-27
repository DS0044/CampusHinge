import 'dart:async';
import 'package:flutter/material.dart';
import '../models/match_model.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class MatchesProvider extends ChangeNotifier {
  List<MatchItem> _matches = [];
  bool _isLoading = false;
  String _errorMessage = '';

  StreamSubscription? _msgSub;
  StreamSubscription? _notifSub;

  List<MatchItem> get matches => _matches;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;

  MatchesProvider() {
    _initSocketListeners();
  }

  void _initSocketListeners() {
    _msgSub = SocketService.onMessage.listen((msg) {
      final index = _matches.indexWhere((m) => m.id == msg.matchId);
      if (index != -1) {
        _matches[index] = _matches[index].copyWith(
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: _matches[index].unreadCount + 1,
        );
        // Move active chat to top
        final item = _matches.removeAt(index);
        _matches.insert(0, item);
        notifyListeners();
      }
    });

    _notifSub = SocketService.onNotification.listen((notif) {
      if (notif['type'] == 'match' || notif['match_id'] != null) {
        loadMatches();
      }
    });
  }

  Future<void> loadMatches() async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      _matches = await ApiService.getMatches();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _msgSub?.cancel();
    _notifSub?.cancel();
    super.dispose();
  }
}
