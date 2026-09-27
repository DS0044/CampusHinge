import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/app_theme.dart';
import '../../config/api_config.dart';
import '../../models/intent_model.dart';
import '../../models/user_model.dart';
import '../../providers/discover_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/swipeable_card_stack.dart';
import '../../widgets/intent_selector_sheet.dart';
import '../../widgets/gradient_button.dart';
import '../chat/chat_screen.dart';

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      final discover = context.read<DiscoverProvider>();
      if (discover.activeIntent != auth.activeIntent) {
        discover.setIntent(auth.activeIntent);
      } else if (discover.deck.isEmpty) {
        discover.loadDeck();
      }
    });
  }

  void _showMatchDialog(Profile partner, String matchId) {
    final myProfile = context.read<AuthProvider>().myProfile;
    final partnerPhoto = partner.photos.isNotEmpty ? ApiConfig.resolvePhotoUrl(partner.photos.first) : '';
    final myPhoto = myProfile != null && myProfile.photos.isNotEmpty
        ? ApiConfig.resolvePhotoUrl(myProfile.photos.first)
        : '';

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppTheme.bgDark,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: AppTheme.primaryPink.withValues(alpha: 0.5), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primaryPink.withValues(alpha: 0.35),
                blurRadius: 36,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🎉', style: TextStyle(fontSize: 48)),
              const SizedBox(height: 12),
              ShaderMask(
                shaderCallback: (bounds) => AppTheme.primaryGradient.createShader(bounds),
                child: Text(
                  'Campus Match!',
                  style: GoogleFonts.outfit(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'You and ${partner.name} liked each other on campus!',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 14, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 24),

              // Overlapping Avatars
              SizedBox(
                height: 90,
                width: 170,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // My Photo (Left)
                    Positioned(
                      left: 10,
                      child: Container(
                        width: 76,
                        height: 76,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2.5),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(40),
                          child: myPhoto.isNotEmpty
                              ? CachedNetworkImage(imageUrl: myPhoto, fit: BoxFit.cover)
                              : Container(color: AppTheme.bgCard, child: const Icon(Icons.person)),
                        ),
                      ),
                    ),

                    // Partner Photo (Right)
                    Positioned(
                      right: 10,
                      child: Container(
                        width: 76,
                        height: 76,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: AppTheme.primaryPink, width: 2.5),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(40),
                          child: partnerPhoto.isNotEmpty
                              ? CachedNetworkImage(imageUrl: partnerPhoto, fit: BoxFit.cover)
                              : Container(color: AppTheme.bgCard, child: const Icon(Icons.person)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              GradientButton(
                text: 'Send a Message',
                icon: const Icon(Icons.chat_bubble_rounded, color: Colors.white, size: 18),
                onPressed: () {
                  Navigator.pop(ctx);
                  context.read<DiscoverProvider>().clearMatchCelebration();
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ChatScreen(
                        matchId: matchId,
                        initialPartner: partner,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  context.read<DiscoverProvider>().clearMatchCelebration();
                },
                child: Text(
                  'Keep Exploring',
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    color: AppTheme.textMuted,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final discover = context.watch<DiscoverProvider>();
    final intentConfig = IntentConfig.get(discover.activeIntent);

    // Watch for match celebration trigger
    if (discover.matchedPartner != null && discover.newMatchId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final partner = discover.matchedPartner;
        final matchId = discover.newMatchId;
        if (partner != null && matchId != null && mounted) {
          _showMatchDialog(partner, matchId);
        }
      });
    }

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: SafeArea(
        child: Column(
          children: [
            // Top Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // App Brand Logo
                  Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          gradient: AppTheme.primaryGradient,
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Text('🎓', style: TextStyle(fontSize: 20)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'CampusHinge',
                        style: GoogleFonts.outfit(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textMain,
                        ),
                      ),
                    ],
                  ),

                  // Intent Mode Switcher Pill
                  InkWell(
                    onTap: () {
                      IntentSelectorSheet.show(
                        context,
                        currentIntent: discover.activeIntent,
                        onIntentSelected: (newIntent) {
                          discover.setIntent(newIntent);
                          context.read<AuthProvider>().updateActiveIntent(newIntent);
                        },
                      );
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
                            intentConfig.label,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: intentConfig.color,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: intentConfig.color,
                            size: 18,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Card Stack Deck
            Expanded(
              child: discover.isLoading
                  ? const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(strokeWidth: 2.5),
                          SizedBox(height: 16),
                          Text('Finding campus connections…'),
                        ],
                      ),
                    )
                  : SwipeableCardStack(
                      profiles: discover.deck,
                      superLikeStatus: discover.superLikeStatus,
                      onSwipe: (action) => discover.swipe(action),
                      onRefresh: () => discover.loadDeck(),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
