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
  bool _disposed = false;
  int _ticks = 0;
  int _generation = 0;

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

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void start() {
    if (_disposed) return;
    _timer?.cancel();
    _poll();
    _timer = Timer.periodic(interval, (_) => _poll());
  }

  void _resetState() {
    _status = DroneStatus.empty;
    history.clear();
    _drops = const [];
    _mqtt = null;
    _error = null;
    _loading = true;
    _busy = false;
  }

  void _invalidate() {
    _generation++;
    _busy = false;
  }

  void _onBackendUrlChanged() {
    if (_disposed) return;
    _invalidate();
    _repository.close();
    _repository = DroneRepository();
    _resetState();
    start();
  }

  void _onDummyModeChanged() {
    if (_disposed) return;
    _invalidate();
    _resetState();
    _ticks = 0;
    _notify();
    start();
  }

  Future<void> _poll() async {
    if (_disposed || _busy) return;
    final generation = _generation;
    final repository = _repository;
    _busy = true;
    try {
      final next = await repository.status();
      if (_disposed || generation != _generation) return;
      _status = next;
      if (history.isEmpty && AppConfig.dummyMode.value) {
        history.seedDummy(next);
      } else {
        history.add(next);
      }
      _error = null;
      _ticks++;
      if (_ticks == 1 || _ticks % 10 == 0) {
        await refreshDrops(
          silent: true,
          generation: generation,
          repository: repository,
        );
        if (_disposed || generation != _generation) return;
        await _refreshMqtt(
          silent: true,
          generation: generation,
          repository: repository,
        );
      }
    } on ApiException catch (e) {
      if (_disposed || generation != _generation) return;
      _error = e.message;
    } catch (e) {
      if (_disposed || generation != _generation) return;
      _error = 'Gagal membaca status: $e';
    } finally {
      if (!_disposed && generation == _generation) {
        _busy = false;
        _loading = false;
        _notify();
      }
    }
  }

  void clearHistory() {
    if (_disposed) return;
    history.clear();
    _notify();
  }

  Future<void> refreshDrops({
    bool silent = false,
    int? generation,
    DroneRepository? repository,
  }) async {
    final target = repository ?? _repository;
    bool stale() => generation != null && generation != _generation;
    if (_disposed || stale()) return;
    try {
      final next = await target.drops();
      if (_disposed || stale()) return;
      _drops = next;
      if (!silent) _notify();
    } on ApiException catch (e) {
      if (silent || _disposed || stale()) return;
      _error = e.message;
      _notify();
    } catch (e) {
      if (silent || _disposed || stale()) return;
      _error = 'Gagal membaca riwayat: $e';
      _notify();
    }
  }

  Future<void> _refreshMqtt({
    bool silent = false,
    int? generation,
    DroneRepository? repository,
  }) async {
    final target = repository ?? _repository;
    bool stale() => generation != null && generation != _generation;
    if (_disposed || stale()) return;
    try {
      final next = await target.mqtt();
      if (_disposed || stale()) return;
      _mqtt = next;
      if (!silent) _notify();
    } catch (_) {}
  }

  Future<DropRecord?> drop() async {
    try {
      final record = await _repository.drop();
      await refreshDrops(silent: true);
      _notify();
      return record;
    } on ApiException catch (e) {
      _error = e.message;
      _notify();
      return null;
    } catch (e) {
      _error = 'Gagal mengirim drop: $e';
      _notify();
      return null;
    }
  }

  Future<String?> configureDrop({required double thrustPercent, required double durationS}) async {
    try {
      _dropConfig = await _repository.configureDrop(
        thrustPercent: thrustPercent,
        durationS: durationS,
      );
      _notify();
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
      _notify();
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
      _notify();
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
      _notify();
      return result;
    } on ApiException catch (e) {
      _error = e.message;
      _notify();
      return null;
    } catch (e) {
      _error = 'Gagal tes thruster: $e';
      _notify();
      return null;
    }
  }

  Future<({String? error, ThrusterResult? result})> emergencyStop() async {
    try {
      final result = await _repository.emergencyStop();
      _notify();
      return (error: null, result: result);
    } on ApiException catch (e) {
      _error = e.message;
      _notify();
      return (error: e.message, result: null);
    } catch (e) {
      final message = 'Gagal mengirim STOP: $e';
      _error = message;
      _notify();
      return (error: message, result: null);
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _timer?.cancel();
    AppConfig.backendUrl.removeListener(_onBackendUrlChanged);
    AppConfig.dummyMode.removeListener(_onDummyModeChanged);
    _repository.close();
    super.dispose();
  }
}
