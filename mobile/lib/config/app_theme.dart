import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Colors
  static const Color bgDark = Color(0xFF090A10);
  static const Color bgSurface = Color(0xFF12141F);
  static const Color bgCard = Color(0xFF161926);
  static const Color bgCardHover = Color(0xFF1E2234);

  static const Color primaryPink = Color(0xFFFF4081);
  static const Color primaryCoral = Color(0xFFFF6B6B);
  static const Color primaryOrange = Color(0xFFFF8E53);
  static const Color accentPurple = Color(0xFF7C4DFF);
  static const Color primaryPurple = Color(0xFF7C4DFF);
  static const Color primaryPurpleLight = Color(0xFFA485FF);
  static const Color bgDarkElevated = Color(0xFF161926);

  static const Color textMain = Color(0xFFF8FAFC);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color textDim = Color(0xFF64748B);

  static const Color glassBorder = Color(0x1AFFFFFF);
  static const Color glassBorderLight = Color(0x28FFFFFF);

  // Status & Mode Colors
  static const Color successGreen = Color(0xFF06D6A0);
  static const Color warningAmber = Color(0xFFFFB703);
  static const Color infoBlue = Color(0xFF4CC9F0);
  static const Color errorRed = Color(0xFFFF4D6D);

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primaryPink, primaryCoral, primaryOrange],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient accentGradient = LinearGradient(
    colors: [primaryPink, accentPurple],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cardGradient = LinearGradient(
    colors: [Color(0xCC161926), Color(0xAA12141F)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const LinearGradient photoOverlayGradient = LinearGradient(
    colors: [
      Colors.transparent,
      Color(0x22000000),
      Color(0xAA090A10),
      Color(0xF0090A10),
    ],
    stops: [0.3, 0.5, 0.8, 1.0],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static ThemeData get darkTheme {
    final baseTextTheme = GoogleFonts.interTextTheme(ThemeData.dark().textTheme);

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgDark,
      primaryColor: primaryPink,
      colorScheme: const ColorScheme.dark(
        primary: primaryPink,
        secondary: accentPurple,
        surface: bgSurface,
        error: errorRed,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: textMain,
      ),
      textTheme: baseTextTheme.copyWith(
        displayLarge: GoogleFonts.outfit(
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: textMain,
          letterSpacing: -0.5,
        ),
        displayMedium: GoogleFonts.outfit(
          fontSize: 26,
          fontWeight: FontWeight.bold,
          color: textMain,
          letterSpacing: -0.5,
        ),
        displaySmall: GoogleFonts.outfit(
          fontSize: 22,
          fontWeight: FontWeight.w700,
          color: textMain,
        ),
        headlineMedium: GoogleFonts.outfit(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: textMain,
        ),
        titleLarge: GoogleFonts.outfit(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: textMain,
        ),
        titleMedium: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: textMain,
        ),
        bodyLarge: GoogleFonts.inter(
          fontSize: 15,
          color: textMain,
          height: 1.4,
        ),
        bodyMedium: GoogleFonts.inter(
          fontSize: 13,
          color: textMuted,
          height: 1.4,
        ),
        bodySmall: GoogleFonts.inter(
          fontSize: 11,
          color: textDim,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgCard,
        hintStyle: GoogleFonts.inter(color: textDim, fontSize: 14),
        labelStyle: GoogleFonts.inter(color: textMuted, fontSize: 14),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: glassBorder, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: glassBorder, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: primaryPink, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: errorRed, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          foregroundColor: Colors.white,
          backgroundColor: primaryPink,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: GoogleFonts.outfit(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        ),
      ),
      cardTheme: CardThemeData(
        color: bgCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: glassBorder, width: 1),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.outfit(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: textMain,
        ),
        iconTheme: const IconThemeData(color: textMain),
      ),
    );
  }
}
