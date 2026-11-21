import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/hud_panel.dart';
import '../../dashboard/providers/dashboard_provider.dart';
import '../widgets/drone_map.dart';

class MapPage extends StatefulWidget {
  const MapPage({super.key, required this.provider});

  final DashboardProvider provider;

  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> {
  bool _showPath = true;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final provider = widget.provider;
    final s = provider.status;
    final coordinate = s.lat == null || s.lon == null
        ? 'MENUNGGU GPS'
        : '${s.lat!.toStringAsFixed(6)}, ${s.lon!.toStringAsFixed(6)}';
    final pathPoints = provider.samples.where((p) => p.lat != null && p.lon != null).length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            const StatusPill('Live map', tone: PillTone.info),
            StatusPill('GPS ${s.gpsFix ?? '--'}D', tone: s.gpsFix != null && s.gpsFix! >= 3 ? PillTone.ok : PillTone.warn),
            StatusPill('${provider.drops.length} drop', tone: PillTone.info),
            StatusPill('$pathPoints titik', tone: PillTone.info),
          ],
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            backgroundColor: _showPath ? withA(c.accent, 0.12) : null,
            foregroundColor: _showPath ? c.accent : c.text,
            side: BorderSide(color: _showPath ? c.accent : c.border),
          ),
          onPressed: () => setState(() => _showPath = !_showPath),
          icon: const Icon(Icons.timeline, size: 15),
          label: Text(
            _showPath ? 'SEMBUNYIKAN FLIGHT PATH' : 'TAMPILKAN FLIGHT PATH',
            style: DccText.head(_showPath ? c.accent : c.text, size: 10, weight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Peta taktis',
          meta: 'ITENAS · auto-center',
          padding: EdgeInsets.zero,
          child: LiveMap(
            status: s,
            drops: provider.drops,
            path: provider.samples,
            showPath: _showPath,
          ),
        ),
        const SizedBox(height: 10),
        HudPanel(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('KOORDINAT DRONE', style: DccText.head(c.textMuted, size: 9, weight: FontWeight.w600, ls: 14)),
              const SizedBox(height: 4),
              Text(coordinate, style: DccText.mono(c.text, size: 16, weight: FontWeight.w600)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _Info(label: 'Ketinggian', value: '${(s.alt ?? 0).toStringAsFixed(1)} m')),
                  const SizedBox(width: 8),
                  Expanded(child: _Info(label: 'Kecepatan', value: '${(s.speed ?? 0).toStringAsFixed(1)} m/s')),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _Info(label: 'Heading', value: '${(s.yaw?.round() ?? 0).toString().padLeft(3, '0')}°')),
                  const SizedBox(width: 8),
                  Expanded(child: _Info(label: 'Mode', value: s.mode ?? '-')),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: c.inset, border: Border.all(color: c.border), borderRadius: BorderRadius.circular(4)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: DccText.head(c.textMuted, size: 8, weight: FontWeight.w600, ls: 12)),
          const SizedBox(height: 4),
          Text(value, style: DccText.mono(c.text, size: 12, weight: FontWeight.w600)),
        ],
      ),
    );
  }
}
