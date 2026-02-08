import 'package:geolocator/geolocator.dart';

import '../data/repositories/parcels_repository.dart';
import '../domain/entities/parcel.dart';

class GeofencingService {
  GeofencingService(this.repository);

  final ParcelsRepository repository;

  Future<List<Parcel>> loadVisibleParcels() async {
    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );

    return repository.visibleParcelsForGps(
      latitude: position.latitude,
      longitude: position.longitude,
    );
  }
}
