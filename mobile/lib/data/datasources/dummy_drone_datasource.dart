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
    final altitude = 12.5 + sin(phase * 0.4) * 2.4;
    final speed = 7.8 + sin(phase * 0.5) * 1.5;
    final heading = (72 + seconds * 0.8) % 360;

    final json = <String, dynamic>{
      'connected': true,
      'armed': !stopped,
      'mode': 'GUIDED',
      'lat': siteLat + sin(phase * 0.05) * 0.00065,
      'lon': siteLon + cos(phase * 0.05) * 0.00072,
      'alt': altitude,
      'pitch': sin(phase * 0.6) * 4.2,
      'roll': cos(phase * 0.6) * 3.1,
      'yaw': heading,
      'speed': speed,
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
      'gps': <String, dynamic>{
        'fix_type': 3,
        'satellites_visible': 14,
        'hdop': 0.65,
        'vdop': 0.9,
        'alt_msl_m': altitude + 6.2,
        'speed_mps': speed,
        'cog_deg': heading,
        'rtk_status': 'none',
      },
      'nav': <String, dynamic>{
        'alt_amsl_m': altitude + 6.2,
        'alt_rel_m': altitude,
        'airspeed_mps': speed - 0.4,
        'groundspeed_mps': speed,
        'climb_mps': 0.4 + sin(phase * 0.3) * 0.3,
        'throttle_percent': 42 + sin(phase * 0.4) * 5,
        'heading_deg': heading,
        'cog_deg': heading,
        'vx_mps': speed * cos(heading * pi / 180),
        'vy_mps': speed * sin(heading * pi / 180),
        'vz_mps': 0.4 + sin(phase * 0.3) * 0.3,
        'wind_speed_mps': 3.1,
        'wind_direction_deg': 143,
        'wind_source': 'WIND_COV',
      },
      'mission': <String, dynamic>{
        'current_wp': 2,
        'total_wp': 6,
        'next_wp_lat': siteLat + 0.0012,
        'next_wp_lon': siteLon + 0.0015,
        'wp_distance_m': 45 + sin(phase * 0.2) * 12,
        'target_bearing_deg': heading,
        'nav_bearing_deg': heading - 3,
        'nav_roll_deg': 2.4,
        'nav_pitch_deg': -1.1,
        'xtrack_error_m': 0.4,
        'state': 'GUIDED',
      },
      'servo': <String, dynamic>{
        'channels': <Map<String, dynamic>>[
          for (var i = 1; i <= 4; i++)
            <String, dynamic>{
              'channel': i,
              'pwm': stopped ? 1000 : (1350 + sin(phase + i * 0.8) * 180).round(),
              'percent': stopped ? 0.0 : 35 + sin(phase + i * 0.8) * 18,
            },
          <String, dynamic>{
            'channel': 9,
            'pwm': 1800,
            'percent': 80,
            'function': 'SeedDrop',
          },
        ],
        'last_drop': _drops.isEmpty
            ? null
            : <String, dynamic>{
                'time': DateTime.fromMillisecondsSinceEpoch(
                  (((_drops.last['time'] as num?)?.toDouble() ?? 0) * 1000).round(),
                ).toUtc().toIso8601String(),
                'channel': 9,
                'pwm': 1800,
                'ack_result': 'ACCEPTED',
                'drop_id': 'dummy-${_drops.length}',
              },
      },
      'schema_version': 1,
      'time': <String, dynamic>{
        'utc': now.toUtc().toIso8601String(),
        'boot_ms': seconds * 1000,
      },
      'power': <String, dynamic>{
        'source': 'BATTERY_STATUS',
        'battery_id': 0,
        'remaining_percent': percent + 1.5 > 100 ? 100.0 : percent + 1.5,
        'energy_consumed_wh': usedMah / 1000 * 22.2,
        'cell_voltages_v': List<double>.generate(
          6,
          (index) => 4.05 + sin(phase * 0.2 + index) * 0.08,
        ),
        'temperature_c': 34.5,
        'load_percent': 38 + sin(phase * 0.4) * 6,
        'usb_connected': false,
        'power_brick_out': false,
      },
      'health': <String, dynamic>{
        'prearm_ok': true,
        'ekf_ok': true,
        'ekf_flags': 31,
        'sensor_present': 3145727,
        'sensor_enabled': 3145727,
        'sensor_health': 3145727,
        'vibration_x': 0.21,
        'vibration_y': 0.28,
        'vibration_z': 0.44,
        'clipping_events': 0,
        'comm_drop_rate': 0.2,
        'comm_errors': 0,
        'failsafe': <String>[],
      },
      'link': <String, dynamic>{
        'rssi': 68,
        'remrssi': 64,
        'noise': 92,
        'remnoise': 95,
        'rx_errors': 2,
        'fixed': 128,
        'txbuf_percent': 12,
      },
      'messages': <Map<String, dynamic>>[
        <String, dynamic>{
          'time': now.subtract(const Duration(seconds: 42)).toUtc().toIso8601String(),
          'severity': 6,
          'text': 'GPS 3D fix acquired',
          'component': 3,
        },
      ],
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
