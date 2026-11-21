import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';

class ChartSeries {
  const ChartSeries({required this.label, required this.color, required this.values});

  final String label;
  final Color color;
  final List<double?> values;
}

class TelemetryLineChart extends StatelessWidget {
  const TelemetryLineChart({
    super.key,
    required this.title,
    required this.series,
    this.height = 116,
    this.unit = '',
  });

  final String title;
  final List<ChartSeries> series;
  final double height;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return HudChartFrame(
      title: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(height: height, child: CustomPaint(painter: _LinePainter(series: series, colors: c))),
          const SizedBox(height: 6),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              for (final s in series)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 8, height: 8, color: s.color),
                    const SizedBox(width: 5),
                    Text('${s.label} ${_last(s.values)}$unit', style: DccText.mono(c.textSecondary, size: 9)),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _last(List<double?> values) {
    for (var i = values.length - 1; i >= 0; i--) {
      final value = values[i];
      if (value != null) return value.toStringAsFixed(1);
    }
    return '--';
  }
}

class HudChartFrame extends StatelessWidget {
  const HudChartFrame({super.key, required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: c.panel, border: Border.all(color: c.border), borderRadius: BorderRadius.circular(6)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title.toUpperCase(), style: DccText.head(c.textSecondary, size: 9, weight: FontWeight.w700, ls: 14)),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class BarDatum {
  const BarDatum(this.label, this.value, {this.color});

  final String label;
  final double value;
  final Color? color;
}

class MiniBarChart extends StatelessWidget {
  const MiniBarChart({super.key, required this.title, required this.data, this.height = 120, this.unit = ''});

  final String title;
  final List<BarDatum> data;
  final double height;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final max = data.fold<double>(0, (m, d) => d.value > m ? d.value : m);
    return HudChartFrame(
      title: title,
      child: SizedBox(
        height: height,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (final item in data)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 5),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        item.value.toStringAsFixed(item.value >= 10 ? 0 : 1) + unit,
                        style: DccText.mono(c.textSecondary, size: 9),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        width: double.infinity,
                        height: max <= 0 ? 2 : (height - 38) * (item.value / max),
                        decoration: BoxDecoration(
                          color: item.color ?? c.accent,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(item.label, style: DccText.head(c.textMuted, size: 8, weight: FontWeight.w600, ls: 6), textAlign: TextAlign.center),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _LinePainter extends CustomPainter {
  _LinePainter({required this.series, required this.colors});

  final List<ChartSeries> series;
  final DccColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final all = series.expand((s) => s.values).whereType<double>().toList();
    if (all.isEmpty) return;
    var min = all.reduce((a, b) => a < b ? a : b);
    var max = all.reduce((a, b) => a > b ? a : b);
    if (max - min < 0.001) {
      max += 1;
      min -= 1;
    }
    final pad = (max - min) * 0.12;
    min -= pad;
    max += pad;

    final grid = Paint()..color = colors.border;
    for (var i = 0; i <= 4; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid..strokeWidth = 0.5);
    }

    for (final s in series) {
      final paint = Paint()
        ..color = s.color
        ..strokeWidth = 1.8
        ..style = PaintingStyle.stroke;
      final path = Path();
      var started = false;
      for (var i = 0; i < s.values.length; i++) {
        final value = s.values[i];
        if (value == null) {
          started = false;
          continue;
        }
        final x = s.values.length <= 1 ? 0.0 : size.width * i / (s.values.length - 1);
        final y = size.height - (value - min) / (max - min) * size.height;
        if (!started) {
          path.moveTo(x, y);
          started = true;
        } else {
          path.lineTo(x, y);
        }
      }
      canvas.drawPath(path, paint);
      final dotPaint = Paint()..color = s.color;
      for (var i = s.values.length - 1; i >= 0; i--) {
        final value = s.values[i];
        if (value == null) continue;
        final x = s.values.length <= 1 ? 0.0 : size.width * i / (s.values.length - 1);
        final y = size.height - (value - min) / (max - min) * size.height;
        canvas.drawCircle(Offset(x, y), 2.5, dotPaint);
        break;
      }
    }

    _label(canvas, max.toStringAsFixed(1), const Offset(2, 2), colors.textMuted);
    _label(canvas, min.toStringAsFixed(1), Offset(2, size.height - 12), colors.textMuted);
  }

  void _label(Canvas canvas, String text, Offset offset, Color color) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: DccText.mono(color, size: 9)),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant _LinePainter oldDelegate) => true;
}
