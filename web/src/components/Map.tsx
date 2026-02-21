import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type ParcelGeometry = GeoJSON.Geometry;

interface ParcelShape {
    id?: string | number;
    geometry: ParcelGeometry;
    properties?: Record<string, unknown>;
    status?: string;
    numParcel?: string;
}

interface MapProps {
    initialCenter?: [number, number];
    initialZoom?: number;
    parcels?: ParcelShape[];
    onParcelClick?: (feature: maplibregl.MapGeoJSONFeature) => void;
}

export default function Map({
    initialCenter = [-13.01, 14.03],
    initialZoom = 15,
    parcels = [],
    onParcelClick
}: MapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (map.current) return;
        if (!mapContainer.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: 'https://demotiles.maplibre.org/style.json',
            center: initialCenter,
            zoom: initialZoom,
            attributionControl: false,
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.current.addControl(new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true
        }), 'top-right');
        map.current.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        map.current.on('load', () => {
            setLoaded(true);
        });

    }, [initialCenter, initialZoom]);

    // Handle Parcel Layers
    useEffect(() => {
        if (!map.current || !loaded) return;
        const mapInstance = map.current;

        const sourceId = 'parcels-source';
        const layerId = 'parcels-layer';
        const outlineLayerId = 'parcels-outline-layer';

        if (!mapInstance.getSource(sourceId)) {
            mapInstance.addSource(sourceId, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            // Fill layer
            mapInstance.addLayer({
                id: layerId,
                type: 'fill',
                source: sourceId,
                paint: {
                    'fill-color': [
                        'match',
                        ['get', 'status'],
                        'pending', '#fbbf24', // amber-400
                        'corrected', '#3b82f6', // blue-500
                        'validated', '#22c55e', // green-500
                        '#9ca3af' // gray-400 default
                    ],
                    'fill-opacity': 0.5
                }
            });

            // Outline layer
            mapInstance.addLayer({
                id: outlineLayerId,
                type: 'line',
                source: sourceId,
                paint: {
                    'line-color': '#000',
                    'line-width': 1
                }
            });

            // Click handler
            mapInstance.on('click', layerId, (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0] as maplibregl.MapGeoJSONFeature;
                    if (onParcelClick) onParcelClick(feature);
                }
            });

            // Change cursor
            mapInstance.on('mouseenter', layerId, () => {
                mapInstance.getCanvas().style.cursor = 'pointer';
            });
            mapInstance.on('mouseleave', layerId, () => {
                mapInstance.getCanvas().style.cursor = '';
            });
        }

        // Update data
        const source = mapInstance.getSource(sourceId) as maplibregl.GeoJSONSource;
        if (source && parcels) {
            const featureCollection = {
                type: 'FeatureCollection',
                features: parcels.map(p => ({
                    type: 'Feature',
                    id: p.id,
                    geometry: p.geometry,
                    properties: {
                        ...p.properties,
                        id: p.id,
                        status: p.status,
                        numParcel: p.numParcel
                    }
                }))
            };
            source.setData(featureCollection as GeoJSON.FeatureCollection);
        }

    }, [loaded, parcels, onParcelClick]);

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainer} className="absolute inset-0" />
            {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10 opacity-75">
                    <span className="text-xl font-semibold text-gray-700">Loading Map...</span>
                </div>
            )}
        </div>
    );
}
