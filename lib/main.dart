import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/di/providers.dart';
import 'data/local/db/app_database.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Force portrait mode (field device)
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // High brightness status bar for outdoor use
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));

  // Initialize the local database
  final appDb = await AppDatabase.open();

  runApp(
    ProviderScope(
      overrides: [
        // Provide the initialized database to the entire widget tree
        appDatabaseProvider.overrideWithValue(appDb),
      ],
      child: const ProcasefApp(),
    ),
  );
}

