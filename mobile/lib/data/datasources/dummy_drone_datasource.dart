import 'dart:math';

import '../models/battery_info.dart';
import '../models/drop_config.dart';
import '../models/drop_point.dart';
import '../models/drone_status.dart';
import '../models/mqtt_info.dart';
import '../models/seed_info.dart';
import '../models/thruster_status.dart';

class DummyDroneDataSource {
  DummyDroneDataSource({DateTime? startedAt}) : _startedAt = startedAt ?? DateTime.now() {
    final now = DateTime.now();
    _drops = List<Map<String, dynamic>>.generate(6, (index) {
      final time = now.subtract(Duration(minutes: 48 - index * 8));
      return <String, dynamic>{
        'time': time.millisecondsSinceEpoch / 1000,
        'lat': siteLat + sin(index * 1.1) * 0.0009,
        'lon': siteLon + cos(index * 1.1) * 0.0011,
        'thrust': 60 + (index % 3) * 8,
        'duration': 1.0 + (index % 2) * 0.4,
      };
    });
  }

  static const siteLat = -6.8971983;
  static const siteLon = 107.636371;

  final DateTime _startedAt;
  late List<Map<String, dynamic>> _drops;
  int _capacityMah = 8000;
  int _loaded = 40;
  double _thrustPercent = 70;
  double _durationS = 1;
  DateTime? _stoppedUntil;

  Future<DroneStatus> fetchStatus() async {
    final now = DateTime.now();
    final seconds = now.difference(_startedAt).inSeconds;
    final minutes = seconds / 60;
    final phase = seconds * 0.35;
    final percent = (82 - minutes * 0.08).clamp(45.0, 82.0).toDouble();
    final usedMah = _capacityMah * (1 - percent / 100);
    final remainingMah = _capacityMah - usedMah;
    final stopped = _stoppedUntil?.isAfter(now) ?? false;
    final dropped = min(_drops.length, _loaded);

    final json = <String, dynamic>{
      'connected': true,
      'armed': !stopped,
      'mode': 'GUIDED',
      'lat': siteLat + sin(phase * 0.05) * 0.00065,
      'lon': siteLon + cos(phase * 0.05) * 0.00072,
      'alt': 12.5 + sin(phase * 0.4) * 2.4,
      'pitch': sin(phase * 0.6) * 4.2,
      'roll': cos(phase * 0.6) * 3.1,
      'yaw': (72 + seconds * 0.8) % 360,
      'speed': 7.8 + sin(phase * 0.5) * 1.5,
      'avg_speed': 7.4 + sin(phase * 0.3) * 1.1,
      'voltage': 16.4 + sin(phase * 0.5) * 0.35,
      'current': 18.5 + sin(phase * 0.7) * 3.2,
      'gps_fix': 3,
      'satellites': 14,
      'battery': <String, dynamic>{
        'capacity_mah': _capacityMah,
        'remaining_mah': remainingMah,
        'remaining_percent': percent,
        'estimated_minutes_left': (remainingMah / 22 * 60).round(),
        'low': false,
        'used_mah': usedMah,
        'avg_current': 21.4 + sin(phase * 0.2) * 1.6,
      },
      'seed': <String, dynamic>{
        'loaded': _loaded,
        'dropped': dropped,
        'remaining': _loaded - dropped,
      },
      'motors': List<Map<String, dynamic>>.generate(4, (index) {
        final motorPhase = phase + index * 0.8;
        return <String, dynamic>{
          'id': index + 1,
          'pwm': stopped ? 1000 : (1350 + sin(motorPhase) * 180).round(),
          'percent': stopped ? 0.0 : 35 + sin(motorPhase) * 18,
        };
      }),
    };
    return DroneStatus.fromJson(json);
  }

  Future<List<DropRecord>> fetchDrops() async =>
      _drops.map(DropRecord.fromJson).toList().reversed.toList();

  Future<MqttInfo> fetchMqtt() async {
    return MqttInfo.fromJson(<String, dynamic>{
      'enabled': true,
      'commands_enabled': true,
      'connected': true,
      'host': 'dummy.local',
      'port': 1883,
      'ws_port': 9001,
      'base_topic': 'seeder/drone1',
    });
  }

  Future<DropRecord> dropNow() async {
    final now = DateTime.now();
    final seconds = now.difference(_startedAt).inSeconds;
    final json = <String, dynamic>{
      'time': now.millisecondsSinceEpoch / 1000,
      'lat': siteLat + sin(seconds * 0.05) * 0.00065,
      'lon': siteLon + cos(seconds * 0.05) * 0.00072,
      'thrust': _thrustPercent,
      'duration': _durationS,
    };
    _drops.add(json);
    return DropRecord.fromJson(json);
  }

  Future<DropConfigData> configureDrop({double? thrustPercent, double? durationS}) async {
    if (thrustPercent != null) _thrustPercent = thrustPercent;
    if (durationS != null) _durationS = durationS;
    return DropConfigData.fromJson(<String, dynamic>{
      'servo_channel': 9,
      'thrust_percent': _thrustPercent,
      'duration_s': _durationS,
      'seeds_per_drop': 1,
      'pwm_min': 1000,
      'pwm_max': 2000,
    });
  }

  Future<SeedInfo> loadSeed(int loaded) async {
    _loaded = loaded;
    return SeedInfo.fromJson(<String, dynamic>{
      'loaded': loaded,
      'dropped': min(_drops.length, loaded),
      'remaining': loaded - min(_drops.length, loaded),
    });
  }

  Future<BatterySetup> configureBattery(BatterySetup setup) async {
    _capacityMah = setup.capacityMah;
    return setup;
  }

  Future<ThrusterResult> testThruster({
    required String target,
    required double thrustPercent,
    required double durationS,
  }) async {
    return ThrusterResult.fromJson(<String, dynamic>{
      'target': target,
      'thrust': thrustPercent,
      'duration': durationS,
      'pwm': (1000 + thrustPercent * 10).round(),
      'total_duration': durationS + 0.4,
      'stopped': false,
    });
  }

  Future<ThrusterResult> stopThruster() async {
    _stoppedUntil = DateTime.now().add(const Duration(seconds: 4));
    return ThrusterResult.fromJson(<String, dynamic>{
      'target': 'all_motors',
      'thrust': 0,
      'duration': 0,
      'pwm': 1000,
      'total_duration': 0.4,
      'stopped': true,
    });
  }

  void close() {}
}
