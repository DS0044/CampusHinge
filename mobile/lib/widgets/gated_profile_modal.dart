import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/app_theme.dart';
import '../config/api_config.dart';
import '../models/user_model.dart';
import '../models/notification_model.dart';
import '../services/api_service.dart';
import 'gradient_button.dart';

class GatedProfileModal extends StatefulWidget {
  final AppNotification notification;
  final Function(AppNotification) onLikeBack;

  const GatedProfileModal({
    super.key,
    required this.notification,
    required this.onLikeBack,
  });

  static Future<void> show(
    BuildContext context, {
    required AppNotification notification,
    required Function(AppNotification) onLikeBack,
  }) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => GatedProfileModal(
        notification: notification,
        onLikeBack: onLikeBack,
      ),
    );
  }

  @override
  State<GatedProfileModal> createState() => _GatedProfileModalState();
}

class _GatedProfileModalState extends State<GatedProfileModal> {
  Profile? _profile;
  bool _isLoading = true;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final p = await ApiService.getGatedProfile(widget.notification.fromUserId);
      if (mounted) {
        setState(() {
          _profile = p;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final notif = widget.notification;
    final isMatched = notif.isMatched;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
      decoration: const BoxDecoration(
        color: AppTheme.bgDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(top: BorderSide(color: AppTheme.glassBorder, width: 1.5)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag pill
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          const SizedBox(height: 20),

          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(40),
              child: CircularProgressIndicator(),
            )
          else if (_errorMessage.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  const Icon(Icons.error_outline_rounded, color: AppTheme.errorRed, size: 42),
                  const SizedBox(height: 12),
                  Text(
                    _errorMessage,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(color: AppTheme.textMuted),
                  ),
                ],
              ),
            )
          else if (_profile != null) ...[
            // Avatar (Blurred if not matched, clear if matched)
            Stack(
              alignment: Alignment.center,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(60),
                  child: SizedBox(
                    width: 120,
                    height: 120,
                    child: Stack(
                      children: [
                        if (_profile!.photos.isNotEmpty)
                          CachedNetworkImage(
                            imageUrl: ApiConfig.resolvePhotoUrl(_profile!.photos.first),
                            fit: BoxFit.cover,
                            width: 120,
                            height: 120,
                          )
                        else
                          Container(
                            color: AppTheme.bgCard,
                            child: const Center(
                              child: Icon(Icons.person, size: 60, color: AppTheme.textDim),
                            ),
                          ),
                        if (!isMatched)
                          BackdropFilter(
                            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                            child: Container(color: Colors.black.withValues(alpha: 0.2)),
                          ),
                      ],
                    ),
                  ),
                ),
                if (!isMatched)
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppTheme.primaryPink.withValues(alpha: 0.8),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.lock_rounded, color: Colors.white, size: 20),
                  ),
              ],
            ),
            const SizedBox(height: 16),

            // Name
            Text(
              isMatched ? _profile!.name : 'Campus Match',
              style: GoogleFonts.outfit(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: AppTheme.textMain,
              ),
            ),
            const SizedBox(height: 4),

            Text(
              isMatched
                  ? '${_profile!.branch ?? 'Student'} • Class of ${_profile!.year ?? '2026'}'
                  : 'Liked your campus profile! Like back to unlock photos & identity.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppTheme.textMuted,
              ),
            ),
            const SizedBox(height: 20),

            // Shared tags hint
            if (notif.sharedInterests.isNotEmpty) ...[
              Text(
                'Shared Interests (${notif.sharedInterests.length})',
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textMain,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: notif.sharedInterests.map((tag) {
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryPink.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.primaryPink.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      tag,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.primaryPink,
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
            ],

            if (!isMatched)
              GradientButton(
                text: 'Like Back to Reveal',
                icon: const Icon(Icons.favorite_rounded, color: Colors.white, size: 20),
                onPressed: () {
                  Navigator.pop(context);
                  widget.onLikeBack(notif);
                },
              )
            else
              Text(
                '🎉 You are matched! Start chatting from your Matches tab.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.successGreen,
                ),
              ),
          ],
        ],
      ),
    );
  }
}
