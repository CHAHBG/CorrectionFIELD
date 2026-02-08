import 'dart:async';

import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';
import 'package:logger/logger.dart';

final _log = Logger(printer: PrettyPrinter(methodCount: 0));

/// Central database wrapper for the PROCASEF local SQLite database.
///
/// Manages schema creation, R-Tree spatial index maintenance, and
/// provides the raw [Database] handle to DAOs.
class AppDatabase {
  AppDatabase._(this.db);

  final Database db;

  /// Open (or create) the local database.
  static Future<AppDatabase> open() async {
    final dir = await getApplicationDocumentsDirectory();
    final path = p.join(dir.path, 'procasef_correction.db');

    _log.i('Opening database at $path');

    final database = await openDatabase(
      path,
      version: 2,
      onCreate: (db, version) async {
        _log.i('Creating database schema v$version');
        await _initializeSchema(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        _log.i('Upgrading database from v$oldVersion to v$newVersion');
        // Drop and recreate for dev iterations
        await db.execute('DROP TABLE IF EXISTS sync_log');
        await db.execute('DROP TABLE IF EXISTS corrections');
        await db.execute('DROP TABLE IF EXISTS rtree_parcels');
        await db.execute('DROP TABLE IF EXISTS parcels');
        await db.execute('DROP TABLE IF EXISTS rtree_communes');
        await db.execute('DROP TABLE IF EXISTS communes');
        await db.execute('DROP TABLE IF EXISTS app_meta');
        await _initializeSchema(db);
      },
    );

    return AppDatabase._(database);
  }

  /// Re-create the database from scratch. Useful for dev / testing.
  static Future<AppDatabase> reset() async {
    final dir = await getApplicationDocumentsDirectory();
    final path = p.join(dir.path, 'procasef_correction.db');
    await deleteDatabase(path);
    return open();
  }

  // ── Schema initialization ──────────────────────────────────

  static Future<void> _initializeSchema(Database db) async {
    final schema = await rootBundle.loadString('assets/schema.sql');

    // Split by semicolons but handle the R-Tree VIRTUAL TABLE statements
    final statements =
        schema.split(';').map((s) => s.trim()).where((s) => s.isNotEmpty);

    for (final statement in statements) {
      try {
        await db.execute(statement);
      } catch (e) {
        _log.w('Schema statement skipped: $e\n→ $statement');
      }
    }

    // Insert default metadata
    await db.insert('app_meta', {'key': 'last_sync_at', 'value': ''});
    await db.insert('app_meta', {'key': 'import_version', 'value': '0'});

    _log.i('Schema initialized successfully');
  }

  // ── R-Tree maintenance helpers ─────────────────────────────

  /// Insert a commune's bounding box into the R-Tree index.
  Future<void> insertCommuneRTree({
    required int id,
    required double minX,
    required double maxX,
    required double minY,
    required double maxY,
  }) async {
    await db.insert('rtree_communes', {
      'id': id,
      'min_x': minX,
      'max_x': maxX,
      'min_y': minY,
      'max_y': maxY,
    });
  }

  /// Insert a parcel's bounding box into the R-Tree index.
  Future<void> insertParcelRTree({
    required int id,
    required double minX,
    required double maxX,
    required double minY,
    required double maxY,
  }) async {
    await db.insert('rtree_parcels', {
      'id': id,
      'min_x': minX,
      'max_x': maxX,
      'min_y': minY,
      'max_y': maxY,
    });
  }

  // ── Metadata helpers ───────────────────────────────────────

  Future<String?> getMeta(String key) async {
    final rows = await db.query(
      'app_meta',
      where: 'key = ?',
      whereArgs: [key],
    );
    if (rows.isEmpty) return null;
    return rows.first['value'] as String?;
  }

  Future<void> setMeta(String key, String value) async {
    await db.insert(
      'app_meta',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Close the database connection.
  Future<void> close() async {
    await db.close();
  }
}

