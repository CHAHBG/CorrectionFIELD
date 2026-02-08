import 'package:flutter/material.dart';

/// PROCASEF high-contrast theme optimized for outdoor field work.
///
/// Design principles:
///   - High contrast for direct sunlight readability
///   - Bold fonts for quick scanning
///   - Large touch targets for field use
///   - GPS accuracy color coding: vert / orange / rouge
class AppTheme {
  AppTheme._();

  // ── Brand colors ───────────────────────────────────────────

  static const Color primary = Color(0xFF0C2C52);      // Dark navy
  static const Color primaryLight = Color(0xFF1A4A7A);
  static const Color accent = Color(0xFF2196F3);
  static const Color surface = Color(0xFFF8FAFC);
  static const Color background = Colors.white;

  // ── GPS accuracy colors ────────────────────────────────────

  static const Color gpsExcellent = Color(0xFF0F9D58); // ≤5m green
  static const Color gpsGood = Color(0xFFF4B400);      // 5–15m orange
  static const Color gpsPoor = Color(0xFFDB4437);       // >15m red

  // ── Parcel status colors ───────────────────────────────────

  static const Color parcelPending = Color(0xFFFF6B35);     // Orange
  static const Color parcelCorrected = Color(0xFF2196F3);   // Blue
  static const Color parcelValidated = Color(0xFF0F9D58);   // Green
  static const Color parcelSynced = Color(0xFF9E9E9E);      // Grey

  // ── Parcel type colors ─────────────────────────────────────

  static const Color sansEnquete = Color(0xFFE91E63);   // Pink/Red
  static const Color sansNumero = Color(0xFFFF9800);     // Orange

  // ── Map polygon colors ─────────────────────────────────────

  static const Color communeBorder = Color(0xFF0C2C52);
  static const Color communeFill = Color(0x110C2C52);
  static const Color parcelBorderDefault = Color(0xFFFF6B35);
  static const Color parcelFillDefault = Color(0x33FF6B35);
  static const Color parcelBorderSelected = Color(0xFF2196F3);
  static const Color parcelFillSelected = Color(0x552196F3);

  // ── Theme data ─────────────────────────────────────────────

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        brightness: Brightness.light,
        primary: primary,
        secondary: accent,
        surface: surface,
      ),
      scaffoldBackgroundColor: background,
      fontFamily: 'Roboto',

      // AppBar
      appBarTheme: const AppBarTheme(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 2,
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),

      // Cards
      cardTheme: CardThemeData(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),

      // Buttons — large for field use
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(48, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 15,
          ),
        ),
      ),

      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 4,
      ),

      // Text
      textTheme: const TextTheme(
        headlineMedium: TextStyle(
          fontWeight: FontWeight.w800,
          color: primary,
        ),
        titleLarge: TextStyle(
          fontWeight: FontWeight.w700,
          color: primary,
        ),
        titleMedium: TextStyle(
          fontWeight: FontWeight.w600,
        ),
        bodyLarge: TextStyle(
          fontWeight: FontWeight.w500,
          fontSize: 16,
        ),
        bodyMedium: TextStyle(
          fontWeight: FontWeight.w400,
          fontSize: 14,
        ),
        labelLarge: TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 14,
        ),
      ),

      // Input decoration
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF0F4F8),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFDDE3EA)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFDDE3EA)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primary, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
      ),

      // Bottom sheet
      bottomSheetTheme: const BottomSheetThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
      ),
    );
  }

  // ── Helper: color for GPS accuracy ─────────────────────────

  static Color gpsColor(double accuracyMeters) {
    if (accuracyMeters <= 5) return gpsExcellent;
    if (accuracyMeters <= 15) return gpsGood;
    return gpsPoor;
  }

  // ── Helper: color for parcel status ────────────────────────

  static Color statusColor(String status) {
    switch (status) {
      case 'pending':
        return parcelPending;
      case 'corrected':
        return parcelCorrected;
      case 'validated':
        return parcelValidated;
      case 'synced':
        return parcelSynced;
      default:
        return parcelPending;
    }
  }
}
