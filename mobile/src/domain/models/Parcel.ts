/**
 * @deprecated v2 uses the generic `AppFeature` type from `types/index.ts`.
 */
export interface Parcel {
    id: number;
    communeRef: string;
    numParcel: string;
    type: 'sans_enquete' | 'sans_numero';
    geometry: GeoJSON.Geometry;
    status: 'pending' | 'corrected' | 'validated' | 'synced';
}
