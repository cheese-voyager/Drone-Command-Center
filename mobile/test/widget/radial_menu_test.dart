import 'package:drone_command_center/core/theme/app_theme.dart';
import 'package:drone_command_center/features/dashboard/providers/dashboard_provider.dart';
import 'package:drone_command_center/features/map/widgets/dcc_map.dart';
import 'package:drone_command_center/features/shell/app_shell.dart';
import 'package:drone_command_center/shared/widgets/radial_menu.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../mocks/mock_drone_repository.dart';

Widget _wrap(Widget child) => MaterialApp(theme: AppTheme.dark(), home: Scaffold(body: child));

void main() {
  testWidgets('menu radial terbuka, menampilkan 10 fitur, dan memilih satu', (tester) async {
    String? picked;
    await tester.pumpWidget(_wrap(Stack(children: [
      Positioned.fill(child: RadialMenu(items: radialItems, activeId: 'dashboard', onSelect: (id) => picked = id)),
    ])));

    await tester.tap(find.byIcon(Icons.apps_rounded));
    await tester.pumpAndSettle();
    for (final item in radialItems) {
      expect(find.text(item.label), findsOneWidget, reason: item.label);
    }

    await tester.tap(find.byIcon(Icons.cloud_outlined));
    await tester.pumpAndSettle();
    expect(picked, 'weather');
  });

  testWidgets('menu tertutup lagi saat scrim disentuh', (tester) async {
    await tester.pumpWidget(_wrap(Stack(children: [
      Positioned.fill(child: RadialMenu(items: radialItems, activeId: 'dashboard', onSelect: (_) {})),
    ])));
    await tester.tap(find.byIcon(Icons.apps_rounded));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(20, 20));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.apps_rounded), findsOneWidget);
    expect(find.byIcon(Icons.close_rounded), findsNothing);
  });

  testWidgets('shell berpindah halaman dan bisa ganti tema', (tester) async {
    final mode = ValueNotifier(ThemeMode.dark);
    final provider = DashboardProvider(repository: FakeDroneRepository());
    await tester.pumpWidget(ValueListenableBuilder<ThemeMode>(
      valueListenable: mode,
      builder: (_, m, __) => MaterialApp(theme: AppTheme.light(), darkTheme: AppTheme.dark(), themeMode: m, home: AppShell(themeMode: mode, provider: provider)),
    ));
    expect(find.text('DRONE CC'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.apps_rounded));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.map_outlined));
    await tester.pumpAndSettle();
    expect(find.text('PETA TAKTIS'), findsOneWidget);
    expect(find.byType(DccMap), findsOneWidget);

    await tester.tap(find.byTooltip('Beralih ke tema terang'));
    await tester.pumpAndSettle();
    expect(mode.value, ThemeMode.light);

    await tester.pumpWidget(const SizedBox.shrink());
    provider.dispose();
    mode.dispose();
  });
}
