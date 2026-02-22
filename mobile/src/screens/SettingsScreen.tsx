// =====================================================
//  FieldCorrect Mobile — Settings Screen
// =====================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import RNFS from 'react-native-fs';

import { localDB } from '@/infra/db/LocalDB';
import { useLayerStore } from '@/stores/layerStore';
import { Card, Button, Divider } from '@/shared/components';
import { colors, spacing, typography } from '@/shared/theme';

export default function SettingsScreen() {
  const { loadLayers } = useLayerStore();
  const [autoSync, setAutoSync] = useState(true);
  const [dbSize, setDbSize] = useState('—');

  useEffect(() => {
    // Calculate DB size
    (async () => {
      try {
        const dbPath = `${RNFS.DocumentDirectoryPath}/fieldcorrect.db`;
        const exists = await RNFS.exists(dbPath);
        if (exists) {
          const stat = await RNFS.stat(dbPath);
          const sizeKB = Math.round(Number(stat.size) / 1024);
          setDbSize(sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`);
        }
      } catch (_) {
        setDbSize('N/A');
      }
    })();
  }, []);

  /* ── Clear local data ── */
  const handleClearData = () => {
    Alert.alert(
      'Supprimer les données locales ?',
      'Cette action est irréversible. Toutes les corrections non synchronisées seront perdues.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const db = localDB.getDB();
            await db.execute('DELETE FROM features');
            await db.execute('DELETE FROM corrections');
            await db.execute('DELETE FROM sync_queue');
            await db.execute('DELETE FROM layers');
            await loadLayers();
            Alert.alert('Données supprimées');
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>

      {/* Sync preferences */}
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={typography.bodyBold}>Synchronisation</Text>
        <Divider />
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.body}>Sync automatique</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Synchroniser toutes les 60 secondes
            </Text>
          </View>
          <Switch
            value={autoSync}
            onValueChange={setAutoSync}
            trackColor={{ false: colors.disabled, true: colors.primaryLight }}
            thumbColor={autoSync ? colors.primary : colors.textMuted}
          />
        </View>
      </Card>

      {/* Storage */}
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={typography.bodyBold}>Stockage</Text>
        <Divider />
        <View style={styles.settingRow}>
          <Text style={typography.body}>Base de données locale</Text>
          <Text style={[typography.bodyBold, { color: colors.textSecondary }]}>{dbSize}</Text>
        </View>
      </Card>

      {/* Danger zone */}
      <Card style={{ marginBottom: spacing.xxl }}>
        <Text style={[typography.bodyBold, { color: colors.error }]}>Zone de danger</Text>
        <Divider />
        <Button
          title="Supprimer toutes les données locales"
          icon="delete-forever"
          variant="danger"
          onPress={handleClearData}
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
