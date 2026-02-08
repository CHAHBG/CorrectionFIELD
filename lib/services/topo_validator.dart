class TopoValidator {
  const TopoValidator();

  Future<bool> isValidPolygon(List<int> wkb) async {
    // Placeholder for ST_IsValid or a JTS-based validation.
    return wkb.isNotEmpty;
  }
}
