import 'dart:math';

import '../models/drop_point.dart';
import 'telemetry_history.dart';

class FlightSession {
  FlightSession({
    required this.id,
    required this.start,
    required this.end,
    required this.points,
    required this.seedsStart,
    required this.seedsEnd,
    required this.maxAlt,
    required this.maxAltAglM,
    required this.maxSpeed,
    required this.distanceKm,
    required this.energyConsumedWh,
    required this.dropCount,
    required this.sampleCount,
    this.mode,
  });

  final String id;
  final DateTime start;
  final DateTime end;
  final List<TelemetrySample> points;
  final int seedsStart;
  final int seedsEnd;
  final double maxAlt;
  final double maxAltAglM;
  final double maxSpeed;
  final double distanceKm;
  final double energyConsumedWh;
  final int dropCount;
  final int sampleCount;
  final String? mode;

  Duration get duration => end.difference(start);

  double get durationS => duration.inMilliseconds / 1000;

  int get seedsUsed => seedsStart - seedsEnd;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'start': start.toUtc().toIso8601String(),
      'end': end.toUtc().toIso8601String(),
      'duration_s': durationS,
      'distance_km': distanceKm,
      'max_alt_m': maxAlt,
      'max_alt_agl_m': maxAltAglM,
      'max_speed_mps': maxSpeed,
      'seeds_start': seedsStart,
      'seeds_end': seedsEnd,
      'seeds_used': seedsUsed,
      'energy_consumed_wh': energyConsumedWh,
      'drop_count': dropCount,
      if (mode != null) 'mode': mode,
      'sample_count': sampleCount,
    };
  }
}

class FlightSummary {
  const FlightSummary._();

  static List<FlightSession> sessions(
    List<TelemetrySample> samples, {
    List<DropRecord> drops = const [],
  }) {
    final result = <FlightSession>[];
    List<TelemetrySample>? current;

    void flush() {
      if (current == null || current!.length < 2) {
        current = null;
        return;
      }
      final points = List<TelemetrySample>.from(current!);
      final start = points.first.time;
      final end = points.last.time;
      final startSeed = points.first.seedRemaining ?? 0;
      final endSeed = points.last.seedRemaining ?? 0;
      final energies = points.map((p) => p.energyConsumedWh).whereType<double>().toList();
      final energyUsed = energies.length >= 2
          ? _nonNegative(energies.last - energies.first)
          : 0.0;
      final startMs = start.millisecondsSinceEpoch;
      final endMs = end.millisecondsSinceEpoch;
      final dropCount = drops
          .where((d) {
            final timeMs = (d.time * 1000).round();
            return timeMs >= startMs && timeMs <= endMs;
          })
          .length;
      final modes = points
          .map((p) => p.mode)
          .where((m) => m != null && m.isNotEmpty)
          .cast<String>()
          .toList();
      String? mode;
      if (modes.isNotEmpty) {
        final counts = <String, int>{};
        for (final value in modes) {
          counts[value] = (counts[value] ?? 0) + 1;
        }
        mode = counts.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
      }

      result.add(
        FlightSession(
          id: 'session-${start.toUtc().millisecondsSinceEpoch}',
          start: start,
          end: end,
          points: points,
          seedsStart: startSeed < 0 ? 0 : startSeed,
          seedsEnd: endSeed < 0 ? 0 : endSeed,
          maxAlt: _nonNegative(points.map((p) => p.alt ?? 0).reduce(max).toDouble()),
          maxAltAglM: _nonNegative(points.map((p) => p.altAglM ?? 0).reduce(max).toDouble()),
          maxSpeed: _nonNegative(points.map((p) => p.speed ?? 0).reduce(max).toDouble()),
          distanceKm: _nonNegative(pathDistance(points)),
          energyConsumedWh: energyUsed,
          dropCount: dropCount,
          sampleCount: points.length,
          mode: mode,
        ),
      );
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

  static double _nonNegative(double value) =>
      value.isNaN || value.isInfinite ? 0.0 : (value < 0 ? 0.0 : value);

  static double _rad(double degree) => degree * pi / 180;
}
