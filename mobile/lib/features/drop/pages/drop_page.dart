import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/hud_panel.dart';
import '../../dashboard/providers/dashboard_provider.dart';
import '../widgets/drop_history_list.dart';

class DropPage extends StatefulWidget {
  const DropPage({super.key, required this.provider});

  final DashboardProvider provider;

  @override
  State<DropPage> createState() => _DropPageState();
}

class _DropPageState extends State<DropPage> {
  late final TextEditingController _thrust;
  late final TextEditingController _duration;

  @override
  void initState() {
    super.initState();
    final config = widget.provider.dropConfig;
    _thrust = TextEditingController(text: config.thrustPercent.toStringAsFixed(0));
    _duration = TextEditingController(text: config.durationS.toStringAsFixed(1));
  }

  @override
  void dispose() {
    _thrust.dispose();
    _duration.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final thrust = double.tryParse(_thrust.text.replaceAll(',', '.'));
    final duration = double.tryParse(_duration.text.replaceAll(',', '.'));
    if (thrust == null || duration == null || thrust < 0 || thrust > 100 || duration <= 0) {
      _snack('Thrust 0-100% dan durasi lebih dari 0 detik.', warn: true);
      return;
    }
    final error = await widget.provider.configureDrop(thrustPercent: thrust, durationS: duration);
    if (!mounted) return;
    _snack(error ?? 'Konfigurasi drop tersimpan di backend.', warn: error != null);
  }

  Future<void> _drop() async {
    final c = context.dcc;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: c.raised,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6), side: BorderSide(color: withA(c.accent, 0.55))),
        title: Text('KONFIRMASI DROP', style: DccText.head(c.text, size: 15, weight: FontWeight.w700, ls: 8)),
        content: Text('Perintah drop akan dikirim ke backend.', style: TextStyle(color: c.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('BATAL', style: DccText.head(c.textSecondary, size: 13))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: c.accent, foregroundColor: c.accentInk),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('DROP SEKARANG', style: DccText.head(c.accentInk, size: 13, weight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    final record = await widget.provider.drop();
    if (!mounted) return;
    _snack(
      record == null
          ? widget.provider.error ?? 'Gagal mengirim drop.'
          : 'Drop terkirim · ${record.thrust.round()}% · ${record.duration.toStringAsFixed(1)}s',
      warn: record == null,
    );
  }

  void _snack(String message, {bool warn = false}) {
    final c = context.dcc;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message, style: DccText.mono(warn ? c.warn : c.text, size: 11))),
    );
  }

  Widget _readiness(DccColors c) {
    final s = widget.provider.status;
    final mqtt = widget.provider.mqtt;
    final items = [
      (label: 'Backend online', ok: widget.provider.backendOnline),
      (label: 'MQTT terhubung', ok: mqtt?.connected ?? false),
      (label: 'GPS 3D fix', ok: s.gpsFix != null && s.gpsFix! >= 3),
      (label: 'Benih tersedia', ok: s.seed.remaining > 0),
      (label: 'Drone armed', ok: s.armed),
    ];
    final ready = items.every((item) => item.ok);
    return HudPanel(
      title: 'Kesiapan drop',
      meta: ready ? 'READY' : 'BELUM SIAP',
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Icon(item.ok ? Icons.check_circle_outline : Icons.radio_button_unchecked,
                      size: 14, color: item.ok ? c.ok : c.textMuted),
                  const SizedBox(width: 8),
                  Text(item.label, style: DccText.mono(item.ok ? c.text : c.textMuted, size: 10)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final config = widget.provider.dropConfig;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            const StatusPill('Drop control', tone: PillTone.info),
            StatusPill('Servo CH ${config.servoChannel}', tone: PillTone.info),
            StatusPill('${config.seedsPerDrop} benih/drop', tone: PillTone.info),
          ],
        ),
        const SizedBox(height: 10),
        _readiness(c),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Konfigurasi drop',
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(child: _Field(label: 'Thrust (%)', controller: _thrust, suffix: '%')),
                  const SizedBox(width: 10),
                  Expanded(child: _Field(label: 'Durasi (s)', controller: _duration, suffix: 's')),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: OutlinedButton.icon(
                  onPressed: _save,
                  icon: const Icon(Icons.save_outlined, size: 16),
                  label: Text('SIMPAN KE BACKEND', style: DccText.head(c.text, size: 12, weight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Drop sekarang',
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Benih tersisa: ${widget.provider.status.seed.remaining} / ${widget.provider.status.seed.loaded}',
                style: DccText.mono(c.textSecondary, size: 12),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 48,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: c.accent, foregroundColor: c.accentInk, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4))),
                  onPressed: widget.provider.busy ? null : _drop,
                  icon: const Icon(Icons.water_drop_outlined, size: 18),
                  label: Text('TEBAR BENIH', style: DccText.head(c.accentInk, size: 14, weight: FontWeight.w700, ls: 10)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text('DROP TERAKHIR', style: DccText.head(c.textSecondary, size: 9, weight: FontWeight.w700, ls: 16)),
        const SizedBox(height: 6),
        DropHistoryList(drops: widget.provider.drops, max: 5),
      ],
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.controller, required this.suffix});

  final String label;
  final TextEditingController controller;
  final String suffix;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      style: DccText.mono(c.text, size: 15),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: DccText.head(c.textMuted, size: 10, weight: FontWeight.w600, ls: 10),
        suffixText: suffix,
        suffixStyle: DccText.mono(c.textSecondary, size: 11),
        filled: true,
        fillColor: c.inset,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: c.border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: c.border)),
      ),
    );
  }
}
