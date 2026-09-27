import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../providers/notification_provider.dart';
import '../../widgets/custom_nav_bar.dart';
import 'discover/discover_screen.dart';
import 'matches/matches_screen.dart';
import 'notifications/notifications_screen.dart';
import 'profile/my_profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    DiscoverScreen(),
    MatchesScreen(),
    NotificationsScreen(),
    MyProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().loadUnreadCount();
    });
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = context.watch<NotificationProvider>().unreadCount;

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: Stack(
        children: [
          // Screens (IndexedStack preserves cards & chat positions)
          IndexedStack(
            index: _currentIndex,
            children: _screens,
          ),

          // Floating Glassmorphic Bottom Navigation Bar
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: CustomNavBar(
              currentIndex: _currentIndex,
              unreadNotifications: unreadCount,
              onTap: (index) => setState(() => _currentIndex = index),
            ),
          ),
        ],
      ),
    );
  }
}
