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
  TouchableOpacity,
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Geolocation from 'react-native-geolocation-service';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import booleanIntersects from '@turf/boolean-intersects';
import { point as turfPoint, feature as turfFeature } from '@turf/helpers';

import { useMapStore } from '@/stores/mapStore';
import { useLayerStore } from '@/stores/layerStore';
import { useProjectStore } from '@/stores/projectStore';
import { localDB } from '@/infra/db/LocalDB';
import { AppFeature, RootStackParamList } from '@/types';
import { FAB } from '@/shared/components';
import { colors, spacing, shadow } from '@/shared/theme';
import { syncEngine } from '@/infra/sync/SyncEngine';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const OSM_STYLE: any = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export default function MapScreen() {
  const nav = useNavigation<Nav>();
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const {
    viewport,
    selectedFeatureIds,
    gpsEnabled,
    followGps,
    currentPosition,
    selectFeatures,
    setGpsEnabled,
    setFollowGps,
    setCurrentPosition,
  } = useMapStore();

  const { layers } = useLayerStore();
  const { currentProject } = useProjectStore();
  const [featuresByLayer, setFeaturesByLayer] = useState<Record<string, AppFeature[]>>({});
  const [zone, setZone] = useState<GeoJSON.Feature | null>(null);

  /* ── Load features & zone ── */
  useEffect(() => {
    (async () => {
      // 1. Load project zone first if possible
      let activeZone: any = null;
      if (currentProject) {
        try {
          const db = localDB.getDB();
          const q = await db.execute('SELECT value FROM app_meta WHERE key = ?', [`zone_${currentProject.id}`]);
          if (q.rows?.[0]?.value) {
            activeZone = JSON.parse(q.rows[0].value as string);
            setZone(activeZone);
          } else {
            setZone(null);
          }
        } catch (e) {
          console.warn('[MapScreen] zone load', e);
        }
      }

      // 2. Load features per layer
      const result: Record<string, AppFeature[]> = {};
      const zoneFeature = activeZone ? turfFeature(activeZone as any) : null;

      for (const layer of layers.filter((l) => l.visible)) {
        try {
          let features = await localDB.getFeaturesByLayer(layer.id);

          // Visibility Filter: Hide features outside assigned zone
          if (zoneFeature) {
            features = features.filter((f) => {
              if (!f.geom) { return false; }
              try {
                return booleanIntersects(turfFeature(f.geom), zoneFeature);
              } catch (e) {
                return true; // Fallback
              }
            });
          }

          result[layer.id] = features;
        } catch (e) {
          console.warn(`[MapScreen] features for ${layer.id}`, e);
        }
      }
      setFeaturesByLayer(result);
    })();
  }, [layers, currentProject]);

  /* ── Geofence monitor ── */
  const [wasInZone, setWasInZone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!zone || !currentPosition) {
      return;
    }

    const userPt = turfPoint([currentPosition.longitude, currentPosition.latitude]);
    const isUserIn = booleanPointInPolygon(userPt, zone as any);

    if (wasInZone === true && isUserIn === false) {
      Alert.alert('Attention', 'vous etes en dehors de la zone qui vius est assigné');
    }
    setWasInZone(isUserIn);
  }, [currentPosition, zone, wasInZone]);

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
    async (featureId: string, _layerId: string) => {
      selectFeatures([featureId]);
    },
    [selectFeatures],
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

        const baseFillColor = layer.style?.fill_color ?? colors.primary;
        const baseLineColor = layer.style?.stroke_color ?? colors.primaryDark;
        const lineWidth = layer.style?.stroke_width ?? 2;
        const opacity = layer.style?.opacity ?? 0.6;

        // Status coloring
        const pendingColor = '#22c55e'; // Green-500

        const fillColor: any = [
          'match',
          ['get', '_status'],
          'pending', pendingColor,
          baseFillColor,
        ];

        const lineColor: any = [
          'match',
          ['get', '_status'],
          'pending', '#15803d', // Green-700
          baseLineColor,
        ];

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

  /* ── Zone display ── */
  const renderZone = () => {
    if (!zone) { return null; }
    return (
      <MapLibreGL.ShapeSource id="zone-src" shape={zone}>
        <MapLibreGL.LineLayer
          id="zone-outline"
          style={{
            lineColor: '#EA580C', // Orange-600
            lineWidth: 3,
            lineDasharray: [2, 2],
          }}
        />
      </MapLibreGL.ShapeSource>
    );
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

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={OSM_STYLE}
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
        {renderZone()}
        {renderGpsMarker()}
      </MapLibreGL.MapView>

      {/* ── Refresh Button (top-right) ── */}
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={async () => {
          Alert.alert('Synchronisation', 'Lancement de la synchronisation manuelle...');
          await syncEngine.run();
          // Reload features
          const result: Record<string, AppFeature[]> = {};
          for (const layer of layers.filter((l) => l.visible)) {
            result[layer.id] = await localDB.getFeaturesByLayer(layer.id);
          }
          setFeaturesByLayer(result);
        }}
      >
        <Icon name="sync" size={24} color={colors.primary} />
      </TouchableOpacity>

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
          onPress={async () => {
            const featureId = selectedFeatureIds[0];
            let targetLayerId = '';
            let targetFeature: AppFeature | null = null;

            for (const [layerId, feats] of Object.entries(featuresByLayer)) {
              const found = feats.find((f) => f.id === featureId);
              if (found) {
                targetLayerId = layerId;
                targetFeature = found;
                break;
              }
            }

            if (!targetFeature) {
              return;
            }

            // Geofence check
            if (zone) {
              // 1. Check user position
              if (!currentPosition) {
                Alert.alert('Erreur', 'Localisation GPS requise pour corriger');
                return;
              }
              const userPt = turfPoint([currentPosition.longitude, currentPosition.latitude]);
              if (!booleanPointInPolygon(userPt, zone as any)) {
                Alert.alert('Accès refusé', 'vous etes en dehors de la zone qui vius est assigné');
                return;
              }

              // 2. Check feature position
              let checkPt: any = null;
              const geom = targetFeature.geom;
              if (geom?.type === 'Point') {
                checkPt = turfPoint(geom.coordinates);
              } else if (geom?.type === 'Polygon') {
                checkPt = turfPoint(geom.coordinates[0][0]);
              } else if (geom?.type === 'LineString') {
                checkPt = turfPoint(geom.coordinates[0]);
              }

              if (checkPt && !booleanPointInPolygon(checkPt, zone as any)) {
                Alert.alert('Accès refusé', 'Cette entité est en dehors de la zone qui vous est assignée');
                return;
              }
            }

            nav.navigate('CorrectionForm', {
              featureId,
              layerId: targetLayerId,
            });
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
  refreshBtn: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 50,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
