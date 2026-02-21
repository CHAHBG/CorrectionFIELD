// =====================================================
//  FieldCorrect Mobile — Correction Form Screen
// =====================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { RootStackParamList, AppFeature, Layer, FieldSchema, Geometry } from '@/types';
import { localDB } from '@/infra/db/LocalDB';
import { useCorrectionStore } from '@/stores/correctionStore';
import { useLayerStore } from '@/stores/layerStore';
import { useProjectStore } from '@/stores/projectStore';
import { Button, Input, Card, StatusBadge, Divider } from '@/shared/components';
import { colors, spacing, typography, radius } from '@/shared/theme';

type Route = RouteProp<RootStackParamList, 'CorrectionForm'>;

export default function CorrectionFormScreen() {
  const { params } = useRoute<Route>();
  const nav = useNavigation();
  const { addCorrection } = useCorrectionStore();
  const { layers } = useLayerStore();
  const user = useProjectStore((s) => s.user);

  const [feature, setFeature] = useState<AppFeature | null>(null);
  const [layer, setLayer] = useState<Layer | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<Asset[]>([]);
  const [gpsPoint, setGpsPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ── Load feature & layer ── */
  useEffect(() => {
    (async () => {
      const f = await localDB.getFeatureById(params.featureId);
      setFeature(f);

      // Pre-populate form with current props
      if (f?.props) {
        setFormValues({ ...f.props });
      }

      const l = layers.find((x) => x.id === params.layerId) ?? null;
      setLayer(l);
    })();
  }, [layers, params.featureId, params.layerId]);

  /* ── Capture GPS ── */
  const captureGps = useCallback(() => {
    Geolocation.getCurrentPosition(
      (pos) => {
        setGpsPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        Alert.alert('GPS', `Position capturée: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
      },
      (err) => Alert.alert('Erreur GPS', err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  /* ── Take / pick photo ── */
  const takePhoto = useCallback(() => {
    launchCamera({ mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1200 }, (resp) => {
      if (resp.assets) {
        setPhotos((prev) => [...prev, ...resp.assets!]);
      }
    });
  }, []);

  const pickPhoto = useCallback(() => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.7, selectionLimit: 5 }, (resp) => {
      if (resp.assets) {
        setPhotos((prev) => [...prev, ...resp.assets!]);
      }
    });
  }, []);

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!feature) {
      return;
    }

    setSubmitting(true);
    try {
      // Build props patch (only changed values)
      const propsPatch: Record<string, any> = {};
      for (const [key, val] of Object.entries(formValues)) {
        if (feature.props?.[key] !== val) {
          propsPatch[key] = val;
        }
      }

      // Build corrected geometry (if GPS captured)
      let geomCorrected: Geometry | undefined;
      if (gpsPoint) {
        geomCorrected = {
          type: 'Point',
          coordinates: [gpsPoint.lng, gpsPoint.lat],
        };
      }

      await addCorrection({
        feature_id: params.featureId,
        layer_id: params.layerId,
        author_id: user?.id ?? 'anonymous',
        status: 'pending',
        props_patch: propsPatch,
        geom_corrected: geomCorrected,
        comment: comment || undefined,
        media_urls: photos.map((p) => p.uri ?? ''),
        dirty: true,
      });

      Alert.alert('Succès', 'Correction enregistrée', [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render dynamic fields ── */
  const renderField = (field: FieldSchema, index: number) => {
    const value = formValues[field.name] ?? '';

    switch (field.type) {
      case 'text':
      case 'string':
        return (
          <Input
            key={index}
            label={field.label ?? field.name}
            value={String(value)}
            onChangeText={(v) => setFormValues((prev) => ({ ...prev, [field.name]: v }))}
            placeholder={`Saisir ${field.label ?? field.name}`}
          />
        );
      case 'number':
      case 'integer':
      case 'float':
        return (
          <Input
            key={index}
            label={field.label ?? field.name}
            value={String(value)}
            onChangeText={(v) => setFormValues((prev) => ({ ...prev, [field.name]: Number(v) || v }))}
            placeholder="0"
          />
        );
      case 'boolean':
        return (
          <View key={index} style={styles.boolRow}>
            <Text style={[typography.captionBold, { color: colors.textSecondary }]}>
              {field.label ?? field.name}
            </Text>
            <TouchableOpacity
              onPress={() => setFormValues((prev) => ({ ...prev, [field.name]: !prev[field.name] }))}
              style={[styles.boolToggle, value ? styles.boolOn : styles.boolOff]}
            >
              <Text style={{ color: value ? colors.white : colors.textPrimary }}>
                {value ? 'Oui' : 'Non'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      case 'enum':
        return (
          <View key={index} style={{ marginBottom: spacing.md }}>
            <Text style={[typography.captionBold, { color: colors.textSecondary, marginBottom: 4 }]}>
              {field.label ?? field.name}
            </Text>
            <View style={styles.enumRow}>
              {(field.enum_values ?? []).map((ev) => (
                <TouchableOpacity
                  key={ev.value}
                  onPress={() => setFormValues((prev) => ({ ...prev, [field.name]: ev.value }))}
                  style={[
                    styles.enumOption,
                    value === ev.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={{ color: value === ev.value ? colors.white : colors.textPrimary, fontSize: 12 }}>
                    {ev.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      default:
        return (
          <Input
            key={index}
            label={field.label ?? field.name}
            value={String(value)}
            onChangeText={(v) => setFormValues((prev) => ({ ...prev, [field.name]: v }))}
          />
        );
    }
  };

  if (!feature) {
    return (
      <View style={styles.center}>
        <Text style={typography.body}>Chargement...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
        {/* Feature info */}
        <Card style={{ marginBottom: spacing.md }}>
          <View style={styles.featureHeader}>
            <Text style={typography.h3}>Parcelle {feature.id.slice(0, 8)}</Text>
            <StatusBadge status={feature.status} />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Couche: {layer?.name ?? params.layerId.slice(0, 8)}
          </Text>
        </Card>

        {/* Dynamic fields from schema */}
        {layer?.fields && layer.fields.length > 0 && (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.bodyBold, { marginBottom: spacing.sm }]}>Attributs</Text>
            <Divider />
            {layer.fields.filter((f) => f.editable !== false).map(renderField)}
          </Card>
        )}

        {/* Comment */}
        <Card style={{ marginBottom: spacing.md }}>
          <Input
            label="Commentaire"
            value={comment}
            onChangeText={setComment}
            placeholder="Décrivez la correction..."
            multiline
          />
        </Card>

        {/* GPS */}
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.bodyBold, { marginBottom: spacing.sm }]}>Position GPS</Text>
          {gpsPoint ? (
            <Text style={[typography.body, { color: colors.success }]}>
              {gpsPoint.lat.toFixed(6)}, {gpsPoint.lng.toFixed(6)}
            </Text>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>Aucune position capturée</Text>
          )}
          <Button
            title="Capturer position"
            icon="crosshairs-gps"
            variant="secondary"
            onPress={captureGps}
            style={{ marginTop: spacing.sm }}
          />
        </Card>

        {/* Photos */}
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.bodyBold, { marginBottom: spacing.sm }]}>Photos</Text>
          <View style={styles.photosRow}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri: p.uri }} style={styles.photoImg} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Icon name="close-circle" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title="Caméra" icon="camera" variant="secondary" onPress={takePhoto} style={{ flex: 1 }} />
            <Button title="Galerie" icon="image" variant="secondary" onPress={pickPhoto} style={{ flex: 1 }} />
          </View>
        </Card>

        {/* Submit */}
        <Button
          title="Enregistrer la correction"
          icon="check-circle"
          onPress={handleSubmit}
          loading={submitting}
          style={{ marginBottom: spacing.xxl }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  boolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  boolToggle: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  boolOn: { backgroundColor: colors.success, borderColor: colors.success },
  boolOff: { backgroundColor: colors.white, borderColor: colors.border },
  enumRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  enumOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoThumb: { width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 2, right: 2 },
});
