// =====================================================
//  FieldCorrect Mobile — Project Members Screen
//  v2: Invite, manage roles, assign zones
// =====================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { Button, StatusBadge, Spinner, EmptyState } from '@/shared/components';
import { useProjectStore } from '@/stores/projectStore';
import { supabase } from '@/infra/supabase';
import type { MemberRole } from '@/types';

interface Member {
  user_id: string;
  role: MemberRole;
  full_name: string;
  email: string;
  avatar_url?: string;
}

const ROLES: MemberRole[] = ['admin', 'supervisor', 'corrector', 'editor', 'viewer'];

const roleColors: Record<string, string> = {
  owner: '#6B21A8',
  admin: '#DC2626',
  supervisor: '#D97706',
  corrector: '#2563EB',
  editor: '#059669',
  viewer: '#6B7280',
};

export default function ProjectMembersScreen() {
  const { currentProject, user } = useProjectStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('corrector');
  const [inviting, setInviting] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!currentProject) {return;}
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('user_id, role, profiles(full_name, email, avatar_url)')
        .eq('project_id', currentProject.id);

      if (error) {throw error;}

      setMembers(
        (data ?? []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          full_name: m.profiles?.full_name ?? '',
          email: m.profiles?.email ?? '',
          avatar_url: m.profiles?.avatar_url,
        })),
      );
    } catch (e) {
      console.error('[Members] fetch error:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  useEffect(() => {
    setLoading(true);
    fetchMembers().finally(() => setLoading(false));
  }, [fetchMembers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentProject) {return;}
    setInviting(true);
    try {
      // Look up user by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.trim())
        .single();

      if (!profile) {
        Alert.alert('Utilisateur introuvable', "Aucun compte avec cet email. L'utilisateur doit d'abord créer un compte.");
        return;
      }

      // Check if already member
      if (members.some((m) => m.user_id === profile.id)) {
        Alert.alert('Déjà membre', 'Cet utilisateur est déjà membre du projet.');
        return;
      }

      const { error } = await supabase.from('project_members').insert({
        project_id: currentProject.id,
        user_id: profile.id,
        role: inviteRole,
      });

      if (error) {throw error;}

      setInviteEmail('');
      await fetchMembers();
      Alert.alert('Invitation envoyée', `${inviteEmail} a été ajouté comme ${inviteRole}.`);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? "Impossible d'inviter");
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (userId: string, newRole: MemberRole) => {
    if (!currentProject) {return;}
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('project_id', currentProject.id)
        .eq('user_id', userId);

      if (error) {throw error;}
      await fetchMembers();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de changer le rôle');
    }
  };

  const removeMember = (userId: string, name: string) => {
    Alert.alert(
      'Retirer le membre',
      `Retirer ${name || 'ce membre'} du projet ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('project_members')
                .delete()
                .eq('project_id', currentProject!.id)
                .eq('user_id', userId);
              await fetchMembers();
            } catch (e: any) {
              Alert.alert('Erreur', e.message);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Invite section */}
      <View style={styles.inviteSection}>
        <Text style={styles.sectionTitle}>Inviter un membre</Text>
        <View style={styles.inviteRow}>
          <TextInput
            style={styles.emailInput}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="email@exemple.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleChip, inviteRole === r && styles.roleChipActive]}
              onPress={() => setInviteRole(r)}
            >
              <Text
                style={[
                  styles.roleChipText,
                  inviteRole === r && { color: roleColors[r] },
                ]}
              >
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button
          title={inviting ? 'Envoi…' : 'Inviter'}
          onPress={handleInvite}
          disabled={inviting || !inviteEmail.trim()}
          icon="account-plus"
        />
      </View>

      {/* Members list */}
      <Text style={styles.sectionTitle}>
        Membres ({members.length})
      </Text>

      {members.length === 0 ? (
        <EmptyState icon="account-group-outline" title="Aucun membre" subtitle="Invitez des membres" />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.user_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Icon name="account-circle" size={36} color={roleColors[item.role] ?? colors.textMuted} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.full_name || item.email}</Text>
                <Text style={styles.memberEmail}>{item.email}</Text>
                <StatusBadge label={item.role} color={roleColors[item.role] ?? colors.textMuted} />
              </View>
              {item.user_id !== user?.id && (
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    onPress={() => {
                      const currentIdx = ROLES.indexOf(item.role as any);
                      const nextRole = ROLES[(currentIdx + 1) % ROLES.length];
                      changeRole(item.user_id, nextRole);
                    }}
                  >
                    <Icon name="account-switch" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeMember(item.user_id, item.full_name)}>
                    <Icon name="account-remove" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inviteSection: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  inviteRow: { marginBottom: spacing.sm },
  emailInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  roleChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChipActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  roleChipText: { ...typography.caption, color: colors.textMuted },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatar: { marginRight: spacing.sm },
  memberInfo: { flex: 1 },
  memberName: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  memberEmail: { ...typography.caption, color: colors.textMuted },
  memberActions: { flexDirection: 'row', gap: spacing.sm },
});
