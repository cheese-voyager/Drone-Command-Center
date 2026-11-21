import 'dart:math';

import '../models/drone_status.dart';

class TelemetrySample {
  TelemetrySample({
    required this.time,
    this.lat,
    this.lon,
    this.alt,
    this.altAglM,
    this.speed,
    this.airspeedMps,
    this.climbMps,
    this.headingDeg,
    this.cogDeg,
    this.voltage,
    this.current,
    this.batteryPercent,
    this.batteryRemainingMah,
    this.energyConsumedWh,
    this.seedRemaining,
    this.gpsFix,
    this.satellites,
    this.hdop,
    this.ekfOk,
    this.rssi,
    this.mode,
    this.armed = false,
  });

  final DateTime time;
  final double? lat;
  final double? lon;
  final double? alt;
  final double? altAglM;
  final double? speed;
  final double? airspeedMps;
  final double? climbMps;
  final double? headingDeg;
  final double? cogDeg;
  final double? voltage;
  final double? current;
  final double? batteryPercent;
  final double? batteryRemainingMah;
  final double? energyConsumedWh;
  final int? seedRemaining;
  final int? gpsFix;
  final int? satellites;
  final double? hdop;
  final bool? ekfOk;
  final int? rssi;
  final String? mode;
  final bool armed;

  factory TelemetrySample.fromStatus(DroneStatus status, DateTime time) {
    return TelemetrySample(
      time: status.time.utc ?? time,
      lat: status.lat,
      lon: status.lon,
      alt: status.alt,
      altAglM: status.nav.altAglM,
      speed: status.avgSpeed ?? status.speed ?? status.nav.groundspeedMps,
      airspeedMps: status.nav.airspeedMps,
      climbMps: status.nav.climbMps,
      headingDeg: status.nav.headingDeg ?? status.yaw,
      cogDeg: status.nav.cogDeg ?? status.gps.cogDeg,
      voltage: status.voltage,
      current: status.current ?? status.battery.avgCurrent,
      batteryPercent: status.battery.remainingPercent,
      batteryRemainingMah: status.battery.remainingMah,
      energyConsumedWh: status.power.energyConsumedWh,
      seedRemaining: status.seed.remaining,
      gpsFix: status.gps.fixType ?? status.gpsFix,
      satellites: status.gps.satellitesVisible ?? status.satellites,
      hdop: status.gps.hdop,
      ekfOk: status.health.ekfOk,
      rssi: status.link.rssi,
      mode: status.mode,
      armed: status.armed,
    );
  }

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{'time': time.toUtc().toIso8601String()};
    void put(String key, dynamic value) {
      if (value != null) json[key] = value;
    }

    put('lat', lat);
    put('lon', lon);
    put('alt', alt);
    put('alt_agl_m', altAglM);
    put('speed', speed);
    put('airspeed_mps', airspeedMps);
    put('climb_mps', climbMps);
    put('heading_deg', headingDeg);
    put('cog_deg', cogDeg);
    put('voltage', voltage);
    put('current', current);
    put('battery_percent', batteryPercent);
    put('battery_remaining_mah', batteryRemainingMah);
    put('energy_consumed_wh', energyConsumedWh);
    put('seed_remaining', seedRemaining);
    put('gps_fix', gpsFix);
    put('satellites', satellites);
    put('hdop', hdop);
    put('ekf_ok', ekfOk);
    put('rssi', rssi);
    put('mode', mode);
    json['armed'] = armed;
    return json;
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
    final lastEnergy = status.power.energyConsumedWh ?? 32.0;
    final capacity = status.battery.capacityMah.toDouble();
    final lat = status.lat ?? -6.8971983;
    final lon = status.lon ?? 107.636371;
    final alt = status.alt ?? 8;
    final heading = status.yaw ?? 72;

    for (var i = 0; i < count; i++) {
      final t = i / (count - 1);
      final phase = t * pi * 5;
      final battery = (startBattery + (lastBattery - startBattery) * t).clamp(0.0, 100.0);
      final voltage = startVoltage + (lastVoltage - startVoltage) * t + sin(phase) * 0.12;
      final current = 19 + random.nextDouble() * 8 + sin(phase * 0.7) * 1.5;
      final speed = (status.avgSpeed ?? status.speed ?? 7) + sin(phase * 0.6) * 1.4;
      final climb = 0.4 + sin(phase * 0.3) * 0.3;
      final sample = TelemetrySample(
        time: end.subtract(Duration(seconds: (count - 1 - i) * 5)),
        lat: lat + sin(phase) * 0.00045 * (1 - t * 0.4),
        lon: lon + cos(phase) * 0.00052 * (1 - t * 0.4),
        alt: alt + sin(phase * 0.8) * 2.2 + 2,
        altAglM: (status.nav.altAglM ?? alt - 1) + sin(phase * 0.8) * 1.8 + 1,
        speed: speed,
        airspeedMps: speed - 0.4,
        climbMps: climb,
        headingDeg: (heading + t * 12) % 360,
        cogDeg: (heading + t * 12 - 3) % 360,
        voltage: voltage,
        current: current,
        batteryPercent: battery,
        batteryRemainingMah: capacity * battery / 100,
        energyConsumedWh: lastEnergy * t,
        seedRemaining: (startSeed - (startSeed - lastSeed) * t).round(),
        gpsFix: 3,
        satellites: (status.satellites ?? 12) - (random.nextDouble() * 2).round(),
        hdop: 0.7,
        ekfOk: true,
        rssi: status.link.rssi ?? 65,
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
