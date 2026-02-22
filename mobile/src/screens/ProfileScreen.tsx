// =====================================================
//  FieldCorrect Mobile — Profile Screen
// =====================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useProjectStore } from '@/stores/projectStore';
import { RootStackParamList } from '@/types';
import { Button, Card, Divider } from '@/shared/components';
import { colors, spacing, typography, shadow } from '@/shared/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const nav = useNavigation<Nav>();
  const { user, isAuthenticated, logout, currentRole } = useProjectStore();
  const displayRole = currentRole || user?.role;

  const handleLogout = async () => {
    await logout();
    nav.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      {/* Avatar & name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Icon name="account" size={48} color={colors.white} />
        </View>
        <Text style={typography.h2}>
          {user?.full_name || 'Utilisateur hors-ligne'}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          {user?.email || 'Mode hors-ligne'}
        </Text>
        {displayRole && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{displayRole.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Quick links */}
      <Card style={{ marginBottom: spacing.md }}>
        <ProfileRow
          icon="sync"
          label="Synchronisation"
          onPress={() => nav.navigate('Sync')}
        />
        <Divider />
        <ProfileRow
          icon="cog"
          label="Paramètres"
          onPress={() => nav.navigate('Settings')}
        />
      </Card>

      {/* Auth actions */}
      {isAuthenticated ? (
        <Button
          title="Déconnexion"
          icon="logout"
          variant="danger"
          onPress={handleLogout}
        />
      ) : (
        <Button
          title="Se connecter"
          icon="login"
          onPress={() => nav.reset({ index: 0, routes: [{ name: 'Login' }] })}
        />
      )}
    </ScrollView>
  );
}

/* ── Reusable profile row ── */

function ProfileRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Button
      title={label}
      icon={icon}
      variant="ghost"
      onPress={onPress}
      style={{ justifyContent: 'flex-start', paddingHorizontal: 0 }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
    marginBottom: spacing.md,
  },
  roleBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  roleText: {
    ...typography.captionBold,
    color: colors.primaryDark,
  },
});
