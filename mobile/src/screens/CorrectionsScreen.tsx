// =====================================================
//  FieldCorrect Mobile — Corrections List Screen
// =====================================================

import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useCorrectionStore } from '@/stores/correctionStore';
import { Correction, RootStackParamList } from '@/types';
import { Card, StatusBadge, EmptyState, Spinner } from '@/shared/components';
import { colors, spacing, typography } from '@/shared/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CorrectionsScreen() {
  const nav = useNavigation<Nav>();
  const { corrections, loading, loadAll } = useCorrectionStore();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading && corrections.length === 0) {
    return <Spinner />;
  }

  const renderItem = ({ item }: { item: Correction }) => (
    <Card
      style={styles.card}
      onPress={() =>
        nav.navigate('CorrectionForm', {
          featureId: item.feature_id,
          layerId: item.layer_id,
        })
      }
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            Parcelle {item.feature_id.slice(0, 8)}
          </Text>
          <Text style={styles.meta}>
            {new Date(item.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      {item.comment && (
        <Text style={styles.comment} numberOfLines={2}>
          {item.comment}
        </Text>
      )}

      {item.media_urls && item.media_urls.length > 0 && (
        <View style={styles.mediaBadge}>
          <Icon name="camera" size={14} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 4 }]}>
            {item.media_urls.length} photo(s)
          </Text>
        </View>
      )}
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.h2}>Corrections</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {corrections.length} correction(s)
        </Text>
      </View>

      {corrections.length === 0 ? (
        <EmptyState
          icon="pencil-off"
          title="Aucune correction"
          message="Sélectionnez une parcelle sur la carte pour créer une correction"
        />
      ) : (
        <FlatList
          data={corrections}
          keyExtractor={(c) => c.id}
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
  card: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  comment: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  mediaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
