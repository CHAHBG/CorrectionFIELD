// =====================================================
//  FieldCorrect Mobile — Layers Screen
// =====================================================

import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Switch,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useLayerStore } from '@/stores/layerStore';
import { Layer, RootStackParamList } from '@/types';
import { Card, EmptyState, Spinner } from '@/shared/components';
import { colors, spacing, typography } from '@/shared/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LayersScreen() {
  const nav = useNavigation<Nav>();
  const { layers, loading, loadLayers, toggleVisibility } = useLayerStore();

  useEffect(() => {
    loadLayers();
  }, [loadLayers]);

  if (loading && layers.length === 0) {
    return <Spinner />;
  }

  const geomIcon = (type: string) => {
    switch (type) {
      case 'Point': return 'map-marker';
      case 'LineString': return 'vector-polyline';
      case 'Polygon': return 'vector-polygon';
      default: return 'shape';
    }
  };

  const renderItem = ({ item }: { item: Layer }) => (
    <Card style={styles.layerCard}>
      <View style={styles.row}>
        <View style={[styles.colorDot, { backgroundColor: item.style?.fill_color ?? colors.primary }]} />
        <Icon name={geomIcon(item.geometry_type)} size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.layerName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.layerMeta}>{item.geometry_type} • {item.fields?.length ?? 0} champs</Text>
        </View>
        <Switch
          value={item.visible}
          onValueChange={() => toggleVisibility(item.id)}
          trackColor={{ false: colors.disabled, true: colors.primaryLight }}
          thumbColor={item.visible ? colors.primary : colors.textMuted}
        />
      </View>

      <TouchableOpacity
        style={styles.configBtn}
        onPress={() => nav.navigate('LayerConfig', { layerId: item.id })}
      >
        <Icon name="cog-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.configLabel}>Configurer</Text>
      </TouchableOpacity>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.h2}>Couches</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{layers.length} couches chargées</Text>
      </View>

      {layers.length === 0 ? (
        <EmptyState
          icon="layers-off"
          title="Aucune couche"
          message="Importez un fichier GeoPackage pour commencer"
        />
      ) : (
        <FlatList
          data={layers}
          keyExtractor={(l) => l.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  layerCard: {
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  layerName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  layerMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  configBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  configLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 4,
  },
});
