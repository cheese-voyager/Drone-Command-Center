import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Panel dengan siku HUD cyan, sama seperti kartu di web.
class HudPanel extends StatelessWidget {
  const HudPanel({
    super.key,
    required this.child,
    this.title,
    this.meta,
    this.padding = const EdgeInsets.all(12),
    this.brackets = true,
  });

  final Widget child;
  final String? title;
  final String? meta;
  final EdgeInsets padding;
  final bool brackets;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Container(
      decoration: BoxDecoration(
        color: c.panel,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(6),
      ),
      child: CustomPaint(
        foregroundPainter: brackets ? _BracketPainter(c.accent) : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (title != null)
              Container(
                height: 34,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.border))),
                child: Row(
                  children: [
                    Container(width: 3, height: 11, color: c.accent),
                    const SizedBox(width: 8),
                    Text(title!.toUpperCase(), style: DccText.head(c.text, size: 11, ls: 14)),
                    const Spacer(),
                    if (meta != null) Text(meta!, style: DccText.mono(c.textMuted, size: 10, weight: FontWeight.w400)),
                  ],
                ),
              ),
            Padding(padding: padding, child: child),
          ],
        ),
      ),
    );
  }
}

class _BracketPainter extends CustomPainter {
  _BracketPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = withA(color, 0.85)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    const l = 10.0;
    final w = size.width, h = size.height;
    void corner(double x, double y, double dx, double dy) {
      canvas.drawLine(Offset(x, y), Offset(x + dx * l, y), p);
      canvas.drawLine(Offset(x, y), Offset(x, y + dy * l), p);
    }

    corner(0, 0, 1, 1);
    corner(w, 0, -1, 1);
    corner(0, h, 1, -1);
    corner(w, h, -1, -1);
  }

  @override
  bool shouldRepaint(_BracketPainter old) => old.color != color;
}

/// Pil status kecil (Pixhawk, GPS, ARM).
enum PillTone { ok, warn, danger, info, accent, neutral }

class StatusPill extends StatelessWidget {
  const StatusPill(this.text, {super.key, this.tone = PillTone.neutral});

  final String text;
  final PillTone tone;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final color = switch (tone) {
      PillTone.ok => c.ok,
      PillTone.warn => c.warn,
      PillTone.danger => c.danger,
      PillTone.info => c.info,
      PillTone.accent => c.accent,
      PillTone.neutral => c.textSecondary,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: withA(color, 0.12),
        border: Border.all(color: withA(color, 0.45)),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(text.toUpperCase(), style: DccText.mono(color, size: 10, ls: 6)),
        ],
      ),
    );
  }
}
