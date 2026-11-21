import '../../../core/config/app_config.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../models/battery_info.dart';
import '../models/drop_config.dart';
import '../models/drop_point.dart';
import '../models/drone_status.dart';
import '../models/mqtt_info.dart';
import '../models/seed_info.dart';
import '../models/thruster_status.dart';

class DroneRemoteDataSource {
  DroneRemoteDataSource({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<DroneStatus> fetchStatus() async {
    final json = await _client.getJson(AppConfig.uri(ApiEndpoints.status));
    return DroneStatus.fromJson(_asMap(json, 'status'));
  }

  Future<List<DropRecord>> fetchDrops() async {
    final json = await _client.getJson(AppConfig.uri(ApiEndpoints.drops));
    if (json is! List<dynamic>) throw const ApiException('Respons /drops bukan daftar JSON.');
    return json
        .whereType<Map<String, dynamic>>()
        .map(DropRecord.fromJson)
        .toList();
  }

  Future<MqttInfo> fetchMqtt() async {
    final json = await _client.getJson(AppConfig.uri(ApiEndpoints.mqtt));
    return MqttInfo.fromJson(_asMap(json, 'mqtt'));
  }

  Future<DropRecord> dropNow() async {
    final json = await _client.postJson(AppConfig.uri(ApiEndpoints.drop));
    return DropRecord.fromJson(_asMap(json, 'drop'));
  }

  Future<DropConfigData> configureDrop({double? thrustPercent, double? durationS}) async {
    final body = <String, dynamic>{
      if (thrustPercent != null) 'thrust_percent': thrustPercent,
      if (durationS != null) 'duration_s': durationS,
    };
    final json = await _client.postJson(AppConfig.uri(ApiEndpoints.dropConfig), body);
    return DropConfigData.fromJson(_asMap(json, 'drop/config'));
  }

  Future<SeedInfo> loadSeed(int loaded) async {
    final json = await _client.postJson(AppConfig.uri(ApiEndpoints.seedLoad), {'loaded': loaded});
    final map = _asMap(json, 'seed/load');
    final nextLoaded = (map['loaded'] as num?)?.toInt() ?? loaded;
    final nextDropped = (map['dropped'] as num?)?.toInt() ?? 0;
    return SeedInfo(
      loaded: nextLoaded,
      dropped: nextDropped,
      remaining: (map['remaining'] as num?)?.toInt() ?? (nextLoaded - nextDropped),
    );
  }

  Future<BatterySetup> configureBattery(BatterySetup setup) async {
    await _client.postJson(AppConfig.uri(ApiEndpoints.battery), setup.toJson());
    return setup;
  }

  Future<ThrusterResult> testThruster({
    required String target,
    required double thrustPercent,
    required double durationS,
  }) async {
    final json = await _client.postJson(AppConfig.uri(ApiEndpoints.thrusterTest), {
      'target': target,
      'thrust_percent': thrustPercent,
      'duration_s': durationS,
    });
    return ThrusterResult.fromJson(_asMap(json, 'thruster/test'));
  }

  Future<ThrusterResult> stopThruster() async {
    final json = await _client.postJson(AppConfig.uri(ApiEndpoints.thrusterStop));
    return ThrusterResult.fromJson(_asMap(json, 'thruster/stop'));
  }

  void close() => _client.close();

  Map<String, dynamic> _asMap(dynamic json, String name) {
    if (json is! Map<String, dynamic>) {
      throw ApiException('Respons $name bukan objek JSON.');
    }
    return json;
  }
}
