import '../../core/config/app_config.dart';
import '../datasources/drone_remote_datasource.dart';
import '../datasources/dummy_drone_datasource.dart';
import '../models/battery_info.dart';
import '../models/drop_config.dart';
import '../models/drop_point.dart';
import '../models/drone_status.dart';
import '../models/mqtt_info.dart';
import '../models/seed_info.dart';
import '../models/thruster_status.dart';

class DroneRepository {
  DroneRepository({DroneRemoteDataSource? remote, DummyDroneDataSource? dummy})
      : _remote = remote ?? DroneRemoteDataSource(),
        _dummy = dummy ?? DummyDroneDataSource();

  final DroneRemoteDataSource _remote;
  final DummyDroneDataSource _dummy;

  bool get _dummyActive => AppConfig.dummyMode.value;

  Future<DroneStatus> status() =>
      _dummyActive ? _dummy.fetchStatus() : _remote.fetchStatus();

  Future<List<DropRecord>> drops() =>
      _dummyActive ? _dummy.fetchDrops() : _remote.fetchDrops();

  Future<MqttInfo> mqtt() =>
      _dummyActive ? _dummy.fetchMqtt() : _remote.fetchMqtt();

  Future<DropRecord> drop() =>
      _dummyActive ? _dummy.dropNow() : _remote.dropNow();

  Future<DropConfigData> configureDrop({double? thrustPercent, double? durationS}) =>
      _dummyActive
          ? _dummy.configureDrop(thrustPercent: thrustPercent, durationS: durationS)
          : _remote.configureDrop(thrustPercent: thrustPercent, durationS: durationS);

  Future<SeedInfo> loadSeed(int loaded) =>
      _dummyActive ? _dummy.loadSeed(loaded) : _remote.loadSeed(loaded);

  Future<BatterySetup> configureBattery(BatterySetup setup) =>
      _dummyActive ? _dummy.configureBattery(setup) : _remote.configureBattery(setup);

  Future<ThrusterResult> testThruster({
    required String target,
    required double thrustPercent,
    required double durationS,
  }) =>
      _dummyActive
          ? _dummy.testThruster(
              target: target,
              thrustPercent: thrustPercent,
              durationS: durationS,
            )
          : _remote.testThruster(
              target: target,
              thrustPercent: thrustPercent,
              durationS: durationS,
            );

  Future<ThrusterResult> emergencyStop() =>
      _dummyActive ? _dummy.stopThruster() : _remote.stopThruster();

  void close() {
    _remote.close();
    _dummy.close();
  }
}
