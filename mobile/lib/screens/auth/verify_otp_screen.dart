import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../config/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/gradient_button.dart';
import '../../widgets/glass_card.dart';
import '../profile/profile_setup_screen.dart';
import '../main_shell.dart';

class VerifyOtpScreen extends StatefulWidget {
  final String email;
  final bool isNewUser;

  const VerifyOtpScreen({
    super.key,
    required this.email,
    this.isNewUser = false,
  });

  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen> {
  final _otpController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  int _resendCooldown = 30;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCooldown();
  }

  void _startCooldown() {
    _timer?.cancel();
    _resendCooldown = 30;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_resendCooldown <= 1) {
        t.cancel();
        setState(() => _resendCooldown = 0);
      } else {
        setState(() => _resendCooldown--);
      }
    });
  }

  @override
  void dispose() {
    _otpController.dispose();
    _timer?.cancel();
    super.dispose();
  }

  void _handleVerify() async {
    if (!_formKey.currentState!.validate()) return;

    final auth = context.read<AuthProvider>();
    final code = _otpController.text.trim();

    final success = await auth.verifyOtp(widget.email, code);
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
          MaterialPageRoute(builder: (_) => const ProfileSetupScreen(isInitialSetup: true)),
          (route) => false,
        );
      }
    }
  }

  void _handleResend() async {
    if (_resendCooldown > 0) return;
    final auth = context.read<AuthProvider>();
    final cooldown = await auth.resendOtp(widget.email);
    if (mounted) {
      setState(() {
        _resendCooldown = cooldown ?? 30;
      });
      _startCooldown();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('A fresh verification code has been dispatched.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
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
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: AppTheme.primaryPink.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                        border: Border.all(color: AppTheme.primaryPink.withValues(alpha: 0.3)),
                      ),
                      child: const Center(
                        child: Icon(Icons.mark_email_read_rounded, size: 36, color: AppTheme.primaryPink),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  Text(
                    'Verify College Email',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textMain,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Enter the 6-digit code sent to\n${widget.email}',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppTheme.textMuted,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 32),

                  GlassCard(
                    borderRadius: 24,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _otpController,
                          keyboardType: TextInputType.text,
                          textAlign: TextAlign.center,
                          maxLength: 6,
                          style: GoogleFonts.outfit(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 10,
                            color: Colors.white,
                          ),
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: '••••••',
                            hintStyle: GoogleFonts.outfit(
                              fontSize: 28,
                              color: AppTheme.textDim,
                              letterSpacing: 10,
                            ),
                            filled: true,
                            fillColor: AppTheme.bgSurface,
                          ),
                          validator: (val) {
                            if (val == null || val.trim().length < 4) {
                              return 'Enter the full verification code';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _resendCooldown > 0 ? 'Resend in ${_resendCooldown}s' : 'Didn’t get it?',
                              style: GoogleFonts.inter(fontSize: 13, color: AppTheme.textDim),
                            ),
                            TextButton(
                              onPressed: _resendCooldown > 0 ? null : _handleResend,
                              child: Text(
                                'Resend Code',
                                style: GoogleFonts.outfit(
                                  fontWeight: FontWeight.w600,
                                  color: _resendCooldown > 0 ? AppTheme.textDim : AppTheme.primaryPink,
                                ),
                              ),
                            ),
                          ],
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

                  const SizedBox(height: 24),

                  GradientButton(
                    text: 'Verify & Continue',
                    isLoading: auth.isLoading,
                    onPressed: _handleVerify,
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
