// =====================================================
//  FieldCorrect — LayerRenderer (renders a single layer on the map)
// =====================================================

import { useMemo } from 'react';
import { Source, Layer as MapLayer } from 'react-map-gl/maplibre';
import { useFeatures, featuresToGeoJSON } from '@/modules/map/hooks/useFeatures';
import { compileStyle } from '@/shared/utils/styleCompiler';
import type { Layer } from '@/shared/types';

interface LayerRendererProps {
  layer: Layer;
}

export function LayerRenderer({ layer }: LayerRendererProps) {
  const { data: features } = useFeatures(layer.id);
  const geojson = useMemo(() => {
    const fc = featuresToGeoJSON(features);
    console.log(`[LayerRenderer] ${layer.name} (${layer.id}): ${fc.features.length} features, geometryType=${layer.geometryType}, visible=${layer.visible}`);
    return fc;
  }, [features, layer.id, layer.name, layer.geometryType, layer.visible]);

  const paintProps = useMemo(() => {
    // If layer has status field but is simple, wrap it with status style
    if (layer.style.mode === 'simple') {
      const statusStyle = compileStyle({
        ...layer.style,
        mode: 'rule-based',
        ruleBased: {
          field: 'status',
          defaultStyle: layer.style.simple!,
          rules: [
            { value: 'pending', label: 'En attente', style: { fillColor: '#4CAF50', strokeColor: '#1B5E20' } },
            { value: 'corrected', label: 'Corrigée', style: { fillColor: '#4CAF50', strokeColor: '#1B5E20' } },
            { value: 'validated', label: 'Validée', style: { fillColor: '#2E7D32', strokeColor: '#1B5E20' } },
            { value: 'rejected', label: 'Rejetée', style: { fillColor: '#F44336', strokeColor: '#B71C1C' } },
          ]
        }
      });
      return statusStyle;
    }
    return compileStyle(layer.style);
  }, [layer.style]);

  const visibility = layer.visible ? 'visible' : 'none';

  // Determine which sub-layers to render based on geometry type.
  // We render both fill+stroke for polygon-like types, and circle for point-like types.
  const isPolygonLike = ['Polygon', 'MultiPolygon'].includes(layer.geometryType);
  const isLineLike = ['LineString', 'MultiLineString'].includes(layer.geometryType);
  const isPointLike = ['Point', 'MultiPoint'].includes(layer.geometryType);

  return (
    <Source
      id={layer.id}
      type="geojson"
      data={geojson}
      generateId={true}
      cluster={layer.cluster ?? false}
      clusterMaxZoom={14}
      clusterRadius={50}
    >
      {/* Fill for polygons — always render, let MapLibre filter by $type */}
      {(isPolygonLike || (!isLineLike && !isPointLike)) && (
        <MapLayer
          id={`${layer.id}-fill`}
          type="fill"
          paint={paintProps.fill as Record<string, unknown>}
          layout={{ visibility }}
          filter={['any', ['==', '$type', 'Polygon']]}
        />
      )}

      {/* Stroke for lines and polygon outlines */}
      {!isPointLike && (
        <MapLayer
          id={`${layer.id}-stroke`}
          type="line"
          paint={paintProps.stroke as Record<string, unknown>}
          layout={{ visibility }}
        />
      )}

      {/* Circle for points */}
      {isPointLike && (
        <MapLayer
          id={`${layer.id}-circle`}
          type="circle"
          paint={paintProps.circle as Record<string, unknown>}
          layout={{ visibility }}
        />
      )}

      {/* Labels (if enabled) */}
      {layer.style.labels?.enabled && (
        <MapLayer
          id={`${layer.id}-labels`}
          type="symbol"
          layout={{
            visibility,
            'text-field': ['get', layer.style.labels.field],
            'text-size': layer.style.labels.fontSize ?? 12,
            'text-anchor': 'center',
            'text-allow-overlap': false,
          }}
          paint={{
            'text-color': layer.style.labels.fontColor ?? '#333',
            'text-halo-color': layer.style.labels.halo ? '#fff' : 'transparent',
            'text-halo-width': layer.style.labels.halo ? 2 : 0,
          }}
          minzoom={layer.style.labels.minZoom ?? 0}
        />
      )}
    </Source>
  );
}

/**
 * Returns the interactive layer IDs for a set of layers.
 */
export function getInteractiveLayerIds(layers: Layer[]): string[] {
  const ids: string[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    const geomType = layer.geometryType;
    if (geomType === 'Point' || geomType === 'MultiPoint') {
      ids.push(`${layer.id}-circle`);
    } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      ids.push(`${layer.id}-fill`);
    } else {
      ids.push(`${layer.id}-stroke`);
    }
  }
  return ids;
}
