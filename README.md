# CorrectionFIELD

Monorepo for the PROCASEF CorrectionFIELD project.

## Structure
-   **`web/`**: React + Vite web application.
-   **`mobile/`**: React Native mobile application (Offline-first).
-   **`data/`**: Source GeoPackage files.

## Getting Started

### Web
```bash
cd web
npm install
npm run dev
```

### Backend (Supabase)

Follow [docs/backend-setup.md](docs/backend-setup.md) to create and connect the backend.

### Mobile
```bash
cd mobile
npm install
npx react-native run-android
```
