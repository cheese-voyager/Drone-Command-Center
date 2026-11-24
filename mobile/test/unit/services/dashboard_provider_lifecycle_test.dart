import 'dart:async';

import 'package:drone_command_center/core/utils/formatters.dart';
import 'package:drone_command_center/data/models/drone_status.dart';
import 'package:drone_command_center/data/models/weather.dart';
import 'package:drone_command_center/features/dashboard/providers/dashboard_provider.dart';
import 'package:drone_command_center/features/thruster_test/pages/thruster_test_page.dart';
import 'package:drone_command_center/features/weather/pages/weather_page.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../mocks/mock_drone_repository.dart';

class _SlowRepository extends FakeDroneRepository {
  final Completer<DroneStatus> pending = Completer<DroneStatus>();

  @override
  Future<DroneStatus> status() => pending.future;
}

void main() {
  test('poll yang selesai setelah dispose tidak memberitahu listener', () async {
    final repository = _SlowRepository();
    final provider = DashboardProvider(
      repository: repository,
      interval: const Duration(hours: 1),
    );
    var notifications = 0;
    provider.addListener(() => notifications++);

    provider.dispose();
    repository.pending.complete(DroneStatus.empty);
    await Future<void>.delayed(Duration.zero);

    expect(notifications, 0);
  });

  test('emergencyStop mengembalikan konfirmasi dari backend', () async {
    final provider = DashboardProvider(
      repository: FakeDroneRepository(),
      interval: const Duration(hours: 1),
    );
    final outcome = await provider.emergencyStop();

    expect(outcome.error, isNull);
    expect(outcome.result?.stopped, isTrue);
    provider.dispose();
  });

  test('penilaian cuaca tidak menganggap data kosong sebagai aman', () {
    final incomplete = assessWeatherRisk(const WeatherSlot(temperature: 28));
    final safe = assessWeatherRisk(const WeatherSlot(rain: 0, windSpeed: 5));
    final bad = assessWeatherRisk(const WeatherSlot(rain: 5, windSpeed: 3));

    expect(incomplete?.label, 'DATA CUACA TIDAK LENGKAP');
    expect(safe?.label, 'AMAN TERBANG');
    expect(bad?.label, 'CUACA BURUK');
  });

  test('validasi thruster menolak motor saat armed dan di atas 30%', () {
    expect(
      validateThrusterTest(target: 'motor_1', armed: true, thrustPercent: 10, durationS: 1),
      contains('ARMED'),
    );
    expect(
      validateThrusterTest(target: 'all_motors', armed: false, thrustPercent: 31, durationS: 1),
      contains('maksimal 30%'),
    );
    expect(
      validateThrusterTest(target: 'seeder', armed: true, thrustPercent: 100, durationS: 1),
      isNull,
    );
  });

  test('format koordinat memakai satu konvensi', () {
    expect(formatCoordinate(-6.8971983, 107.636371), '-6.897198, 107.636371');
    expect(formatCoordinate(null, null), '--');
    expect(formatLatitude(-0.0000001), '0.000000');
  });
}
