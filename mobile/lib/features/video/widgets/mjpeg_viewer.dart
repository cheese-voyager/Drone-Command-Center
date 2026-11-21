import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/theme/app_theme.dart';

class MjpegViewer extends StatefulWidget {
  const MjpegViewer({super.key, required this.url, this.dummy = false});

  final Uri url;
  final bool dummy;

  @override
  State<MjpegViewer> createState() => _MjpegViewerState();
}

class _MjpegViewerState extends State<MjpegViewer> {
  final ValueNotifier<ui.Image?> _frame = ValueNotifier<ui.Image?>(null);
  final HttpClient _client = HttpClient();
  bool _cancelled = false;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (!widget.dummy) _connect();
  }

  @override
  void dispose() {
    _cancelled = true;
    _client.close();
    _frame.value?.dispose();
    _frame.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    try {
      final request = await _client.getUrl(widget.url);
      request.headers.set('Accept', 'multipart/x-mixed-replace');
      final response = await request.close();
      if (response.statusCode != 200) {
        throw HttpException('HTTP ${response.statusCode}');
      }
      if (!mounted) return;
      setState(() => _loading = false);

      final buffer = <int>[];
      await for (final chunk in response) {
        if (_cancelled) break;
        buffer.addAll(chunk);
        while (true) {
          final start = _indexOf(buffer, 0, 0xFF, 0xD8);
          if (start < 0) {
            if (buffer.length > 400000) buffer.clear();
            break;
          }
          if (start > 0) buffer.removeRange(0, start);
          final end = _indexOf(buffer, 2, 0xFF, 0xD9);
          if (end < 0) break;
          final frameEnd = end + 2;
          final jpeg = Uint8List.fromList(buffer.sublist(0, frameEnd));
          buffer.removeRange(0, frameEnd);
          try {
            final codec = await ui.instantiateImageCodec(jpeg);
            final nextFrame = await codec.getNextFrame();
            if (_cancelled) {
              nextFrame.image.dispose();
              break;
            }
            final old = _frame.value;
            _frame.value = nextFrame.image;
            old?.dispose();
          } catch (_) {}
        }
      }
    } catch (e) {
      if (_cancelled || !mounted) return;
      setState(() {
        _loading = false;
        _error = 'Stream kamera tidak tersedia: $e';
      });
    }
  }

  int _indexOf(List<int> bytes, int from, int a, int b) {
    for (var i = from; i < bytes.length - 1; i++) {
      if (bytes[i] == a && bytes[i + 1] == b) return i;
    }
    return -1;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.dummy) return const _DummyVideoPreview();
    final c = context.dcc;
    return ValueListenableBuilder<ui.Image?>(
      valueListenable: _frame,
      builder: (context, image, _) {
        if (image != null) {
          return Stack(
            fit: StackFit.expand,
            children: [
              CustomPaint(painter: _ImagePainter(image)),
              Positioned(
                left: 10,
                top: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: withA(c.panel, 0.85), borderRadius: BorderRadius.circular(3)),
                  child: Text('MJPEG · LIVE', style: DccText.mono(c.ok, size: 9, weight: FontWeight.w700, ls: 8)),
                ),
              ),
            ],
          );
        }
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: _loading
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(color: c.accent),
                      const SizedBox(height: 12),
                      Text('Menghubungkan stream /video...', style: DccText.mono(c.textMuted, size: 11)),
                    ],
                  )
                : Text(
                    _error ?? 'Tidak ada frame kamera.',
                    style: DccText.mono(c.warn, size: 11),
                    textAlign: TextAlign.center,
                  ),
          ),
        );
      },
    );
  }
}

class _ImagePainter extends CustomPainter {
  const _ImagePainter(this.image);

  final ui.Image image;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / image.width;
    final height = image.height * scale;
    final top = height > size.height ? (size.height - height) / 2 : 0.0;
    canvas.drawImageRect(
      image,
      Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble()),
      Rect.fromLTWH(0, top, size.width, height > size.height ? height : height),
      Paint(),
    );
  }

  @override
  bool shouldRepaint(covariant _ImagePainter oldDelegate) => oldDelegate.image != image;
}

class _DummyVideoPreview extends StatefulWidget {
  const _DummyVideoPreview();

  @override
  State<_DummyVideoPreview> createState() => _DummyVideoPreviewState();
}

class _DummyVideoPreviewState extends State<_DummyVideoPreview> {
  Timer? _timer;
  int _tick = 0;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (mounted) setState(() => _tick++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final clock = DateTime.now();
    final stamp = '${_two(clock.hour)}:${_two(clock.minute)}:${_two(clock.second)}';
    return Stack(
      fit: StackFit.expand,
      children: [
        CustomPaint(painter: _DummyFeedPainter(tick: _tick, colors: c)),
        Positioned(
          left: 10,
          top: 10,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: withA(c.panel, 0.85), borderRadius: BorderRadius.circular(3)),
            child: Text('DUMMY MJPEG · LIVE', style: DccText.mono(c.ok, size: 9, weight: FontWeight.w700, ls: 8)),
          ),
        ),
        Positioned(
          right: 10,
          bottom: 10,
          child: Text(stamp, style: DccText.mono(c.textSecondary, size: 10, weight: FontWeight.w600)),
        ),
        Positioned(
          left: 10,
          bottom: 10,
          child: Text('ALT 12.4 m  ·  SPD 7.8 m/s', style: DccText.mono(c.textSecondary, size: 9)),
        ),
      ],
    );
  }

  String _two(int value) => value.toString().padLeft(2, '0');
}

class _DummyFeedPainter extends CustomPainter {
  const _DummyFeedPainter({required this.tick, required this.colors});

  final int tick;
  final DccColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final c = colors;
    canvas.drawRect(Offset.zero & size, Paint()..color = c.inset);

    final grid = Paint()
      ..color = withA(c.border, 0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.6;
    for (var x = 0.0; x < size.width; x += 36) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (var y = 0.0; y < size.height; y += 36) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }

    final horizonY = size.height * 0.55 + (tick % 40 - 20) * 0.3;
    canvas.drawLine(
      Offset(0, horizonY),
      Offset(size.width, horizonY),
      Paint()
        ..color = withA(c.info, 0.7)
        ..strokeWidth = 1.2,
    );

    final target = Paint()
      ..color = withA(c.warn, 0.9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (var i = 0; i < 3; i++) {
      final dx = size.width * (0.25 + i * 0.25);
      final dy = size.height * (0.62 + (i % 2) * 0.12);
      canvas.drawCircle(Offset(dx, dy), 9, target);
      canvas.drawLine(Offset(dx - 14, dy), Offset(dx + 14, dy), target);
      canvas.drawLine(Offset(dx, dy - 14), Offset(dx, dy + 14), target);
    }

    final cx = size.width * (0.5 + (tick % 120 - 60) / 600);
    final cy = size.height * (0.42 + (tick % 80 - 40) / 800);
    final cross = Paint()
      ..color = c.accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8;
    canvas.drawCircle(Offset(cx, cy), 18, cross);
    canvas.drawLine(Offset(cx - 34, cy), Offset(cx - 8, cy), cross);
    canvas.drawLine(Offset(cx + 8, cy), Offset(cx + 34, cy), cross);
    canvas.drawLine(Offset(cx, cy - 34), Offset(cx, cy - 8), cross);
    canvas.drawLine(Offset(cx, cy + 8), Offset(cx, cy + 34), cross);

    final scanY = (tick * 4) % (size.height + 1);
    canvas.drawRect(
      Rect.fromLTWH(0, scanY, size.width, 2),
      Paint()..color = withA(c.accent, 0.18),
    );
  }

  @override
  bool shouldRepaint(covariant _DummyFeedPainter oldDelegate) => oldDelegate.tick != tick;
}
