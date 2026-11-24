import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';

/// Gauge busur 270° (celah di bawah).
class GaugePainter extends CustomPainter {
  GaugePainter({required this.fraction, required this.track, required this.value, this.stroke = 10});

  final double fraction;
  final Color track;
  final Color value;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final r = (math.min(size.width, size.height) - stroke) / 2;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: r);
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    const start = 135 * math.pi / 180;
    const sweep = 270 * math.pi / 180;
    canvas.drawArc(rect, start, sweep, false, p..color = track);
    canvas.drawArc(rect, start, sweep * fraction.clamp(0.0, 1.0), false, p..color = value);
  }

  @override
  bool shouldRepaint(GaugePainter old) => old.fraction != fraction || old.track != track || old.value != value;
}

/// Indikator horizon (pitch dan roll dalam derajat).
class HorizonPainter extends CustomPainter {
  HorizonPainter({required this.pitch, required this.roll, required this.colors});

  final double pitch;
  final double roll;
  final DccColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final c = colors;
    final center = size.center(Offset.zero);
    final r = size.width / 2;
    final pxPerDeg = size.width / 150 * 3;

    canvas.save();
    canvas.clipPath(Path()..addOval(Rect.fromCircle(center: center, radius: r)));
    canvas.drawRect(Offset.zero & size, Paint()..color = c.inset);
    canvas.translate(center.dx, center.dy);
    canvas.rotate(-roll * math.pi / 180);
    final hy = pitch * pxPerDeg;
    final big = size.width * 2;
    canvas.drawRect(Rect.fromLTRB(-big, -big, big, hy), Paint()..color = withA(c.info, 0.3));
    canvas.drawRect(Rect.fromLTRB(-big, hy, big, big), Paint()..color = withA(c.warn, 0.18));
    canvas.drawLine(Offset(-big, hy), Offset(big, hy), Paint()..color = c.accent..strokeWidth = 1.5);
    final ladder = Paint()
      ..color = withA(c.text, 0.6)
      ..strokeWidth = 1.5;
    for (final d in [-20, -10, 10, 20]) {
      final y = hy - d * pxPerDeg;
      final w = d.abs() == 20 ? r * 0.3 : r * 0.19;
      canvas.drawLine(Offset(-w, y), Offset(w, y), ladder);
    }
    canvas.restore();

    final plane = Paint()
      ..color = c.accent
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(center, 4, plane);
    canvas.drawLine(Offset(center.dx - r * 0.5, center.dy), Offset(center.dx - r * 0.2, center.dy), plane);
    canvas.drawLine(Offset(center.dx + r * 0.2, center.dy), Offset(center.dx + r * 0.5, center.dy), plane);
    canvas.drawCircle(
      center,
      r - 1.5,
      Paint()
        ..color = c.borderStrong
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
  }

  @override
  bool shouldRepaint(HorizonPainter old) => old.pitch != pitch || old.roll != roll || old.colors != colors;
}
