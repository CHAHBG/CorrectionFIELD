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
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProjectStore } from '@/stores/projectStore';
import { supabase } from '@/infra/supabase';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { EmptyState, Spinner } from '@/shared/components';
import type { Project, RootStackParamList } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Projects'>;

export default function ProjectsScreen() {
  const nav = useNavigation<Nav>();
  const { setProject, user } = useProjectStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchProjects = useCallback(async () => {
    // Skip Supabase call for offline user
    if (!user || user.id === 'offline') {
      setProjects([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_members!inner(user_id, role)
        `)
        .eq('project_members.user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) { throw error; }
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
  }, [user]);

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
          subtitle={user?.id === 'offline' ? 'Connectez-vous pour accéder à vos projets' : 'Demandez une invitation à un projet existant'}
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
});
