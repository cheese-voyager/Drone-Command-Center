import 'package:drone_command_center/data/models/drop_point.dart';
import 'package:drone_command_center/data/services/flight_summary.dart';
import 'package:drone_command_center/data/services/telemetry_history.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('FlightSession mengikuti schema flightSession dan menghitung turunan', () {
    final start = DateTime.utc(2026, 11, 21, 10, 0);
    final samples = [
      TelemetrySample(
        time: start,
        lat: -6.9,
        lon: 107.6,
        alt: 5,
        altAglM: 4,
        speed: 3,
        seedRemaining: 20,
        energyConsumedWh: 10,
        mode: 'AUTO',
        armed: true,
      ),
      TelemetrySample(
        time: start.add(const Duration(seconds: 10)),
        lat: -6.901,
        lon: 107.602,
        alt: 15,
        altAglM: 13,
        speed: 7,
        seedRemaining: 14,
        energyConsumedWh: 13,
        mode: 'AUTO',
        armed: true,
      ),
      TelemetrySample(
        time: start.add(const Duration(seconds: 11)),
        lat: -6.901,
        lon: 107.602,
        alt: 15,
        speed: 0,
        armed: false,
      ),
    ];
    final drops = [
      DropRecord.fromJson({'time': start.add(const Duration(seconds: 2)).millisecondsSinceEpoch / 1000, 'thrust': 60, 'duration': 1}),
      DropRecord.fromJson({'time': start.add(const Duration(seconds: 8)).millisecondsSinceEpoch / 1000, 'thrust': 62, 'duration': 1}),
    ];

    final sessions = FlightSummary.sessions(samples, drops: drops);
    expect(sessions, hasLength(1));

    final session = sessions.first;
    expect(session.id, 'session-${start.millisecondsSinceEpoch}');
    expect(session.durationS, 10);
    expect(session.sampleCount, 2);
    expect(session.seedsUsed, 6);
    expect(session.maxAlt, 15);
    expect(session.maxAltAglM, 13);
    expect(session.maxSpeed, 7);
    expect(session.energyConsumedWh, 3);
    expect(session.dropCount, 2);
    expect(session.mode, 'AUTO');

    final json = session.toJson();
    expect(json['id'], session.id);
    expect(json['duration_s'], 10);
    expect(json['distance_km'], greaterThan(0));
    expect(json['seeds_used'], 6);
    expect(json['drop_count'], 2);
    expect(json.containsKey('points'), isFalse);
    expect(json.containsKey('sample_count'), isTrue);
  });

  test('Sesi dipisah oleh gap lebih dari 60 detik', () {
    final start = DateTime.utc(2026, 11, 21, 9, 0);
    final samples = [
      TelemetrySample(time: start, lat: -6.9, lon: 107.6, armed: true),
      TelemetrySample(
        time: start.add(const Duration(seconds: 10)),
        lat: -6.901,
        lon: 107.601,
        armed: true,
      ),
      TelemetrySample(
        time: start.add(const Duration(seconds: 130)),
        lat: -6.902,
        lon: 107.602,
        armed: true,
      ),
      TelemetrySample(
        time: start.add(const Duration(seconds: 140)),
        lat: -6.903,
        lon: 107.603,
        armed: true,
      ),
    ];

    final sessions = FlightSummary.sessions(samples);
    expect(sessions, hasLength(2));
    expect(sessions.first.start, start.add(const Duration(seconds: 130)));
  });
}
