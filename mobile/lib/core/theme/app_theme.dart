import 'package:flutter/material.dart';

import '../constants/app_colors.dart';

/// Gaya teks: judul bergaya taktis (Chakra Petch) dan angka telemetri (JetBrains Mono).
class DccText {
  const DccText._();

  static TextStyle head(Color color, {double size = 13, FontWeight weight = FontWeight.w600, double ls = 8}) =>
      TextStyle(fontFamily: 'ChakraPetch', fontSize: size, fontWeight: weight, color: color, letterSpacing: size * ls / 100);

  static TextStyle mono(Color color, {double size = 12, FontWeight weight = FontWeight.w500, double ls = 0}) =>
      TextStyle(fontFamily: 'JetBrainsMono', fontSize: size, fontWeight: weight, color: color, letterSpacing: size * ls / 100);
}

class AppTheme {
  const AppTheme._();

  static ThemeData dark() => _build(DccColors.dark, Brightness.dark);
  static ThemeData light() => _build(DccColors.light, Brightness.light);

  static ThemeData _build(DccColors c, Brightness brightness) {
    final base = ThemeData(brightness: brightness, useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: c.bg,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: c.accent,
        onPrimary: c.accentInk,
        secondary: c.accent,
        onSecondary: c.accentInk,
        error: c.danger,
        onError: Colors.white,
        surface: c.panel,
        onSurface: c.text,
      ),
      textTheme: base.textTheme.apply(bodyColor: c.text, displayColor: c.text),
      dividerColor: c.border,
      extensions: <ThemeExtension<dynamic>>[c],
      snackBarTheme: SnackBarThemeData(
        backgroundColor: c.raised,
        contentTextStyle: TextStyle(color: c.text),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
