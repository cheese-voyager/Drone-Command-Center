import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';

Path _dashed(Path src, {double on = 5, double off = 5}) {
  final out = Path();
  for (final m in src.computeMetrics()) {
    for (double d = 0; d < m.length; d += on + off) {
      out.addPath(m.extractPath(d, math.min(d + on, m.length)), Offset.zero);
    }
  }
  return out;
}

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

/// Ilustrasi peta: grid, area tebar, jejak terbang, titik drop, dan posisi drone.
/// Hanya gambar contoh; ganti dengan peta sungguhan saat terhubung ke GPS.
class MapPainter extends CustomPainter {
  MapPainter(this.colors);

  final DccColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final c = colors;
    canvas.drawRect(Offset.zero & size, Paint()..color = c.inset);
    final grid = Paint()
      ..color = c.border
      ..strokeWidth = 1;
    for (double x = 32; x < size.width; x += 32) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (double y = 32; y < size.height; y += 32) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }

    final x0 = size.width * 0.12, x1 = size.width * 0.64;
    final y0 = size.height * 0.2, y1 = size.height * 0.82;
    final field = Path()..addRect(Rect.fromLTRB(x0 - 12, y0 - 12, x1 + 12, y1 + 12));
    canvas.drawPath(field, Paint()..color = withA(c.ok, 0.07));
    canvas.drawPath(
      _dashed(field),
      Paint()
        ..color = withA(c.ok, 0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );

    const passes = 6;
    double yAt(int i) => y1 - (y1 - y0) * i / (passes - 1);
    final done = Path()..moveTo(x0, yAt(0));
    for (var i = 0; i < 4; i++) {
      final toRight = i.isEven;
      done.lineTo(toRight ? x1 : x0, yAt(i));
      if (i < 3) done.lineTo(toRight ? x1 : x0, yAt(i + 1));
    }
    final dx = x0 + (x1 - x0) * 0.55, dy = yAt(4);
    done.lineTo(x0, yAt(4));
    done.lineTo(dx, dy);
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(done, line..color = c.accent..strokeWidth = 2.2);

    final rest = Path()
      ..moveTo(dx, dy)
      ..lineTo(x1, dy)
      ..lineTo(x1, yAt(5))
      ..lineTo(x0, yAt(5));
    canvas.drawPath(_dashed(rest, on: 4, off: 5), line..color = withA(c.accent, 0.45)..strokeWidth = 1.8);

    for (final p in const [[0.25, 0], [0.5, 0], [0.75, 0], [0.75, 1], [0.5, 1], [0.25, 1], [0.25, 2], [0.5, 2]]) {
      final pos = Offset(x0 + (x1 - x0) * p[0], yAt(p[1].toInt()));
      canvas.drawCircle(pos, 4.5, Paint()..color = c.panel);
      canvas.drawCircle(pos, 3.5, Paint()..color = c.warn);
    }

    final drone = Offset(dx, dy);
    canvas.drawCircle(drone, 17, Paint()..color = withA(c.accent, 0.1));
    canvas.drawCircle(
      drone,
      17,
      Paint()
        ..color = withA(c.accent, 0.4)
        ..style = PaintingStyle.stroke,
    );
    final arrow = Path()
      ..moveTo(drone.dx - 6, drone.dy - 7)
      ..lineTo(drone.dx + 8, drone.dy)
      ..lineTo(drone.dx - 6, drone.dy + 7)
      ..lineTo(drone.dx - 3, drone.dy)
      ..close();
    canvas.drawPath(arrow, Paint()..color = c.accent);
    canvas.drawPath(
      arrow,
      Paint()
        ..color = c.panel
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );
  }

  @override
  bool shouldRepaint(MapPainter old) => old.colors != colors;
}
