import 'package:flutter/foundation.dart';

class AppConfig {
  const AppConfig._();

  static const String defaultBackendUrl = String.fromEnvironment(
    'DCC_BACKEND_URL',
    defaultValue: 'http://192.168.1.105:8000',
  );

  static final ValueNotifier<String> backendUrl = ValueNotifier<String>(defaultBackendUrl);

  static final ValueNotifier<bool> dummyMode = ValueNotifier<bool>(
    const bool.fromEnvironment('DCC_DUMMY', defaultValue: false),
  );

  static Uri uri(String path) {
    final base = backendUrl.value.trim().replaceAll(RegExp(r'/+$'), '');
    return Uri.parse('$base$path');
  }
}
