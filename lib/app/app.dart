import 'package:flutter/material.dart';

import '../presentation/screens/map_screen.dart';

class ProcasefApp extends StatelessWidget {
  const ProcasefApp({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = ThemeData(
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF0C2C52),
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: Colors.white,
      textTheme: const TextTheme(
        titleLarge: TextStyle(fontWeight: FontWeight.w700),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF0C2C52),
        foregroundColor: Colors.white,
      ),
    );

    return MaterialApp(
      title: 'PROCASEF Correction',
      theme: theme,
      home: const MapScreen(),
    );
  }
}
