import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/export/report_exporter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/charts.dart';
import '../../../../shared/widgets/hud_panel.dart';
import '../../dashboard/providers/dashboard_provider.dart';

class SeedPage extends StatefulWidget {
  const SeedPage({super.key, required this.provider});

  final DashboardProvider provider;

  @override
  State<SeedPage> createState() => _SeedPageState();
}

class _SeedPageState extends State<SeedPage> {
  late final TextEditingController _loaded;
  bool _showPoints = false;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _loaded = TextEditingController(text: '${widget.provider.status.seed.loaded}');
  }

  @override
  void dispose() {
    _loaded.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final loaded = int.tryParse(_loaded.text.replaceAll(',', '.'));
    if (loaded == null || loaded < 0) {
      _snack('Jumlah benih harus 0 atau lebih.', warn: true);
      return;
    }
    final error = await widget.provider.loadSeed(loaded);
    if (!mounted) return;
    _snack(error ?? 'Benih berhasil dimuat di backend.', warn: error != null);
  }

  List<_SeedPoint> _points() {
    final points = <_SeedPoint>[];
    for (final sample in widget.provider.samples) {
      if (sample.lat != null && sample.lon != null) {
        points.add(_SeedPoint(sample.time, sample.lat!, sample.lon!, 'TELEMETRI', sample.seedRemaining ?? 0));
      }
    }
    for (final drop in widget.provider.drops) {
      if (drop.lat != null && drop.lon != null) {
        points.add(_SeedPoint(
          DateTime.fromMillisecondsSinceEpoch((drop.time * 1000).round()),
          drop.lat!,
          drop.lon!,
          'DROP',
          widget.provider.status.seed.remaining,
        ));
      }
    }
    points.sort((a, b) => b.time.compareTo(a.time));
    return points;
  }

  Future<void> _exportPdf() async {
    setState(() => _exporting = true);
    try {
      final status = widget.provider.status;
      final seed = status.seed;
      final points = _points();
      await ReportExporter.pdf(
        fileName: 'benih-${_stamp()}',
        title: 'Laporan Benih & Titik Koordinat',
        subtitle: 'Dimuat ${seed.loaded} · di-drop ${seed.dropped} · sisa ${seed.remaining}',
        paragraphs: [
          'Persentase sisa: ${_percent(seed)}%',
          'Mode ${status.mode ?? '-'} · ketinggian ${status.alt?.toStringAsFixed(1) ?? '-'} m · kecepatan ${status.speed?.toStringAsFixed(1) ?? '-'} m/s',
          'GPS ${_gps(status.gpsFix)} · ${status.satellites ?? '-'} satelit · koordinat ${_coord(status.lat, status.lon)}',
          'Baterai ${status.battery.remainingPercent.toStringAsFixed(0)}% · ${status.voltage?.toStringAsFixed(1) ?? '-'} V · ${status.current?.toStringAsFixed(1) ?? '-'} A',
          'Jumlah titik koordinat: ${points.length}',
        ],
        bars: [
          ReportBar('Dimuat', seed.loaded.toDouble(), color: PdfColors.blue),
          ReportBar('Di-drop', seed.dropped.toDouble(), color: PdfColors.orange),
          ReportBar('Sisa', seed.remaining.toDouble(), color: PdfColors.green),
        ],
        headers: const ['Waktu', 'Jenis', 'Latitude', 'Longitude', 'Sisa benih'],
        rows: points.take(300).map((p) => [
              p.time.toIso8601String(),
              p.kind,
              p.lat.toStringAsFixed(7),
              p.lon.toStringAsFixed(7),
              '${p.remaining}',
            ]).toList(),
      );
      if (mounted) _snack('PDF benih siap dibagikan.');
    } catch (e) {
      if (mounted) _snack('Gagal membuat PDF: $e', warn: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _exportCsv() async {
    setState(() => _exporting = true);
    try {
      await ReportExporter.csv(
        fileName: 'benih-titik-${_stamp()}',
        headers: const ['Waktu', 'Jenis', 'Latitude', 'Longitude', 'Sisa benih'],
        rows: _points().map((p) => [
              p.time.toIso8601String(),
              p.kind,
              p.lat.toStringAsFixed(7),
              p.lon.toStringAsFixed(7),
              '${p.remaining}',
            ]).toList(),
      );
      if (mounted) _snack('CSV titik benih siap dibagikan.');
    } catch (e) {
      if (mounted) _snack('Gagal membuat CSV: $e', warn: true);
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

  String _stamp() {
    final now = DateTime.now();
    return '${now.year}${_two(now.month)}${_two(now.day)}-${_two(now.hour)}${_two(now.minute)}';
  }

  double _percent(seed) => seed.loaded > 0 ? (seed.remaining / seed.loaded) * 100 : 0;

  String _gps(int? fix) => switch (fix) {
        3 => '3D fix',
        2 => '2D fix',
        1 => 'No fix',
        _ => 'Tidak tersedia',
      };

  String _coord(double? lat, double? lon) =>
      lat == null || lon == null ? '-' : '${lat.toStringAsFixed(6)}, ${lon.toStringAsFixed(6)}';

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final status = widget.provider.status;
    final seed = status.seed;
    final fraction = (seed.loaded > 0 ? seed.remaining / seed.loaded : 0.0).clamp(0.0, 1.0).toDouble();
    final points = _points();
    final samples = widget.provider.samples;
    final window = samples.length > 60 ? samples.sublist(samples.length - 60) : samples;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            const StatusPill('Manajemen benih', tone: PillTone.info),
            StatusPill(seed.loaded > 0 ? 'TERSEDIA' : 'KOSONG', tone: seed.loaded > 0 ? PillTone.ok : PillTone.warn),
            StatusPill('${points.length} titik', tone: PillTone.info),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => setState(() => _showPoints = !_showPoints),
                icon: Icon(_showPoints ? Icons.area_chart : Icons.place_outlined, size: 15),
                label: Text(_showPoints ? 'SEMBUNYIKAN TITIK' : 'TITIK KOORDINAT', style: DccText.head(c.text, size: 10, weight: FontWeight.w700)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _exporting ? null : _exportPdf,
                icon: const Icon(Icons.picture_as_pdf_outlined, size: 15),
                label: Text('PDF', style: DccText.head(c.text, size: 11, weight: FontWeight.w700)),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _exporting ? null : _exportCsv,
                icon: const Icon(Icons.table_chart_outlined, size: 15),
                label: Text('EXCEL/CSV', style: DccText.head(c.text, size: 11, weight: FontWeight.w700)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Persediaan benih',
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('${seed.remaining}', style: DccText.mono(c.accent, size: 40, weight: FontWeight.w700)),
                  const SizedBox(width: 6),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 5),
                    child: Text('/ ${seed.loaded} benih', style: DccText.mono(c.textSecondary, size: 12)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(value: fraction, minHeight: 7, backgroundColor: c.borderStrong, color: c.accent),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        MiniBarChart(
          title: 'Komposisi benih',
          unit: '',
          data: [
            BarDatum('DIMUAT', seed.loaded.toDouble(), color: c.info),
            BarDatum('DI-DROP', seed.dropped.toDouble(), color: c.warn),
            BarDatum('SISA', seed.remaining.toDouble(), color: c.accent),
          ],
        ),
        TelemetryLineChart(
          title: 'Profil ketinggian',
          unit: ' m',
          series: [
            ChartSeries(label: 'Altitude', color: c.accent, values: window.map((s) => s.alt).toList()),
          ],
        ),
        HudPanel(
          title: 'Data pendukung',
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              _Row(label: 'Sisa benih', value: '${_percent(seed).toStringAsFixed(1)}%'),
              _Row(label: 'Mode', value: status.mode ?? '-'),
              _Row(label: 'Ketinggian', value: '${status.alt?.toStringAsFixed(1) ?? '-'} m'),
              _Row(label: 'Kecepatan', value: '${status.speed?.toStringAsFixed(1) ?? '-'} m/s'),
              _Row(label: 'Koordinat', value: _coord(status.lat, status.lon)),
              _Row(label: 'GPS', value: '${_gps(status.gpsFix)} · ${status.satellites ?? '-'} sat'),
              _Row(label: 'Baterai', value: '${status.battery.remainingPercent.toStringAsFixed(0)}% · ${status.voltage?.toStringAsFixed(1) ?? '-'} V'),
              _Row(label: 'Arus', value: '${status.current?.toStringAsFixed(1) ?? '-'} A'),
            ],
          ),
        ),
        if (_showPoints) ...[
          const SizedBox(height: 10),
          Text('TITIK KOORDINAT TERBARU', style: DccText.head(c.textSecondary, size: 9, weight: FontWeight.w700, ls: 16)),
          const SizedBox(height: 6),
          for (final point in points.take(12))
            Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: c.panel, border: Border.all(color: c.border), borderRadius: BorderRadius.circular(5)),
              child: Row(
                children: [
                  Icon(point.kind == 'DROP' ? Icons.water_drop_outlined : Icons.place_outlined, size: 15, color: point.kind == 'DROP' ? c.warn : c.info),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${point.kind} · sisa ${point.remaining}', style: DccText.mono(c.text, size: 10, weight: FontWeight.w600)),
                        Text('${point.lat.toStringAsFixed(6)}, ${point.lon.toStringAsFixed(6)}', style: DccText.mono(c.textMuted, size: 9)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
        const SizedBox(height: 10),
        HudPanel(
          title: 'Muat benih',
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _loaded,
                keyboardType: TextInputType.number,
                style: DccText.mono(c.text, size: 15),
                decoration: InputDecoration(
                  labelText: 'Jumlah benih dimuat',
                  labelStyle: DccText.head(c.textMuted, size: 10, weight: FontWeight.w600, ls: 10),
                  filled: true,
                  fillColor: c.inset,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: c.border)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: c.border)),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 46,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: c.accent, foregroundColor: c.accentInk, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4))),
                  onPressed: _load,
                  icon: const Icon(Icons.grass, size: 17),
                  label: Text('SIMPAN KE BACKEND', style: DccText.head(c.accentInk, size: 12, weight: FontWeight.w700, ls: 8)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SeedPoint {
  const _SeedPoint(this.time, this.lat, this.lon, this.kind, this.remaining);

  final DateTime time;
  final double lat;
  final double lon;
  final String kind;
  final int remaining;
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
