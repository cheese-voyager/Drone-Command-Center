import 'package:drone_command_center/core/theme/app_theme.dart';
import 'package:drone_command_center/features/video/widgets/mjpeg_viewer.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('dummy MjpegViewer renders synthetic feed without network', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark(),
        home: Scaffold(
          body: MjpegViewer(url: Uri.http('localhost', '/video'), dummy: true),
        ),
      ),
    );

    expect(find.text('DUMMY MJPEG · LIVE'), findsOneWidget);
    expect(find.text('ALT 12.4 m  ·  SPD 7.8 m/s'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });
}
