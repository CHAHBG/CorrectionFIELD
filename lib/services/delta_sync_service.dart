class DeltaSyncService {
  const DeltaSyncService();

  Future<void> pushDeltas() async {
    // TODO: select dirty rows and send to server
  }

  Future<void> pullDeltas() async {
    // TODO: request changes since last_sync_at and upsert
  }
}
