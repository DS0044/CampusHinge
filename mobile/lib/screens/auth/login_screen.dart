import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../config/app_theme.dart';
import '../../config/api_config.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/gradient_button.dart';
import '../../widgets/glass_card.dart';
import '../profile/profile_setup_screen.dart';
import '../main_shell.dart';
import 'verify_otp_screen.dart';
import 'signup_screen.dart';
import 'terms_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _acceptedTerms = true;
  bool _showEmailLogin = false;
  bool _isGoogleSigningIn = false;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  late final GoogleSignIn _googleSignIn;

  @override
  void initState() {
    super.initState();
    _googleSignIn = GoogleSignIn(
      serverClientId: ApiConfig.googleClientId,
      scopes: ['email', 'profile'],
    );

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleGoogleSignIn() async {
    if (!_acceptedTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppTheme.errorRed,
          content: Text('Please accept the Terms & Conditions and Privacy Policy to continue.'),
        ),
      );
      return;
    }

    setState(() => _isGoogleSigningIn = true);
    final auth = context.read<AuthProvider>();

    try {
      await _googleSignIn.signOut();
      final GoogleSignInAccount? account = await _googleSignIn.signIn();

      if (account == null) {
        // User cancelled
        setState(() => _isGoogleSigningIn = false);
        return;
      }

      final GoogleSignInAuthentication googleAuth = await account.authentication;
      final idToken = googleAuth.idToken;

      if (idToken == null || idToken.isEmpty) {
        throw Exception('Google did not return an ID token. Please use campus email login below.');
      }

      final success = await auth.signInWithGoogleToken(idToken);
      if (success && mounted) {
        if (auth.isProfileComplete) {
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const MainShell()),
            (route) => false,
          );
        } else {
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const ProfileSetupScreen()),
            (route) => false,
          );
        }
      }
    } catch (e) {
      debugPrint('Google Sign-In Error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.errorRed,
            content: Text(
              e.toString().contains('network')
                  ? 'Network error connecting to Google. Try campus email login.'
                  : 'Google Sign-In: ${e.toString().replaceAll('Exception: ', '')}',
            ),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isGoogleSigningIn = false);
      }
    }
  }

  void _handleEmailLogin() async {
    if (!_formKey.currentState!.validate()) return;

    if (!_acceptedTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppTheme.errorRed,
          content: Text('Please accept the Terms & Conditions and Privacy Policy to continue.'),
        ),
      );
      return;
    }

    final auth = context.read<AuthProvider>();
    final email = _emailController.text.trim().toLowerCase();

    // Call live backend login
    final success = await auth.login(email);
    if (success && mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => VerifyOtpScreen(email: email, isNewUser: false),
        ),
      );
    } else if (mounted && auth.errorMessage.contains('No account found')) {
      // If user is not found, automatically attempt signup with terms accepted
      final signupSuccess = await auth.signup(email, acceptedTerms: true);
      if (signupSuccess && mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => VerifyOtpScreen(email: email, isNewUser: true),
          ),
        );
      }
    }
  }

  Widget _buildGoogleIcon({double size = 22}) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          'G',
          style: TextStyle(
            color: const Color(0xFF4285F4),
            fontWeight: FontWeight.w900,
            fontSize: size * 0.72,
            fontFamily: 'Roboto',
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isLoading = auth.isLoading || _isGoogleSigningIn;

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Animated Brand Icon
                ScaleTransition(
                  scale: _pulseAnimation,
                  child: Center(
                    child: Container(
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(
                        gradient: AppTheme.primaryGradient,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primaryPink.withValues(alpha: 0.4),
                            blurRadius: 30,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text('🎓', style: TextStyle(fontSize: 38)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                Text(
                  'CampusHinge',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.textMain,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Connect exclusively with students from your campus.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppTheme.textMuted,
                  ),
                ),
                const SizedBox(height: 32),

                // Main Glass Card
                GlassCard(
                  borderRadius: 28,
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Welcome to CampusHinge',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.outfit(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textMain,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Sign in or create your campus-verified account.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: AppTheme.textMuted,
                        ),
                      ),
                      const SizedBox(height: 22),

                      // Terms & Conditions Checkbox
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: _acceptedTerms
                              ? AppTheme.primaryPurple.withValues(alpha: 0.08)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: _acceptedTerms
                                ? AppTheme.primaryPurple.withValues(alpha: 0.25)
                                : AppTheme.glassBorder,
                          ),
                        ),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 24,
                              height: 24,
                              child: Checkbox(
                                value: _acceptedTerms,
                                activeColor: AppTheme.primaryPink,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                onChanged: isLoading
                                    ? null
                                    : (val) => setState(() => _acceptedTerms = val ?? false),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => const TermsScreen()),
                                  );
                                },
                                child: RichText(
                                  text: TextSpan(
                                    style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textMuted),
                                    children: const [
                                      TextSpan(text: 'I agree to the '),
                                      TextSpan(
                                        text: 'Terms & Conditions',
                                        style: TextStyle(
                                          color: AppTheme.primaryPink,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      TextSpan(text: ' and '),
                                      TextSpan(
                                        text: 'Privacy Policy',
                                        style: TextStyle(
                                          color: AppTheme.primaryPink,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      if (!_acceptedTerms) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Please accept the terms to continue with Google sign-in',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(fontSize: 11, color: AppTheme.textDim),
                        ),
                      ],

                      const SizedBox(height: 20),

                      // Primary Action: Google Sign-In with College Gmail
                      isLoading
                          ? const Center(
                              child: Padding(
                                padding: EdgeInsets.all(12),
                                child: CircularProgressIndicator(color: AppTheme.primaryPink),
                              ),
                            )
                          : ElevatedButton(
                              onPressed: _acceptedTerms ? _handleGoogleSignIn : null,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: _acceptedTerms ? Colors.white : Colors.white24,
                                foregroundColor: Colors.black87,
                                elevation: _acceptedTerms ? 4 : 0,
                                padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 16),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(30),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  _buildGoogleIcon(size: 22),
                                  const SizedBox(width: 12),
                                  Text(
                                    'Continue with College Gmail',
                                    style: GoogleFonts.outfit(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                      color: _acceptedTerms ? Colors.black87 : Colors.white38,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                      if (auth.errorMessage.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppTheme.errorRed.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline_rounded, color: AppTheme.errorRed, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  auth.errorMessage,
                                  style: GoogleFonts.inter(fontSize: 12, color: AppTheme.errorRed),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 20),

                      // Supported Campuses Info Box (Matching Web Layout)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryPurple.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.primaryPurple.withValues(alpha: 0.15)),
                        ),
                        child: Column(
                          children: [
                            Text(
                              'Supported Campuses:',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textMuted,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              'VIT Bhopal • LPU • BITS Pilani • Galgotias University',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                color: AppTheme.textDim,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Trust Badge
                Text(
                  '🔒 Only students with verified college accounts can join.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textDim),
                ),

                const SizedBox(height: 16),

                // Email OTP Login Option Toggle
                Center(
                  child: TextButton(
                    onPressed: () {
                      setState(() {
                        _showEmailLogin = !_showEmailLogin;
                      });
                    },
                    child: Text(
                      _showEmailLogin ? 'Hide Campus Email Login' : 'Or sign in with Campus Email (OTP)',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: AppTheme.primaryPink,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),

                if (_showEmailLogin) ...[
                  const SizedBox(height: 8),
                  GlassCard(
                    borderRadius: 20,
                    padding: const EdgeInsets.all(16),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Campus Email',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.textMain,
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'e.g. student@vitbhopal.ac.in',
                              prefixIcon: const Icon(Icons.school_outlined, color: AppTheme.textMuted, size: 20),
                              filled: true,
                              fillColor: AppTheme.bgSurface,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            ),
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) {
                                return 'Please enter your campus email';
                              }
                              if (!val.contains('@') || !val.contains('.')) {
                                return 'Enter a valid campus email address';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 12),
                          GradientButton(
                            text: 'Send Verification OTP',
                            icon: const Icon(Icons.send_rounded, color: Colors.white, size: 16),
                            isLoading: isLoading,
                            onPressed: _handleEmailLogin,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 16),

                // Link to Signup
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'New to CampusHinge? ',
                      style: GoogleFonts.inter(fontSize: 13, color: AppTheme.textMuted),
                    ),
                    GestureDetector(
                      onTap: () {
                        auth.clearError();
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const SignupScreen()),
                        );
                      },
                      child: Text(
                        'Create Account',
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryPink,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // Legal Footer
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const TermsScreen()),
                        );
                      },
                      child: Text(
                        'Privacy Policy',
                        style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textDim),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text('•', style: TextStyle(color: AppTheme.textDim.withValues(alpha: 0.5))),
                    ),
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const TermsScreen()),
                        );
                      },
                      child: Text(
                        'Terms of Service',
                        style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textDim),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
