import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../app/di/providers.dart';
import '../../data/repositories/corrections_repository.dart';
import '../../services/topo_validator.dart';
import '../entities/correction.dart';

/// Use case: Save a field correction with validation.
///
/// Validates:
///   1. Num_parcel uniqueness (no duplicates)
///   2. Topology (no self-intersections) if geometry is provided
///   3. Required fields
class SaveCorrection {
  SaveCorrection({
    required this.correctionsRepo,
    required this.topoValidator,
  });

  final CorrectionsRepository correctionsRepo;
  final TopoValidator topoValidator;

  /// Save a new correction. Returns the correction id or throws.
  Future<int> execute({
    required int parcelId,
    required String numParcel,
    String? enqueteur,
    String? notes,
    double? gpsLatitude,
    double? gpsLongitude,
    double? gpsAccuracy,
    String? geomJson,
  }) async {
    // 1) Validate uniqueness of num_parcel
    final isTaken = await correctionsRepo.isNumParcelTaken(numParcel);
    if (isTaken) {
      throw ValidationException(
        'Le numéro de parcelle "$numParcel" est déjà utilisé.',
      );
    }

    // 2) Validate topology if geometry is provided
    if (geomJson != null && geomJson.isNotEmpty) {
      final result = topoValidator.validateGeoJson(geomJson);
      if (!result.isValid) {
        throw ValidationException(
          'Géométrie invalide:\n${result.errorSummary}',
        );
      }
    }

    // 3) Save the correction
    final uuid = const Uuid().v4();
    return correctionsRepo.saveCorrection(
      uuid: uuid,
      parcelId: parcelId,
      numParcel: numParcel,
      enqueteur: enqueteur,
      notes: notes,
      gpsLatitude: gpsLatitude,
      gpsLongitude: gpsLongitude,
      gpsAccuracy: gpsAccuracy,
      geomJson: geomJson,
    );
  }
}

class ValidationException implements Exception {
  const ValidationException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Provider for the use case.
final saveCorrectionProvider = Provider<SaveCorrection>((ref) {
  return SaveCorrection(
    correctionsRepo: ref.watch(correctionsRepositoryProvider),
    topoValidator: ref.watch(topoValidatorProvider),
  );
});
