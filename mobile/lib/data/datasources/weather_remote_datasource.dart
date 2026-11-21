import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../core/config/app_config.dart';
import '../models/weather.dart';
import 'dummy_weather.dart';

class WeatherService {
  WeatherService({this.timeout = const Duration(seconds: 8)});

  final Duration timeout;
  final HttpClient _http = HttpClient();

  Future<WeatherForecast> fetch(double lat, double lon) async {
    if (AppConfig.dummyMode.value) return DummyWeatherForecast.build(lat, lon);
    final location = await _location(lat, lon);
    final adm4 = location['adm4'] as String? ?? '';
    if (adm4.isEmpty) throw const WeatherException('Lokasi tidak memiliki kode BMKG (adm4).');
    final raw = await _getJson(
      Uri.parse('https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${Uri.encodeComponent(adm4)}'),
      referer: true,
    );
    final entry = (raw['data'] as List<dynamic>?)?.cast<Map<String, dynamic>>().firstOrNull;
    if (entry == null) throw const WeatherException('Prakiraan BMKG belum tersedia.');
    final groups = entry['cuaca'] as List<dynamic>? ?? [];
    final slots = <WeatherSlot>[];
    for (final group in groups) {
      if (group is! List<dynamic>) continue;
      for (final item in group) {
        if (item is Map<String, dynamic>) slots.add(WeatherSlot.fromJson(item));
      }
    }
    if (slots.isEmpty) throw const WeatherException('Slot prakiraan BMKG kosong.');
    final loc = entry['lokasi'] as Map<String, dynamic>? ?? location;
    final name = [
      loc['kecamatan'],
      loc['kotkab'],
      loc['provinsi'],
    ].whereType<String>().join(', ');
    return WeatherForecast(location: name.isEmpty ? 'Lokasi drone' : name, adm4: adm4, slots: slots);
  }

  void close() => _http.close();

  Future<Map<String, dynamic>> _location(double lat, double lon) async {
    final raw = await _getJson(
      Uri.parse('https://cuaca.bmkg.go.id/api/df/v1/adm/coord?lat=${lat.toStringAsFixed(6)}&lon=${lon.toStringAsFixed(6)}'),
      origin: true,
    );
    return raw is Map<String, dynamic> ? raw : <String, dynamic>{};
  }

  Future<dynamic> _getJson(Uri uri, {bool origin = false, bool referer = false}) async {
    try {
      final request = await _http.getUrl(uri);
      request.headers.set('Accept', 'application/json');
      request.headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36');
      if (origin) request.headers.set('Origin', 'https://cuaca.bmkg.go.id');
      if (origin || referer) request.headers.set('Referer', 'https://cuaca.bmkg.go.id/');
      final response = await request.close().timeout(timeout);
      final text = await utf8.decoder.bind(response).join();
      if (response.statusCode != 200) {
        throw WeatherException('BMKG HTTP ${response.statusCode}');
      }
      return jsonDecode(text);
    } on WeatherException {
      rethrow;
    } on TimeoutException {
      throw const WeatherException('BMKG timeout. Periksa koneksi internet HP.');
    } on SocketException {
      throw const WeatherException('Tidak bisa menjangkau BMKG.');
    } catch (e) {
      throw WeatherException('Gagal membaca BMKG: $e');
    }
  }
}

class WeatherException implements Exception {
  const WeatherException(this.message);

  final String message;

  @override
  String toString() => message;
}
