// =====================================================
//  FieldCorrect Mobile — Map Screen
// =====================================================

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Geolocation from 'react-native-geolocation-service';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useMapStore } from '@/stores/mapStore';
import { useLayerStore } from '@/stores/layerStore';
import { localDB } from '@/infra/db/LocalDB';
import { AppFeature, RootStackParamList, MapTool } from '@/types';
import { FAB, ToolbarBtn } from '@/shared/components';
import { colors, spacing, shadow } from '@/shared/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Initialize MapLibre
MapLibreGL.setAccessToken(null);

export default function MapScreen() {
  const nav = useNavigation<Nav>();
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const {
    viewport,
    activeTool,
    selectedFeatureIds,
    gpsEnabled,
    followGps,
    currentPosition,
    setActiveTool,
    selectFeatures,
    setGpsEnabled,
    setFollowGps,
    setCurrentPosition,
  } = useMapStore();

  const { layers } = useLayerStore();
  const [featuresByLayer, setFeaturesByLayer] = useState<Record<string, AppFeature[]>>({});

  /* ── Load features for visible layers ── */
  useEffect(() => {
    (async () => {
      const result: Record<string, AppFeature[]> = {};
      for (const layer of layers.filter((l) => l.visible)) {
        try {
          result[layer.id] = await localDB.getFeaturesByLayer(layer.id);
        } catch (e) {
          console.warn(`[MapScreen] features for ${layer.id}`, e);
        }
      }
      setFeaturesByLayer(result);
    })();
  }, [layers]);

  /* ── GPS ── */
  useEffect(() => {
    if (!gpsEnabled) {
      return;
    }

    let watchId: number;

    const startWatch = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission refusée', 'Accès à la localisation requis');
          setGpsEnabled(false);
          return;
        }
      }

      watchId = Geolocation.watchPosition(
        (pos) => {
          setCurrentPosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (followGps && cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: [pos.coords.longitude, pos.coords.latitude],
              animationDuration: 500,
            });
          }
        },
        (err) => console.warn('[GPS]', err),
        { enableHighAccuracy: true, distanceFilter: 5, interval: 3000 },
      );
    };

    startWatch();
    return () => {
      if (watchId !== undefined) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, [followGps, gpsEnabled, setCurrentPosition, setGpsEnabled]);

  /* ── Feature press ── */
  const handleFeaturePress = useCallback(
    (featureId: string, layerId: string) => {
      if (activeTool === 'select') {
        selectFeatures([featureId]);
      } else if (activeTool === 'correct') {
        nav.navigate('CorrectionForm', { featureId, layerId });
      } else {
        selectFeatures([featureId]);
      }
    },
    [activeTool, nav, selectFeatures],
  );

  /* ── Build GeoJSON sources per layer ── */
  const renderLayers = () => {
    return layers
      .filter((l) => l.visible)
      .map((layer) => {
        const features = featuresByLayer[layer.id] ?? [];
        if (features.length === 0) {
          return null;
        }

        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: features
            .filter((f) => f.geom)
            .map((f) => ({
              type: 'Feature' as const,
              id: f.id,
              geometry: f.geom!,
              properties: {
                ...f.props,
                _id: f.id,
                _status: f.status,
                _layerId: layer.id,
                _selected: selectedFeatureIds.includes(f.id) ? 1 : 0,
              },
            })),
        };

        const fillColor = layer.style?.fill_color ?? colors.primary;
        const lineColor = layer.style?.stroke_color ?? colors.primaryDark;
        const lineWidth = layer.style?.stroke_width ?? 2;
        const opacity = layer.style?.opacity ?? 0.6;

        return (
          <MapLibreGL.ShapeSource
            key={layer.id}
            id={`src-${layer.id}`}
            shape={geojson}
            onPress={(e: any) => {
              const feat = e?.features?.[0];
              if (feat?.properties?._id) {
                handleFeaturePress(feat.properties._id, layer.id);
              }
            }}
          >
            {/* Polygons */}
            <MapLibreGL.FillLayer
              id={`fill-${layer.id}`}
              style={{
                fillColor: fillColor,
                fillOpacity: opacity * 0.4,
              }}
              filter={['==', '$type', 'Polygon']}
            />
            <MapLibreGL.LineLayer
              id={`outline-${layer.id}`}
              style={{
                lineColor: lineColor,
                lineWidth: lineWidth,
              }}
              filter={['==', '$type', 'Polygon']}
            />

            {/* Lines */}
            <MapLibreGL.LineLayer
              id={`line-${layer.id}`}
              style={{
                lineColor: lineColor,
                lineWidth: lineWidth,
              }}
              filter={['==', '$type', 'LineString']}
            />

            {/* Points */}
            <MapLibreGL.CircleLayer
              id={`circle-${layer.id}`}
              style={{
                circleRadius: 6,
                circleColor: fillColor,
                circleStrokeWidth: 2,
                circleStrokeColor: lineColor,
              }}
              filter={['==', '$type', 'Point']}
            />

            {/* Selection highlight */}
            <MapLibreGL.LineLayer
              id={`sel-${layer.id}`}
              style={{
                lineColor: colors.selectionHighlight,
                lineWidth: 4,
              }}
              filter={['==', ['get', '_selected'], 1]}
            />
          </MapLibreGL.ShapeSource>
        );
      });
  };

  /* ── GPS marker ── */
  const renderGpsMarker = () => {
    if (!gpsEnabled || !currentPosition) {
      return null;
    }
    const point: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [currentPosition.longitude, currentPosition.latitude],
          },
          properties: {},
        },
      ],
    };
    return (
      <MapLibreGL.ShapeSource id="gps-point" shape={point}>
        <MapLibreGL.CircleLayer
          id="gps-circle-accuracy"
          style={{
            circleRadius: 30,
            circleColor: colors.gpsAccuracy,
            circleStrokeWidth: 0,
          }}
        />
        <MapLibreGL.CircleLayer
          id="gps-circle-dot"
          style={{
            circleRadius: 8,
            circleColor: colors.primary,
            circleStrokeWidth: 3,
            circleStrokeColor: colors.white,
          }}
        />
      </MapLibreGL.ShapeSource>
    );
  };

  /* ── Toolbar ── */
  const tools: { icon: string; tool: MapTool; label: string }[] = [
    { icon: 'cursor-default', tool: 'pan', label: 'Pan' },
    { icon: 'cursor-default-click', tool: 'select', label: 'Select' },
    { icon: 'pencil', tool: 'correct', label: 'Corriger' },
    { icon: 'information-outline', tool: 'info', label: 'Info' },
  ];

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        ref={mapRef}
        style={styles.map}
        mapStyle="https://demotiles.maplibre.org/style.json"
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [viewport.longitude, viewport.latitude],
            zoomLevel: viewport.zoom,
          }}
        />
        {renderLayers()}
        {renderGpsMarker()}
      </MapLibreGL.MapView>

      {/* ── Toolbar (top-right) ── */}
      <View style={styles.toolbar}>
        {tools.map((t) => (
          <ToolbarBtn
            key={t.tool}
            icon={t.icon}
            label={t.label}
            active={activeTool === t.tool}
            onPress={() => setActiveTool(t.tool)}
          />
        ))}
      </View>

      {/* ── GPS FAB ── */}
      <FAB
        icon={gpsEnabled ? 'crosshairs-gps' : 'crosshairs'}
        onPress={() => {
          if (!gpsEnabled) {
            setGpsEnabled(true);
            setFollowGps(true);
          } else if (!followGps) {
            setFollowGps(true);
          } else {
            setGpsEnabled(false);
            setFollowGps(false);
          }
        }}
        color={gpsEnabled ? colors.primary : colors.textSecondary}
        style={styles.gpsFab}
      />

      {/* ── New correction FAB ── */}
      {selectedFeatureIds.length === 1 && (
        <FAB
          icon="pencil-plus"
          onPress={() => {
            // Find which layer the selected feature belongs to
            for (const [layerId, feats] of Object.entries(featuresByLayer)) {
              const found = feats.find((f) => f.id === selectedFeatureIds[0]);
              if (found) {
                nav.navigate('CorrectionForm', {
                  featureId: found.id,
                  layerId,
                });
                break;
              }
            }
          }}
          color={colors.success}
          style={styles.correctionFab}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  toolbar: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.xs,
    ...shadow.md,
  },
  gpsFab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.md,
  },
  correctionFab: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.md,
  },
});
