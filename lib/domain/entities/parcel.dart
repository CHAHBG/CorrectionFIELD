class Parcel {
  const Parcel({
    required this.id,
    required this.communeRef,
    required this.geomWkb,
    this.numParcel,
  });

  final int id;
  final String? numParcel;
  final String communeRef;
  final List<int> geomWkb;
}
