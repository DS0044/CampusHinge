import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/app_theme.dart';
import '../config/api_config.dart';
import '../models/deck_model.dart';
import '../models/intent_model.dart';
import 'profile_detail_sheet.dart';

class SwipeableCardStack extends StatefulWidget {
  final List<DiscoverProfile> profiles;
  final SuperLikeStatus superLikeStatus;
  final Function(SwipeAction) onSwipe;
  final VoidCallback onRefresh;

  const SwipeableCardStack({
    super.key,
    required this.profiles,
    required this.superLikeStatus,
    required this.onSwipe,
    required this.onRefresh,
  });

  @override
  State<SwipeableCardStack> createState() => _SwipeableCardStackState();
}

class _SwipeableCardStackState extends State<SwipeableCardStack> with SingleTickerProviderStateMixin {
  Offset _dragOffset = Offset.zero;
  int _photoIndex = 0;
  late AnimationController _animController;
  Animation<Offset>? _flyAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
  }

  @override
  void didUpdateWidget(SwipeableCardStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.profiles.isEmpty ||
        (oldWidget.profiles.isNotEmpty &&
            widget.profiles.isNotEmpty &&
            oldWidget.profiles.first.profile.userId != widget.profiles.first.profile.userId)) {
      _photoIndex = 0;
      _dragOffset = Offset.zero;
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _triggerSwipe(SwipeAction action) {
    if (widget.profiles.isEmpty) return;

    Offset target;
    switch (action) {
      case SwipeAction.like:
        target = const Offset(500, 0);
        break;
      case SwipeAction.pass:
        target = const Offset(-500, 0);
        break;
      case SwipeAction.superLike:
        target = const Offset(0, -600);
        break;
    }

    _flyAnimation = Tween<Offset>(
      begin: _dragOffset,
      end: target,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));

    _animController.forward(from: 0).then((_) {
      _animController.reset();
      setState(() {
        _dragOffset = Offset.zero;
        _photoIndex = 0;
      });
      widget.onSwipe(action);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.profiles.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  color: AppTheme.primaryPink.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.primaryPink.withValues(alpha: 0.3)),
                ),
                child: const Center(
                  child: Text('🎓', style: TextStyle(fontSize: 42)),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'No Profiles Available',
                style: GoogleFonts.outfit(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textMain,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'You’ve seen all current campus recommendations for this mode. Check back soon or switch your intent!',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 14, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: widget.onRefresh,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Refresh Deck'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryPink,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final top = widget.profiles[0];
    final second = widget.profiles.length > 1 ? widget.profiles[1] : null;

    return Column(
      children: [
        // Main Swiping Deck
        Expanded(
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Underneath card preview
              if (second != null)
                Transform.scale(
                  scale: 0.94,
                  child: Opacity(
                    opacity: 0.7,
                    child: _buildCardContent(second, isTop: false),
                  ),
                ),

              // Top interactive card
              AnimatedBuilder(
                animation: _animController,
                builder: (ctx, child) {
                  final offset = _flyAnimation?.value ?? _dragOffset;
                  final angle = (offset.dx / 400.0) * (math.pi / 14);

                  return Transform.translate(
                    offset: offset,
                    child: Transform.rotate(
                      angle: angle,
                      child: GestureDetector(
                        onPanUpdate: (details) {
                          setState(() {
                            _dragOffset += details.delta;
                          });
                        },
                        onPanEnd: (details) {
                          if (_dragOffset.dx > 120) {
                            _triggerSwipe(SwipeAction.like);
                          } else if (_dragOffset.dx < -120) {
                            _triggerSwipe(SwipeAction.pass);
                          } else if (_dragOffset.dy < -140 && widget.superLikeStatus.available) {
                            _triggerSwipe(SwipeAction.superLike);
                          } else {
                            setState(() {
                              _dragOffset = Offset.zero;
                            });
                          }
                        },
                        child: _buildCardContent(top, isTop: true),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),

        // Bottom Action Dock
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // Pass Button (X)
              _buildActionButton(
                icon: Icons.close_rounded,
                color: AppTheme.errorRed,
                size: 60,
                iconSize: 30,
                onTap: () => _triggerSwipe(SwipeAction.pass),
              ),

              // Super Like Button (Star)
              _buildSuperLikeButton(),

              // Like Button (Heart)
              _buildActionButton(
                icon: Icons.favorite_rounded,
                color: AppTheme.successGreen,
                size: 60,
                iconSize: 30,
                onTap: () => _triggerSwipe(SwipeAction.like),
              ),

              // Info / Details Button
              _buildActionButton(
                icon: Icons.info_outline_rounded,
                color: AppTheme.infoBlue,
                size: 46,
                iconSize: 22,
                onTap: () {
                  ProfileDetailSheet.show(
                    context,
                    profile: top.profile,
                    breakdown: top.compatibilityBreakdown,
                    compatibilityScore: top.compatibilityScore,
                    onPass: () => _triggerSwipe(SwipeAction.pass),
                    onLike: () => _triggerSwipe(SwipeAction.like),
                    onSuperLike: widget.superLikeStatus.available
                        ? () => _triggerSwipe(SwipeAction.superLike)
                        : null,
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCardContent(DiscoverProfile discoverProfile, {required bool isTop}) {
    final profile = discoverProfile.profile;
    final photos = profile.photos;
    final intentConfig = IntentConfig.get(profile.activeIntent);
    final photoCount = photos.isNotEmpty ? photos.length : 1;

    final currentIdx = isTop ? _photoIndex.clamp(0, photoCount - 1) : 0;
    final photoUrl = photos.isNotEmpty ? ApiConfig.resolvePhotoUrl(photos[currentIdx]) : '';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
        border: Border.all(color: AppTheme.glassBorder, width: 1.5),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Student Photo
            if (photoUrl.isNotEmpty)
              CachedNetworkImage(
                imageUrl: photoUrl,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(
                  color: AppTheme.bgCard,
                  child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                ),
                errorWidget: (context, url, err) => Container(
                  color: AppTheme.bgCard,
                  child: const Center(
                    child: Icon(Icons.person, size: 80, color: AppTheme.textDim),
                  ),
                ),
              )
            else
              Container(
                color: AppTheme.bgCard,
                child: const Center(
                  child: Icon(Icons.person, size: 80, color: AppTheme.textDim),
                ),
              ),

            // Top gradient & photo indicator bar
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0x99000000), Colors.transparent],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
                child: Row(
                  children: List.generate(
                    photoCount,
                    (idx) => Expanded(
                      child: Container(
                        height: 3.5,
                        margin: const EdgeInsets.symmetric(horizontal: 2),
                        decoration: BoxDecoration(
                          color: idx == currentIdx ? Colors.white : Colors.white.withValues(alpha: 0.35),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // Left / Right tap zones for photo cycling (Top card only)
            if (isTop && photoCount > 1)
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onTap: () {
                        if (_photoIndex > 0) {
                          setState(() => _photoIndex--);
                        }
                      },
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onTap: () {
                        if (_photoIndex < photoCount - 1) {
                          setState(() => _photoIndex++);
                        }
                      },
                    ),
                  ),
                ],
              ),

            // Bottom Gradient & Information Overlay
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 40, 20, 24),
                decoration: const BoxDecoration(
                  gradient: AppTheme.photoOverlayGradient,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Mode Tag Pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: intentConfig.badgeBg,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: intentConfig.badgeBorder),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(intentConfig.icon, style: const TextStyle(fontSize: 12)),
                          const SizedBox(width: 4),
                          Text(
                            intentConfig.label,
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: intentConfig.color,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Name, Age, Verification
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            profile.name,
                            style: GoogleFonts.outfit(
                              fontSize: 26,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (profile.age != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            '${profile.age}',
                            style: GoogleFonts.outfit(
                              fontSize: 24,
                              fontWeight: FontWeight.w300,
                              color: Colors.white70,
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

                    // Academic Info
                    Text(
                      '${profile.branch ?? 'Campus Student'} ${profile.year != null ? '• Class of ${profile.year}' : ''}',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                    ),

                    // Bio snippet
                    if (profile.bio != null && profile.bio!.trim().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        profile.bio!.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: Colors.white.withValues(alpha: 0.85),
                          height: 1.35,
                        ),
                      ),
                    ],

                    // Shared Interests / Tags preview
                    if (discoverProfile.sharedInterests.isNotEmpty || profile.interests.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: (discoverProfile.sharedInterests.isNotEmpty
                                ? discoverProfile.sharedInterests
                                : profile.interests)
                            .take(3)
                            .map((tag) {
                          final isShared = discoverProfile.sharedInterests.contains(tag);
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: isShared
                                  ? AppTheme.primaryPink.withValues(alpha: 0.25)
                                  : Colors.black.withValues(alpha: 0.35),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isShared
                                    ? AppTheme.primaryPink.withValues(alpha: 0.5)
                                    : Colors.white24,
                              ),
                            ),
                            child: Text(
                              tag,
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: isShared ? FontWeight.w600 : FontWeight.normal,
                                color: isShared ? AppTheme.primaryPink : Colors.white,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // Dynamic Swiping Overlay Stamp
            if (isTop && _dragOffset != Offset.zero) _buildStampOverlay(),
          ],
        ),
      ),
    );
  }

  Widget _buildStampOverlay() {
    final dx = _dragOffset.dx;
    final dy = _dragOffset.dy;

    if (dy < -80 && dx.abs() < 100) {
      // Super Like Stamp
      return Positioned(
        bottom: 120,
        left: 0,
        right: 0,
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF4CC9F0).withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white, width: 2),
            ),
            child: Text(
              'SUPER LIKE',
              style: GoogleFonts.outfit(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                letterSpacing: 2,
              ),
            ),
          ),
        ),
      );
    }

    if (dx > 40) {
      // LIKE Stamp
      final opacity = (dx / 120.0).clamp(0.0, 1.0);
      return Positioned(
        top: 60,
        left: 30,
        child: Opacity(
          opacity: opacity,
          child: Transform.rotate(
            angle: -0.25,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.successGreen, width: 3),
              ),
              child: Text(
                'LIKE',
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.successGreen,
                  letterSpacing: 1.5,
                ),
              ),
            ),
          ),
        ),
      );
    } else if (dx < -40) {
      // NOPE Stamp
      final opacity = (-dx / 120.0).clamp(0.0, 1.0);
      return Positioned(
        top: 60,
        right: 30,
        child: Opacity(
          opacity: opacity,
          child: Transform.rotate(
            angle: 0.25,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.errorRed, width: 3),
              ),
              child: Text(
                'NOPE',
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.errorRed,
                  letterSpacing: 1.5,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildActionButton({
    required IconData icon,
    required Color color,
    required double size,
    required double iconSize,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(size),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppTheme.bgCard,
          shape: BoxShape.circle,
          border: Border.all(color: color.withValues(alpha: 0.4), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.18),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Icon(icon, color: color, size: iconSize),
      ),
    );
  }

  Widget _buildSuperLikeButton() {
    final available = widget.superLikeStatus.available;
    const color = Color(0xFF4CC9F0);

    return InkWell(
      onTap: available ? () => _triggerSwipe(SwipeAction.superLike) : null,
      borderRadius: BorderRadius.circular(52),
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: AppTheme.bgCard,
          shape: BoxShape.circle,
          border: Border.all(
            color: available ? color.withValues(alpha: 0.6) : Colors.white12,
            width: 1.5,
          ),
          boxShadow: available
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.2),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : [],
        ),
        child: Icon(
          Icons.star_rounded,
          color: available ? color : AppTheme.textDim,
          size: 26,
        ),
      ),
    );
  }
}
