// =====================================================
//  FieldCorrect Mobile — Layer Config Screen
// =====================================================

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { RouteProp, useRoute } from '@react-navigation/native';

import { useLayerStore } from '@/stores/layerStore';
import { Card, Divider } from '@/shared/components';
import { colors, spacing, typography } from '@/shared/theme';

// This screen is kept for reference but is not used in the mobile navigator.
// Project configuration is done via the web interface only.
type LayerConfigParams = { LayerConfig: { layerId: string } };
type Route = RouteProp<LayerConfigParams, 'LayerConfig'>;

export default function LayerConfigScreen() {
  const { params } = useRoute<Route>();
  const { layers, setLayerOpacity } = useLayerStore();
  const layer = useMemo(() => layers.find((l) => l.id === params.layerId), [layers, params.layerId]);

  if (!layer) {
    return (
      <View style={styles.center}>
        <Text style={typography.body}>Couche introuvable</Text>
      </View>
    );
  }

  const opacity = layer.style?.opacity ?? 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={typography.h3}>{layer.name}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {layer.geometry_type} • ID: {layer.id.slice(0, 8)}
      </Text>

      <Card>
        <Text style={typography.bodyBold}>Opacité</Text>
        <View style={styles.sliderRow}>
          <Slider
            style={{ flex: 1 }}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={opacity}
            onSlidingComplete={(v: number) => setLayerOpacity(layer.id, v)}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.disabled}
            thumbTintColor={colors.primary}
          />
          <Text style={[typography.caption, { width: 40, textAlign: 'right' }]}>
            {Math.round(opacity * 100)}%
          </Text>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={typography.bodyBold}>Champs ({layer.fields?.length ?? 0})</Text>
        <Divider />
        {(layer.fields ?? []).map((f, i) => (
          <View key={i} style={styles.fieldRow}>
            <Text style={typography.body}>{f.name}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{f.type}</Text>
          </View>
        ))}
        {(!layer.fields || layer.fields.length === 0) && (
          <Text style={[typography.caption, { color: colors.textMuted }]}>Aucun champ défini</Text>
        )}
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={typography.bodyBold}>Style</Text>
        <Divider />
        <View style={styles.fieldRow}>
          <Text style={typography.body}>Remplissage</Text>
          <View style={[styles.swatch, { backgroundColor: layer.style?.fill_color ?? colors.primary }]} />
        </View>
        <View style={styles.fieldRow}>
          <Text style={typography.body}>Contour</Text>
          <View style={[styles.swatch, { backgroundColor: layer.style?.stroke_color ?? colors.primaryDark }]} />
        </View>
        <View style={styles.fieldRow}>
          <Text style={typography.body}>Épaisseur</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{layer.style?.stroke_width ?? 2}px</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
