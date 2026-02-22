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
  const {
    setProject,
    user,
    organizations,
    activeOrganization,
    setOrganization,
    projects,
    fetchOrganizations,
    fetchProjects
  } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    // Skip Supabase call for offline user
    if (!user || user.id === 'offline') {
      return;
    }
    await fetchOrganizations();
    if (activeOrganization) {
      await fetchProjects();
    }
  }, [user, activeOrganization, fetchOrganizations, fetchProjects]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    setLoading(true);
    fetchProjects().finally(() => setLoading(false));
  }, [fetchProjects]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const selectProject = (project: Project) => {
    setProject(project);
    nav.navigate('Main');
  };

  // 1. Organization List View
  if (!activeOrganization) {
    const filteredOrgs = organizations.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mes Organisations</Text>
        </View>

        <View style={styles.searchRow}>
          <Icon name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une organisation…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {filteredOrgs.length === 0 ? (
          <EmptyState
            icon="domain"
            title="Aucune organisation"
            subtitle={user?.id === 'offline' ? 'Connectez-vous pour accéder à vos organisations' : 'Demandez une invitation à un projet existant'}
          />
        ) : (
          <FlatList
            data={filteredOrgs}
            keyExtractor={(o) => o.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.projectCard}
                onPress={() => setOrganization(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.projectIcon, { backgroundColor: colors.info + '15' }]}>
                  <Text style={{ ...typography.h3, color: colors.info }}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.projectInfo}>
                  <Text style={styles.projectName}>{item.name}</Text>
                  <Text style={styles.projectDesc}>Role: {item.role}</Text>
                </View>
                <Icon name="chevron-right" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // 2. Project List View (for the active organization)
  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subtitle}>{activeOrganization.name}</Text>
          <Text style={styles.title}>Projets</Text>
        </View>
        <TouchableOpacity onPress={() => setOrganization(null)} style={styles.backButton}>
          <Icon name="close" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

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

      {filtered.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title="Aucun projet"
          subtitle="Cette organisation n'a pas encore de projet."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
                  <Text style={styles.projectDesc} numberOfLines={2}>{item.description}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.primary, textTransform: 'uppercase', marginBottom: 2, fontWeight: 'bold' },
  backButton: { padding: spacing.xs },
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
