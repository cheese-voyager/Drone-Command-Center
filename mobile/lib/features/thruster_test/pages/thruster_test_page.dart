import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/models/thruster_status.dart';
import '../../../../shared/widgets/charts.dart';
import '../../../../shared/widgets/hud_panel.dart';
import '../../dashboard/providers/dashboard_provider.dart';

class ThrusterTestPage extends StatefulWidget {
  const ThrusterTestPage({super.key, required this.provider});

  final DashboardProvider provider;

  @override
  State<ThrusterTestPage> createState() => _ThrusterTestPageState();
}

class _ThrusterTestPageState extends State<ThrusterTestPage> {
  static const targets = <String>[
    'seeder',
    'motor_1',
    'motor_2',
    'motor_3',
    'motor_4',
    'all_motors',
  ];

  String _target = 'seeder';
  late final TextEditingController _thrust;
  late final TextEditingController _duration;
  ThrusterResult? _result;

  @override
  void initState() {
    super.initState();
    _thrust = TextEditingController(text: '25');
    _duration = TextEditingController(text: '1');
  }

  @override
  void dispose() {
    _thrust.dispose();
    _duration.dispose();
    super.dispose();
  }

  Future<void> _test() async {
    final thrust = double.tryParse(_thrust.text.replaceAll(',', '.'));
    final duration = double.tryParse(_duration.text.replaceAll(',', '.'));
    if (thrust == null || duration == null || thrust < 0 || thrust > 100 || duration <= 0) {
      _snack('Thrust 0-100% dan durasi lebih dari 0 detik.', warn: true);
      return;
    }
    if (_target != 'seeder' && widget.provider.status.armed && thrust > 30) {
      _snack('Tes motor hanya boleh saat disarm dan thrust maksimal 30%.', warn: true);
      return;
    }
    final result = await widget.provider.testThruster(
      target: _target,
      thrustPercent: thrust,
      durationS: duration,
    );
    if (!mounted) return;
    if (result == null) {
      _snack(widget.provider.error ?? 'Gagal mengirim tes thruster.', warn: true);
      return;
    }
    setState(() => _result = result);
    _snack('Tes ${result.target} terkirim ke backend.');
  }

  Future<void> _stop() async {
    final error = await widget.provider.emergencyStop();
    if (!mounted) return;
    _snack(error ?? 'STOP darurat terkirim.', warn: error != null);
  }

  void _snack(String message, {bool warn = false}) {
    final c = context.dcc;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message, style: DccText.mono(warn ? c.warn : c.text, size: 11))),
    );
  }

  Widget _motorSection(DccColors c) {
    final motors = widget.provider.status.motors;
    if (motors.isEmpty) {
      return HudPanel(
        title: 'Motor live',
        padding: const EdgeInsets.all(12),
        child: Text('Belum ada data motor dari backend.', style: DccText.mono(c.textMuted, size: 11)),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MiniBarChart(
          title: 'Motor PWM langsung',
          unit: '%',
          data: [
            for (final motor in motors)
              BarDatum('M${motor.id}', motor.percent, color: c.info),
          ],
        ),
        HudPanel(
          title: 'Motor live',
          padding: const EdgeInsets.all(12),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final motor in motors)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(color: c.inset, border: Border.all(color: c.border), borderRadius: BorderRadius.circular(4)),
                  child: Text(
                    'M${motor.id} ${motor.pwm} PWM · ${motor.percent.toStringAsFixed(0)}%',
                    style: DccText.mono(c.text, size: 10, weight: FontWeight.w600),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            const StatusPill('Thruster test', tone: PillTone.info),
            StatusPill(widget.provider.status.armed ? 'ARMED' : 'DISARMED', tone: widget.provider.status.armed ? PillTone.danger : PillTone.ok),
          ],
        ),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Uji aktuator',
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('TARGET', style: DccText.head(c.textMuted, size: 9, weight: FontWeight.w700, ls: 14)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(color: c.inset, border: Border.all(color: c.border), borderRadius: BorderRadius.circular(4)),
                child: DropdownButton<String>(
                  value: _target,
                  isExpanded: true,
                  dropdownColor: c.raised,
                  underline: const SizedBox(),
                  style: DccText.mono(c.text, size: 13),
                  items: [
                    for (final target in targets)
                      DropdownMenuItem(value: target, child: Text(target.replaceAll('_', ' '))),
                  ],
                  onChanged: (value) => setState(() => _target = value ?? 'seeder'),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _Field(label: 'Thrust (%)', controller: _thrust, suffix: '%')),
                  const SizedBox(width: 10),
                  Expanded(child: _Field(label: 'Durasi (s)', controller: _duration, suffix: 's')),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                _target == 'seeder'
                    ? 'Seeder memakai PWM servo channel 9.'
                    : 'Motor hanya aman saat disarm dengan thrust maksimal 30%.',
                style: DccText.mono(c.textMuted, size: 10),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 46,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: c.info, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4))),
                  onPressed: _test,
                  icon: const Icon(Icons.play_arrow, size: 17),
                  label: Text('JALANKAN TES', style: DccText.head(Colors.white, size: 13, weight: FontWeight.w700, ls: 8)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        _motorSection(c),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Hasil tes terakhir',
          padding: const EdgeInsets.all(12),
          child: _result == null
              ? Text('Belum ada tes dijalankan.', style: DccText.mono(c.textMuted, size: 11))
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Row(label: 'Target', value: _result!.target),
                    _Row(label: 'Thrust', value: '${_result!.thrust.toStringAsFixed(0)}%'),
                    _Row(label: 'Durasi', value: '${_result!.duration.toStringAsFixed(1)} s'),
                    if (_result!.pwm != null) _Row(label: 'PWM', value: '${_result!.pwm}'),
                    if (_result!.totalDuration != null) _Row(label: 'Total', value: '${_result!.totalDuration!.toStringAsFixed(1)} s'),
                  ],
                ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 46,
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(foregroundColor: c.danger, side: BorderSide(color: c.danger), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4))),
            onPressed: _stop,
            icon: const Icon(Icons.stop_circle_outlined, size: 17),
            label: Text('HENTIKAN SEMUA AKTUATOR', style: DccText.head(c.danger, size: 12, weight: FontWeight.w700, ls: 8)),
          ),
        ),
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

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Text(label, style: DccText.head(c.textMuted, size: 9, weight: FontWeight.w600, ls: 12)),
          const Spacer(),
          Text(value, style: DccText.mono(c.text, size: 12, weight: FontWeight.w600)),
        ],
      ),
    );
  }
}
