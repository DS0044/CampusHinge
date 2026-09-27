import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/app_theme.dart';
import '../../config/api_config.dart';
import '../../models/intent_model.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/intent_selector_sheet.dart';
import 'profile_setup_screen.dart';
import '../auth/login_screen.dart';
import '../auth/terms_screen.dart';

class MyProfileScreen extends StatelessWidget {
  const MyProfileScreen({super.key});

  void _showApiSettings(BuildContext context) {
    final controller = TextEditingController(text: ApiConfig.baseUrl);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.bgCard,
        title: Text('API Server Endpoint', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Change the server address if connecting from a physical phone or remote server:',
              style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textMuted),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
              decoration: const InputDecoration(
                hintText: 'http://192.168.1.100:3000/api',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              ApiConfig.customBaseUrl = '';
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Reset to default URL')),
              );
            },
            child: const Text('Reset Default'),
          ),
          ElevatedButton(
            onPressed: () {
              final val = controller.text.trim();
              if (val.isNotEmpty) {
                ApiConfig.customBaseUrl = val;
              }
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Base URL set to: ${ApiConfig.baseUrl}')),
              );
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.bgCard,
        title: Text('Sign Out?', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text(
          'Are you sure you want to log out of your campus account?',
          style: GoogleFonts.inter(color: AppTheme.textMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorRed),
            onPressed: () async {
              Navigator.pop(ctx);
              final auth = context.read<AuthProvider>();
              await auth.logout();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (route) => false,
                );
              }
            },
            child: const Text('Log Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final profile = auth.myProfile;
    final intentConfig = IntentConfig.get(auth.activeIntent);

    final photoUrl = profile != null && profile.photos.isNotEmpty
        ? ApiConfig.resolvePhotoUrl(profile.photos.first)
        : '';

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'My Campus Profile',
                  style: GoogleFonts.outfit(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textMain,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.settings_outlined, color: AppTheme.textMuted),
                  onPressed: () => _showApiSettings(context),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Profile Card Preview
            GlassCard(
              borderRadius: 24,
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Stack(
                    alignment: Alignment.bottomRight,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(55),
                        child: SizedBox(
                          width: 110,
                          height: 110,
                          child: photoUrl.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: photoUrl,
                                  fit: BoxFit.cover,
                                )
                              : Container(
                                  color: AppTheme.bgCardHover,
                                  child: const Icon(Icons.person, size: 54, color: AppTheme.textDim),
                                ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: AppTheme.bgDark,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.verified_rounded, color: Color(0xFF4CC9F0), size: 24),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  Text(
                    profile?.name ?? 'Campus Student',
                    style: GoogleFonts.outfit(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textMain,
                    ),
                  ),
                  const SizedBox(height: 4),

                  Text(
                    '${profile?.branch ?? 'Student'} • ${profile?.year != null ? 'Class of ${profile?.year}' : ''}',
                    style: GoogleFonts.inter(fontSize: 13, color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 12),

                  // Active Intent Chip (Clickable to switch!)
                  InkWell(
                    onTap: () {
                      IntentSelectorSheet.show(
                        context,
                        currentIntent: auth.activeIntent,
                        onIntentSelected: (newIntent) {
                          auth.updateActiveIntent(newIntent);
                        },
                      );
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: intentConfig.badgeBg,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: intentConfig.badgeBorder),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(intentConfig.icon, style: const TextStyle(fontSize: 14)),
                          const SizedBox(width: 6),
                          Text(
                            'Active Mode: ${intentConfig.label}',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: intentConfig.color,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(Icons.arrow_drop_down_rounded, color: intentConfig.color, size: 18),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),

                  ElevatedButton.icon(
                    icon: const Icon(Icons.edit_rounded, size: 16),
                    label: const Text('Edit Profile & Photos'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryPink,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ProfileSetupScreen(isInitialSetup: false),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Bio & Details Card
            if (profile != null && profile.bio != null && profile.bio!.trim().isNotEmpty) ...[
              Text(
                'About Me',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textMain,
                ),
              ),
              const SizedBox(height: 8),
              GlassCard(
                borderRadius: 18,
                padding: const EdgeInsets.all(16),
                child: Text(
                  profile.bio!.trim(),
                  style: GoogleFonts.inter(fontSize: 14, color: AppTheme.textMain, height: 1.45),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Interests Card
            if (profile != null && profile.interests.isNotEmpty) ...[
              Text(
                'Campus Interests',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textMain,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: profile.interests.map((t) {
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.glassBorderLight),
                    ),
                    child: Text(t, style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textMain)),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
            ],

            // App Options
            GlassCard(
              borderRadius: 20,
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.privacy_tip_outlined, color: Color(0xFF4CC9F0)),
                    title: Text('Privacy Policy', style: GoogleFonts.inter(fontSize: 14)),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppTheme.textDim),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const TermsScreen(isPrivacyPolicy: true)),
                      );
                    },
                  ),
                  const Divider(color: AppTheme.glassBorder, height: 1),
                  ListTile(
                    leading: const Icon(Icons.description_outlined, color: Color(0xFFFFB703)),
                    title: Text('Terms of Service', style: GoogleFonts.inter(fontSize: 14)),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppTheme.textDim),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const TermsScreen()),
                      );
                    },
                  ),
                  const Divider(color: AppTheme.glassBorder, height: 1),
                  ListTile(
                    leading: const Icon(Icons.logout_rounded, color: AppTheme.errorRed),
                    title: Text(
                      'Log Out',
                      style: GoogleFonts.inter(fontSize: 14, color: AppTheme.errorRed, fontWeight: FontWeight.w600),
                    ),
                    onTap: () => _showLogoutDialog(context),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
