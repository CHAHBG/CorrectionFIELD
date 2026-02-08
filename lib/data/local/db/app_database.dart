import 'dart:async';

import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

class AppDatabase {
  AppDatabase._(this.db);

  final Database db;

  static Future<AppDatabase> open() async {
    final dir = await getApplicationDocumentsDirectory();
    final path = p.join(dir.path, 'procasef.db');
    final db = await openDatabase(
      path,
      version: 1,
      onCreate: (database, version) async {
        await _initializeSchema(database);
      },
    );

    return AppDatabase._(db);
  }

  static Future<void> _initializeSchema(Database database) async {
    final schema = await _loadSchemaAsset();
    final statements = schema.split(';').map((s) => s.trim()).where((s) => s.isNotEmpty);
    for (final statement in statements) {
      await database.execute(statement);
    }
  }

  static Future<String> _loadSchemaAsset() async {
    return await rootBundle.loadString('assets/schema.sql');
  }
}
