// =====================================================
//  FieldCorrect Mobile — Zone Assignment Screen
//  v2: Admin draws polygons on map, assigns to enquêteurs
// =====================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { Spinner, StatusBadge } from '@/shared/components';
import { useProjectStore } from '@/stores/projectStore';
import { supabase } from '@/infra/supabase';
import type { MemberRole } from '@/types';
import type { Geometry, FeatureCollection } from 'geojson';

interface MemberWithZone {
  user_id: string;
  role: MemberRole;
  full_name: string;
  email: string;
  zone: Geometry | null;
  color: string;
}

const ZONE_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export default function ZoneAssignScreen() {
  const { currentProject } = useProjectStore();
  const [members, setMembers] = useState<MemberWithZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const mapRef = useRef<any>(null);

  const fetchMembers = useCallback(async () => {
    if (!currentProject) {return;}
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('user_id, role, zone, profiles(full_name, email)')
        .eq('project_id', currentProject.id);

      if (error) {throw error;}

      setMembers(
        (data ?? []).map((m: any, i: number) => ({
          user_id: m.user_id,
          role: m.role,
          full_name: m.profiles?.full_name ?? '',
          email: m.profiles?.email ?? '',
          zone: m.zone,
          color: ZONE_COLORS[i % ZONE_COLORS.length],
        })),
      );
    } catch (e) {
      console.error('[ZoneAssign] fetch error:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  useEffect(() => {
    setLoading(true);
    fetchMembers().finally(() => setLoading(false));
  }, [fetchMembers]);

  // Build GeoJSON for all zones
  const zonesGeoJSON: FeatureCollection = {
    type: 'FeatureCollection',
    features: members
      .filter((m) => m.zone)
      .map((m) => ({
        type: 'Feature' as const,
        properties: {
          user_id: m.user_id,
          name: m.full_name || m.email,
          color: m.color,
          selected: m.user_id === selectedMember,
        },
        geometry: m.zone as Geometry,
      })),
  };

  const clearZone = async (userId: string) => {
    if (!currentProject) {return;}
    Alert.alert(
      'Supprimer la zone',
      'Retirer la zone assignée à ce membre ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('project_members')
                .update({ zone: null })
                .eq('project_id', currentProject.id)
                .eq('user_id', userId);
              await fetchMembers();
            } catch (e: any) {
              Alert.alert('Erreur', e.message);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapLibreGL.MapView
          ref={mapRef}
          style={styles.map}
          mapStyle="https://demotiles.maplibre.org/style.json"
          logoEnabled={false}
        >
          <MapLibreGL.Camera
            defaultSettings={{ centerCoordinate: [-12.3, 12.8], zoomLevel: 8 }}
          />

          {/* Zone polygons */}
          <MapLibreGL.ShapeSource id="zones" shape={zonesGeoJSON}>
            <MapLibreGL.FillLayer
              id="zone-fill"
              style={{
                fillColor: ['get', 'color'],
                fillOpacity: ['case', ['get', 'selected'], 0.4, 0.2],
              }}
            />
            <MapLibreGL.LineLayer
              id="zone-border"
              style={{
                lineColor: ['get', 'color'],
                lineWidth: ['case', ['get', 'selected'], 3, 1.5],
              }}
            />
            <MapLibreGL.SymbolLayer
              id="zone-label"
              style={{
                textField: ['get', 'name'],
                textSize: 12,
                textColor: '#333',
                textHaloColor: '#fff',
                textHaloWidth: 1,
              }}
            />
          </MapLibreGL.ShapeSource>
        </MapLibreGL.MapView>

        {/* Instructions overlay */}
        <View style={styles.mapOverlay}>
          <Text style={styles.mapOverlayText}>
            {selectedMember
              ? '🗺 Zones actuelles affichées. Utilisez Supabase Studio ou QGIS pour dessiner des polygones de zone.'
              : 'Sélectionnez un membre ci-dessous pour voir/gérer sa zone'}
          </Text>
        </View>
      </View>

      {/* Members list */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Membres & Zones</Text>
        <FlatList
          data={members}
          keyExtractor={(m) => m.user_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.memberRow,
                selectedMember === item.user_id && { borderColor: item.color, borderWidth: 2 },
              ]}
              onPress={() =>
                setSelectedMember((prev) => (prev === item.user_id ? null : item.user_id))
              }
            >
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.full_name || item.email}</Text>
                <Text style={styles.memberRole}>{item.role}</Text>
              </View>
              {item.zone ? (
                <TouchableOpacity onPress={() => clearZone(item.user_id)}>
                  <StatusBadge label="Zone ✓" color={colors.success} />
                </TouchableOpacity>
              ) : (
                <StatusBadge label="Pas de zone" color={colors.textMuted} />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucun membre dans ce projet</Text>
          }
        />

        <View style={styles.infoBox}>
          <Icon name="information-outline" size={16} color={colors.info} />
          <Text style={styles.infoText}>
            Pour dessiner une zone : utilisez QGIS (connexion PostGIS) ou Supabase Studio pour
            insérer un polygone dans la colonne 'zone' de project_members.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  mapOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  mapOverlayText: { ...typography.caption, color: colors.textSecondary },
  listContainer: {
    height: 260,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  listTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.sm,
    marginHorizontal: spacing.xs,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.sm },
  memberInfo: { flex: 1 },
  memberName: { ...typography.body, fontWeight: '600' },
  memberRole: { ...typography.caption, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.info + '10',
    borderTopWidth: 1,
    borderTopColor: colors.info + '20',
  },
  infoText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
});
