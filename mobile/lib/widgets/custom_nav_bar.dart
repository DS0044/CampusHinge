import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../config/app_theme.dart';

class CustomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final int unreadNotifications;

  const CustomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.unreadNotifications = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      decoration: BoxDecoration(
        color: AppTheme.bgCard.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppTheme.glassBorderLight, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(
                  index: 0,
                  icon: Icons.local_fire_department_rounded,
                  label: 'Discover',
                ),
                _buildNavItem(
                  index: 1,
                  icon: Icons.forum_rounded,
                  label: 'Matches',
                ),
                _buildNavItem(
                  index: 2,
                  icon: Icons.notifications_rounded,
                  label: 'Activity',
                  badgeCount: unreadNotifications,
                ),
                _buildNavItem(
                  index: 3,
                  icon: Icons.person_rounded,
                  label: 'Profile',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required String label,
    int badgeCount = 0,
  }) {
    final isSelected = currentIndex == index;

    return InkWell(
      onTap: () => onTap(index),
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(
          horizontal: isSelected ? 16 : 12,
          vertical: 8,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primaryPink.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: isSelected
              ? Border.all(color: AppTheme.primaryPink.withValues(alpha: 0.35))
              : null,
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  size: 22,
                  color: isSelected ? AppTheme.primaryPink : AppTheme.textDim,
                ),
                if (isSelected) ...[
                  const SizedBox(width: 6),
                  Text(
                    label,
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primaryPink,
                    ),
                  ),
                ],
              ],
            ),

            if (badgeCount > 0)
              Positioned(
                top: -4,
                right: isSelected ? null : -4,
                left: isSelected ? -4 : null,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryPink,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  child: Text(
                    badgeCount > 99 ? '99+' : '$badgeCount',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
