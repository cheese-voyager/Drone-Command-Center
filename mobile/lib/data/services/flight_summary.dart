import 'dart:math';

import 'telemetry_history.dart';

class FlightSession {
  FlightSession({
    required this.start,
    required this.end,
    required this.points,
    required this.seedsStart,
    required this.seedsEnd,
    required this.maxAlt,
    required this.maxSpeed,
    required this.distanceKm,
  });

  final DateTime start;
  final DateTime end;
  final List<TelemetrySample> points;
  final int seedsStart;
  final int seedsEnd;
  final double maxAlt;
  final double maxSpeed;
  final double distanceKm;

  Duration get duration => end.difference(start);

  int get seedsUsed => seedsStart - seedsEnd;
}

class FlightSummary {
  const FlightSummary._();

  static List<FlightSession> sessions(List<TelemetrySample> samples) {
    final result = <FlightSession>[];
    List<TelemetrySample>? current;

    void flush() {
      if (current == null || current!.length < 2) {
        current = null;
        return;
      }
      final points = List<TelemetrySample>.from(current!);
      final startSeed = points.first.seedRemaining ?? 0;
      final endSeed = points.last.seedRemaining ?? 0;
      result.add(FlightSession(
        start: points.first.time,
        end: points.last.time,
        points: points,
        seedsStart: startSeed,
        seedsEnd: endSeed,
        maxAlt: points.map((p) => p.alt ?? 0).reduce(max),
        maxSpeed: points.map((p) => p.speed ?? 0).reduce(max),
        distanceKm: pathDistance(points),
      ));
      current = null;
    }

    for (final sample in samples) {
      if (!sample.armed || sample.lat == null || sample.lon == null) {
        flush();
        continue;
      }
      if (current != null && sample.time.difference(current!.last.time).inSeconds > 60) {
        flush();
      }
      (current ??= <TelemetrySample>[]).add(sample);
    }
    flush();
    return result.reversed.toList();
  }

  static double pathDistance(List<TelemetrySample> points) {
    var total = 0.0;
    for (var i = 1; i < points.length; i++) {
      final a = points[i - 1];
      final b = points[i];
      if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) continue;
      total += distanceKm(a.lat!, a.lon!, b.lat!, b.lon!);
    }
    return total;
  }

  static double distanceKm(double lat1, double lon1, double lat2, double lon2) {
    const radius = 6371.0;
    final dLat = _rad(lat2 - lat1);
    final dLon = _rad(lon2 - lon1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_rad(lat1)) * cos(_rad(lat2)) * sin(dLon / 2) * sin(dLon / 2);
    return 2 * radius * atan2(sqrt(a), sqrt(1 - a));
  }

  static double _rad(double degree) => degree * pi / 180;
}
