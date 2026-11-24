import 'package:drone_command_center/core/theme/app_theme.dart';
import 'package:drone_command_center/data/models/drone_status.dart';
import 'package:drone_command_center/data/models/drop_point.dart';
import 'package:drone_command_center/data/services/telemetry_history.dart';
import 'package:drone_command_center/features/map/map_config.dart';
import 'package:drone_command_center/features/map/widgets/dcc_map.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _wrap(DccMap map) => MaterialApp(
      theme: AppTheme.dark(),
      home: Scaffold(
        body: SizedBox(width: 400, height: 300, child: map),
      ),
    );

MapOptions _options(WidgetTester tester) {
  final context = tester.element(find.byType(Scalebar));
  return MapOptions.maybeOf(context)!;
}

MapController _controller(WidgetTester tester) {
  final context = tester.element(find.byType(Scalebar));
  return MapController.maybeOf(context)!;
}

void main() {
  testWidgets('tanpa GPS peta memakai pusat ITENAS', (tester) async {
    await tester.pumpWidget(_wrap(const DccMap(
      status: DroneStatus.empty,
      drops: <DropRecord>[],
      showTiles: false,
    )));
    await tester.pump();

    expect(find.byType(FlutterMap), findsOneWidget);
    expect(_options(tester).initialCenter, DccMapConfig.siteCenter);
    expect(find.text('ITENAS'), findsOneWidget);
    expect(find.textContaining('0 DROP'), findsOneWidget);
  });

  testWidgets('marker drone dan drop hanya memakai data berkoordinat', (tester) async {
    const status = DroneStatus(
      connected: true,
      armed: false,
      lat: -6.89,
      lon: 107.64,
      gpsFix: 3,
      satellites: 12,
    );
    final drops = <DropRecord>[
      const DropRecord(time: 1, lat: -6.891, lon: 107.641, thrust: 60, duration: 1),
      const DropRecord(time: 2, thrust: 60, duration: 1),
    ];

    await tester.pumpWidget(_wrap(DccMap(
      status: status,
      drops: drops,
      showTiles: false,
    )));
    await tester.pump();

    final center = _options(tester).initialCenter;
    expect(center.latitude, closeTo(-6.89, 0.000001));
    expect(center.longitude, closeTo(107.64, 0.000001));
    expect(find.text('UAV'), findsWidgets);
    expect(find.textContaining('1 DROP'), findsOneWidget);
  });

  testWidgets('flight path tampil sesuai toggle', (tester) async {
    final now = DateTime.now();
    final path = <TelemetrySample>[
      TelemetrySample(time: now, lat: -6.89, lon: 107.64),
      TelemetrySample(time: now, lat: -6.891, lon: 107.641),
    ];

    await tester.pumpWidget(_wrap(DccMap(
      status: DroneStatus.empty,
      drops: const <DropRecord>[],
      path: path,
      showTiles: false,
    )));
    await tester.pump();
    expect(find.byType(PolylineLayer), findsOneWidget);

    await tester.pumpWidget(_wrap(DccMap(
      status: DroneStatus.empty,
      drops: const <DropRecord>[],
      path: path,
      showPath: false,
      showTiles: false,
    )));
    await tester.pump();
    expect(find.byType(PolylineLayer), findsNothing);
  });

  testWidgets('zoom manual tetap dipakai saat auto-center', (tester) async {
    const first = DroneStatus(connected: true, armed: false, lat: -6.89, lon: 107.64);
    const next = DroneStatus(connected: true, armed: false, lat: -6.892, lon: 107.642);

    await tester.pumpWidget(_wrap(const DccMap(
      status: first,
      drops: <DropRecord>[],
      showTiles: false,
    )));
    await tester.pump();
    await tester.pump();

    final initialZoom = _controller(tester).camera.zoom;
    await tester.tap(find.byTooltip('Perbesar peta'));
    await tester.pump();
    final zoomed = _controller(tester).camera.zoom;
    expect(zoomed, greaterThan(initialZoom));

    await tester.pumpWidget(_wrap(const DccMap(
      status: next,
      drops: <DropRecord>[],
      showTiles: false,
    )));
    await tester.pump();
    await tester.pump();

    final camera = _controller(tester).camera;
    expect(camera.center.latitude, closeTo(-6.892, 0.000001));
    expect(camera.zoom, closeTo(zoomed, 0.001));
  });

  testWidgets('mini-map non-interaktif menonaktifkan gesture', (tester) async {
    await tester.pumpWidget(_wrap(const DccMap(
      status: DroneStatus.empty,
      drops: <DropRecord>[],
      showTiles: false,
      showControls: false,
      showLegend: false,
      showStatus: false,
      interactive: false,
    )));
    await tester.pump();

    expect(_options(tester).interactionOptions.flags, InteractiveFlag.none);
    expect(find.byTooltip('Perbesar peta'), findsNothing);
  });
}
