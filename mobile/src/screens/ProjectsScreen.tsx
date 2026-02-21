// =====================================================
//  FieldCorrect Mobile — Projects List Screen
//  v2: Multi-project support
// =====================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProjectStore } from '@/stores/projectStore';
import { supabase } from '@/infra/supabase';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { Button, EmptyState, Spinner } from '@/shared/components';
import type { Project, RootStackParamList } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Projects'>;

export default function ProjectsScreen() {
  const nav = useNavigation<Nav>();
  const { setProject, user } = useProjectStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_members!inner(user_id, role)
        `)
        .eq('project_members.user_id', user?.id ?? '')
        .order('created_at', { ascending: false });

      if (error) {throw error;}
      setProjects(
        (data ?? []).map((p: any) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          settings: p.settings ?? {},
          created_at: p.created_at,
          updated_at: p.updated_at ?? p.created_at,
        })),
      );
    } catch (e) {
      console.error('[ProjectsScreen] fetch', e);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    fetchProjects().finally(() => setLoading(false));
  }, [fetchProjects]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProjects();
    setRefreshing(false);
  };

  const selectProject = (project: Project) => {
    setProject(project);
    nav.navigate('Main');
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mes Projets</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreate(true)}
        >
          <Icon name="plus" size={20} color={colors.white} />
          <Text style={styles.createBtnText}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Icon name="magnify" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un projet…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Project List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title="Aucun projet"
          subtitle="Créez un projet ou demandez une invitation"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.projectCard}
              onPress={() => selectProject(item)}
              activeOpacity={0.7}
            >
              <View style={styles.projectIcon}>
                <Icon name="earth" size={28} color={colors.primary} />
              </View>
              <View style={styles.projectInfo}>
                <Text style={styles.projectName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.projectDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <Text style={styles.projectMeta}>
                  {new Date(item.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create Project Modal */}
      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(p) => {
            setProjects((prev) => [p, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </View>
  );
}

/* ─── Create Project Modal ─── */

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const { user } = useProjectStore();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const autoSlug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du projet est requis');
      return;
    }
    setSaving(true);
    try {
      const finalSlug = slug.trim() || autoSlug(name);
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          slug: finalSlug,
          description: description.trim() || null,
          owner_id: user?.id,
          settings: { default_crs: 'EPSG:4326', auto_lock: true, require_validation: false, offline_enabled: true },
        })
        .select()
        .single();

      if (error) {throw error;}

      // Add self as admin member
      await supabase.from('project_members').insert({
        project_id: data.id,
        user_id: user?.id,
        role: 'admin',
      });

      onCreated({
        id: data.id,
        slug: data.slug,
        name: data.name,
        description: data.description,
        settings: data.settings ?? {},
        created_at: data.created_at,
        updated_at: data.updated_at ?? data.created_at,
      });
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de créer le projet');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>Nouveau Projet</Text>

        <Text style={styles.label}>Nom *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (!slug) {setSlug(autoSlug(t));}
          }}
          placeholder="Ex: PROCASEF Boundou"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Identifiant (slug)</Text>
        <TextInput
          style={styles.input}
          value={slug || autoSlug(name)}
          onChangeText={setSlug}
          placeholder="procasef-boundou"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description du projet…"
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <View style={styles.modalActions}>
          <Button title="Annuler" variant="secondary" onPress={onClose} />
          <Button
            title={saving ? 'Création…' : 'Créer'}
            onPress={handleCreate}
            disabled={saving}
          />
        </View>
      </View>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: 4,
  },
  createBtnText: { color: colors.white, ...typography.body, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, marginLeft: spacing.sm, ...typography.body },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  projectInfo: { flex: 1 },
  projectName: { ...typography.h3, color: colors.textPrimary },
  projectDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  projectMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modal: {
    width: '90%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
