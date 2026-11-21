import 'package:flutter/material.dart';

/// Warna dengan alpha 0..1 (kompatibel di semua versi Flutter).
Color withA(Color c, double opacity) => c.withAlpha((opacity.clamp(0.0, 1.0) * 255).round());

/// Token warna tema "tactical HUD". Nilainya sama dengan web.
@immutable
class DccColors extends ThemeExtension<DccColors> {
  const DccColors({
    required this.bg,
    required this.panel,
    required this.raised,
    required this.inset,
    required this.border,
    required this.borderStrong,
    required this.text,
    required this.textSecondary,
    required this.textMuted,
    required this.accent,
    required this.accentInk,
    required this.ok,
    required this.warn,
    required this.danger,
    required this.info,
  });

  final Color bg;
  final Color panel;
  final Color raised;
  final Color inset;
  final Color border;
  final Color borderStrong;
  final Color text;
  final Color textSecondary;
  final Color textMuted;
  final Color accent;
  final Color accentInk;
  final Color ok;
  final Color warn;
  final Color danger;
  final Color info;

  static const dark = DccColors(
    bg: Color(0xFF05090E),
    panel: Color(0xFF0A111A),
    raised: Color(0xFF0F1926),
    inset: Color(0xFF070D14),
    border: Color(0xFF15222F),
    borderStrong: Color(0xFF233648),
    text: Color(0xFFE8F2FB),
    textSecondary: Color(0xFF8FA6BB),
    textMuted: Color(0xFF7189A0),
    accent: Color(0xFF2DE2E6),
    accentInk: Color(0xFF04121A),
    ok: Color(0xFF3DDC97),
    warn: Color(0xFFFFB020),
    danger: Color(0xFFE5304B),
    info: Color(0xFF5AA9FF),
  );

  static const light = DccColors(
    bg: Color(0xFFEEF2F8),
    panel: Color(0xFFFFFFFF),
    raised: Color(0xFFF4F7FC),
    inset: Color(0xFFE7EDF6),
    border: Color(0xFFD6DFEC),
    borderStrong: Color(0xFFB5C4DA),
    text: Color(0xFF0F172A),
    textSecondary: Color(0xFF52617A),
    textMuted: Color(0xFF5F6F88),
    accent: Color(0xFF0A8F95),
    accentInk: Color(0xFFFFFFFF),
    ok: Color(0xFF0E8F5B),
    warn: Color(0xFFB26B00),
    danger: Color(0xFFD42A45),
    info: Color(0xFF2563C9),
  );

  @override
  DccColors copyWith({Color? bg, Color? panel, Color? raised, Color? inset, Color? border, Color? borderStrong, Color? text, Color? textSecondary, Color? textMuted, Color? accent, Color? accentInk, Color? ok, Color? warn, Color? danger, Color? info}) {
    return DccColors(
      bg: bg ?? this.bg,
      panel: panel ?? this.panel,
      raised: raised ?? this.raised,
      inset: inset ?? this.inset,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      text: text ?? this.text,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      accent: accent ?? this.accent,
      accentInk: accentInk ?? this.accentInk,
      ok: ok ?? this.ok,
      warn: warn ?? this.warn,
      danger: danger ?? this.danger,
      info: info ?? this.info,
    );
  }

  @override
  DccColors lerp(ThemeExtension<DccColors>? other, double t) {
    if (other is! DccColors) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return DccColors(
      bg: l(bg, other.bg),
      panel: l(panel, other.panel),
      raised: l(raised, other.raised),
      inset: l(inset, other.inset),
      border: l(border, other.border),
      borderStrong: l(borderStrong, other.borderStrong),
      text: l(text, other.text),
      textSecondary: l(textSecondary, other.textSecondary),
      textMuted: l(textMuted, other.textMuted),
      accent: l(accent, other.accent),
      accentInk: l(accentInk, other.accentInk),
      ok: l(ok, other.ok),
      warn: l(warn, other.warn),
      danger: l(danger, other.danger),
      info: l(info, other.info),
    );
  }
}

extension DccContext on BuildContext {
  DccColors get dcc => Theme.of(this).extension<DccColors>()!;
}
