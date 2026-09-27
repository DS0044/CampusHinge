class ApiConfig {
  static const String liveBaseUrl = 'https://campushinge-api.campushinge-worker.workers.dev/api';
  static const String liveWsUrl = 'wss://campushinge-api.campushinge-worker.workers.dev/ws/chat';
  static const String googleClientId = '949417596101-ddno4en30ki9tc2fg67mm5evb9eoq36l.apps.googleusercontent.com';

  static String customBaseUrl = '';

  static String get baseUrl {
    if (customBaseUrl.isNotEmpty) return customBaseUrl;
    return liveBaseUrl;
  }

  static String get apiOrigin {
    final base = baseUrl;
    return base.replaceAll(RegExp(r'/api/?$'), '');
  }

  static String get socketUrl {
    return liveWsUrl;
  }

  /// Resolves server photo paths into full accessible URLs
  static String resolvePhotoUrl(String? photo) {
    if (photo == null || photo.trim().isEmpty) return '';
    final trimmed = photo.trim();
    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/cdn/')) {
      return '$apiOrigin$trimmed';
    }
    if (trimmed.startsWith('cdn/')) {
      return '$apiOrigin/$trimmed';
    }
    if (trimmed.startsWith('/uploads/')) {
      return '$apiOrigin/cdn$trimmed';
    }
    if (trimmed.startsWith('uploads/')) {
      return '$apiOrigin/cdn/$trimmed';
    }
    return '$apiOrigin/cdn/uploads/$trimmed';
  }
}
