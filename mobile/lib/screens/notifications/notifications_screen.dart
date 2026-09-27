import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/app_theme.dart';
import '../../config/api_config.dart';
import '../../models/notification_model.dart';
import '../../providers/notification_provider.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/gated_profile_modal.dart';
import '../chat/chat_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().loadNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final notifProvider = context.watch<NotificationProvider>();
    final notifs = notifProvider.notifications;

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Campus Activity',
                    style: GoogleFonts.outfit(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textMain,
                    ),
                  ),
                  if (notifs.isNotEmpty)
                    TextButton(
                      onPressed: () => notifProvider.markAllAsRead(),
                      child: Text(
                        'Mark all read',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: AppTheme.primaryPink,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            if (notifProvider.isLoading && notifs.isEmpty)
              const Expanded(
                child: Center(
                  child: CircularProgressIndicator(),
                ),
              )
            else if (notifs.isEmpty)
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
                          child: const Center(
                            child: Icon(Icons.notifications_none_rounded, size: 40, color: AppTheme.primaryPink),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'No Notifications Yet',
                          style: GoogleFonts.outfit(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textMain,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'When other students like your profile or message you, you\'ll receive real-time updates here.',
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
                child: RefreshIndicator(
                  onRefresh: () => notifProvider.loadNotifications(),
                  color: AppTheme.primaryPink,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                    itemCount: notifs.length,
                    separatorBuilder: (_, index) => const SizedBox(height: 10),
                    itemBuilder: (ctx, i) {
                      final notif = notifs[i];
                      return _buildNotificationCard(notif, notifProvider);
                    },
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationCard(AppNotification notif, NotificationProvider provider) {
    final isLike = notif.type == 'like';
    final isMatched = notif.isMatched;
    final photoUrl = ApiConfig.resolvePhotoUrl(notif.fromUserPhoto);

    return GlassCard(
      borderRadius: 20,
      padding: const EdgeInsets.all(14),
      backgroundColor: notif.isRead
          ? AppTheme.bgCard.withValues(alpha: 0.6)
          : AppTheme.bgCardHover.withValues(alpha: 0.95),
      border: Border.all(
        color: notif.isRead ? AppTheme.glassBorder : AppTheme.primaryPink.withValues(alpha: 0.35),
        width: notif.isRead ? 1 : 1.5,
      ),
      onTap: () {
        provider.markAsRead(notif.id);
        if (notif.isMatched && notif.matchId != null) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ChatScreen(matchId: notif.matchId!),
            ),
          );
        } else {
          GatedProfileModal.show(
            context,
            notification: notif,
            onLikeBack: (n) => provider.likeBack(n),
          );
        }
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Avatar (mystery blur if unrevealed like, or clear photo)
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(25),
                child: SizedBox(
                  width: 50,
                  height: 50,
                  child: Stack(
                    children: [
                      if (photoUrl.isNotEmpty)
                        CachedNetworkImage(imageUrl: photoUrl, fit: BoxFit.cover, width: 50, height: 50)
                      else
                        Container(color: AppTheme.bgCard, child: const Icon(Icons.person, size: 28)),
                      if (isLike && !isMatched)
                        BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                          child: Container(color: Colors.black26),
                        ),
                    ],
                  ),
                ),
              ),
              Positioned(
                bottom: -2,
                right: -2,
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: const BoxDecoration(
                    color: AppTheme.bgDark,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isMatched
                        ? Icons.favorite_rounded
                        : (isLike ? Icons.lock_rounded : Icons.mark_chat_unread_rounded),
                    color: isMatched
                        ? AppTheme.primaryPink
                        : (isLike ? const Color(0xFFFFB703) : const Color(0xFF4CC9F0)),
                    size: 13,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 14),

          // Notification Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: GoogleFonts.inter(fontSize: 13, color: AppTheme.textMain),
                    children: [
                      TextSpan(
                        text: isMatched
                            ? notif.fromUserName
                            : (isLike ? 'Someone on campus' : notif.fromUserName),
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: isMatched
                            ? ' is now matched with you! 🎉'
                            : (isLike ? ' liked your profile.' : ' sent you a message.'),
                        style: TextStyle(color: notif.isRead ? AppTheme.textMuted : AppTheme.textMain),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      notif.formattedTime,
                      style: GoogleFonts.inter(fontSize: 11, color: AppTheme.textDim),
                    ),
                    if (notif.sharedCount > 0) ...[
                      const SizedBox(width: 8),
                      Text(
                        '• ${notif.sharedCount} shared interests',
                        style: GoogleFonts.inter(fontSize: 11, color: AppTheme.primaryPink),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),

          // Action button (Like back if unread like)
          if (isLike && !isMatched) ...[
            const SizedBox(width: 8),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryPink,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                provider.likeBack(notif);
              },
              child: Text(
                'Like Back',
                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
