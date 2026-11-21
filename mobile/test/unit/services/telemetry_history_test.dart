import 'package:drone_command_center/data/models/drone_status.dart';
import 'package:drone_command_center/data/services/telemetry_history.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('TelemetrySample memetakan field P1/P2 dan toJson mengikuti schema', () {
    final time = DateTime.utc(2026, 11, 21, 10, 30);
    final status = DroneStatus.fromJson({
      'connected': true,
      'armed': true,
      'mode': 'AUTO',
      'lat': -6.9,
      'lon': 107.6,
      'alt': 12.5,
      'yaw': 83.0,
      'speed': 4.2,
      'gps_fix': 3,
      'satellites': 14,
      'battery': {
        'capacity_mah': 8000,
        'remaining_mah': 6400,
        'remaining_percent': 80,
        'low': false,
      },
      'seed': {'loaded': 40, 'dropped': 6, 'remaining': 34},
      'gps': {'fix_type': 3, 'satellites_visible': 14, 'hdop': 0.65},
      'nav': {
        'alt_rel_m': 12.5,
        'alt_agl_m': 10.2,
        'groundspeed_mps': 4.2,
        'airspeed_mps': 4.8,
        'climb_mps': 0.7,
        'heading_deg': 83,
        'cog_deg': 81,
      },
      'power': {'energy_consumed_wh': 32.5},
      'health': {'ekf_ok': true},
      'link': {'rssi': 68},
      'time': {'utc': time.toIso8601String(), 'boot_ms': 1000},
    });

    final sample = TelemetrySample.fromStatus(status, time.add(const Duration(seconds: 5)));
    final json = sample.toJson();

    expect(sample.time, time);
    expect(sample.altAglM, 10.2);
    expect(sample.airspeedMps, 4.8);
    expect(sample.headingDeg, 83);
    expect(sample.batteryRemainingMah, 6400);
    expect(sample.energyConsumedWh, 32.5);
    expect(sample.ekfOk, isTrue);
    expect(sample.rssi, 68);

    expect(json['time'], time.toIso8601String());
    expect(json['alt_agl_m'], 10.2);
    expect(json['battery_remaining_mah'], 6400);
    expect(json['energy_consumed_wh'], 32.5);
    expect(json.containsKey('avg_speed'), isFalse);
    expect(json.containsKey('schema_version'), isFalse);
  });

  test('TelemetryHistory membuang sample lebih cepat dari 1 detik', () {
    final time = DateTime.utc(2026, 11, 21, 10, 30);
    final history = TelemetryHistory();
    final status = DroneStatus.fromJson({
      'connected': true,
      'armed': true,
      'battery': {
        'capacity_mah': 8000,
        'remaining_mah': 6400,
        'remaining_percent': 80,
        'low': false,
      },
      'seed': {'loaded': 40, 'dropped': 0, 'remaining': 40},
    });

    history.add(status, now: time);
    history.add(status, now: time.add(const Duration(milliseconds: 500)));
    expect(history.samples, hasLength(1));

    history.add(status, now: time.add(const Duration(seconds: 1)));
    expect(history.samples, hasLength(2));
    expect(history.last?.time, time.add(const Duration(seconds: 1)));
  });
}
