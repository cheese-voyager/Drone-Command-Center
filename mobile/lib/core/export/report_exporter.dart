import 'dart:convert';
import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

class ReportBar {
  const ReportBar(this.label, this.value, {this.color = PdfColors.blue});

  final String label;
  final double value;
  final PdfColor color;
}

class ReportExporter {
  static Future<void> pdf({
    required String fileName,
    required String title,
    String subtitle = '',
    List<String> paragraphs = const [],
    List<ReportBar> bars = const [],
    List<String> headers = const [],
    List<List<String>> rows = const [],
  }) async {
    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        build: (context) => <pw.Widget>[
          pw.Header(level: 0, text: _ascii(title)),
          if (subtitle.isNotEmpty) pw.Paragraph(text: _ascii(subtitle)),
          for (final line in paragraphs) pw.Paragraph(text: _ascii(line)),
          if (bars.isNotEmpty) ...[
            pw.SizedBox(height: 8),
            pw.Text('GRAFIK RINGKAS', style: const pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
            pw.SizedBox(height: 6),
            ...bars.map(_bar),
          ],
          if (headers.isNotEmpty && rows.isNotEmpty) ...[
            pw.SizedBox(height: 12),
            pw.Text('DATA', style: const pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
            pw.SizedBox(height: 6),
            pw.TableHelper.fromTextArray(
              headers: headers.map(_ascii).toList(),
              data: rows.map((r) => r.map(_ascii).toList()).toList(),
              headerStyle: const pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8),
              cellStyle: const pw.TextStyle(fontSize: 7),
              headerDecoration: const pw.BoxDecoration(color: PdfColors.grey300),
              cellAlignment: pw.Alignment.centerLeft,
            ),
          ],
          pw.SizedBox(height: 14),
          pw.Container(
            alignment: pw.Alignment.centerRight,
            child: pw.Text(
              'Drone Command Center - diekspor ${_stamp()}',
              style: const pw.TextStyle(color: PdfColors.grey600, fontSize: 8),
            ),
          ),
        ],
      ),
    );
    final bytes = await doc.save();
    await _share(bytes, '$fileName.pdf', 'application/pdf', title);
  }

  static Future<void> csv({
    required String fileName,
    required List<String> headers,
    required List<List<String>> rows,
  }) async {
    final buffer = StringBuffer()
      ..writeln(headers.map(_csvCell).join(','));
    for (final row in rows) {
      buffer.writeln(row.map(_csvCell).join(','));
    }
    final bytes = utf8.encode('\uFEFF${buffer.toString()}');
    await _share(bytes, '$fileName.csv', 'text/csv', fileName);
  }

  static Future<void> json({
    required String fileName,
    required Map<String, dynamic> data,
  }) async {
    final bytes = utf8.encode(const JsonEncoder.withIndent('  ').convert(data));
    await _share(bytes, '$fileName.json', 'application/json', fileName);
  }

  static pw.Widget _bar(ReportBar bar) {
    final max = bar.value > 0 ? bar.value : 1.0;
    final width = (180 * (bar.value / max)).clamp(2.0, 180.0).toDouble();
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 4),
      child: pw.Row(
        children: [
          pw.SizedBox(width: 105, child: pw.Text(_ascii(bar.label), style: const pw.TextStyle(fontSize: 8))),
          pw.Container(width: width, height: 7, color: bar.color),
          pw.SizedBox(width: 6),
          pw.Text(bar.value.toStringAsFixed(1), style: const pw.TextStyle(fontSize: 8)),
        ],
      ),
    );
  }

  static Future<void> _share(List<int> bytes, String name, String mime, String subject) async {
    final file = XFile.fromData(Uint8List.fromList(bytes), name: name, mimeType: mime);
    await SharePlus.instance.share(ShareParams(files: [file], subject: subject, text: 'Laporan $name'));
  }

  static String _csvCell(String value) {
    final v = value.replaceAll('"', '""');
    return v.contains(',') || v.contains('\n') ? '"$v"' : v;
  }

  static String _ascii(String value) => value
      .replaceAll('°', 'd')
      .replaceAll('·', '-')
      .replaceAll('–', '-')
      .replaceAll('—', '-')
      .replaceAll('→', '->')
      .replaceAll('−', '-');

  static String _two(int value) => value.toString().padLeft(2, '0');

  static String _stamp() {
    final now = DateTime.now();
    return '${now.year}${_two(now.month)}${_two(now.day)}-${_two(now.hour)}${_two(now.minute)}';
  }
}
