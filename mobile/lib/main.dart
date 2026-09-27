import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'config/app_theme.dart';
import 'services/storage_service.dart';
import 'providers/auth_provider.dart';
import 'providers/discover_provider.dart';
import 'providers/matches_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/notification_provider.dart';
import 'screens/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Dark navigation bar and status bar
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppTheme.bgDark,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  await StorageService.init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => DiscoverProvider()),
        ChangeNotifierProvider(create: (_) => MatchesProvider()),
        ChangeNotifierProvider(create: (_) => ChatProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
      ],
      child: const CampusHingeApp(),
    ),
  );
}

class CampusHingeApp extends StatelessWidget {
  const CampusHingeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CampusHinge',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const SplashScreen(),
    );
  }
}
