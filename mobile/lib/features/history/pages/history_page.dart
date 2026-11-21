import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/export/report_exporter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/services/flight_summary.dart';
import '../../../../data/services/telemetry_history.dart';
import '../../../../shared/widgets/charts.dart';
import '../../../../shared/widgets/hud_panel.dart';
import '../../dashboard/providers/dashboard_provider.dart';
import '../../drop/widgets/drop_history_list.dart';

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key, required this.provider});

  final DashboardProvider provider;

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  int _tab = 0;
  bool _byDay = false;
  FlightSession? _selected;
  bool _exporting = false;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
      final sessions = FlightSummary.sessions(widget.provider.samples, drops: widget.provider.drops);

    if (_selected != null && !sessions.any((s) => s.start == _selected!.start)) {
      _selected = null;
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      children: [
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  backgroundColor: _tab == 0 ? c.accent : null,
                  foregroundColor: _tab == 0 ? c.accentInk : c.text,
                  side: BorderSide(color: c.accent),
                ),
                onPressed: () => setState(() => _tab = 0),
                child: Text('RIWAYAT DROP', style: DccText.head(_tab == 0 ? c.accentInk : c.text, size: 11, weight: FontWeight.w700)),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  backgroundColor: _tab == 1 ? c.accent : null,
                  foregroundColor: _tab == 1 ? c.accentInk : c.text,
                  side: BorderSide(color: c.accent),
                ),
                onPressed: () => setState(() => _tab = 1),
                child: Text('PENERBANGAN', style: DccText.head(_tab == 1 ? c.accentInk : c.text, size: 11, weight: FontWeight.w700)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _tab == 0 ? _dropTab() : _flightTab(sessions),
      ],
    );
  }

  Widget _dropTab() {
    final c = context.dcc;
    final drops = widget.provider.drops;
    final avgThrust = drops.isEmpty ? 0.0 : drops.map((d) => d.thrust).reduce((a, b) => a + b) / drops.length;
    final totalDuration = drops.fold<double>(0, (sum, d) => sum + d.duration);
    final located = drops.where((d) => d.lat != null && d.lon != null).length;
    final mqtt = widget.provider.mqtt;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            StatusPill('${drops.length} drop', tone: PillTone.info),
            StatusPill('$located berkoordinat', tone: PillTone.ok),
            if (mqtt != null)
              StatusPill(mqtt.connected ? 'MQTT connected' : 'MQTT disconnected',
                  tone: mqtt.connected ? PillTone.ok : PillTone.warn),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _Metric(label: 'Rata-rata thrust', value: '${avgThrust.toStringAsFixed(1)}%')),
            const SizedBox(width: 8),
            Expanded(child: _Metric(label: 'Total durasi', value: '${totalDuration.toStringAsFixed(1)} s')),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => setState(() => _byDay = !_byDay),
                icon: Icon(_byDay ? Icons.today_outlined : Icons.schedule, size: 15),
                label: Text(_byDay ? 'PER HARI' : 'PER JAM', style: DccText.head(c.text, size: 10, weight: FontWeight.w700)),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _exporting ? null : _exportDropsPdf,
                icon: const Icon(Icons.picture_as_pdf_outlined, size: 15),
                label: Text('PDF', style: DccText.head(c.text, size: 11, weight: FontWeight.w700)),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _exporting ? null : _exportDropsCsv,
                icon: const Icon(Icons.table_chart_outlined, size: 15),
                label: Text('CSV', style: DccText.head(c.text, size: 11, weight: FontWeight.w700)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        MiniBarChart(title: 'Sebaran drop', data: _buckets(), unit: ''),
        Text('RIWAYAT LENGKAP', style: DccText.head(c.textSecondary, size: 9, weight: FontWeight.w700, ls: 16)),
        const SizedBox(height: 6),
        DropHistoryList(drops: drops),
        if (mqtt != null) ...[
          const SizedBox(height: 10),
          HudPanel(
            title: 'Status MQTT',
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                _Row(label: 'Broker', value: '${mqtt.host}:${mqtt.port}'),
                _Row(label: 'WebSocket', value: '${mqtt.host}:${mqtt.wsPort}'),
                _Row(label: 'Base topic', value: mqtt.baseTopic),
                _Row(label: 'Commands', value: mqtt.commandsEnabled ? 'aktif' : 'nonaktif'),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _flightTab(List<FlightSession> sessions) {
    final c = context.dcc;
    final totalKm = sessions.fold<double>(0, (sum, s) => sum + s.distanceKm);
    final totalMinutes = sessions.fold<int>(0, (sum, s) => sum + s.duration.inMinutes);
    final totalSeeds = sessions.fold<int>(0, (sum, s) => sum + s.seedsUsed);
    final selected = _selected ?? (sessions.isEmpty ? null : sessions.first);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            StatusPill('${sessions.length} sesi', tone: PillTone.info),
            StatusPill('${totalKm.toStringAsFixed(2)} km', tone: PillTone.ok),
            StatusPill('$totalMinutes menit', tone: PillTone.info),
            StatusPill('$totalSeeds benih', tone: PillTone.info),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _exporting ? null : _exportFlightPdf,
                icon: const Icon(Icons.picture_as_pdf_outlined, size: 15),
                label: Text('PDF', style: DccText.head(c.text, size: 11, weight: FontWeight.w700)),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _exporting ? null : _exportFlightCsv,
                icon: const Icon(Icons.table_chart_outlined, size: 15),
                label: Text('CSV', style: DccText.head(c.text, size: 11, weight: FontWeight.w700)),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _exporting ? null : _exportFlightJson,
                icon: const Icon(Icons.data_object_outlined, size: 15),
                label: Text('JSON', style: DccText.head(c.text, size: 11, weight: FontWeight.w700)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (sessions.isEmpty)
          HudPanel(
            padding: const EdgeInsets.all(16),
            child: Text('Belum ada sesi penerbangan. Data dummy akan muncul saat backend terkoneksi.', style: DccText.mono(c.textMuted, size: 11)),
          )
        else ...[
          for (final session in sessions.take(8))
            Container(
              margin: const EdgeInsets.only(bottom: 6),
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  backgroundColor: selected?.start == session.start ? withA(c.accent, 0.12) : null,
                  side: BorderSide(color: selected?.start == session.start ? c.accent : c.border),
                  padding: const EdgeInsets.all(12),
                ),
                onPressed: () => setState(() => _selected = session),
                child: Row(
                  children: [
                    Icon(Icons.flight_takeoff, size: 16, color: c.accent),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_clock(session.start), style: DccText.mono(c.text, size: 12, weight: FontWeight.w700)),
                          Text('${session.duration.inMinutes} menit · ${session.distanceKm.toStringAsFixed(2)} km · ${session.seedsUsed} benih', style: DccText.mono(c.textMuted, size: 9)),
                        ],
                      ),
                    ),
                    Text('${session.maxAlt.toStringAsFixed(0)} m', style: DccText.mono(c.textSecondary, size: 11)),
                  ],
                ),
              ),
            ),
          if (selected != null) ...[
            const SizedBox(height: 6),
            HudPanel(
              title: 'Detail sesi',
              padding: const EdgeInsets.all(12),
              child: Column(
                 children: [
                   _Row(label: 'ID', value: selected.id),
                   _Row(label: 'Mulai', value: _clock(selected.start)),

                  _Row(label: 'Durasi', value: '${selected.duration.inMinutes} menit'),
                  _Row(label: 'Jarak', value: '${selected.distanceKm.toStringAsFixed(3)} km'),
                  _Row(label: 'Benih', value: '${selected.seedsStart} -> ${selected.seedsEnd}'),
                  _Row(label: 'Max alt', value: '${selected.maxAlt.toStringAsFixed(1)} m'),
                  _Row(label: 'Max speed', value: '${selected.maxSpeed.toStringAsFixed(1)} m/s'),
                ],
              ),
            ),
            const SizedBox(height: 10),
            TelemetryLineChart(
              title: 'Ketinggian penerbangan',
              unit: ' m',
              series: [
                ChartSeries(label: 'Alt', color: c.accent, values: selected.points.map((p) => p.alt).toList()),
              ],
            ),
            TelemetryLineChart(
              title: 'Kecepatan penerbangan',
              unit: ' m/s',
              series: [
                ChartSeries(label: 'Speed', color: c.info, values: selected.points.map((p) => p.speed).toList()),
              ],
            ),
          ],
          const SizedBox(height: 8),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(foregroundColor: c.danger, side: BorderSide(color: c.danger)),
            onPressed: () {
              widget.provider.clearHistory();
              setState(() => _selected = null);
            },
            icon: const Icon(Icons.delete_outline, size: 16),
            label: Text('HAPUS RIWAYAT', style: DccText.head(c.danger, size: 11, weight: FontWeight.w700)),
          ),
        ],
      ],
    );
  }

  List<BarDatum> _buckets() {
    final c = context.dcc;
    final counts = <String, int>{};
    for (final drop in widget.provider.drops) {
      final time = DateTime.fromMillisecondsSinceEpoch((drop.time * 1000).round()).add(const Duration(hours: 7));
      final key = _byDay
          ? '${_two(time.day)}/${_two(time.month)}'
          : '${_two(time.hour)}:00';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    final keys = counts.keys.toList()..sort();
    return keys.map((key) => BarDatum(key, counts[key]!.toDouble(), color: c.info)).toList();
  }

  List<TelemetrySample> _flightRows(FlightSession? session) {
    if (session != null) return session.points;
    return widget.provider.samples;
  }

  Future<void> _exportDropsPdf() async {
    setState(() => _exporting = true);
    try {
      final drops = widget.provider.drops;
      final rows = drops.map((d) {
        final time = DateTime.fromMillisecondsSinceEpoch((d.time * 1000).round());
        return [
          time.toIso8601String(),
          d.lat?.toStringAsFixed(7) ?? '-',
          d.lon?.toStringAsFixed(7) ?? '-',
          d.thrust.toStringAsFixed(1),
          d.duration.toStringAsFixed(2),
        ];
      }).toList();
      await ReportExporter.pdf(
        fileName: 'riwayat-drop-${_stamp()}',
        title: 'Laporan Riwayat Drop',
        subtitle: 'Total ${drops.length} drop · ${rows.length} entri',
        bars: _buckets().map((b) => ReportBar(b.label, b.value, color: PdfColors.blue)).toList(),
        headers: const ['Waktu', 'Latitude', 'Longitude', 'Thrust %', 'Durasi s'],
        rows: rows.length > 300 ? rows.sublist(rows.length - 300) : rows,
      );
      if (mounted) _snack('PDF riwayat drop siap dibagikan.');
    } catch (e) {
      if (mounted) _snack('Gagal membuat PDF: $e', warn: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _exportDropsCsv() async {
    setState(() => _exporting = true);
    try {
      await ReportExporter.csv(
        fileName: 'riwayat-drop-${_stamp()}',
        headers: const ['Waktu', 'Latitude', 'Longitude', 'Thrust %', 'Durasi s'],
        rows: widget.provider.drops.map((d) => [
              DateTime.fromMillisecondsSinceEpoch((d.time * 1000).round()).toIso8601String(),
              d.lat?.toStringAsFixed(7) ?? '',
              d.lon?.toStringAsFixed(7) ?? '',
              d.thrust.toStringAsFixed(1),
              d.duration.toStringAsFixed(2),
            ]).toList(),
      );
      if (mounted) _snack('CSV riwayat drop siap dibagikan.');
    } catch (e) {
      if (mounted) _snack('Gagal membuat CSV: $e', warn: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _exportFlightPdf() async {
    setState(() => _exporting = true);
    try {
    final sessions = FlightSummary.sessions(widget.provider.samples, drops: widget.provider.drops);

      final selected = _selected;
      final rows = _flightRows(selected).map((p) => [
            p.time.toIso8601String(),
            p.lat?.toStringAsFixed(7) ?? '-',
            p.lon?.toStringAsFixed(7) ?? '-',
            p.alt?.toStringAsFixed(1) ?? '-',
            p.speed?.toStringAsFixed(1) ?? '-',
            p.batteryPercent?.toStringAsFixed(1) ?? '-',
          ]).toList();
      await ReportExporter.pdf(
        fileName: 'riwayat-penerbangan-${_stamp()}',
        title: 'Laporan Penerbangan',
        subtitle: '${sessions.length} sesi · total ${sessions.fold<double>(0, (s, x) => s + x.distanceKm).toStringAsFixed(2)} km',
        paragraphs: [
          if (selected != null)
            'Sesi terpilih: ${_clock(selected.start)} · ${selected.duration.inMinutes} menit · benih ${selected.seedsStart} -> ${selected.seedsEnd}',
        ],
        bars: [
          ReportBar('Max alt', selected?.maxAlt ?? 0, color: PdfColors.blue),
          ReportBar('Max speed', selected?.maxSpeed ?? 0, color: PdfColors.green),
        ],
        headers: const ['Waktu', 'Latitude', 'Longitude', 'Alt m', 'Speed m/s', 'Baterai %'],
        rows: rows.length > 300 ? rows.sublist(rows.length - 300) : rows,
      );
      if (mounted) _snack('PDF penerbangan siap dibagikan.');
    } catch (e) {
      if (mounted) _snack('Gagal membuat PDF: $e', warn: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _exportFlightCsv() async {
    setState(() => _exporting = true);
    try {
      final sessions = FlightSummary.sessions(widget.provider.samples, drops: widget.provider.drops);
      final selected = _selected ?? (sessions.isEmpty ? null : sessions.first);
      await ReportExporter.csv(
        fileName: 'riwayat-penerbangan-${_stamp()}',
        headers: const ['Waktu', 'Latitude', 'Longitude', 'Alt m', 'Speed m/s', 'Baterai %'],
        rows: _flightRows(selected).map((p) => [
              p.time.toIso8601String(),
              p.lat?.toStringAsFixed(7) ?? '',
              p.lon?.toStringAsFixed(7) ?? '',
              p.alt?.toStringAsFixed(2) ?? '',
              p.speed?.toStringAsFixed(2) ?? '',
              p.batteryPercent?.toStringAsFixed(2) ?? '',
            ]).toList(),
      );
      if (mounted) _snack('CSV penerbangan siap dibagikan.');
    } catch (e) {
      if (mounted) _snack('Gagal membuat CSV: $e', warn: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _exportFlightJson() async {
    setState(() => _exporting = true);
    try {
      final sessions = FlightSummary.sessions(widget.provider.samples, drops: widget.provider.drops);
      await ReportExporter.json(
        fileName: 'riwayat-penerbangan-${_stamp()}',
        data: <String, dynamic>{
          'schema_version': 1,
          'telemetry_samples': widget.provider.samples.map((p) => p.toJson()).toList(),
          'flight_sessions': sessions.map((s) => s.toJson()).toList(),
        },
      );
      if (mounted) _snack('JSON telemetry & sesi siap dibagikan.');
    } catch (e) {
      if (mounted) _snack('Gagal membuat JSON: $e', warn: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  void _snack(String message, {bool warn = false}) {
    final c = context.dcc;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message, style: DccText.mono(warn ? c.warn : c.text, size: 11))),
    );
  }

  String _two(int value) => value.toString().padLeft(2, '0');

  String _clock(DateTime time) => '${_two(time.hour)}:${_two(time.minute)}:${_two(time.second)}';

  String _stamp() {
    final now = DateTime.now();
    return '${now.year}${_two(now.month)}${_two(now.day)}-${_two(now.hour)}${_two(now.minute)}';
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

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
          Text(label.toUpperCase(), style: DccText.head(c.textMuted, size: 8, weight: FontWeight.w600, ls: 10)),
          const SizedBox(height: 4),
          Text(value, style: DccText.mono(c.text, size: 13, weight: FontWeight.w700)),
        ],
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
          Text(value, style: DccText.mono(c.text, size: 10, weight: FontWeight.w600)),
        ],
      ),
    );
  }
}
