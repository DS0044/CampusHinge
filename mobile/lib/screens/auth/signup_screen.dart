import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../config/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/gradient_button.dart';
import '../../widgets/glass_card.dart';
import 'login_screen.dart';
import 'verify_otp_screen.dart';
import 'terms_screen.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _emailController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _acceptedTerms = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  void _handleSignup() async {
    if (!_formKey.currentState!.validate()) return;

    if (!_acceptedTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please accept the Terms & Conditions to create an account.')),
      );
      return;
    }

    final auth = context.read<AuthProvider>();
    final email = _emailController.text.trim();

    final success = await auth.signup(email, acceptedTerms: _acceptedTerms);
    if (success && mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => VerifyOtpScreen(email: email, isNewUser: true),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Icon
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        gradient: AppTheme.accentGradient,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.accentPurple.withValues(alpha: 0.35),
                            blurRadius: 24,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text('✨', style: TextStyle(fontSize: 34)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  Text(
                    'Join CampusHinge',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textMain,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'A closed, verified social network for your campus',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppTheme.textMuted,
                    ),
                  ),
                  const SizedBox(height: 32),

                  GlassCard(
                    borderRadius: 24,
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Institutional Email',
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
                          style: GoogleFonts.inter(color: Colors.white, fontSize: 15),
                          decoration: InputDecoration(
                            hintText: 'yourname@university.edu',
                            prefixIcon: const Icon(Icons.verified_user_outlined, color: AppTheme.textMuted),
                            filled: true,
                            fillColor: AppTheme.bgSurface,
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) {
                              return 'Please enter your campus email';
                            }
                            if (!val.contains('@') || !val.contains('.')) {
                              return 'Enter a valid email address';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Campus verification protects students and ensures authentic profiles only.',
                          style: GoogleFonts.inter(fontSize: 11, color: AppTheme.textDim),
                        ),
                      ],
                    ),
                  ),

                  if (auth.errorMessage.isNotEmpty) ...[
                    const SizedBox(height: 14),
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

                  const SizedBox(height: 16),

                  // Terms checkbox
                  Row(
                    children: [
                      Checkbox(
                        value: _acceptedTerms,
                        activeColor: AppTheme.primaryPink,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                        onChanged: (val) => setState(() => _acceptedTerms = val ?? false),
                      ),
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
                                TextSpan(text: 'I accept the '),
                                TextSpan(
                                  text: 'Campus Terms',
                                  style: TextStyle(
                                    color: AppTheme.primaryPink,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                TextSpan(text: ' and confirm my student enrollment.'),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  GradientButton(
                    text: 'Create Campus Account',
                    icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 18),
                    isLoading: auth.isLoading,
                    onPressed: _handleSignup,
                  ),

                  const SizedBox(height: 24),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Already have an account? ',
                        style: GoogleFonts.inter(fontSize: 14, color: AppTheme.textMuted),
                      ),
                      GestureDetector(
                        onTap: () {
                          auth.clearError();
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(builder: (_) => const LoginScreen()),
                          );
                        },
                        child: Text(
                          'Sign In',
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryPink,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
