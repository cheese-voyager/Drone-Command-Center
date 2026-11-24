import 'package:drone_command_center/data/models/battery_info.dart';
import 'package:drone_command_center/data/models/drop_config.dart';
import 'package:drone_command_center/data/models/drop_point.dart';
import 'package:drone_command_center/data/models/drone_status.dart';
import 'package:drone_command_center/data/models/mqtt_info.dart';
import 'package:drone_command_center/data/models/seed_info.dart';
import 'package:drone_command_center/data/models/thruster_status.dart';
import 'package:drone_command_center/data/repositories/drone_repository.dart';

class FakeDroneRepository extends DroneRepository {
  FakeDroneRepository({
    this.statusValue = DroneStatus.empty,
    this.dropsValue = const <DropRecord>[],
  });

  DroneStatus statusValue;
  List<DropRecord> dropsValue;

  @override
  Future<DroneStatus> status() async => statusValue;

  @override
  Future<List<DropRecord>> drops() async => dropsValue;

  @override
  Future<MqttInfo> mqtt() async => const MqttInfo(
        enabled: true,
        commandsEnabled: true,
        connected: true,
        host: 'localhost',
        port: 1883,
        wsPort: 9001,
        baseTopic: 'dcc/test',
      );

  @override
  Future<DropRecord> drop() async => const DropRecord(
        time: 1,
        thrust: 70,
        duration: 1,
      );

  @override
  Future<DropConfigData> configureDrop({
    double? thrustPercent,
    double? durationS,
  }) async =>
      DropConfigData(
        servoChannel: 9,
        thrustPercent: thrustPercent ?? 70,
        durationS: durationS ?? 1,
        seedsPerDrop: 1,
        pwmMin: 1000,
        pwmMax: 2000,
      );

  @override
  Future<SeedInfo> loadSeed(int loaded) async => SeedInfo(
        loaded: loaded,
        dropped: 0,
        remaining: loaded,
      );

  @override
  Future<BatterySetup> configureBattery(BatterySetup setup) async => setup;

  @override
  Future<ThrusterResult> testThruster({
    required String target,
    required double thrustPercent,
    required double durationS,
  }) async =>
      ThrusterResult(
        target: target,
        thrust: thrustPercent,
        duration: durationS,
      );

  @override
  Future<ThrusterResult> emergencyStop() async => const ThrusterResult(
        target: 'all',
        thrust: 0,
        duration: 0,
        stopped: true,
      );

  @override
  void close() {}
}
