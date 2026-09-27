import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import 'auth/login_screen.dart';
import 'profile/profile_setup_screen.dart';
import 'main_shell.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    _scaleAnimation = Tween<double>(begin: 0.85, end: 1.05).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: const Interval(0.0, 0.6, curve: Curves.easeIn)),
    );

    _animController.forward();
    _initializeApp();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _initializeApp() async {
    final auth = context.read<AuthProvider>();
    await auth.init();

    await Future.delayed(const Duration(milliseconds: 1600));

    if (!mounted) return;

    if (!auth.isAuthenticated) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    } else if (!auth.isProfileComplete) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const ProfileSetupScreen(isInitialSetup: true)),
      );
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const MainShell()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: Center(
        child: AnimatedBuilder(
          animation: _animController,
          builder: (ctx, child) {
            return Opacity(
              opacity: _fadeAnimation.value,
              child: Transform.scale(
                scale: _scaleAnimation.value,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Glowing logo icon
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        gradient: AppTheme.primaryGradient,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primaryPink.withValues(alpha: 0.4),
                            blurRadius: 36,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text(
                          '🎓',
                          style: TextStyle(fontSize: 48),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // App Title
                    ShaderMask(
                      shaderCallback: (bounds) => AppTheme.primaryGradient.createShader(bounds),
                      child: Text(
                        'CampusHinge',
                        style: GoogleFonts.outfit(
                          fontSize: 36,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Tagline
                    Text(
                      'Campus-Verified Connections',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: AppTheme.textMuted,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 48),

                    const SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation(AppTheme.primaryPink),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
