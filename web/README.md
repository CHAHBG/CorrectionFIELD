# CorrectionFIELD Web

A React PWA for offline-first land parcel correction, ported from the original Flutter application.

## Tech Stack
-   **React 19** + **Vite**
-   **TypeScript**
-   **Tailwind CSS v4**
-   **MapLibre GL JS** (Maps)
-   **IndexedDB** (`idb`) (Offline Storage)
-   **React Router**

## Getting Started

### Prerequisites
-   Node.js (v18+)

### Installation
```bash
cd web
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

## Features
-   **Offline Map**: Renders parcels from local IndexedDB.
-   **Correction Form**: Edit parcel details and status locally.
-   **Data Seeding**: "Load Demo Data" button for testing.
