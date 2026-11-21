import 'package:flutter/material.dart';

import '../../core/config/app_config.dart';
import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/radial_menu.dart';
import '../battery/pages/battery_page.dart';
import '../dashboard/pages/dashboard_page.dart';
import '../dashboard/providers/dashboard_provider.dart';
import '../drop/pages/drop_page.dart';
import '../history/pages/history_page.dart';
import '../map/pages/map_page.dart';
import '../seed/pages/seed_page.dart';
import '../settings/pages/settings_page.dart';
import '../thruster_test/pages/thruster_test_page.dart';
import '../video/pages/video_page.dart';
import '../weather/pages/weather_page.dart';

const radialItems = <RadialItem>[
  RadialItem(id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard_outlined, ring: 0, angle: 180),
  RadialItem(id: 'map', label: 'Peta', icon: Icons.map_outlined, ring: 0, angle: 135),
  RadialItem(id: 'weather', label: 'Cuaca', icon: Icons.cloud_outlined, ring: 0, angle: 90),
  RadialItem(id: 'drop', label: 'Drop', icon: Icons.water_drop_outlined, ring: 0, angle: 45),
  RadialItem(id: 'thruster', label: 'Thruster', icon: Icons.air, ring: 0, angle: 0),
  RadialItem(id: 'battery', label: 'Baterai', icon: Icons.battery_charging_full, ring: 1, angle: 168),
  RadialItem(id: 'seed', label: 'Benih', icon: Icons.grass, ring: 1, angle: 129),
  RadialItem(id: 'history', label: 'Riwayat', icon: Icons.history, ring: 1, angle: 90),
  RadialItem(id: 'video', label: 'Kamera', icon: Icons.videocam_outlined, ring: 1, angle: 51),
  RadialItem(id: 'settings', label: 'Setelan', icon: Icons.tune, ring: 1, angle: 12),
];

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.themeMode, this.onEmergencyStop});

  final ValueNotifier<ThemeMode> themeMode;
  final VoidCallback? onEmergencyStop;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final DashboardProvider _dashboard = DashboardProvider();
  String _page = 'dashboard';

  @override
  void dispose() {
    _dashboard.dispose();
    super.dispose();
  }

  Widget _pageFor(String id) {
    switch (id) {
      case 'dashboard':
        return DashboardPage(provider: _dashboard);
      case 'map':
        return MapPage(provider: _dashboard);
      case 'weather':
        return WeatherPage(provider: _dashboard);
      case 'drop':
        return DropPage(provider: _dashboard);
      case 'thruster':
        return ThrusterTestPage(provider: _dashboard);
      case 'battery':
        return BatteryPage(provider: _dashboard);
      case 'seed':
        return SeedPage(provider: _dashboard);
      case 'history':
        return HistoryPage(provider: _dashboard);
      case 'video':
        return VideoPage(provider: _dashboard);
      case 'settings':
        return const SettingsPage();
      default:
        return const SizedBox.shrink();
    }
  }

  void _toggleTheme(Brightness current) {
    widget.themeMode.value = current == Brightness.dark ? ThemeMode.light : ThemeMode.dark;
  }

  Future<void> _stop() async {
    widget.onEmergencyStop?.call();
    final error = await _dashboard.emergencyStop();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error ?? 'STOP darurat terkirim ke backend.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final brightness = Theme.of(context).brightness;
    return AnimatedBuilder(
      animation: _dashboard,
      builder: (context, _) => Scaffold(
        body: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              Column(
                children: [
                  _AppBar(
                    colors: c,
                    dark: brightness == Brightness.dark,
                    online: _dashboard.backendOnline,
                    dummy: AppConfig.dummyMode.value,
                    onToggleTheme: () => _toggleTheme(brightness),
                    onStop: _stop,
                  ),
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 180),
                      child: KeyedSubtree(key: ValueKey(_page), child: _pageFor(_page)),
                    ),
                  ),
                ],
              ),
              Positioned.fill(
                child: RadialMenu(
                  items: radialItems,
                  activeId: _page,
                  onSelect: (id) => setState(() => _page = id),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AppBar extends StatelessWidget {
  const _AppBar({
    required this.colors,
    required this.dark,
    required this.online,
    required this.dummy,
    required this.onToggleTheme,
    required this.onStop,
  });

  final DccColors colors;
  final bool dark;
  final bool online;
  final bool dummy;
  final VoidCallback onToggleTheme;
  final Future<void> Function() onStop;

  @override
  Widget build(BuildContext context) {
    final c = colors;
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(color: c.panel, border: Border(bottom: BorderSide(color: c.border))),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: withA(c.accent, 0.12),
              border: Border.all(color: c.accent),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Icon(Icons.adjust, size: 18, color: c.accent),
          ),
          const SizedBox(width: 10),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('DRONE CC', style: DccText.head(c.text, size: 14, weight: FontWeight.w700, ls: 10)),
              Text(
                dummy
                    ? 'GROUND STATION · DUMMY'
                    : online
                        ? 'GROUND STATION · ONLINE'
                        : 'GROUND STATION · OFFLINE',
                style: DccText.mono(dummy ? c.info : online ? c.ok : c.warn, size: 8, weight: FontWeight.w400, ls: 10),
              ),
            ],
          ),
          const Spacer(),
          IconButton(
            tooltip: dark ? 'Beralih ke tema terang' : 'Beralih ke tema gelap',
            onPressed: onToggleTheme,
            icon: Icon(dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined, size: 20, color: c.textSecondary),
          ),
          const SizedBox(width: 4),
          Semantics(
            button: true,
            label: 'Stop darurat',
            child: Material(
              color: c.danger,
              borderRadius: BorderRadius.circular(4),
              child: InkWell(
                borderRadius: BorderRadius.circular(4),
                onTap: onStop,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.report_outlined, size: 16, color: Colors.white),
                      const SizedBox(width: 6),
                      Text('STOP', style: DccText.head(Colors.white, size: 12, weight: FontWeight.w700, ls: 10)),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
