/// A commune (administrative boundary) from the PROCASEF 17-commune dataset.
class Commune {
  const Commune({
    required this.id,
    required this.communeRef,
    required this.name,
    required this.geomJson,
    required this.bbox,
    this.region,
    this.departement,
    this.arrondissement,
    this.superficieHa,
  });

  final int id;
  final String communeRef; // COD_ENTITE (ex: 05320101)
  final String name; // CCRCA (ex: BALA)
  final String? region;
  final String? departement;
  final String? arrondissement;
  final double? superficieHa;
  final String geomJson; // GeoJSON MultiPolygon string (WGS84)
  final List<double> bbox; // [minX, minY, maxX, maxY]

  factory Commune.fromRow(Map<String, Object?> row) {
    return Commune(
      id: row['id'] as int,
      communeRef: row['commune_ref'] as String,
      name: row['name'] as String,
      region: row['region'] as String?,
      departement: row['departement'] as String?,
      arrondissement: row['arrondissement'] as String?,
      superficieHa: row['superficie_ha'] as double?,
      geomJson: row['geom_json'] as String,
      bbox: [
        row['min_x'] as double,
        row['min_y'] as double,
        row['max_x'] as double,
        row['max_y'] as double,
      ],
    );
  }
}
