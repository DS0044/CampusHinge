import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/app_theme.dart';
import '../config/api_config.dart';
import '../models/user_model.dart';
import '../models/intent_model.dart';
import '../models/deck_model.dart';
import '../services/api_service.dart';
import 'glass_card.dart';

class ProfileDetailSheet extends StatefulWidget {
  final Profile profile;
  final CompatibilityBreakdown? breakdown;
  final double? compatibilityScore;
  final VoidCallback? onLike;
  final VoidCallback? onPass;
  final VoidCallback? onSuperLike;

  const ProfileDetailSheet({
    super.key,
    required this.profile,
    this.breakdown,
    this.compatibilityScore,
    this.onLike,
    this.onPass,
    this.onSuperLike,
  });

  static Future<void> show(
    BuildContext context, {
    required Profile profile,
    CompatibilityBreakdown? breakdown,
    double? compatibilityScore,
    VoidCallback? onLike,
    VoidCallback? onPass,
    VoidCallback? onSuperLike,
  }) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => ProfileDetailSheet(
        profile: profile,
        breakdown: breakdown,
        compatibilityScore: compatibilityScore,
        onLike: onLike,
        onPass: onPass,
        onSuperLike: onSuperLike,
      ),
    );
  }

  @override
  State<ProfileDetailSheet> createState() => _ProfileDetailSheetState();
}

class _ProfileDetailSheetState extends State<ProfileDetailSheet> {
  int _currentPhotoIndex = 0;
  final PageController _pageController = PageController();

  void _showReportDialog() {
    String selectedReason = 'Inappropriate content';
    final reasons = [
      'Inappropriate content',
      'Harassment or bullying',
      'Fake profile or impersonation',
      'Spam or scam',
      'Other',
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: AppTheme.bgCard,
          title: Text(
            'Report ${widget.profile.name}',
            style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: reasons.map((r) {
              final isSel = selectedReason == r;
              return InkWell(
                onTap: () => setDialogState(() => selectedReason = r),
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                  child: Row(
                    children: [
                      Icon(
                        isSel ? Icons.radio_button_checked : Icons.radio_button_off,
                        color: isSel ? AppTheme.primaryPink : AppTheme.textDim,
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(r, style: GoogleFonts.inter(fontSize: 14)),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await ApiService.reportUser(widget.profile.userId, selectedReason);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Report submitted. Thank you for keeping campus safe.')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Report failed: $e')),
                    );
                  }
                }
              },
              child: const Text('Submit Report'),
            ),
          ],
        ),
      ),
    );
  }

  void _showBlockDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.bgCard,
        title: Text('Block ${widget.profile.name}?', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text(
          'You will no longer see their profile or messages, and they will not see yours.',
          style: GoogleFonts.inter(fontSize: 14, color: AppTheme.textMuted),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorRed),
            onPressed: () async {
              Navigator.pop(ctx);
              Navigator.pop(context); // Close sheet
              try {
                await ApiService.blockUser(widget.profile.userId);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('User blocked.')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Block failed: $e')),
                  );
                }
              }
            },
            child: const Text('Block User'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final photos = widget.profile.photos;
    final intentConfig = IntentConfig.get(widget.profile.activeIntent);

    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (ctx, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: AppTheme.bgDark,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            border: Border(top: BorderSide(color: AppTheme.glassBorder, width: 1.5)),
          ),
          child: Column(
            children: [
              // Top drag pill
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),

              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
                  children: [
                    // Photo Gallery
                    ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: SizedBox(
                        height: 380,
                        child: Stack(
                          children: [
                            PageView.builder(
                              controller: _pageController,
                              itemCount: photos.isNotEmpty ? photos.length : 1,
                              onPageChanged: (i) => setState(() => _currentPhotoIndex = i),
                              itemBuilder: (ctx, i) {
                                if (photos.isEmpty) {
                                  return Container(
                                    color: AppTheme.bgCard,
                                    child: const Center(
                                      child: Icon(Icons.person, size: 80, color: AppTheme.textDim),
                                    ),
                                  );
                                }
                                final url = ApiConfig.resolvePhotoUrl(photos[i]);
                                return CachedNetworkImage(
                                  imageUrl: url,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(
                                    color: AppTheme.bgCard,
                                    child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                                  ),
                                  errorWidget: (context, url, err) => Container(
                                    color: AppTheme.bgCard,
                                    child: const Center(child: Icon(Icons.broken_image, size: 48)),
                                  ),
                                );
                              },
                            ),

                            // Photo progress indicators
                            if (photos.length > 1)
                              Positioned(
                                top: 12,
                                left: 16,
                                right: 16,
                                child: Row(
                                  children: List.generate(
                                    photos.length,
                                    (idx) => Expanded(
                                      child: Container(
                                        height: 3.5,
                                        margin: const EdgeInsets.symmetric(horizontal: 2),
                                        decoration: BoxDecoration(
                                          color: idx == _currentPhotoIndex
                                              ? Colors.white
                                              : Colors.white.withValues(alpha: 0.3),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 18),

                    // Name, Age, Intent pill
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      widget.profile.name,
                                      style: GoogleFonts.outfit(
                                        fontSize: 26,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.textMain,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (widget.profile.age != null) ...[
                                    const SizedBox(width: 8),
                                    Text(
                                      '${widget.profile.age}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 24,
                                        fontWeight: FontWeight.w400,
                                        color: AppTheme.textMuted,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(width: 6),
                                  const Icon(
                                    Icons.verified_rounded,
                                    color: Color(0xFF4CC9F0),
                                    size: 20,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${widget.profile.branch ?? 'Campus Student'} ${widget.profile.year != null ? '• Class of ${widget.profile.year}' : ''}',
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  color: AppTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Intent badge
                        Container(
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
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 18),

                    // Compatibility Breakdown (if present)
                    if (widget.breakdown != null || widget.compatibilityScore != null) ...[
                      GlassCard(
                        borderRadius: 18,
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Campus Compatibility',
                                  style: GoogleFonts.outfit(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.textMain,
                                  ),
                                ),
                                if (widget.compatibilityScore != null)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppTheme.successGreen.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      '${(widget.compatibilityScore! * 100).toInt()}% Match',
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.successGreen,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            if (widget.breakdown != null) ...[
                              const SizedBox(height: 12),
                              _buildScoreBar('Shared Interests', widget.breakdown!.interest, AppTheme.primaryPink),
                              const SizedBox(height: 8),
                              _buildScoreBar('Behavioral Affinity', widget.breakdown!.behavioral, AppTheme.accentPurple),
                              const SizedBox(height: 8),
                              _buildScoreBar('Campus Activity', widget.breakdown!.freshness, AppTheme.infoBlue),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                    ],

                    // Bio
                    if (widget.profile.bio != null && widget.profile.bio!.trim().isNotEmpty) ...[
                      Text(
                        'About Me',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textMain,
                        ),
                      ),
                      const SizedBox(height: 8),
                      GlassCard(
                        borderRadius: 18,
                        child: Text(
                          widget.profile.bio!.trim(),
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            color: AppTheme.textMain,
                            height: 1.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                    ],

                    // Interests
                    if (widget.profile.interests.isNotEmpty) ...[
                      Text(
                        'Campus Interests',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textMain,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: widget.profile.interests.map((tag) {
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              color: AppTheme.bgCard,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppTheme.glassBorderLight),
                            ),
                            child: Text(
                              tag,
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                color: AppTheme.textMain,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 18),
                    ],

                    // Activity Tags
                    if (widget.profile.activityTags.isNotEmpty) ...[
                      Text(
                        'Favorite Activities',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textMain,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: widget.profile.activityTags.map((tag) {
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              color: const Color(0xFF06D6A0).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: const Color(0xFF06D6A0).withValues(alpha: 0.35),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text('⚡', style: TextStyle(fontSize: 12)),
                                const SizedBox(width: 4),
                                Text(
                                  tag,
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: const Color(0xFF06D6A0),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // Report & Block options
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        TextButton.icon(
                          onPressed: _showReportDialog,
                          icon: const Icon(Icons.flag_outlined, size: 16, color: AppTheme.textDim),
                          label: Text(
                            'Report Profile',
                            style: GoogleFonts.inter(fontSize: 13, color: AppTheme.textDim),
                          ),
                        ),
                        const SizedBox(width: 16),
                        TextButton.icon(
                          onPressed: _showBlockDialog,
                          icon: const Icon(Icons.block_outlined, size: 16, color: AppTheme.errorRed),
                          label: Text(
                            'Block User',
                            style: GoogleFonts.inter(fontSize: 13, color: AppTheme.errorRed),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Bottom Action Bar
              if (widget.onPass != null || widget.onLike != null || widget.onSuperLike != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  decoration: const BoxDecoration(
                    color: AppTheme.bgSurface,
                    border: Border(top: BorderSide(color: AppTheme.glassBorder)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      if (widget.onPass != null)
                        _buildCircleBtn(
                          icon: Icons.close_rounded,
                          color: AppTheme.errorRed,
                          size: 54,
                          onTap: () {
                            Navigator.pop(context);
                            widget.onPass!();
                          },
                        ),
                      if (widget.onSuperLike != null)
                        _buildCircleBtn(
                          icon: Icons.star_rounded,
                          color: const Color(0xFF4CC9F0),
                          size: 48,
                          onTap: () {
                            Navigator.pop(context);
                            widget.onSuperLike!();
                          },
                        ),
                      if (widget.onLike != null)
                        _buildCircleBtn(
                          icon: Icons.favorite_rounded,
                          color: AppTheme.successGreen,
                          size: 54,
                          onTap: () {
                            Navigator.pop(context);
                            widget.onLike!();
                          },
                        ),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildScoreBar(String label, double value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textMuted)),
            Text('${(value * 100).toInt()}%', style: GoogleFonts.inter(fontSize: 12, color: color, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value.clamp(0.0, 1.0),
            backgroundColor: Colors.white10,
            valueColor: AlwaysStoppedAnimation(color),
            minHeight: 6,
          ),
        ),
      ],
    );
  }

  Widget _buildCircleBtn({
    required IconData icon,
    required Color color,
    required double size,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(size),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          shape: BoxShape.circle,
          border: Border.all(color: color.withValues(alpha: 0.4), width: 1.5),
        ),
        child: Icon(icon, color: color, size: size * 0.5),
      ),
    );
  }
}
