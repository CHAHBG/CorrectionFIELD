import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:correction_field/app/app.dart';

void main() {
  testWidgets(
    'App builds (smoke test)',
    (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: ProcasefApp(),
        ),
      );
    },
    skip: true,
  );
}
