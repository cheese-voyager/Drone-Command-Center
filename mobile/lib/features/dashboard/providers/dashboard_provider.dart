import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_exception.dart';
import '../../../data/models/battery_info.dart';
import '../../../data/models/drop_config.dart';
import '../../../data/models/drop_point.dart';
import '../../../data/models/drone_status.dart';
import '../../../data/models/mqtt_info.dart';
import '../../../data/models/thruster_status.dart';
import '../../../data/repositories/drone_repository.dart';
import '../../../data/services/telemetry_history.dart';

class DashboardProvider extends ChangeNotifier {
  DashboardProvider({DroneRepository? repository, this.interval = const Duration(seconds: 1)})
      : _repository = repository ?? DroneRepository() {
    AppConfig.backendUrl.addListener(_onBackendUrlChanged);
    AppConfig.dummyMode.addListener(_onDummyModeChanged);
    start();
  }

  final Duration interval;

  final TelemetryHistory history = TelemetryHistory();

  DroneRepository _repository;
  Timer? _timer;
  DroneStatus _status = DroneStatus.empty;
  List<DropRecord> _drops = const [];
  MqttInfo? _mqtt;
  DropConfigData _dropConfig = const DropConfigData(
    servoChannel: 9,
    thrustPercent: 70,
    durationS: 1,
    seedsPerDrop: 1,
    pwmMin: 1000,
    pwmMax: 2000,
  );
  String? _error;
  bool _loading = true;
  bool _busy = false;
  int _ticks = 0;

  DroneStatus get status => _status;
  List<TelemetrySample> get samples => history.samples;
  List<DropRecord> get drops => _drops;
  MqttInfo? get mqtt => _mqtt;
  DropConfigData get dropConfig => _dropConfig;
  String? get error => _error;
  bool get loading => _loading;
  bool get busy => _busy;
  bool get backendOnline => AppConfig.dummyMode.value || (_error == null && !_loading);
  bool get droneConnected => _status.connected;

  void start() {
    _timer?.cancel();
    _poll();
    _timer = Timer.periodic(interval, (_) => _poll());
  }

  void _onBackendUrlChanged() {
    _repository.close();
    _repository = DroneRepository();
    _status = DroneStatus.empty;
    history.clear();
    _drops = const [];
    _mqtt = null;
    _error = null;
    _loading = true;
    start();
  }

  void _onDummyModeChanged() {
    _status = DroneStatus.empty;
    history.clear();
    _drops = const [];
    _mqtt = null;
    _error = null;
    _loading = true;
    _ticks = 0;
    notifyListeners();
    start();
  }

  Future<void> _poll() async {
    if (_busy) return;
    _busy = true;
    try {
      final next = await _repository.status();
      _status = next;
      if (history.isEmpty) {
        history.seedDummy(next);
      } else {
        history.add(next);
      }
      _error = null;
      _ticks++;
      if (_ticks == 1 || _ticks % 10 == 0) {
        await refreshDrops(silent: true);
        await _refreshMqtt(silent: true);
      }
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Gagal membaca status: $e';
    } finally {
      _busy = false;
      _loading = false;
      notifyListeners();
    }
  }

  void clearHistory() {
    history.clear();
    notifyListeners();
  }

  Future<void> refreshDrops({bool silent = false}) async {
    try {
      _drops = await _repository.drops();
      if (!silent) notifyListeners();
    } on ApiException catch (e) {
      if (!silent) _error = e.message;
    } catch (e) {
      if (!silent) _error = 'Gagal membaca riwayat: $e';
    }
  }

  Future<void> _refreshMqtt({bool silent = false}) async {
    try {
      _mqtt = await _repository.mqtt();
      if (!silent) notifyListeners();
    } catch (_) {}
  }

  Future<DropRecord?> drop() async {
    try {
      final record = await _repository.drop();
      await refreshDrops(silent: true);
      notifyListeners();
      return record;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Gagal mengirim drop: $e';
      notifyListeners();
      return null;
    }
  }

  Future<String?> configureDrop({required double thrustPercent, required double durationS}) async {
    try {
      _dropConfig = await _repository.configureDrop(
        thrustPercent: thrustPercent,
        durationS: durationS,
      );
      notifyListeners();
      return null;
    } on ApiException catch (e) {
      return e.message;
    } catch (e) {
      return 'Gagal menyimpan konfigurasi drop: $e';
    }
  }

  Future<String?> loadSeed(int loaded) async {
    try {
      final next = await _repository.loadSeed(loaded);
      _status = _status.copyWith(seed: next);
      notifyListeners();
      return null;
    } on ApiException catch (e) {
      return e.message;
    } catch (e) {
      return 'Gagal memuat benih: $e';
    }
  }

  Future<String?> configureBattery(BatterySetup setup) async {
    try {
      await _repository.configureBattery(setup);
      notifyListeners();
      return null;
    } on ApiException catch (e) {
      return e.message;
    } catch (e) {
      return 'Gagal menyimpan baterai: $e';
    }
  }

  Future<ThrusterResult?> testThruster({
    required String target,
    required double thrustPercent,
    required double durationS,
  }) async {
    try {
      final result = await _repository.testThruster(
        target: target,
        thrustPercent: thrustPercent,
        durationS: durationS,
      );
      notifyListeners();
      return result;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Gagal tes thruster: $e';
      notifyListeners();
      return null;
    }
  }

  Future<String?> emergencyStop() async {
    try {
      await _repository.emergencyStop();
      return null;
    } on ApiException catch (e) {
      return e.message;
    } catch (e) {
      return 'Gagal mengirim STOP: $e';
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    AppConfig.backendUrl.removeListener(_onBackendUrlChanged);
    AppConfig.dummyMode.removeListener(_onDummyModeChanged);
    _repository.close();
    super.dispose();
  }
}
