/// Type of orphan parcel in the PROCASEF system.
enum ParcelType {
  sansEnquete, // Has a parcel number but no survey was conducted
  sansNumero, // No parcel number assigned
}

/// Status of a parcel in the correction workflow.
enum ParcelStatus {
  pending, // Needs correction
  corrected, // Field correction done, not yet synced
  validated, // Validated by supervisor
  synced, // Pushed to central server
}

/// A land parcel from the PROCASEF GeoPackage data.
///
/// Geometries are stored as GeoJSON strings (WGS84) for direct
/// consumption by MapLibre and efficient SQLite text storage.
class Parcel {
  const Parcel({
    required this.id,
    required this.communeRef,
    required this.geomJson,
    required this.parcelType,
    required this.status,
    required this.updatedAt,
    required this.bbox,
    this.numParcel,
    this.sourceFile,
    this.layer,
    this.isDeleted = false,
  });

  final int id;
  final String? numParcel;
  final String communeRef;
  final ParcelType parcelType;
  final String? sourceFile;
  final String? layer;
  final String geomJson; // GeoJSON geometry string
  final List<double> bbox; // [minX, minY, maxX, maxY]
  final ParcelStatus status;
  final String updatedAt;
  final bool isDeleted;

  /// Whether this parcel still needs a correction.
  bool get needsCorrection => status == ParcelStatus.pending;

  /// Whether this parcel has no assigned number.
  bool get isSansNumero =>
      parcelType == ParcelType.sansNumero ||
      numParcel == null ||
      numParcel == '0';

  /// Create from a database row map.
  factory Parcel.fromRow(Map<String, Object?> row) {
    return Parcel(
      id: row['id'] as int,
      numParcel: row['num_parcel'] as String?,
      communeRef: row['commune_ref'] as String,
      parcelType: (row['parcel_type'] as String) == 'sans_numero'
          ? ParcelType.sansNumero
          : ParcelType.sansEnquete,
      sourceFile: row['source_file'] as String?,
      layer: row['layer'] as String?,
      geomJson: row['geom_json'] as String,
      bbox: [
        row['min_x'] as double,
        row['min_y'] as double,
        row['max_x'] as double,
        row['max_y'] as double,
      ],
      status: ParcelStatus.values.firstWhere(
        (s) => s.name == (row['status'] as String? ?? 'pending'),
        orElse: () => ParcelStatus.pending,
      ),
      updatedAt: row['updated_at'] as String,
      isDeleted: (row['is_deleted'] as int? ?? 0) == 1,
    );
  }
}

