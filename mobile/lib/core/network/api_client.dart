import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../core/network/api_exception.dart';

class ApiClient {
  ApiClient({this.timeout = const Duration(seconds: 3)});

  final Duration timeout;
  final HttpClient _http = HttpClient();

  Future<dynamic> getJson(Uri uri) async {
    final request = await _http.getUrl(uri);
    request.headers.set('Accept', 'application/json');
    return _read(request);
  }

  Future<dynamic> postJson(Uri uri, [Object? body]) async {
    final request = await _http.postUrl(uri);
    request.headers.set('Accept', 'application/json');
    if (body != null) {
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(body));
    }
    return _read(request);
  }

  void close() => _http.close();

  Future<dynamic> _read(HttpClientRequest request) async {
    try {
      final response = await request.close().timeout(timeout);
      final text = await utf8.decoder.bind(response).join();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(
          'Backend ${response.statusCode}: ${text.isEmpty ? 'gagal' : text}',
          statusCode: response.statusCode,
        );
      }
      if (text.isEmpty) return null;
      return jsonDecode(text);
    } on ApiException {
      rethrow;
    } on TimeoutException {
      throw const ApiException('Backend tidak merespons (timeout). Periksa IP dan port 8000.');
    } on SocketException catch (e) {
      throw ApiException('Tidak bisa menjangkau backend: ${e.message}');
    } on HttpException catch (e) {
      throw ApiException('Respons backend tidak valid: ${e.message}');
    } catch (e) {
      throw ApiException('Gagal memanggil backend: $e');
    }
  }
}
