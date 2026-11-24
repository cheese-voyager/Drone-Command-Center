import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:drone_command_center/app.dart';
import 'package:drone_command_center/features/dashboard/providers/dashboard_provider.dart';
import 'package:drone_command_center/features/map/widgets/dcc_map.dart';
import 'mocks/mock_drone_repository.dart';

void main() {
  testWidgets('app shell renders dashboard', (WidgetTester tester) async {
    final provider = DashboardProvider(repository: FakeDroneRepository());
    await tester.pumpWidget(DccApp(provider: provider));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('DRONE CC'), findsOneWidget);
    expect(find.textContaining('GROUND STATION'), findsOneWidget);
    expect(find.text('PETA LIVE'), findsOneWidget);
    expect(find.byType(DccMap), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    provider.dispose();
  });
}
