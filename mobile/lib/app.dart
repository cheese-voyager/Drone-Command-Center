import 'package:flutter/material.dart';

import 'core/theme/app_theme.dart';
import 'features/shell/app_shell.dart';

class DccApp extends StatefulWidget {
  const DccApp({super.key});

  @override
  State<DccApp> createState() => _DccAppState();
}

class _DccAppState extends State<DccApp> {
  final ValueNotifier<ThemeMode> _themeMode = ValueNotifier(ThemeMode.dark);

  @override
  void dispose() {
    _themeMode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: _themeMode,
      builder: (context, mode, _) => MaterialApp(
        title: 'Drone Command Center',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: mode,
        home: AppShell(themeMode: _themeMode),
      ),
    );
  }
}
