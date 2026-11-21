import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/models/drone_status.dart';
import '../../../../data/models/drop_point.dart';
import '../../../../data/services/telemetry_history.dart';
import '../../dashboard/widgets/painters.dart';

class LiveMap extends StatelessWidget {
  const LiveMap({
    super.key,
    required this.status,
    required this.drops,
    this.path = const <TelemetrySample>[],
    this.showPath = true,
    this.height = 240,
  });

  static const siteLat = -6.8971983;
  static const siteLon = 107.636371;

  final DroneStatus status;
  final List<DropRecord> drops;
  final List<TelemetrySample> path;
  final bool showPath;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final flightPoints = showPath
        ? path.where((p) => p.lat != null && p.lon != null).map((p) => MapPoint(p.lat!, p.lon!)).toList()
        : <MapPoint>[];
    final points = <MapPoint>[
      const MapPoint(siteLat, siteLon),
      ...flightPoints,
      for (final drop in drops)
        if (drop.lat != null && drop.lon != null) MapPoint(drop.lat!, drop.lon!),
      if (status.lat != null && status.lon != null) MapPoint(status.lat!, status.lon!),
    ];
    final lats = points.map((p) => p.lat).toList();
    final lons = points.map((p) => p.lon).toList();
    final minLat = _expandMin(lats.reduce(math.min));
    final maxLat = _expandMax(lats.reduce(math.max));
    final minLon = _expandMin(lons.reduce(math.min));
    final maxLon = _expandMax(lons.reduce(math.max));
    double x(double lon) => ((lon - minLon) / (maxLon - minLon)).clamp(0.04, 0.96).toDouble();
    double y(double lat) => (1 - ((lat - minLat) / (maxLat - minLat))).clamp(0.04, 0.96).toDouble();

    return SizedBox(
      height: height,
      child: Stack(
        fit: StackFit.expand,
        children: [
          CustomPaint(painter: MapPainter(c)),
          if (flightPoints.length > 1)
            CustomPaint(
              painter: _FlightPathPainter(
                points: flightPoints,
                color: c.accent,
                project: (point, size) => Offset(x(point.lon) * size.width, y(point.lat) * size.height),
              ),
            ),
          _Marker(
            x: x(siteLon),
            y: y(siteLat),
            color: c.info,
            icon: Icons.school_outlined,
            label: 'ITENAS',
          ),
          for (final drop in drops)
            if (drop.lat != null && drop.lon != null)
              _Marker(
                x: x(drop.lon!),
                y: y(drop.lat!),
                color: c.warn,
                icon: Icons.water_drop_outlined,
                label: 'DROP',
                small: true,
              ),
          if (status.lat != null && status.lon != null)
            _Marker(
              x: x(status.lon!),
              y: y(status.lat!),
              color: c.accent,
              icon: Icons.navigation,
              label: 'DRONE',
              rotation: (status.yaw ?? 0) * math.pi / 180,
            ),
          Positioned(
            left: 10,
            bottom: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: withA(c.panel, 0.9),
                border: Border.all(color: c.borderStrong),
                borderRadius: BorderRadius.circular(3),
              ),
              child: Text(
                'GPS ${status.gpsFix ?? '--'}D · ${status.satellites ?? '-'} SAT · ${drops.length} DROP',
                style: DccText.mono(c.textSecondary, size: 9, ls: 6),
              ),
            ),
          ),
        ],
      ),
    );
  }

  double _expandMin(double value) => value - 0.00035;
  double _expandMax(double value) => value + 0.00035;
}

class MapPoint {
  const MapPoint(this.lat, this.lon);

  final double lat;
  final double lon;
}

class _FlightPathPainter extends CustomPainter {
  const _FlightPathPainter({
    required this.points,
    required this.color,
    required this.project,
  });

  final List<MapPoint> points;
  final Color color;
  final Offset Function(MapPoint point, Size size) project;

  @override
  void paint(Canvas canvas, Size size) {
    final glow = Paint()
      ..color = withA(color, 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7;
    final line = Paint()
      ..color = withA(color, 0.85)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeJoin = StrokeJoin.round;
    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final offset = project(points[i], size);
      if (i == 0) {
        path.moveTo(offset.dx, offset.dy);
      } else {
        path.lineTo(offset.dx, offset.dy);
      }
    }
    canvas.drawPath(path, glow);
    canvas.drawPath(path, line);
    final dot = Paint()..color = color;
    for (final point in points.where((p) => p == points.first || p == points.last)) {
      final offset = project(point, size);
      canvas.drawCircle(offset, point == points.last ? 4 : 3, dot);
    }
  }

  @override
  bool shouldRepaint(covariant _FlightPathPainter oldDelegate) =>
      oldDelegate.points != points || oldDelegate.color != color;
}

class _Marker extends StatelessWidget {
  const _Marker({
    required this.x,
    required this.y,
    required this.color,
    required this.icon,
    required this.label,
    this.rotation = 0,
    this.small = false,
  });

  final double x;
  final double y;
  final Color color;
  final IconData icon;
  final String label;
  final double rotation;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final size = small ? 18.0 : 24.0;
    return Positioned(
      left: MediaQuery.of(context).size.width * x - size / 2,
      top: (small ? 200 : 216) * y - size / 2,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Transform.rotate(
            angle: rotation,
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(color: withA(color, 0.18), border: Border.all(color: color), shape: BoxShape.circle),
              child: Icon(icon, size: small ? 10 : 13, color: color),
            ),
          ),
          if (!small)
            Text(label, style: DccText.head(color, size: 8, weight: FontWeight.w700, ls: 10)),
        ],
      ),
    );
  }
}
