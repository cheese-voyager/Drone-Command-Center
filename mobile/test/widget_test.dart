import 'package:flutter_test/flutter_test.dart';

import 'package:drone_command_center/app.dart';

void main() {
  testWidgets('app shell renders dashboard', (WidgetTester tester) async {
    await tester.pumpWidget(const DccApp());
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('DRONE CC'), findsOneWidget);
    expect(find.text('GROUND STATION · OFFLINE'), findsOneWidget);
    expect(find.text('PETA LIVE'), findsOneWidget);
  });
}
