import '../../domain/entities/parcel.dart';
import '../local/dao/parcels_dao.dart';

class ParcelsRepository {
  ParcelsRepository(this.dao);

  final ParcelsDao dao;

  Future<List<Parcel>> visibleParcelsForGps({
    required double latitude,
    required double longitude,
  }) async {
    final communeRef = await dao.findCommuneForPoint(
      latitude: latitude,
      longitude: longitude,
    );

    if (communeRef == null) {
      return [];
    }

    final rows = await dao.findParcelsByCommune(communeRef);
    return rows
        .map(
          (row) => Parcel(
            id: row['id'] as int,
            numParcel: row['num_parcel'] as String?,
            communeRef: row['commune_ref'] as String,
            geomWkb: row['geom'] as List<int>,
          ),
        )
        .toList();
  }
}
