import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/drone_status.dart';
import '../../../shared/widgets/hud_panel.dart';
import '../../map/widgets/dcc_map.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/painters.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key, required this.provider});

  final DashboardProvider provider;

  Future<void> _drop(BuildContext context) async {
    final c = context.dcc;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: c.raised,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6), side: BorderSide(color: withA(c.accent, 0.55))),
        title: Text('KONFIRMASI TEBAR BENIH', style: DccText.head(c.text, size: 15, weight: FontWeight.w700, ls: 8)),
        content: Text('Perintah drop akan dikirim ke backend.', style: TextStyle(color: c.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('BATAL', style: DccText.head(c.textSecondary, size: 13))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: c.accent, foregroundColor: c.accentInk),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('TEBAR SEKARANG', style: DccText.head(c.accentInk, size: 13, weight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final record = await provider.drop();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          record == null
              ? provider.error ?? 'Gagal mengirim drop.'
              : 'Drop terkirim · ${record.thrust.round()}% · ${record.duration.toStringAsFixed(1)}s',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final s = provider.status;
    final seedFraction = (s.seed.loaded > 0 ? s.seed.remaining / s.seed.loaded : 0.0)
        .clamp(0.0, 1.0)
        .toDouble();
    final coordinate = formatCoordinate(s.lat, s.lon);
    final gpsText = s.gpsFix == null ? 'GPS --' : 'GPS ${s.gpsFix}D · ${s.satellites ?? '-'}';

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            StatusPill('Pixhawk', tone: s.connected ? PillTone.ok : PillTone.danger),
            StatusPill(gpsText, tone: s.gpsFix != null && s.gpsFix! >= 3 ? PillTone.ok : PillTone.warn),
            StatusPill(s.armed ? 'Armed' : 'Disarmed', tone: s.armed ? PillTone.danger : PillTone.info),
            if (s.health.ekfOk != null)
              StatusPill(s.health.ekfOk! ? 'EKF OK' : 'EKF WARN', tone: s.health.ekfOk! ? PillTone.ok : PillTone.warn),
            if (s.link.rssi != null)
              StatusPill('RSSI ${s.link.rssi}', tone: s.link.rssi! < 30 ? PillTone.warn : PillTone.info),
            if (provider.error != null) const StatusPill('Backend offline', tone: PillTone.danger),
          ],
        ),
        const SizedBox(height: 10),
        _P1SummaryPanel(status: s),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Peta live',
          meta: s.mode ?? 'AUTO-CENTER',
          padding: EdgeInsets.zero,
          child: SizedBox(
            height: 170,
            child: Stack(
              fit: StackFit.expand,
              children: [
                DccMap(
                  status: s,
                  drops: provider.drops,
                  path: provider.samples,
                  showControls: false,
                  showLegend: false,
                  showStatus: false,
                  interactive: false,
                  height: 170,
                ),
                Positioned(
                  left: 10,
                  top: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: withA(c.panel, 0.9), border: Border.all(color: c.borderStrong), borderRadius: BorderRadius.circular(3)),
                    child: Text(coordinate, style: DccText.mono(c.text, size: 10, ls: 2)),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _Kpi(icon: Icons.terrain, label: 'Ketinggian', value: _value(s.nav.altRelM ?? s.alt), unit: 'm')),
          const SizedBox(width: 10),
          Expanded(child: _Kpi(icon: Icons.speed, label: 'Kecepatan', value: _value(s.nav.groundspeedMps ?? s.speed), unit: 'm/s')),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _Kpi(icon: Icons.explore_outlined, label: 'Heading', value: _angle(s.nav.headingDeg ?? s.yaw), unit: '°')),
          const SizedBox(width: 10),
          Expanded(child: _Kpi(icon: Icons.bolt, label: 'Tegangan', value: _value(s.voltage), unit: 'V')),
        ]),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _AttitudeCard(status: s)),
            const SizedBox(width: 10),
            Expanded(child: _PowerCard(status: s)),
          ],
        ),
        const SizedBox(height: 10),
        _DiagnosticsPanel(status: s),
        const SizedBox(height: 10),
        HudPanel(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('${s.seed.remaining}', style: DccText.mono(c.accent, size: 26, weight: FontWeight.w700)),
                  const SizedBox(width: 6),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 3),
                    child: Text('/ ${s.seed.loaded} benih', style: DccText.mono(c.textSecondary, size: 11, weight: FontWeight.w400)),
                  ),
                  const Spacer(),
                  Text('${s.seed.dropped} DITEBAR', style: DccText.mono(c.textMuted, size: 10, ls: 8)),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(value: seedFraction, minHeight: 5, backgroundColor: c.border, color: c.accent),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 48,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: c.accent,
                    foregroundColor: c.accentInk,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  ),
                  onPressed: provider.busy ? null : () => _drop(context),
                  icon: const Icon(Icons.water_drop_outlined, size: 18),
                  label: Text('TEBAR BENIH', style: DccText.head(c.accentInk, size: 14, weight: FontWeight.w700, ls: 10)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

String _value(double? value) => value == null ? '--' : value.toStringAsFixed(1);

String _angle(double? value) =>
    value == null ? '--' : value.round().toString().padLeft(3, '0');

String _angleLabel(double? value) => value == null ? '--' : '${_angle(value)}°';

class _Kpi extends StatelessWidget {
  const _Kpi({required this.icon, required this.label, required this.value, required this.unit});

  final IconData icon;
  final String label;
  final String value;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Semantics(
      label: '$label $value $unit',
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: c.panel, border: Border.all(color: c.border), borderRadius: BorderRadius.circular(6)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(icon, size: 13, color: c.textSecondary),
                const SizedBox(width: 6),
                Text(label.toUpperCase(), style: DccText.head(c.textSecondary, size: 9, weight: FontWeight.w500, ls: 14)),
              ]),
              const SizedBox(height: 6),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(value, style: DccText.mono(c.text, size: 24)),
                  const SizedBox(width: 4),
                  Text(unit, style: DccText.mono(c.textSecondary, size: 11, weight: FontWeight.w400)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AttitudeCard extends StatelessWidget {
  const _AttitudeCard({required this.status});

  final DroneStatus status;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    String sign(double? v) =>
        v == null ? '--' : '${v >= 0 ? '+' : '−'}${v.abs().toStringAsFixed(1)}°';
    return HudPanel(
      title: 'Attitude',
      padding: const EdgeInsets.all(10),
      child: Row(
        children: [
          SizedBox(
            width: 64,
            height: 64,
            child: CustomPaint(painter: HorizonPainter(pitch: status.pitch ?? 0, roll: status.roll ?? 0, colors: c)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Mini('Pitch', sign(status.pitch)),
                const SizedBox(height: 4),
                _Mini('Roll', sign(status.roll)),
                const SizedBox(height: 4),
                _Mini('Yaw', _angleLabel(status.nav.headingDeg ?? status.yaw)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PowerCard extends StatelessWidget {
  const _PowerCard({required this.status});

  final DroneStatus status;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final percent = status.battery.remainingPercent;
    final value = percent < 25 ? c.danger : (percent < 50 ? c.warn : c.accent);
    return HudPanel(
      title: 'Daya',
      meta: '${status.battery.capacityMah} mAh',
      padding: const EdgeInsets.all(10),
      child: Row(
        children: [
          SizedBox(
            width: 64,
            height: 64,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CustomPaint(size: const Size.square(64), painter: GaugePainter(fraction: (percent / 100).clamp(0.0, 1.0).toDouble(), track: c.borderStrong, value: value, stroke: 7)),
                Text('${percent.round()}%', style: DccText.mono(c.text, size: 14, weight: FontWeight.w700)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Mini('mAh', (status.battery.remainingMah).round().toString()),
                const SizedBox(height: 4),
                _Mini('Menit', (status.battery.estimatedMinutesLeft?.round() ?? 0).toString()),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _P1SummaryPanel extends StatelessWidget {
  const _P1SummaryPanel({required this.status});

  final DroneStatus status;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final gpsFix = status.gps.fixType ?? status.gpsFix;
    final satellites = status.gps.satellitesVisible ?? status.satellites;
    final gps = gpsFix == null
        ? '--'
        : '${gpsFix}D · ${satellites ?? '-'} sat · HDOP ${status.gps.hdop?.toStringAsFixed(2) ?? '--'}';
    final nav = [
      'ALT ${_value(status.nav.altRelM ?? status.alt)} m',
      '${_value(status.nav.groundspeedMps ?? status.speed)} m/s',
      _angleLabel(status.nav.headingDeg ?? status.yaw),
    ].join(' · ');
    final mission = status.mission.currentWp == null
        ? (status.mission.state ?? status.mode ?? '--')
        : 'WP ${status.mission.currentWp}/${status.mission.totalWp ?? '--'}'
            ' · ${status.mission.state ?? status.mode ?? '--'}'
            ' · ${status.mission.wpDistanceM?.round() ?? '--'} m';
    final drop = status.servo.lastDrop;
    final servo = drop == null
        ? '${status.servo.channels.length} channel · IDLE'
        : 'CH ${drop.channel} · ${drop.ackResult} · ${status.servo.channels.length} ch';

    return HudPanel(
      title: 'Navigasi & misi',
      meta: status.mode ?? 'AUTO-CENTER',
      padding: const EdgeInsets.all(10),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: _P1Metric(label: 'GPS', value: gps, color: c.info)),
              const SizedBox(width: 10),
              Expanded(child: _P1Metric(label: 'NAV', value: nav, color: c.accent)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _P1Metric(label: 'MISI', value: mission, color: c.warn)),
              const SizedBox(width: 10),
              Expanded(child: _P1Metric(label: 'SERVO', value: servo, color: c.ok)),
            ],
          ),
        ],
      ),
    );
  }
}

class _P1Metric extends StatelessWidget {
  const _P1Metric({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: c.inset,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: DccText.head(color, size: 8, weight: FontWeight.w700, ls: 14)),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: DccText.mono(c.text, size: 11),
          ),
        ],
      ),
    );
  }
}

class _DiagnosticsPanel extends StatelessWidget {
  const _DiagnosticsPanel({required this.status});

  final DroneStatus status;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final ekf = status.health.ekfOk;
    final vib = status.health.vibrationZ;
    final rssi = status.link.rssi;
    final latest = status.messages.isEmpty ? null : status.messages.last;
    final energy = status.power.energyConsumedWh;

    return HudPanel(
      title: 'Diagnostik',
      meta: status.power.source ?? 'MAVLINK',
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: _DiagnosticMetric(
                  label: 'EKF',
                  value: ekf == null ? '--' : (ekf ? 'OK' : 'WARN'),
                  color: ekf == null ? c.textMuted : (ekf ? c.ok : c.warn),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _DiagnosticMetric(
                  label: 'RSSI',
                  value: rssi == null ? '--' : '$rssi',
                  color: rssi == null ? c.textMuted : (rssi < 30 ? c.warn : c.ok),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _DiagnosticMetric(
                  label: 'VIB Z',
                  value: vib == null ? '--' : vib.toStringAsFixed(2),
                  color: vib == null ? c.textMuted : (vib > 2 ? c.warn : c.ok),
                ),
              ),
            ],
          ),
          if (status.health.failsafe.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: withA(c.danger, 0.1),
                border: Border.all(color: withA(c.danger, 0.5)),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                status.health.failsafe.join(' · '),
                style: DccText.mono(c.danger, size: 10),
              ),
            ),
          ],
          if (latest != null) ...[
            const SizedBox(height: 10),
            _Mini('PESAN', latest.text),
          ],
          if (status.power.remainingPercent != null) ...[
            const SizedBox(height: 10),
            _Mini(
              'BATERAI AP',
              '${status.power.remainingPercent!.round()}%'
              '${energy == null ? '' : ' · ${energy.toStringAsFixed(1)} Wh'}',
            ),
          ],
        ],
      ),
    );
  }
}

class _DiagnosticMetric extends StatelessWidget {
  const _DiagnosticMetric({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: c.inset,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: DccText.head(c.textMuted, size: 8, ls: 12)),
          const SizedBox(height: 3),
          Text(value, style: DccText.mono(color, size: 13, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: DccText.head(c.textMuted, size: 8, weight: FontWeight.w500, ls: 14)),
        Text(value, style: DccText.mono(c.text, size: 12)),
      ],
    );
  }
}
