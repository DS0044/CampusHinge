import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:campushinge_mobile/widgets/glass_card.dart';
import 'package:campushinge_mobile/widgets/gradient_button.dart';
import 'package:campushinge_mobile/config/app_theme.dart';

void main() {
  testWidgets('GlassCard and GradientButton render properly', (WidgetTester tester) async {
    bool buttonPressed = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.darkTheme,
        home: Scaffold(
          body: GlassCard(
            child: GradientButton(
              text: 'Connect on Campus',
              onPressed: () {
                buttonPressed = true;
              },
            ),
          ),
        ),
      ),
    );

    expect(find.text('Connect on Campus'), findsOneWidget);
    expect(find.byType(GlassCard), findsOneWidget);

    await tester.tap(find.text('Connect on Campus'));
    await tester.pump();

    expect(buttonPressed, true);
  });
}
