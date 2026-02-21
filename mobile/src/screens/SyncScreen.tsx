// =====================================================
//  FieldCorrect Mobile — Sync Screen
// =====================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { syncEngine } from '@/infra/sync/SyncEngine';
import { localDB } from '@/infra/db/LocalDB';
import { Card, Button, Divider } from '@/shared/components';
import { colors, spacing, typography } from '@/shared/theme';

export default function SyncScreen() {
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    const count = await localDB.getSyncQueueCount();
    setPendingCount(count);

    const db = localDB.getDB();
    const result = await db.execute("SELECT value FROM app_meta WHERE key = 'last_sync'");
    const val = (result.rows?.[0]?.value as string | null | undefined) ?? null;
    setLastSync(val);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncEngine.run();
      await loadStats();
    } catch (e) {
      console.error('[SyncScreen]', e);
    } finally {
      setSyncing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Status cards */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Icon name="upload-outline" size={28} color={colors.warning} />
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </Card>

        <Card style={styles.statCard}>
          <Icon name="clock-outline" size={28} color={colors.info} />
          <Text style={styles.statValue}>
            {lastSync
              ? new Date(lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : '--:--'}
          </Text>
          <Text style={styles.statLabel}>Dernière sync</Text>
        </Card>
      </View>

      {lastSync && (
        <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg }]}>
          {new Date(lastSync).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </Text>
      )}

      {/* Sync button */}
      <Button
        title={syncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
        icon="sync"
        onPress={handleSync}
        loading={syncing}
        style={{ marginBottom: spacing.lg }}
      />

      {/* Info */}
      <Card>
        <Text style={typography.bodyBold}>Comment fonctionne la sync</Text>
        <Divider />
        <InfoRow icon="upload" text="Les corrections créées hors-ligne sont envoyées au serveur" />
        <InfoRow icon="download" text="Les nouvelles couches et parcelles sont téléchargées automatiquement" />
        <InfoRow icon="wifi-off" text="En mode hors-ligne, toutes les données restent disponibles localement" />
        <InfoRow icon="shield-check" text="Les conflits sont résolus automatiquement (dernier écrit gagne)" />
      </Card>
    </ScrollView>
  );
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={18} color={colors.primary} style={{ marginRight: 8 }} />
      <Text style={[typography.body, { flex: 1, color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  statValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
});
