// =====================================================
//  FieldCorrect Mobile — Login Screen
// =====================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useProjectStore } from '@/stores/projectStore';
import { RootStackParamList } from '@/types';
import { Button, Input } from '@/shared/components';
import { colors, spacing, typography, shadow } from '@/shared/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const nav = useNavigation<Nav>();
  const { login, isAuthenticated, init } = useProjectStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Check existing session on mount
  useEffect(() => {
    init();
  }, [init]);

  // Auto-navigate if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      nav.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Projects' }] }),
      );
    }
  }, [isAuthenticated, nav]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email et mot de passe requis');
      return;
    }
    setError('');
    setLoggingIn(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message ?? 'Erreur de connexion');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSkip = () => {
    // Allow offline mode without auth — go to Projects
    useProjectStore.getState().skipAuth();
    nav.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Projects' }] }),
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo / Branding */}
        <View style={styles.logoSection}>
          <View style={styles.iconCircle}>
            <Icon name="map-check" size={48} color={colors.white} />
          </View>
          <Text style={styles.appName}>FieldCorrect</Text>
          <Text style={styles.tagline}>Correction terrain de données parcellaires</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="votre@email.com"
          />
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          {error !== '' && (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            title="Se connecter"
            onPress={handleLogin}
            loading={loggingIn}
            icon="login"
            style={{ marginTop: spacing.md }}
          />

          <Button
            title="Mode hors-ligne"
            onPress={handleSkip}
            variant="ghost"
            icon="wifi-off"
            style={{ marginTop: spacing.sm }}
          />

          <TouchableOpacity
            onPress={() => nav.navigate('Register')}
            style={styles.linkRow}
          >
            <Text style={styles.linkText}>
              Pas encore de compte ?{' '}
              <Text style={styles.linkBold}>S'inscrire</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
    marginBottom: spacing.md,
  },
  appName: {
    ...typography.h1,
    color: colors.primary,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  form: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xl,
    ...shadow.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginLeft: 8,
    flex: 1,
  },
  linkRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  linkText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  linkBold: {
    color: colors.primary,
    fontWeight: '600',
  },
});
