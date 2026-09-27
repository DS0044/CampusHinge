import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import '../config/api_config.dart';
import '../models/message_model.dart';
import 'storage_service.dart';

class SocketService {
  static socket_io.Socket? _socketIo;
  static WebSocket? _nativeWs;
  static StreamSubscription? _wsSubscription;
  static bool _isConnected = false;

  static final _messageStreamController = StreamController<ChatMessage>.broadcast();
  static final _typingStreamController = StreamController<Map<String, dynamic>>.broadcast();
  static final _stopTypingStreamController = StreamController<Map<String, dynamic>>.broadcast();
  static final _notificationStreamController = StreamController<Map<String, dynamic>>.broadcast();
  static final _unreadCountStreamController = StreamController<int>.broadcast();
  static final _connectionStreamController = StreamController<bool>.broadcast();

  static Stream<ChatMessage> get onMessage => _messageStreamController.stream;
  static Stream<Map<String, dynamic>> get onTyping => _typingStreamController.stream;
  static Stream<Map<String, dynamic>> get onStopTyping => _stopTypingStreamController.stream;
  static Stream<Map<String, dynamic>> get onNotification => _notificationStreamController.stream;
  static Stream<int> get onUnreadCount => _unreadCountStreamController.stream;
  static Stream<bool> get onConnectionChange => _connectionStreamController.stream;

  static bool get isConnected => _isConnected;

  static void connect() async {
    final token = StorageService.getToken();
    if (token == null || token.isEmpty) return;

    if (_isConnected) return;

    final url = ApiConfig.socketUrl;
    debugPrint('🔌 Connecting socket to $url');

    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      _connectNativeWebSocket(url, token);
    } else {
      _connectSocketIo(url, token);
    }
  }

  static void _connectNativeWebSocket(String url, String token) async {
    try {
      _wsSubscription?.cancel();
      _nativeWs?.close();

      _nativeWs = await WebSocket.connect(url);
      _isConnected = true;
      _connectionStreamController.add(true);
      debugPrint('⚡ Native WebSocket connected to $url');

      _wsSubscription = _nativeWs!.listen(
        (data) {
          try {
            final parsed = jsonDecode(data.toString());
            if (parsed is Map<String, dynamic>) {
              final type = parsed['type'];
              if (type == 'new_message' && parsed['message'] != null) {
                _messageStreamController.add(ChatMessage.fromJson(parsed['message']));
              } else if (type == 'typing') {
                _typingStreamController.add({'userId': parsed['userId']});
              } else if (type == 'stop_typing') {
                _stopTypingStreamController.add({'userId': parsed['userId']});
              } else if (type == 'notification') {
                _notificationStreamController.add(parsed['notification'] ?? parsed);
              }
            }
          } catch (e) {
            debugPrint('⚠️ Error parsing WebSocket message: $e');
          }
        },
        onError: (err) {
          debugPrint('❌ Native WebSocket error: $err');
          _isConnected = false;
          _connectionStreamController.add(false);
        },
        onDone: () {
          debugPrint('🔌 Native WebSocket closed');
          _isConnected = false;
          _connectionStreamController.add(false);
        },
      );
    } catch (e) {
      debugPrint('❌ Failed to connect native WebSocket: $e');
      _isConnected = false;
      _connectionStreamController.add(false);
    }
  }

  static void _connectSocketIo(String url, String token) {
    _socketIo = socket_io.io(
      url,
      socket_io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(2000)
          .setReconnectionAttempts(10)
          .build(),
    );

    _socketIo!.onConnect((_) {
      debugPrint('⚡ Socket.IO connected: ${_socketIo?.id}');
      _isConnected = true;
      _connectionStreamController.add(true);
    });

    _socketIo!.onDisconnect((reason) {
      debugPrint('🔌 Socket.IO disconnected: $reason');
      _isConnected = false;
      _connectionStreamController.add(false);
    });

    _socketIo!.onConnectError((err) {
      debugPrint('❌ Socket.IO connect error: $err');
      _isConnected = false;
      _connectionStreamController.add(false);
    });

    _socketIo!.on('new_message', (data) {
      if (data is Map<String, dynamic>) {
        _messageStreamController.add(ChatMessage.fromJson(data));
      }
    });

    _socketIo!.on('user_typing', (data) {
      if (data is Map<String, dynamic>) {
        _typingStreamController.add(data);
      }
    });

    _socketIo!.on('user_stop_typing', (data) {
      if (data is Map<String, dynamic>) {
        _stopTypingStreamController.add(data);
      }
    });

    _socketIo!.on('notification', (data) {
      if (data is Map<String, dynamic>) {
        _notificationStreamController.add(data);
      }
    });

    _socketIo!.on('unread_count', (data) {
      if (data is Map<String, dynamic> && data['unread_count'] is num) {
        _unreadCountStreamController.add((data['unread_count'] as num).toInt());
      }
    });
  }

  static void joinMatch(String matchId) {
    final token = StorageService.getToken() ?? '';
    if (_nativeWs != null && _isConnected) {
      _nativeWs!.add(jsonEncode({
        'type': 'join',
        'matchId': matchId,
        'token': token,
      }));
    } else {
      _socketIo?.emit('join_match', matchId);
    }
  }

  static void leaveMatch(String matchId) {
    if (_nativeWs != null && _isConnected) {
      _nativeWs!.add(jsonEncode({
        'type': 'leave',
        'matchId': matchId,
      }));
    } else {
      _socketIo?.emit('leave_match', matchId);
    }
  }

  static void sendTyping(String matchId) {
    if (_nativeWs != null && _isConnected) {
      _nativeWs!.add(jsonEncode({
        'type': 'typing',
        'matchId': matchId,
      }));
    } else {
      _socketIo?.emit('typing', {'matchId': matchId});
    }
  }

  static void sendStopTyping(String matchId) {
    if (_nativeWs != null && _isConnected) {
      _nativeWs!.add(jsonEncode({
        'type': 'stop_typing',
        'matchId': matchId,
      }));
    } else {
      _socketIo?.emit('stop_typing', {'matchId': matchId});
    }
  }

  static void disconnect() {
    _wsSubscription?.cancel();
    _nativeWs?.close();
    _nativeWs = null;

    _socketIo?.disconnect();
    _socketIo?.dispose();
    _socketIo = null;

    _isConnected = false;
    _connectionStreamController.add(false);
  }
}
