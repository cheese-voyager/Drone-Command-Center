import 'package:drone_command_center/data/models/drone_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('DroneStatus parses backend status payload', () {
    final status = DroneStatus.fromJson({
      'connected': true,
      'armed': false,
      'mode': 'GUIDED',
      'lat': -6.8971983,
      'lon': 107.636371,
      'alt': 12.5,
      'pitch': 4.2,
      'roll': -8.5,
      'yaw': 95.0,
      'speed': 3.4,
      'voltage': 22.2,
      'gps_fix': 3,
      'satellites': 12,
      'battery': {
        'capacity_mah': 10000,
        'remaining_mah': 8210,
        'remaining_percent': 82.1,
        'estimated_minutes_left': 243,
        'low': false,
      },
      'seed': {'loaded': 200, 'dropped': 10, 'remaining': 190},
    });

    expect(status.connected, isTrue);
    expect(status.lat, -6.8971983);
    expect(status.battery.remainingPercent, 82.1);
    expect(status.seed.remaining, 190);
  });
}
