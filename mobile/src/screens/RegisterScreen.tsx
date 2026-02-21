// =====================================================
//  FieldCorrect Mobile — Register Screen
// =====================================================

import React, { useState } from 'react';
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

import { supabase } from '@/infra/supabase';
import { RootStackParamList } from '@/types';
import { Button, Input } from '@/shared/components';
import { colors, spacing, typography, shadow } from '@/shared/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RegisterScreen() {
    const nav = useNavigation<Nav>();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [registering, setRegistering] = useState(false);

    const handleRegister = async () => {
        // Validation
        if (!fullName.trim() || !email.trim() || !password.trim()) {
            setError('Tous les champs sont requis');
            return;
        }
        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            return;
        }
        if (password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        setError('');
        setRegistering(true);
        try {
            // 1. Create auth account
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: { full_name: fullName.trim() },
                },
            });

            if (signUpError) {
                throw signUpError;
            }

            // 2. Create profile row
            if (data.user) {
                await supabase.from('profiles').upsert({
                    id: data.user.id,
                    email: email.trim(),
                    full_name: fullName.trim(),
                    role: 'editor',
                });
            }

            // 3. Navigate to Projects
            nav.dispatch(
                CommonActions.reset({ index: 0, routes: [{ name: 'Projects' }] }),
            );
        } catch (e: any) {
            setError(e.message ?? "Erreur lors de l'inscription");
        } finally {
            setRegistering(false);
        }
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
                        <Icon name="account-plus" size={48} color={colors.white} />
                    </View>
                    <Text style={styles.appName}>Créer un compte</Text>
                    <Text style={styles.tagline}>Rejoignez FieldCorrect</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <Input
                        label="Nom complet"
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Jean Dupont"
                    />
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
                    <Input
                        label="Confirmer le mot de passe"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
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
                        title="S'inscrire"
                        onPress={handleRegister}
                        loading={registering}
                        icon="account-check"
                        style={{ marginTop: spacing.md }}
                    />

                    <TouchableOpacity
                        onPress={() => nav.goBack()}
                        style={styles.linkRow}
                    >
                        <Text style={styles.linkText}>
                            Déjà un compte ?{' '}
                            <Text style={styles.linkBold}>Se connecter</Text>
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
        backgroundColor: colors.success,
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
