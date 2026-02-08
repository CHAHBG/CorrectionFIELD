import 'package:flutter/material.dart';

import 'theme.dart';
import '../presentation/screens/map_screen.dart';
import '../presentation/screens/import_screen.dart';

/// Root widget for the PROCASEF CorrectionFIELD application.
class ProcasefApp extends StatelessWidget {
  const ProcasefApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CorrectionFIELD - PROCASEF',
      theme: AppTheme.lightTheme,
      debugShowCheckedModeBanner: false,
      initialRoute: '/',
      routes: {
        '/': (_) => const MapScreen(),
        '/import': (_) => const ImportScreen(),
      },
    );
  }
}

