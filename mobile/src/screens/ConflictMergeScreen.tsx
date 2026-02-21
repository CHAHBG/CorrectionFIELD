// =====================================================
//  FieldCorrect Mobile — Conflict Merge Screen
//  v2: Side-by-side diff for sync conflicts
// =====================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { Button } from '@/shared/components';
import { localDB } from '@/infra/db/LocalDB';
import type { RootStackParamList } from '@/types';

type RouteParams = RouteProp<RootStackParamList, 'ConflictMerge'>;

interface ConflictField {
  key: string;
  localValue: any;
  serverValue: any;
  chosen: 'local' | 'server';
}

export default function ConflictMergeScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteParams>();
  const { featureId, localData, serverData } = route.params;

  const localProps = localData?.props ?? {};
  const serverProps = serverData?.props ?? {};

  // Build field diff
  const allKeys = [...new Set([...Object.keys(localProps), ...Object.keys(serverProps)])];
  const initialFields: ConflictField[] = allKeys
    .filter((k) => JSON.stringify(localProps[k]) !== JSON.stringify(serverProps[k]))
    .map((key) => ({
      key,
      localValue: localProps[key],
      serverValue: serverProps[key],
      chosen: 'server' as const, // default: server wins
    }));

  const [fields, setFields] = useState<ConflictField[]>(initialFields);
  const [saving, setSaving] = useState(false);

  const unchangedKeys = allKeys.filter(
    (k) => JSON.stringify(localProps[k]) === JSON.stringify(serverProps[k]),
  );

  const toggleChoice = (idx: number) => {
    setFields((prev) =>
      prev.map((f, i) =>
        i === idx
          ? { ...f, chosen: f.chosen === 'local' ? 'server' : 'local' }
          : f,
      ),
    );
  };

  const acceptAll = (choice: 'local' | 'server') => {
    setFields((prev) => prev.map((f) => ({ ...f, chosen: choice })));
  };

  const handleResolve = async () => {
    setSaving(true);
    try {
      // Merge props: start with server, apply chosen local values
      const merged: Record<string, any> = { ...serverProps };
      for (const field of fields) {
        merged[field.key] = field.chosen === 'local' ? field.localValue : field.serverValue;
      }

      // Update local feature with merged data
      await localDB.upsertFeature({
        id: featureId,
        layer_id: serverData?.layer_id ?? localData?.layer_id,
        geom: serverData?.geom ?? localData?.geom,
        props: merged,
        status: serverData?.status ?? 'pending',
        dirty: false, // resolved
      });

      nav.goBack();
    } catch (e: any) {
      console.error('[ConflictMerge] resolve error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="source-merge" size={24} color={colors.warning} />
        <Text style={styles.headerTitle}>Conflit détecté</Text>
      </View>
      <Text style={styles.headerSub}>
        La feature a été modifiée sur le serveur pendant que vous travailliez hors-ligne.
        Choisissez la version à conserver pour chaque champ.
      </Text>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => acceptAll('local')}>
          <Icon name="cellphone" size={16} color={colors.primary} />
          <Text style={styles.quickBtnText}>Tout local</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => acceptAll('server')}>
          <Icon name="cloud" size={16} color={colors.info} />
          <Text style={styles.quickBtnText}>Tout serveur</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Conflicting fields */}
        {fields.length === 0 ? (
          <View style={styles.noConflict}>
            <Icon name="check-circle" size={48} color={colors.success} />
            <Text style={styles.noConflictText}>Aucun conflit détecté</Text>
          </View>
        ) : (
          fields.map((field, idx) => (
            <View key={field.key} style={styles.fieldCard}>
              <Text style={styles.fieldName}>{field.key}</Text>
              <View style={styles.diffRow}>
                {/* Local */}
                <TouchableOpacity
                  style={[
                    styles.diffOption,
                    field.chosen === 'local' && styles.diffOptionSelected,
                  ]}
                  onPress={() => toggleChoice(idx)}
                >
                  <Icon name="cellphone" size={14} color={field.chosen === 'local' ? colors.primary : colors.textMuted} />
                  <Text style={styles.diffLabel}>Local</Text>
                  <Text style={[styles.diffValue, field.chosen === 'local' && styles.diffValueSelected]}>
                    {formatValue(field.localValue)}
                  </Text>
                </TouchableOpacity>

                {/* Server */}
                <TouchableOpacity
                  style={[
                    styles.diffOption,
                    field.chosen === 'server' && styles.diffOptionSelectedServer,
                  ]}
                  onPress={() => toggleChoice(idx)}
                >
                  <Icon name="cloud" size={14} color={field.chosen === 'server' ? colors.info : colors.textMuted} />
                  <Text style={styles.diffLabel}>Serveur</Text>
                  <Text style={[styles.diffValue, field.chosen === 'server' && styles.diffValueSelectedServer]}>
                    {formatValue(field.serverValue)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Unchanged fields */}
        {unchangedKeys.length > 0 && (
          <View style={styles.unchangedSection}>
            <Text style={styles.unchangedTitle}>
              Champs identiques ({unchangedKeys.length})
            </Text>
            {unchangedKeys.map((key) => (
              <View key={key} style={styles.unchangedRow}>
                <Text style={styles.unchangedKey}>{key}</Text>
                <Text style={styles.unchangedVal}>{formatValue(localProps[key])}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Resolve button */}
      <View style={styles.footer}>
        <Button
          title={saving ? 'Résolution…' : 'Appliquer la résolution'}
          onPress={handleResolve}
          disabled={saving}
          icon="check"
        />
      </View>
    </View>
  );
}

function formatValue(v: any): string {
  if (v === null || v === undefined) {return '(vide)';}
  if (typeof v === 'object') {return JSON.stringify(v);}
  return String(v);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  headerTitle: { ...typography.h2, color: colors.warning },
  headerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickBtnText: { ...typography.caption, color: colors.textSecondary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  noConflict: { alignItems: 'center', marginTop: spacing.xl },
  noConflictText: { ...typography.body, color: colors.success, marginTop: spacing.sm },
  fieldCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldName: { ...typography.body, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  diffRow: { flexDirection: 'row', gap: spacing.sm },
  diffOption: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  diffOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  diffOptionSelectedServer: { borderColor: colors.info, backgroundColor: colors.info + '10' },
  diffLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  diffValue: { ...typography.body, color: colors.textSecondary },
  diffValueSelected: { color: colors.primary, fontWeight: '600' },
  diffValueSelectedServer: { color: colors.info, fontWeight: '600' },
  unchangedSection: { marginTop: spacing.lg },
  unchangedTitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  unchangedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  unchangedKey: { ...typography.caption, color: colors.textSecondary },
  unchangedVal: { ...typography.caption, color: colors.textPrimary },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
});
