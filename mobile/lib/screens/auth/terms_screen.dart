import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../config/app_theme.dart';
import '../../widgets/glass_card.dart';

class TermsScreen extends StatelessWidget {
  final bool isPrivacyPolicy;

  const TermsScreen({super.key, this.isPrivacyPolicy = false});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: Text(isPrivacyPolicy ? 'Privacy Policy' : 'Terms & Conditions'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          GlassCard(
            borderRadius: 20,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isPrivacyPolicy ? 'Campus Privacy Commitment' : 'Terms of Service',
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textMain,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Last updated: September 2026',
                  style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textDim),
                ),
                const SizedBox(height: 16),
                Text(
                  isPrivacyPolicy
                      ? 'At CampusHinge, your safety and privacy in the campus community are our top priorities.\n\n'
                          '1. Closed Campus Network:\n'
                          'Only verified students with valid institutional email domains can access our platform. Your profile is never shown outside your college ecosystem.\n\n'
                          '2. Mutual Reveal Architecture:\n'
                          'Incoming likes are protected with gated identity cards. Students who like you will have their identity revealed only after mutual engagement.\n\n'
                          '3. Safe Storage & Data Retention:\n'
                          'All messages and photos are securely transmitted over HTTPS/WSS and stored under strict access policies. You may delete your account or block any user anytime.\n\n'
                          '4. Moderation & Harassment Protection:\n'
                          'Our campus safety portal actively reviews abuse and harassment reports with zero tolerance for misconduct.'
                      : 'Welcome to CampusHinge! By creating an account or accessing the platform, you agree to these terms:\n\n'
                          '1. Eligibility:\n'
                          'You must be a currently enrolled student at an accredited university and register with your active college email domain.\n\n'
                          '2. Respectful Community:\n'
                          'CampusHinge is built for authentic dating, friendships, study groups, and networking. Harassment, hate speech, impersonation, or offensive media will lead to immediate account termination.\n\n'
                          '3. Accurate Identity:\n'
                          'You agree to use your real identity, true student details, and your own photographs.\n\n'
                          '4. Safety Center:\n'
                          'Always practice safe communication. Never share sensitive passwords or financial credentials with other students.',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppTheme.textMuted,
                    height: 1.6,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('I Understand'),
          ),
        ],
      ),
    );
  }
}
