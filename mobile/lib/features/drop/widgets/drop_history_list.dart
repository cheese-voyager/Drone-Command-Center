import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/models/drop_point.dart';
import '../../../../shared/widgets/hud_panel.dart';

class DropHistoryList extends StatelessWidget {
  const DropHistoryList({super.key, required this.drops, this.max, this.emptyLabel = 'Belum ada drop tercatat.'});

  final List<DropRecord> drops;
  final int? max;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final items = max == null ? drops : drops.take(max!).toList();
    if (items.isEmpty) {
      return HudPanel(
        padding: const EdgeInsets.all(16),
        child: Text(emptyLabel, style: DccText.mono(c.textMuted, size: 11)),
      );
    }
    return Column(
      children: [
        for (final drop in items)
          Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: c.panel,
              border: Border.all(color: c.border),
              borderRadius: BorderRadius.circular(5),
            ),
            child: Row(
              children: [
                Icon(Icons.place_outlined, size: 15, color: c.accent),
                const SizedBox(width: 9),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_time(drop.time), style: DccText.mono(c.text, size: 11, weight: FontWeight.w600)),
                      const SizedBox(height: 3),
                      Text(
                        drop.lat == null || drop.lon == null
                            ? 'Koordinat belum tersedia'
                            : '${drop.lat!.toStringAsFixed(6)}, ${drop.lon!.toStringAsFixed(6)}',
                        style: DccText.mono(c.textMuted, size: 10),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('${drop.thrust.round()}%', style: DccText.mono(c.accent, size: 12, weight: FontWeight.w700)),
                    Text('${drop.duration.toStringAsFixed(1)}s', style: DccText.mono(c.textSecondary, size: 10)),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }

  String _time(double seconds) {
    final dt = DateTime.fromMillisecondsSinceEpoch((seconds * 1000).round());
    String two(int v) => v.toString().padLeft(2, '0');
    return '${two(dt.hour)}:${two(dt.minute)}:${two(dt.second)}';
  }
}
