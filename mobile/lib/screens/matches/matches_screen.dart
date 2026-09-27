import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/app_theme.dart';
import '../../config/api_config.dart';
import '../../models/intent_model.dart';
import '../../models/match_model.dart';
import '../../providers/matches_provider.dart';
import '../../widgets/glass_card.dart';
import '../chat/chat_screen.dart';

class MatchesScreen extends StatefulWidget {
  const MatchesScreen({super.key});

  @override
  State<MatchesScreen> createState() => _MatchesScreenState();
}

class _MatchesScreenState extends State<MatchesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MatchesProvider>().loadMatches();
    });
  }

  @override
  Widget build(BuildContext context) {
    final matchesProvider = context.watch<MatchesProvider>();
    final matches = matchesProvider.matches;

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Screen Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Matches',
                    style: GoogleFonts.outfit(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textMain,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, color: AppTheme.textMuted),
                    onPressed: () => matchesProvider.loadMatches(),
                  ),
                ],
              ),
            ),

            if (matchesProvider.isLoading && matches.isEmpty)
              const Expanded(
                child: Center(
                  child: CircularProgressIndicator(),
                ),
              )
            else if (matches.isEmpty)
              Expanded(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: AppTheme.primaryPink.withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: const Center(child: Text('💌', style: TextStyle(fontSize: 38))),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'No Matches Yet',
                          style: GoogleFonts.outfit(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textMain,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Keep swiping in Discover! When another student likes you back, your conversation unlocks here.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(fontSize: 14, color: AppTheme.textMuted),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.only(bottom: 100),
                  children: [
                    // Horizontal "New Matches" carousel
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        'NEW CONNECTIONS',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textDim,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 105,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: matches.length,
                        itemBuilder: (ctx, i) {
                          final match = matches[i];
                          return _buildHorizontalMatchItem(match);
                        },
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Vertical Conversations List
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        'CONVERSATIONS',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textDim,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),

                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: matches.length,
                      separatorBuilder: (_, index) => const SizedBox(height: 8),
                      itemBuilder: (ctx, i) {
                        final match = matches[i];
                        return _buildConversationCard(match);
                      },
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildHorizontalMatchItem(MatchItem match) {
    final photoUrl = ApiConfig.resolvePhotoUrl(match.partnerPhoto);
    final intentConfig = IntentConfig.get(match.intent);

    return InkWell(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ChatScreen(
              matchId: match.id,
              initialPartner: match.partnerProfile,
            ),
          ),
        );
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 80,
        margin: const EdgeInsets.symmetric(horizontal: 6),
        child: Column(
          children: [
            Stack(
              children: [
                Container(
                  width: 68,
                  height: 68,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: intentConfig.color, width: 2),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(35),
                    child: photoUrl.isNotEmpty
                        ? CachedNetworkImage(imageUrl: photoUrl, fit: BoxFit.cover)
                        : Container(color: AppTheme.bgCard, child: const Icon(Icons.person)),
                  ),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(
                      color: AppTheme.bgDark,
                      shape: BoxShape.circle,
                    ),
                    child: Text(intentConfig.icon, style: const TextStyle(fontSize: 13)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              match.partnerName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textMain),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConversationCard(MatchItem match) {
    final photoUrl = ApiConfig.resolvePhotoUrl(match.partnerPhoto);
    final intentConfig = IntentConfig.get(match.intent);

    return GlassCard(
      borderRadius: 18,
      padding: const EdgeInsets.all(12),
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ChatScreen(
              matchId: match.id,
              initialPartner: match.partnerProfile,
            ),
          ),
        );
      },
      child: Row(
        children: [
          // Avatar
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(26),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: photoUrl.isNotEmpty
                      ? CachedNetworkImage(imageUrl: photoUrl, fit: BoxFit.cover)
                      : Container(color: AppTheme.bgCard, child: const Icon(Icons.person)),
                ),
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(
                    color: AppTheme.bgDark,
                    shape: BoxShape.circle,
                  ),
                  child: Text(intentConfig.icon, style: const TextStyle(fontSize: 11)),
                ),
              ),
            ],
          ),
          const SizedBox(width: 14),

          // Message preview
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text(
                        match.partnerName,
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textMain,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (match.lastMessageAt != null)
                      Text(
                        _formatTime(match.lastMessageAt!),
                        style: GoogleFonts.inter(fontSize: 11, color: AppTheme.textDim),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  match.lastMessage ?? 'Say hello on campus 👋',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: match.unreadCount > 0 ? AppTheme.textMain : AppTheme.textMuted,
                    fontWeight: match.unreadCount > 0 ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
              ],
            ),
          ),

          // Unread badge
          if (match.unreadCount > 0) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: const BoxDecoration(
                color: AppTheme.primaryPink,
                shape: BoxShape.circle,
              ),
              child: Text(
                '${match.unreadCount}',
                style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatTime(String timeStr) {
    try {
      var str = timeStr.trim();
      if (!str.endsWith('Z') && !RegExp(r'[+-]\d{2}:?\d{2}$').hasMatch(str)) {
        str = '${str.replaceAll(' ', 'T')}Z';
      }
      final date = DateTime.parse(str).toLocal();
      final now = DateTime.now();
      if (now.difference(date).inHours < 24) {
        final hour = date.hour > 12 ? date.hour - 12 : (date.hour == 0 ? 12 : date.hour);
        final minute = date.minute.toString().padLeft(2, '0');
        final ampm = date.hour >= 12 ? 'PM' : 'AM';
        return '$hour:$minute $ampm';
      }
      return '${date.month}/${date.day}';
    } catch (_) {
      return '';
    }
  }
}
