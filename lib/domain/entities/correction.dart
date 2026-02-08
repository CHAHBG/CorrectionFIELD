/// A field correction made by an enquêteur on a parcel.
class Correction {
  const Correction({
    required this.id,
    required this.uuid,
    required this.parcelId,
    required this.numParcel,
    required this.surveyStatus,
    required this.createdAt,
    required this.updatedAt,
    this.enqueteur,
    this.notes,
    this.gpsLatitude,
    this.gpsLongitude,
    this.gpsAccuracy,
    this.geomJson,
    this.dirty = true,
  });

  final int id;
  final String uuid;
  final int parcelId;
  final String numParcel;
  final String? enqueteur;
  final String surveyStatus; // draft | submitted | synced
  final String? notes;
  final double? gpsLatitude;
  final double? gpsLongitude;
  final double? gpsAccuracy;
  final String? geomJson;
  final bool dirty;
  final String createdAt;
  final String updatedAt;

  bool get isSynced => !dirty;

  factory Correction.fromRow(Map<String, Object?> row) {
    return Correction(
      id: row['id'] as int,
      uuid: row['uuid'] as String,
      parcelId: row['parcel_id'] as int,
      numParcel: row['num_parcel'] as String,
      enqueteur: row['enqueteur'] as String?,
      surveyStatus: row['survey_status'] as String? ?? 'draft',
      notes: row['notes'] as String?,
      gpsLatitude: row['gps_latitude'] as double?,
      gpsLongitude: row['gps_longitude'] as double?,
      gpsAccuracy: row['gps_accuracy'] as double?,
      geomJson: row['geom_json'] as String?,
      dirty: (row['dirty'] as int? ?? 1) == 1,
      createdAt: row['created_at'] as String,
      updatedAt: row['updated_at'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'uuid': uuid,
      'parcel_id': parcelId,
      'num_parcel': numParcel,
      'enqueteur': enqueteur,
      'survey_status': surveyStatus,
      'notes': notes,
      'gps_latitude': gpsLatitude,
      'gps_longitude': gpsLongitude,
      'gps_accuracy': gpsAccuracy,
      'geom_json': geomJson,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }
}
