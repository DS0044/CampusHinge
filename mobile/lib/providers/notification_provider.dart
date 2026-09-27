import 'dart:async';
import 'package:flutter/material.dart';
import '../models/notification_model.dart';
import '../models/deck_model.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class NotificationProvider extends ChangeNotifier {
  List<AppNotification> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = false;
  String _errorMessage = '';

  StreamSubscription? _notifSub;
  StreamSubscription? _unreadSub;

  List<AppNotification> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;

  NotificationProvider() {
    _initSocketListeners();
  }

  void _initSocketListeners() {
    _notifSub = SocketService.onNotification.listen((_) {
      loadNotifications(silent: true);
      loadUnreadCount();
    });

    _unreadSub = SocketService.onUnreadCount.listen((count) {
      _unreadCount = count;
      notifyListeners();
    });
  }

  Future<void> loadNotifications({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _errorMessage = '';
      notifyListeners();
    }

    try {
      _notifications = await ApiService.getNotifications();
      if (!silent) _isLoading = false;
      notifyListeners();
    } catch (e) {
      if (!silent) {
        _errorMessage = e.toString();
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadUnreadCount() async {
    try {
      _unreadCount = await ApiService.getUnreadNotificationCount();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> markAsRead(String notificationId) async {
    final index = _notifications.indexWhere((n) => n.id == notificationId);
    if (index != -1 && !_notifications[index].isRead) {
      _notifications[index] = _notifications[index].copyWith(isRead: true, isSeen: true);
      if (_unreadCount > 0) _unreadCount--;
      notifyListeners();

      try {
        await ApiService.markNotificationAsRead(notificationId);
      } catch (_) {}
    }
  }

  Future<void> markAllAsRead() async {
    _notifications = _notifications.map((n) => n.copyWith(isRead: true, isSeen: true)).toList();
    _unreadCount = 0;
    notifyListeners();

    try {
      await ApiService.markAllNotificationsAsRead();
    } catch (_) {}
  }

  Future<bool> likeBack(AppNotification notif) async {
    try {
      final res = await ApiService.recordSwipe(
        swipedId: notif.fromUserId,
        action: SwipeAction.like,
      );

      final index = _notifications.indexWhere((n) => n.id == notif.id);
      if (index != -1) {
        _notifications[index] = _notifications[index].copyWith(
          isMatched: res.matched,
          matchId: res.matchId,
          isRead: true,
          fromUserName: res.partner?.name ?? notif.realName ?? notif.fromUserName,
        );
        notifyListeners();
      }

      await loadNotifications(silent: true);
      return res.matched;
    } catch (e) {
      debugPrint('Error liking back: $e');
      return false;
    }
  }

  @override
  void dispose() {
    _notifSub?.cancel();
    _unreadSub?.cancel();
    super.dispose();
  }
}
