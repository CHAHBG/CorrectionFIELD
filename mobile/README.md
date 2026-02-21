# Mobile App: CorrectionFIELD (React Native)

An offline-first GIS application for land correction.

## Features
-   **Offline Map**: MapLibre GL Native.
-   **Data**: GeoPackage (SQLite) via `op-sqlite`.
-   **Architecture**: Clean Architecture (Data/Domain/Presentation).

## Setup
1.  `npm install`
2.  `npx react-native run-android`

## Backend
- Configure Supabase first using [docs/backend-setup.md](../docs/backend-setup.md).
- Update [src/infra/supabase.ts](src/infra/supabase.ts) with your project URL and anon key.

## Data
GeoPackages are located in `android/app/src/main/assets/data`.
