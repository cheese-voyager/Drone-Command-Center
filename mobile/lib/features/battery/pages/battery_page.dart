import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/export/report_exporter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/models/battery_info.dart';
import '../../../../shared/widgets/charts.dart';
import '../../../../shared/widgets/hud_panel.dart';
import '../../dashboard/providers/dashboard_provider.dart';
import '../../dashboard/widgets/painters.dart';

class BatteryPage extends StatefulWidget {
  const BatteryPage({super.key, required this.provider});

  final DashboardProvider provider;

  @override
  State<BatteryPage> createState() => _BatteryPageState();
}

class _BatteryPageState extends State<BatteryPage> {
  late final TextEditingController _capacity;
  late final TextEditingController _cells;
  late final TextEditingController _minSafe;
  bool _showCharts = false;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    final battery = widget.provider.status.battery;
    _capacity = TextEditingController(text: battery.capacityMah > 0 ? '${battery.capacityMah}' : '10000');
    _cells = TextEditingController(text: '6');
    _minSafe = TextEditingController(text: '25');
  }

  @override
  void dispose() {
    _capacity.dispose();
    _cells.dispose();
    _minSafe.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final capacity = int.tryParse(_capacity.text.replaceAll(',', '.'));
    final cells = int.tryParse(_cells.text.replaceAll(',', '.'));
    final minSafe = int.tryParse(_minSafe.text.replaceAll(',', '.'));
    if (capacity == null || capacity <= 0 || cells == null || cells < 1 || cells > 14 || minSafe == null || minSafe < 0 || minSafe > 100) {
      _snack('Kapasitas > 0, cells 1-14, min safe 0-100%.', warn: true);
      return;
    }
    final error = await widget.provider.configureBattery(
      BatterySetup(capacityMah: capacity, cells: cells, minSafePercent: minSafe),
    );
    if (!mounted) return;
    _snack(error ?? 'Konfigurasi baterai tersimpan di backend.', warn: error != null);
  }

  Future<void> _exportPdf() async {
    setState(() => _exporting = true);
    try {
      final samples = widget.provider.samples;
      final battery = widget.provider.status.battery;
      final rows = samples.map((s) => [
            _clock(s.time),
            s.batteryPercent?.toStringAsFixed(1) ?? '-',
            s.voltage?.toStringAsFixed(2) ?? '-',
            s.current?.toStringAsFixed(1) ?? '-',
          ]).toList();
      await ReportExporter.pdf(
        fileName: 'baterai-${_stamp()}',
        title: 'Laporan Penggunaan Baterai',
        subtitle: 'Kapasitas ${battery.capacityMah} mAh · terpakai ${battery.usedMah.toStringAsFixed(0)} mAh · sisa ${battery.remainingMah.toStringAsFixed(0)} mAh',
        paragraphs: [
          'Persentase sisa: ${battery.remainingPercent.toStringAsFixed(1)}%',
          'Arus rata-rata: ${battery.avgCurrent.toStringAsFixed(1)} A · tegangan: ${widget.provider.status.voltage?.toStringAsFixed(2) ?? '-'} V',
          'Estimasi tersisa: ${battery.estimatedMinutesLeft?.round() ?? 0} menit · status: ${battery.low ? 'LOW BATTERY' : 'NORMAL'}',
          'Jumlah sampel: ${samples.length}',
        ],
        bars: [
          ReportBar('Baterai (%)', battery.remainingPercent, color: PdfColors.blue),
          ReportBar('Tegangan (V)', widget.provider.status.voltage ?? 0),
          ReportBar('Arus (A)', widget.provider.status.current ?? battery.avgCurrent),
        ],
        headers: const ['Waktu', 'Baterai %', 'Tegangan V', 'Arus A'],
        rows: rows.length > 300 ? rows.sublist(rows.length - 300) : rows,
      );
      if (mounted) _snack('PDF baterai siap dibagikan.');
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
        fileName: 'baterai-${_stamp()}',
        headers: const ['Waktu', 'Baterai %', 'Tegangan V', 'Arus A'],
        rows: widget.provider.samples.map((s) => [
              s.time.toIso8601String(),
              s.batteryPercent?.toStringAsFixed(2) ?? '',
              s.voltage?.toStringAsFixed(3) ?? '',
              s.current?.toStringAsFixed(2) ?? '',
            ]).toList(),
      );
      if (mounted) _snack('CSV baterai siap dibagikan.');
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

  String _clock(DateTime time) =>
      '${_two(time.hour)}:${_two(time.minute)}:${_two(time.second)}';

  String _stamp() {
    final now = DateTime.now();
    return '${now.year}${_two(now.month)}${_two(now.day)}-${_two(now.hour)}${_two(now.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final battery = widget.provider.status.battery;
    final fraction = (battery.remainingPercent / 100).clamp(0.0, 1.0).toDouble();
    final tone = battery.remainingPercent < 25 ? c.danger : (battery.remainingPercent < 50 ? c.warn : c.accent);
    final samples = widget.provider.samples;
    final window = samples.length > 60 ? samples.sublist(samples.length - 60) : samples;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            StatusPill('Baterai', tone: battery.low ? PillTone.danger : PillTone.ok),
            StatusPill('${battery.capacityMah} mAh', tone: PillTone.info),
            StatusPill('${samples.length} sampel', tone: PillTone.info),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => setState(() => _showCharts = !_showCharts),
                icon: Icon(_showCharts ? Icons.area_chart : Icons.show_chart, size: 15),
                label: Text(_showCharts ? 'SEMBUNYIKAN GRAFIK' : 'TAMPILKAN GRAFIK', style: DccText.head(c.text, size: 10, weight: FontWeight.w700)),
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
          title: 'Kondisi baterai',
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              SizedBox(
                width: 96,
                height: 96,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CustomPaint(size: const Size.square(96), painter: GaugePainter(fraction: fraction, track: c.borderStrong, value: tone, stroke: 10)),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('${battery.remainingPercent.round()}%', style: DccText.mono(c.text, size: 20, weight: FontWeight.w700)),
                        Text('SISA', style: DccText.head(c.textMuted, size: 8, weight: FontWeight.w700, ls: 14)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  children: [
                    _Metric(label: 'Terpakai', value: '${battery.usedMah.toStringAsFixed(0)} mAh'),
                    const SizedBox(height: 8),
                    _Metric(label: 'Sisa kapasitas', value: '${battery.remainingMah.round()} mAh'),
                    const SizedBox(height: 8),
                    _Metric(label: 'Arus rata-rata', value: '${battery.avgCurrent.toStringAsFixed(1)} A'),
                    const SizedBox(height: 8),
                    _Metric(label: 'Estimasi', value: '${battery.estimatedMinutesLeft?.round() ?? 0} menit'),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Tegangan & arus',
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(child: _Metric(label: 'Tegangan', value: '${widget.provider.status.voltage?.toStringAsFixed(2) ?? '--'} V')),
              const SizedBox(width: 8),
              Expanded(child: _Metric(label: 'Arus', value: '${widget.provider.status.current?.toStringAsFixed(1) ?? '--'} A')),
            ],
          ),
        ),
        if (_showCharts) ...[
          const SizedBox(height: 10),
          TelemetryLineChart(
            title: 'Riwayat baterai',
            unit: '%',
            series: [
              ChartSeries(label: 'Baterai', color: c.accent, values: window.map((s) => s.batteryPercent).toList()),
            ],
          ),
          TelemetryLineChart(
            title: 'Riwayat tegangan',
            unit: ' V',
            series: [
              ChartSeries(label: 'Tegangan', color: c.info, values: window.map((s) => s.voltage).toList()),
            ],
          ),
          TelemetryLineChart(
            title: 'Riwayat arus',
            unit: ' A',
            series: [
              ChartSeries(label: 'Arus', color: c.warn, values: window.map((s) => s.current).toList()),
            ],
          ),
        ],
        const SizedBox(height: 10),
        HudPanel(
          title: 'Konfigurasi backend',
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(child: _Field(label: 'Kapasitas (mAh)', controller: _capacity)),
                  const SizedBox(width: 10),
                  Expanded(child: _Field(label: 'Cells (1-14)', controller: _cells)),
                ],
              ),
              const SizedBox(height: 12),
              _Field(label: 'Min safe (%)', controller: _minSafe),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: c.accent, foregroundColor: c.accentInk, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4))),
                  onPressed: _save,
                  icon: const Icon(Icons.save_outlined, size: 16),
                  label: Text('SIMPAN KE BACKEND', style: DccText.head(c.accentInk, size: 12, weight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
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
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(color: c.inset, border: Border.all(color: c.border), borderRadius: BorderRadius.circular(4)),
      child: Row(
        children: [
          Text(label.toUpperCase(), style: DccText.head(c.textMuted, size: 8, weight: FontWeight.w600, ls: 10)),
          const Spacer(),
          Text(value, style: DccText.mono(c.text, size: 12, weight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.controller});

  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      style: DccText.mono(c.text, size: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: DccText.head(c.textMuted, size: 10, weight: FontWeight.w600, ls: 10),
        filled: true,
        fillColor: c.inset,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: c.border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: c.border)),
      ),
    );
  }
}
