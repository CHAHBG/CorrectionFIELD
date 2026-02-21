// =====================================================
//  FieldCorrect Mobile — Settings Screen
// =====================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import RNFS from 'react-native-fs';
import { launchImageLibrary } from 'react-native-image-picker';

import { localDB } from '@/infra/db/LocalDB';
import { useLayerStore } from '@/stores/layerStore';
import { Card, Button, Divider } from '@/shared/components';
import { colors, spacing, typography } from '@/shared/theme';
import uuid from 'react-native-uuid';

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

  /* ── Import GeoPackage ── */
  const handleImportGpkg = useCallback(async () => {
    try {
      // Use file picker to select .gpkg
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        selectionLimit: 1,
      });

      if (result.assets && result.assets[0]?.uri) {
        const uri = result.assets[0].uri;
        const fileName = result.assets[0].fileName ?? 'import.gpkg';

        // Copy to app documents
        const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
        await RNFS.copyFile(uri, destPath);

        // Import as a layer
        const layerName = fileName.replace('.gpkg', '').replace(/_/g, ' ');
        const layerId = String(uuid.v4());

        await localDB.upsertLayer({
          id: layerId,
          name: layerName,
          geometry_type: 'Polygon',
          fields: [],
          style: {
            fill_color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
            stroke_color: '#333333',
            stroke_width: 2,
            opacity: 0.7,
          },
          visible: true,
          sort_order: 0,
        });

        // Attach and read features from GeoPackage
        try {
          localDB.attachGeoPackage(destPath, 'import_gpkg');

          const db = localDB.getDB();
          // Try to find the main feature table
          const tables = await db.execute(
            "SELECT table_name FROM import_gpkg.gpkg_contents WHERE data_type = 'features' LIMIT 1",
          );

          if (tables.rows?.[0]) {
            const tableName = String(tables.rows[0].table_name);
            const features = await db.execute(
              `SELECT *, hex(geom) as geom_hex FROM import_gpkg."${tableName}" LIMIT 10000`,
            );

            let imported = 0;
            for (const row of features.rows ?? []) {
              await localDB.upsertFeature({
                id: String(uuid.v4()),
                layer_id: layerId,
                geom: null, // Would need WKB parsing
                props: row,
                status: 'draft',
                dirty: false,
              });
              imported++;
            }

            Alert.alert(
              'Import réussi',
              `${imported} entités importées dans la couche "${layerName}"`,
            );
          }

          localDB.detachGeoPackage('import_gpkg');
        } catch (gpkgErr: any) {
          console.warn('[Import] GPKG read', gpkgErr);
          Alert.alert('Import partiel', 'Couche créée mais les entités n\'ont pas pu être lues');
        }

        await loadLayers();
      }
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Erreur lors de l\'import');
    }
  }, [loadLayers]);

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
            db.execute('DELETE FROM features');
            db.execute('DELETE FROM corrections');
            db.execute('DELETE FROM sync_queue');
            db.execute('DELETE FROM layers');
            await loadLayers();
            Alert.alert('Données supprimées');
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      {/* Import */}
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={typography.bodyBold}>Import de données</Text>
        <Divider />
        <Button
          title="Importer un GeoPackage"
          icon="database-import"
          variant="secondary"
          onPress={handleImportGpkg}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

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
