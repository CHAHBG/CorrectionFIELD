import 'package:sqflite/sqflite.dart';

class ParcelsDao {
  ParcelsDao(this.db);

  final Database db;

  Future<String?> findCommuneForPoint({
    required double latitude,
    required double longitude,
  }) async {
    final result = await db.rawQuery(
      '''
      SELECT commune_ref
      FROM communes
      WHERE ST_Contains(geom, MakePoint(?, ?, 4326))
      LIMIT 1
      ''',
      [longitude, latitude],
    );

    if (result.isEmpty) {
      return null;
    }

    return result.first['commune_ref'] as String?;
  }

  Future<List<Map<String, Object?>>> findParcelsByCommune(String communeRef) async {
    return db.rawQuery(
      '''
      SELECT id, num_parcel, commune_ref, geom
      FROM parcels
      WHERE commune_ref = ?
        AND is_deleted = 0
      ''',
      [communeRef],
    );
  }
}
