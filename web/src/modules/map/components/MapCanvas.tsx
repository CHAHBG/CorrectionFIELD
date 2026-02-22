// =====================================================
//  FieldCorrect — MapCanvas (main map container)
// =====================================================

import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import Map, {
  NavigationControl,
  ScaleControl,
  GeolocateControl,
  type MapRef,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useMapStore } from '@/stores/mapStore';
import { useLayerStore } from '@/stores/layerStore';
import { LayerRenderer, getInteractiveLayerIds } from './LayerRenderer';
import { Toolbar } from './Toolbar';
import { SearchBar } from './SearchBar';
import { MeasureOverlay } from './MeasureOverlay';
import { DrawingOverlay } from './DrawingOverlay';
import { GeofenceOverlay } from './GeofenceOverlay';
import { useMapEvents } from '@/modules/map/hooks/useMapEvents';

// Free tile source — OpenStreetMap raster tiles as fallback
const DEFAULT_MAP_STYLE = {
  version: 8 as const,
  name: 'FieldCorrect Base',
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster' as const,
      source: 'osm',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export function MapCanvas() {
  const mapRef = useRef<MapRef>(null);
  const viewport = useMapStore((s) => s.viewport);
  const viewportUpdateId = useMapStore((s) => s.viewportUpdateId);
  const setViewport = useMapStore((s) => s.setViewport);
  const layers = useLayerStore((s) => s.layers);

  const activeTool = useMapStore((s) => s.activeTool);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Cursor changes based on active tool
  const cursor = useMemo(() => {
    if (activeTool === 'draw_point' || activeTool === 'draw_line' || activeTool === 'draw_polygon') return 'crosshair';
    if (activeTool === 'measure_distance' || activeTool === 'measure_area') return 'crosshair';
    if (activeTool === 'pan') return 'grab';
    if (activeTool === 'edit') return 'default';
    return '';
  }, [activeTool]);

  const interactiveLayerIds = useMemo(
    () => getInteractiveLayerIds(layers),
    [layers]
  );

  const { handleClick, handleDblClick, handleHover } = useMapEvents(mapRef, interactiveLayerIds);

  const onMove = useCallback(
    (evt: ViewStateChangeEvent) => {
      setViewport({
        latitude: evt.viewState.latitude,
        longitude: evt.viewState.longitude,
        zoom: evt.viewState.zoom,
        bearing: evt.viewState.bearing,
        pitch: evt.viewState.pitch,
        padding: evt.viewState.padding ? {
          top: evt.viewState.padding.top ?? 0,
          bottom: evt.viewState.padding.bottom ?? 0,
          left: evt.viewState.padding.left ?? 0,
          right: evt.viewState.padding.right ?? 0,
        } : { top: 0, bottom: 0, left: 0, right: 0 },
      });
    },
    [setViewport]
  );

  // Handle programmatic jumps (e.g. Zoom to Layer)
  useEffect(() => {
    if (viewportUpdateId > 0 && mapRef.current) {
      mapRef.current.flyTo({
        center: [viewport.longitude, viewport.latitude],
        zoom: viewport.zoom,
        duration: 2000,
        padding: viewport.padding,
      });
    }
  }, [viewportUpdateId, viewport.latitude, viewport.longitude, viewport.padding, viewport.zoom]);

  const handleSearchResult = useCallback(
    (result: { lngLat?: [number, number] }) => {
      if (result.lngLat && mapRef.current) {
        mapRef.current.flyTo({
          center: result.lngLat,
          zoom: 15,
          duration: 1500,
        });
      }
    },
    []
  );

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={viewport}
        mapStyle={DEFAULT_MAP_STYLE}
        onMove={onMove}
        onClick={handleClick}
        onDblClick={handleDblClick}
        onMouseMove={(e) => {
          handleHover(e);
          setCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        }}
        interactiveLayerIds={interactiveLayerIds}
        attributionControl={false}
        cursor={cursor}
        reuseMaps
      >
        {/* Dynamic layers from store */}
        {layers.map((layer) => (
          <LayerRenderer key={layer.id} layer={layer} />
        ))}

        {/* Measure overlay */}
        <MeasureOverlay />

        {/* Drawing overlay */}
        <DrawingOverlay />

        {/* Geofence zone overlay */}
        <GeofenceOverlay />

        {/* Map controls */}
        <NavigationControl position="top-right" showCompass showZoom />
        <ScaleControl position="bottom-right" maxWidth={100} unit="metric" />
        <GeolocateControl
          position="top-right"
          trackUserLocation
          showAccuracyCircle
        />
      </Map>

      {/* UI overlays */}
      <Toolbar />
      <SearchBar onSelectResult={handleSearchResult} />

      {/* Coordinate display */}
      <div className="absolute bottom-2 left-2 z-10 rounded bg-white/90 px-2 py-1 text-xs font-mono text-gray-700 shadow-sm border border-gray-200">
        {coords
          ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)} · WGS84`
          : 'Survolez la carte'}
      </div>
    </div>
  );
}
