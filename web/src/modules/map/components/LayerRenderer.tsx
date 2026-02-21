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
  const geojson = useMemo(() => featuresToGeoJSON(features), [features]);

  const paintProps = useMemo(
    () => compileStyle(layer.style),
    [layer.style]
  );

  const visibility = layer.visible ? 'visible' : 'none';

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
      {/* Fill for polygons */}
      {(layer.geometryType === 'Polygon' || layer.geometryType === 'MultiPolygon') && (
        <MapLayer
          id={`${layer.id}-fill`}
          type="fill"
          paint={paintProps.fill as Record<string, unknown>}
          layout={{ visibility }}
          filter={['any',
            ['==', '$type', 'Polygon'],
            ['==', '$type', 'MultiPolygon'],
          ]}
        />
      )}

      {/* Stroke for lines and polygon outlines */}
      {(layer.geometryType !== 'Point' && layer.geometryType !== 'MultiPoint') && (
        <MapLayer
          id={`${layer.id}-stroke`}
          type="line"
          paint={paintProps.stroke as Record<string, unknown>}
          layout={{ visibility }}
        />
      )}

      {/* Circle for points */}
      {(layer.geometryType === 'Point' || layer.geometryType === 'MultiPoint') && (
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
