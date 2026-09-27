import 'dart:async';
import 'package:flutter/material.dart';
import '../models/message_model.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/storage_service.dart';

class ChatProvider extends ChangeNotifier {
  String? _currentMatchId;
  Profile? _partnerProfile;
  List<ChatMessage> _messages = [];
  bool _isLoading = false;
  bool _isPartnerTyping = false;
  String _errorMessage = '';

  Timer? _typingDebounce;
  Timer? _partnerTypingTimer;
  StreamSubscription? _msgSub;
  StreamSubscription? _typingSub;
  StreamSubscription? _stopTypingSub;

  String? get currentMatchId => _currentMatchId;
  Profile? get partnerProfile => _partnerProfile;
  List<ChatMessage> get messages => _messages;
  bool get isLoading => _isLoading;
  bool get isPartnerTyping => _isPartnerTyping;
  String get errorMessage => _errorMessage;

  String get currentUserId {
    return StorageService.getUser()?.id ?? '';
  }

  void openChat(String matchId, {Profile? initialPartner}) {
    _currentMatchId = matchId;
    _partnerProfile = initialPartner;
    _messages.clear();
    _isPartnerTyping = false;

    SocketService.joinMatch(matchId);
    _listenToSocket(matchId);
    loadMessages(matchId);
  }

  void closeChat() {
    if (_currentMatchId != null) {
      SocketService.leaveMatch(_currentMatchId!);
    }
    _msgSub?.cancel();
    _typingSub?.cancel();
    _stopTypingSub?.cancel();
    _typingDebounce?.cancel();
    _partnerTypingTimer?.cancel();
    _currentMatchId = null;
    _partnerProfile = null;
    _messages.clear();
    _isPartnerTyping = false;
  }

  void _listenToSocket(String matchId) {
    _msgSub?.cancel();
    _typingSub?.cancel();
    _stopTypingSub?.cancel();

    _msgSub = SocketService.onMessage.listen((msg) {
      if (msg.matchId == matchId) {
        // Prevent duplicate if already added optimistically
        final exists = _messages.any((m) => m.id == msg.id);
        if (!exists) {
          _messages.add(msg);
          _isPartnerTyping = false;
          notifyListeners();
        }
      }
    });

    _typingSub = SocketService.onTyping.listen((payload) {
      if (payload['matchId'] == matchId && payload['userId'] != currentUserId) {
        _isPartnerTyping = true;
        notifyListeners();

        _partnerTypingTimer?.cancel();
        _partnerTypingTimer = Timer(const Duration(seconds: 4), () {
          _isPartnerTyping = false;
          notifyListeners();
        });
      }
    });

    _stopTypingSub = SocketService.onStopTyping.listen((payload) {
      if (payload['matchId'] == matchId && payload['userId'] != currentUserId) {
        _isPartnerTyping = false;
        notifyListeners();
      }
    });
  }

  Future<void> loadMessages(String matchId) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final res = await ApiService.getMessages(matchId);
      _messages = List<ChatMessage>.from(res['messages'] ?? []);
      if (res['partner'] != null) {
        _partnerProfile = res['partner'];
      }
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  void onUserTyping() {
    if (_currentMatchId == null) return;
    SocketService.sendTyping(_currentMatchId!);

    _typingDebounce?.cancel();
    _typingDebounce = Timer(const Duration(seconds: 2), () {
      if (_currentMatchId != null) {
        SocketService.sendStopTyping(_currentMatchId!);
      }
    });
  }

  Future<void> sendMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _currentMatchId == null) return;

    final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
    final localMsg = ChatMessage(
      id: tempId,
      matchId: _currentMatchId!,
      senderId: currentUserId,
      content: trimmed,
      createdAt: DateTime.now().toUtc().toIso8601String(),
      status: MessageStatus.sending,
    );

    _messages.add(localMsg);
    notifyListeners();

    try {
      final serverMsg = await ApiService.sendMessage(_currentMatchId!, trimmed);
      final index = _messages.indexWhere((m) => m.id == tempId);
      if (index != -1) {
        _messages[index] = serverMsg;
      }
      notifyListeners();
    } catch (e) {
      final index = _messages.indexWhere((m) => m.id == tempId);
      if (index != -1) {
        _messages[index] = localMsg.copyWith(status: MessageStatus.failed);
      }
      notifyListeners();
    }
  }

  @override
  void dispose() {
    closeChat();
    super.dispose();
  }
}
