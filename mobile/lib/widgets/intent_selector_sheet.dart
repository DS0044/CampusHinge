import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../config/app_theme.dart';
import '../models/intent_model.dart';
import 'glass_card.dart';

class IntentSelectorSheet extends StatelessWidget {
  final IntentType currentIntent;
  final ValueChanged<IntentType> onIntentSelected;

  const IntentSelectorSheet({
    super.key,
    required this.currentIntent,
    required this.onIntentSelected,
  });

  static Future<void> show(
    BuildContext context, {
    required IntentType currentIntent,
    required ValueChanged<IntentType> onIntentSelected,
  }) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => IntentSelectorSheet(
        currentIntent: currentIntent,
        onIntentSelected: onIntentSelected,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(top: 12, bottom: 32, left: 16, right: 16),
      decoration: const BoxDecoration(
        color: AppTheme.bgDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(top: BorderSide(color: AppTheme.glassBorder, width: 1.5)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
          const SizedBox(height: 18),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Switch Campus Intent',
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textMain,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryPink.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppTheme.primaryPink.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    'Campus Closed Network',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primaryPink,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              'Filter the discover deck by your current goal. Profiles are matched based on mutual campus intent.',
              style: GoogleFonts.inter(fontSize: 13, color: AppTheme.textMuted),
            ),
          ),
          const SizedBox(height: 20),
          ...IntentType.values.map((intent) {
            final config = IntentConfig.get(intent);
            final isSelected = intent == currentIntent;

            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GlassCard(
                borderRadius: 18,
                padding: const EdgeInsets.all(14),
                backgroundColor: isSelected
                    ? config.color.withValues(alpha: 0.18)
                    : AppTheme.bgCard.withValues(alpha: 0.6),
                border: Border.all(
                  color: isSelected ? config.color : AppTheme.glassBorder,
                  width: isSelected ? 1.5 : 1,
                ),
                onTap: () {
                  Navigator.pop(context);
                  onIntentSelected(intent);
                },
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: config.badgeBg,
                        shape: BoxShape.circle,
                        border: Border.all(color: config.badgeBorder),
                      ),
                      child: Center(
                        child: Text(
                          config.icon,
                          style: const TextStyle(fontSize: 22),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                config.label,
                                style: GoogleFonts.outfit(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: isSelected ? config.color : AppTheme.textMain,
                                ),
                              ),
                              if (isSelected) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: config.color,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    'ACTIVE',
                                    style: GoogleFonts.inter(
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            config.description,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: AppTheme.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      isSelected ? Icons.check_circle_rounded : Icons.chevron_right_rounded,
                      color: isSelected ? config.color : AppTheme.textDim,
                      size: 22,
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
