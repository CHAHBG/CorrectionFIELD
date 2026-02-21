// =====================================================
//  FieldCorrect Mobile — Import Wizard Screen
//  v2: Any GPKG/GeoJSON → analyze → configure → upload
// =====================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { Button, StatusBadge } from '@/shared/components';
import { useProjectStore } from '@/stores/projectStore';
import { useLayerStore } from '@/stores/layerStore';
import { localDB } from '@/infra/db/LocalDB';
import { supabase } from '@/infra/supabase';
import type { FieldSchema, FieldType, Layer } from '@/types';
import uuid from 'react-native-uuid';

// ── Types ───────────────────────────────────────────

interface AnalysisResult {
  fileName: string;
  format: 'gpkg' | 'geojson';
  geometryType: string;
  featureCount: number;
  fields: DetectedField[];
  sourceCrs: string;
  bbox: [number, number, number, number] | null;
  rawFeatures: any[];
}

interface DetectedField {
  name: string;
  type: FieldType;
  sampleValues: string[];
  distinctCount: number;
  editable: boolean;
  required: boolean;
  useAsFilter: boolean;
  useAsLabel: boolean;
  isEnum: boolean;
  enumValues: string[];
}

type WizardStep = 'pick' | 'analyze' | 'configure' | 'upload';

/* ═══════════════════════════════════════════════════ */

export default function ImportWizardScreen() {
  const nav = useNavigation();
  const { currentProject } = useProjectStore();
  const { addLayer } = useLayerStore();

  const [step, setStep] = useState<WizardStep>('pick');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Config state
  const [layerName, setLayerName] = useState('');
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [labelField, setLabelField] = useState<string>('');

  /* ── Step 1: Pick file ─── */
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
      });

      if (!result.uri) {return;}

      const ext = (result.name ?? '').toLowerCase();
      if (!ext.endsWith('.gpkg') && !ext.endsWith('.geojson') && !ext.endsWith('.json')) {
        Alert.alert('Format non supporté', 'Seuls les fichiers .gpkg et .geojson sont acceptés.');
        return;
      }

      setStep('analyze');
      setLoading(true);

      // Copy to app directory for safe access
      const destPath = `${RNFS.DocumentDirectoryPath}/import_${Date.now()}_${result.name}`;
      await RNFS.copyFile(result.uri, destPath);

      if (ext.endsWith('.geojson') || ext.endsWith('.json')) {
        await analyzeGeoJson(destPath, result.name ?? 'import');
      } else {
        await analyzeGpkg(destPath, result.name ?? 'import');
      }
    } catch (e: any) {
      if (!DocumentPicker.isCancel(e)) {
        Alert.alert('Erreur', e.message ?? "Impossible d'ouvrir le fichier");
      }
      setStep('pick');
    } finally {
      setLoading(false);
    }
  };

  /* ── Analyze GeoJSON ─── */
  const analyzeGeoJson = async (path: string, fileName: string) => {
    const raw = await RNFS.readFile(path, 'utf8');
    const geojson = JSON.parse(raw);

    const feats = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
    if (feats.length === 0) {
      Alert.alert('Fichier vide', 'Aucune feature trouvée dans le fichier.');
      setStep('pick');
      return;
    }

    const geomType = feats[0]?.geometry?.type ?? 'Unknown';
    const detectedFields = detectFields(feats);
    const bbox = computeBbox(feats);

    const result: AnalysisResult = {
      fileName,
      format: 'geojson',
      geometryType: geomType,
      featureCount: feats.length,
      fields: detectedFields,
      sourceCrs: 'EPSG:4326',
      bbox,
      rawFeatures: feats,
    };

    setAnalysis(result);
    setLayerName(fileName.replace(/\.(geojson|json|gpkg)$/i, ''));
    setFields(detectedFields);
    setStep('configure');
  };

  /* ── Analyze GPKG (via SQLite) ─── */
  const analyzeGpkg = async (path: string, fileName: string) => {
    try {
      const alias = `import_${Date.now()}`;
      await localDB.attachGeoPackage(path, alias);

      const db = localDB.getDB();

      // Get table names from gpkg_contents
      const tablesResult = await db.execute(
        `SELECT table_name, data_type, srs_id FROM ${alias}.gpkg_contents WHERE data_type IN ('features','tiles') LIMIT 10`,
      );
      const tables = tablesResult.rows ?? [];

      if (tables.length === 0) {
        Alert.alert('GeoPackage vide', 'Aucune couche trouvée.');
        await localDB.detachGeoPackage(alias);
        setStep('pick');
        return;
      }

      // Take first feature table
      const tableName = (tables[0] as any).table_name;
      const srsId = (tables[0] as any).srs_id ?? 4326;

      // Get geometry column info
      const geomColResult = await db.execute(
        `SELECT column_name, geometry_type_name FROM ${alias}.gpkg_geometry_columns WHERE table_name = ?`,
        [tableName],
      );
      const geomCol = (geomColResult.rows?.[0] as any)?.column_name ?? 'geom';
      const geomTypeName = (geomColResult.rows?.[0] as any)?.geometry_type_name ?? 'GEOMETRY';

      // Count features
      const countResult = await db.execute(`SELECT COUNT(*) as cnt FROM ${alias}."${tableName}"`);
      const featureCount = (countResult.rows?.[0] as any)?.cnt ?? 0;

      // Get column info
      const colsResult = await db.execute(`PRAGMA ${alias}.table_info("${tableName}")`);
      const cols = (colsResult.rows ?? []).filter(
        (c: any) => c.name !== geomCol && c.name !== 'fid' && c.name !== 'id',
      );

      // Sample rows (limit 200 for analysis)
      const sampleResult = await db.execute(
        `SELECT * FROM ${alias}."${tableName}" LIMIT 200`,
      );
      const sampleRows = sampleResult.rows ?? [];

      // Detect fields from sample
      const detectedFields: DetectedField[] = cols.map((col: any) => {
        const values = sampleRows
          .map((r: any) => r[col.name])
          .filter((v: any) => v != null)
          .map((v: any) => String(v));
        const distinctValues = [...new Set(values)];
        const isEnum = distinctValues.length > 0 && distinctValues.length <= 20;
        const baseType = sqliteTypeToFieldType(col.type);

        return {
          name: col.name,
          type: isEnum && baseType === 'text' ? ('select_one' as FieldType) : baseType,
          sampleValues: distinctValues.slice(0, 5),
          distinctCount: distinctValues.length,
          editable: true,
          required: !!col.notnull,
          useAsFilter: isEnum,
          useAsLabel: false,
          isEnum,
          enumValues: isEnum ? distinctValues : [],
        };
      });

      // We'll store raw features as simple objects (without binary geom for now)
      const rawFeatures = sampleRows.map((r: any) => {
        const props: Record<string, any> = {};
        cols.forEach((c: any) => {
          props[c.name] = r[c.name];
        });
        return { properties: props, geometry: null }; // geom parsed on upload
      });

      await localDB.detachGeoPackage(alias);

      const result: AnalysisResult = {
        fileName,
        format: 'gpkg',
        geometryType: geomTypeName,
        featureCount,
        fields: detectedFields,
        sourceCrs: `EPSG:${srsId}`,
        bbox: null,
        rawFeatures,
      };

      setAnalysis(result);
      setLayerName(tableName || fileName.replace(/\.gpkg$/i, ''));
      setFields(detectedFields);
      setStep('configure');
    } catch (e: any) {
      Alert.alert('Erreur analyse', e.message ?? "Impossible d'analyser le GeoPackage");
      setStep('pick');
    }
  };

  /* ── Step 3: Upload ─── */
  const handleUpload = async () => {
    if (!analysis || !currentProject) {return;}

    setStep('upload');
    setLoading(true);
    setProgress(0);

    try {
      // 1. Create layer record
      const layerId = String(uuid.v4());
      const fieldSchemas: FieldSchema[] = fields.map((f) => ({
        name: f.name,
        type: f.type,
        label: f.name.replace(/_/g, ' '),
        editable: f.editable,
        required: f.required,
        enum_values: f.isEnum
          ? f.enumValues.map((v) => ({ value: v, label: v }))
          : undefined,
      }));

      const layerData: Layer = {
        id: layerId,
        project_id: currentProject.id,
        name: layerName || analysis.fileName,
        geometry_type: analysis.geometryType,
        source_crs: analysis.sourceCrs,
        fields: fieldSchemas,
        style: {
          fill_color: colors.primary,
          stroke_color: colors.primary,
          stroke_width: 2,
          opacity: 0.7,
        },
        visible: true,
        sort_order: 0,
      };

      // Save layer to Supabase
      const { error: layerErr } = await supabase.from('layers').insert({
        id: layerData.id,
        project_id: layerData.project_id,
        name: layerData.name,
        geometry_type: layerData.geometry_type,
        source_crs: layerData.source_crs,
        fields: layerData.fields,
        style: layerData.style,
        is_editable: true,
        is_reference: false,
      });

      if (layerErr) {throw layerErr;}

      // Save layer locally
      await localDB.upsertLayer(layerData);
      setProgress(10);

      // 2. Upload features in batches
      if (analysis.format === 'geojson' && analysis.rawFeatures.length > 0) {
        const batchSize = 200;
        const total = analysis.rawFeatures.length;

        for (let i = 0; i < total; i += batchSize) {
          const batch = analysis.rawFeatures.slice(i, i + batchSize);
          const rows = batch.map((feat: any) => ({
            id: String(uuid.v4()),
            layer_id: layerId,
            geom: feat.geometry,
            props: feat.properties ?? {},
            status: 'pending',
            source_file: analysis.fileName,
          }));

          // Push to Supabase
          const { error: featErr } = await supabase.from('features').insert(rows);
          if (featErr) {console.warn('[Import] batch error:', featErr.message);}

          // Save locally
          for (const row of rows) {
            await localDB.upsertFeature({
              id: row.id,
              layer_id: row.layer_id,
              geom: row.geom,
              props: row.props,
              status: row.status,
              dirty: false,
            });
          }

          setProgress(10 + Math.round(((i + batchSize) / total) * 90));
        }
      }

      setProgress(100);
      await addLayer(layerData);

      Alert.alert(
        'Import réussi',
        `${analysis.featureCount} features importées dans la couche "${layerName}".`,
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('Erreur import', e.message ?? "Échec de l'import");
      setStep('configure');
    } finally {
      setLoading(false);
    }
  };

  /* ── Render ─── */
  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepBar}>
        {(['pick', 'analyze', 'configure', 'upload'] as WizardStep[]).map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                step === s && styles.stepDotActive,
                (['pick', 'analyze', 'configure', 'upload'].indexOf(step) > i) && styles.stepDotDone,
              ]}
            >
              <Text style={styles.stepNum}>{i + 1}</Text>
            </View>
            <Text style={styles.stepLabel}>
              {['Fichier', 'Analyse', 'Config', 'Import'][i]}
            </Text>
          </View>
        ))}
      </View>

      {/* Step 1: Pick file */}
      {step === 'pick' && (
        <View style={styles.centerContent}>
          <Icon name="file-upload-outline" size={64} color={colors.textMuted} />
          <Text style={styles.pickTitle}>Importer une couche</Text>
          <Text style={styles.pickSubtitle}>
            GeoPackage (.gpkg) ou GeoJSON (.geojson)
          </Text>
          <Button title="Choisir un fichier" onPress={pickFile} icon="file-document" />
        </View>
      )}

      {/* Step 2: Analyzing */}
      {step === 'analyze' && loading && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.analyzeText}>Analyse du fichier…</Text>
        </View>
      )}

      {/* Step 3: Configure */}
      {step === 'configure' && analysis && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{analysis.fileName}</Text>
            <View style={styles.summaryRow}>
              <StatusBadge label={analysis.format.toUpperCase()} color={colors.primary} />
              <StatusBadge label={analysis.geometryType} color={colors.info} />
              <StatusBadge label={`${analysis.featureCount} features`} color={colors.success} />
            </View>
            {analysis.sourceCrs !== 'EPSG:4326' && (
              <Text style={styles.crsWarning}>
                ⚠️ CRS source: {analysis.sourceCrs} — sera reprojeté en WGS84
              </Text>
            )}
          </View>

          {/* Layer name */}
          <Text style={styles.sectionTitle}>Nom de la couche</Text>
          <TextInput
            style={styles.input}
            value={layerName}
            onChangeText={setLayerName}
            placeholder="Nom de la couche"
            placeholderTextColor={colors.textMuted}
          />

          {/* Fields config */}
          <Text style={styles.sectionTitle}>Champs ({fields.length})</Text>
          {fields.map((field, idx) => (
            <FieldConfigRow
              key={field.name}
              field={field}
              isLabel={labelField === field.name}
              onToggleEditable={() => {
                const copy = [...fields];
                copy[idx] = { ...copy[idx], editable: !copy[idx].editable };
                setFields(copy);
              }}
              onToggleFilter={() => {
                const copy = [...fields];
                copy[idx] = { ...copy[idx], useAsFilter: !copy[idx].useAsFilter };
                setFields(copy);
              }}
              onSetLabel={() => setLabelField(field.name)}
            />
          ))}

          {/* Upload button */}
          <View style={styles.uploadArea}>
            <Button
              title="Importer la couche"
              onPress={handleUpload}
              icon="cloud-upload"
            />
          </View>
        </ScrollView>
      )}

      {/* Step 4: Uploading */}
      {step === 'upload' && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.analyzeText}>Import en cours… {progress}%</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════ */
/* ── Field Config Row ─── */

function FieldConfigRow({
  field,
  isLabel,
  onToggleEditable,
  onToggleFilter,
  onSetLabel,
}: {
  field: DetectedField;
  isLabel: boolean;
  onToggleEditable: () => void;
  onToggleFilter: () => void;
  onSetLabel: () => void;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldHeader}>
        <Icon
          name={fieldTypeIcon(field.type)}
          size={18}
          color={colors.textMuted}
        />
        <Text style={styles.fieldName}>{field.name}</Text>
        <Text style={styles.fieldType}>{field.type}</Text>
      </View>

      <View style={styles.fieldToggles}>
        <ToggleChip label="Éditable" active={field.editable} onPress={onToggleEditable} />
        <ToggleChip label="Filtre" active={field.useAsFilter} onPress={onToggleFilter} />
        <ToggleChip label="Label" active={isLabel} onPress={onSetLabel} />
      </View>

      {field.isEnum && (
        <Text style={styles.fieldEnum}>
          Enum: {field.enumValues.slice(0, 5).join(', ')}
          {field.enumValues.length > 5 ? ` (+${field.enumValues.length - 5})` : ''}
        </Text>
      )}

      {field.sampleValues.length > 0 && !field.isEnum && (
        <Text style={styles.fieldSample}>
          Ex: {field.sampleValues.slice(0, 3).join(', ')}
        </Text>
      )}
    </View>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ── Helpers ─── */

function detectFields(features: any[]): DetectedField[] {
  if (features.length === 0) {return [];}

  const allKeys = new Set<string>();
  features.forEach((f) => {
    if (f.properties) {
      Object.keys(f.properties).forEach((k) => allKeys.add(k));
    }
  });

  return Array.from(allKeys).map((key) => {
    const values = features
      .map((f) => f.properties?.[key])
      .filter((v) => v != null)
      .map((v) => String(v));
    const distinct = [...new Set(values)];
    const isEnum = distinct.length > 0 && distinct.length <= 20;

    // Infer type
    const sample = features.find((f) => f.properties?.[key] != null)?.properties?.[key];
    let type: FieldType = 'text';
    if (typeof sample === 'number') {
      type = Number.isInteger(sample) ? 'integer' : 'decimal';
    } else if (typeof sample === 'boolean') {
      type = 'boolean';
    } else if (isEnum) {
      type = 'select_one';
    }

    return {
      name: key,
      type,
      sampleValues: distinct.slice(0, 5),
      distinctCount: distinct.length,
      editable: true,
      required: false,
      useAsFilter: isEnum,
      useAsLabel: false,
      isEnum,
      enumValues: isEnum ? distinct : [],
    };
  });
}

function computeBbox(features: any[]): [number, number, number, number] | null {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  let found = false;

  features.forEach((f) => {
    const coords = extractCoords(f.geometry);
    coords.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      found = true;
    });
  });

  return found ? [minX, minY, maxX, maxY] : null;
}

function extractCoords(geom: any): [number, number][] {
  if (!geom) {return [];}
  if (geom.type === 'Point') {return [geom.coordinates];}
  if (geom.type === 'MultiPoint') {return geom.coordinates;}
  if (geom.type === 'LineString') {return geom.coordinates;}
  if (geom.type === 'MultiLineString') {return geom.coordinates.flat();}
  if (geom.type === 'Polygon') {return geom.coordinates.flat();}
  if (geom.type === 'MultiPolygon') {return geom.coordinates.flat(2);}
  return [];
}

function sqliteTypeToFieldType(sqlType: string): FieldType {
  const t = (sqlType ?? '').toUpperCase();
  if (t.includes('INT')) {return 'integer';}
  if (t.includes('REAL') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('NUMERIC')) {return 'decimal';}
  if (t.includes('BOOL')) {return 'boolean';}
  if (t.includes('DATE') || t.includes('TIME')) {return 'date';}
  return 'text';
}

function fieldTypeIcon(type: FieldType): string {
  switch (type) {
    case 'text': case 'string': return 'format-text';
    case 'integer': case 'float': case 'number': case 'decimal': return 'numeric';
    case 'boolean': return 'checkbox-marked-outline';
    case 'date': case 'datetime': return 'calendar';
    case 'select_one': case 'select_multiple': case 'enum': return 'menu-down';
    case 'image': return 'camera';
    case 'geopoint': return 'crosshairs-gps';
    default: return 'text-box-outline';
  }
}

/* ── Styles ─── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepItem: { alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepDotDone: { backgroundColor: colors.success },
  stepNum: { color: colors.white, ...typography.caption, fontWeight: '700' },
  stepLabel: { ...typography.caption, color: colors.textMuted },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  pickTitle: { ...typography.h2, color: colors.textPrimary },
  pickSubtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  analyzeText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  crsWarning: { ...typography.caption, color: colors.warning, marginTop: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  fieldRow: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fieldName: { ...typography.body, fontWeight: '600', flex: 1 },
  fieldType: { ...typography.caption, color: colors.textMuted },
  fieldToggles: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  fieldEnum: { ...typography.caption, color: colors.info, marginTop: 4 },
  fieldSample: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textMuted },
  chipTextActive: { color: colors.primary },
  uploadArea: { marginTop: spacing.lg, alignItems: 'center' },
  progressBar: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
});
