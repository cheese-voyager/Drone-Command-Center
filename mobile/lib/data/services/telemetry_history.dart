import 'dart:math';

import '../models/drone_status.dart';

class TelemetrySample {
  TelemetrySample({
    required this.time,
    this.lat,
    this.lon,
    this.alt,
    this.speed,
    this.voltage,
    this.current,
    this.batteryPercent,
    this.seedRemaining,
    this.gpsFix,
    this.satellites,
    this.mode,
    this.armed = false,
  });

  final DateTime time;
  final double? lat;
  final double? lon;
  final double? alt;
  final double? speed;
  final double? voltage;
  final double? current;
  final double? batteryPercent;
  final int? seedRemaining;
  final int? gpsFix;
  final int? satellites;
  final String? mode;
  final bool armed;

  factory TelemetrySample.fromStatus(DroneStatus status, DateTime time) {
    return TelemetrySample(
      time: time,
      lat: status.lat,
      lon: status.lon,
      alt: status.alt,
      speed: status.avgSpeed ?? status.speed,
      voltage: status.voltage,
      current: status.current ?? status.battery.avgCurrent,
      batteryPercent: status.battery.remainingPercent,
      seedRemaining: status.seed.remaining,
      gpsFix: status.gpsFix,
      satellites: status.satellites,
      mode: status.mode,
      armed: status.armed,
    );
  }
}

class TelemetryHistory {
  TelemetryHistory({this.maxPoints = 600});

  final int maxPoints;
  final List<TelemetrySample> _samples = <TelemetrySample>[];

  List<TelemetrySample> get samples => List<TelemetrySample>.unmodifiable(_samples);
  bool get isEmpty => _samples.isEmpty;
  TelemetrySample? get last => _samples.isEmpty ? null : _samples.last;

  void add(DroneStatus status, {DateTime? now}) {
    final time = now ?? DateTime.now();
    if (_samples.isNotEmpty && time.difference(_samples.last.time).inSeconds < 1) return;
    _samples.add(TelemetrySample.fromStatus(status, time));
    _trim();
  }

  void seedDummy(DroneStatus status, {DateTime? now, int count = 120}) {
    if (_samples.isNotEmpty) return;
    final end = now ?? DateTime.now();
    final random = Random(42);
    final lastBattery = status.battery.remainingPercent;
    final startBattery = (lastBattery + 38).clamp(35.0, 100.0).toDouble();
    final lastVoltage = status.voltage ?? 16.8;
    final startVoltage = lastVoltage + 1.6;
    final lastSeed = status.seed.remaining;
    final startSeed = lastSeed + 12;
    final lat = status.lat ?? -6.8971983;
    final lon = status.lon ?? 107.636371;

    for (var i = 0; i < count; i++) {
      final t = i / (count - 1);
      final phase = t * pi * 5;
      final battery = startBattery + (lastBattery - startBattery) * t;
      final voltage = startVoltage + (lastVoltage - startVoltage) * t + sin(phase) * 0.12;
      final current = 19 + random.nextDouble() * 8 + sin(phase * 0.7) * 1.5;
      final sample = TelemetrySample(
        time: end.subtract(Duration(seconds: (count - 1 - i) * 5)),
        lat: lat + sin(phase) * 0.00045 * (1 - t * 0.4),
        lon: lon + cos(phase) * 0.00052 * (1 - t * 0.4),
        alt: (status.alt ?? 8) + sin(phase * 0.8) * 2.2 + 2,
        speed: (status.avgSpeed ?? status.speed ?? 7) + sin(phase * 0.6) * 1.4,
        voltage: voltage,
        current: current,
        batteryPercent: battery.clamp(0.0, 100.0),
        seedRemaining: (startSeed - (startSeed - lastSeed) * t).round(),
        gpsFix: 3,
        satellites: (status.satellites ?? 12) - (random.nextDouble() * 2).round(),
        mode: status.mode ?? 'GUIDED',
        armed: true,
      );
      _samples.add(sample);
    }
    _samples.last = TelemetrySample.fromStatus(status, end);
    _trim();
  }

  void clear() => _samples.clear();

  void _trim() {
    if (_samples.length > maxPoints) {
      _samples.removeRange(0, _samples.length - maxPoints);
    }
  }
}
