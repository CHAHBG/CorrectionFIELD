# PROCASEF Correction Field App

Prototype Flutter app for offline-first land parcel correction in PROCASEF communes.

## Features scaffolded
- High-contrast UI for field work.
- GPS accuracy badge.
- Offline database schema (SQLite) with parcel/correction tables.
- Geofencing flow (commune lookup + parcel filtering).
- Service stubs for delta sync and Kobo bridge.

## Next steps
- Wire MapLibre map widget and vector tile source.
- Add SpatiaLite extension loader for spatial queries.
- Implement sync APIs and Kobo deep links.
