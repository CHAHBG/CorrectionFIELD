// =====================================================
//  FieldCorrect Mobile — Shared UI Components
// =====================================================

import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, radius, typography, shadow, statusColorMap } from '../theme';

/* ───── Button ───── */

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: ButtonProps) {
  const bg =
    variant === 'primary' ? colors.primary
    : variant === 'danger' ? colors.error
    : variant === 'secondary' ? colors.white
    : 'transparent';

  const fg =
    variant === 'primary' || variant === 'danger' ? colors.white : colors.primary;

  const borderColor = variant === 'secondary' ? colors.border : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        btnStyles.base,
        { backgroundColor: bg, borderColor },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={fg} style={{ marginRight: 6 }} />}
          <Text style={[btnStyles.label, { color: fg }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  label: {
    ...typography.bodyBold,
  },
});

/* ───── FloatingActionButton ───── */

interface FabProps {
  icon: string;
  onPress: () => void;
  color?: string;
  size?: number;
  style?: ViewStyle;
}

export function FAB({ icon, onPress, color = colors.primary, size = 56, style }: FabProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.lg,
        },
        style,
      ]}
    >
      <Icon name={icon} size={size * 0.45} color={colors.white} />
    </TouchableOpacity>
  );
}

/* ───── Card ───── */

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={[cardStyles.card, style]}
    >
      {children}
    </Wrapper>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
});

/* ───── StatusBadge ───── */

export function StatusBadge({ status, label, color }: { status?: string; label?: string; color?: string }) {
  const bg = color ?? (status ? statusColorMap[status] ?? colors.textMuted : colors.textMuted);
  const displayText = label ?? status ?? '';
  return (
    <View style={[badgeStyles.badge, { backgroundColor: bg }]}>
      <Text style={badgeStyles.text}>{displayText.toUpperCase()}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

/* ───── Input ───── */

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  error?: string;
  style?: ViewStyle;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  error,
  style,
}: InputProps) {
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label && <Text style={inputStyles.label}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        style={[
          inputStyles.input,
          multiline && { minHeight: 80, textAlignVertical: 'top' },
          error ? { borderColor: colors.error } : {},
        ]}
      />
      {error && <Text style={inputStyles.error}>{error}</Text>}
    </View>
  );
}

const inputStyles = StyleSheet.create({
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: 2,
  },
});

/* ───── Empty State ───── */

export interface EmptyStateProps {
  icon: string;
  title: string;
  message?: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, message, subtitle }: EmptyStateProps) {
  const msg = message ?? subtitle;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl }}>
      <Icon name={icon} size={56} color={colors.textMuted} />
      <Text style={[typography.h3, { color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }]}>{title}</Text>
      {msg && (
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
          {msg}
        </Text>
      )}
    </View>
  );
}

/* ───── Spinner ───── */

export function Spinner({ size = 'large' }: { size?: 'small' | 'large' }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size={size} color={colors.primary} />
    </View>
  );
}

/* ───── Divider ───── */

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />;
}

/* ───── Toolbar Button ───── */

interface ToolbarBtnProps {
  icon: string;
  label?: string;
  active?: boolean;
  onPress: () => void;
}

export function ToolbarBtn({ icon, label, active, onPress }: ToolbarBtnProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        backgroundColor: active ? colors.primaryLight : 'transparent',
        borderRadius: radius.md,
        minWidth: 48,
      }}
    >
      <Icon name={icon} size={22} color={active ? colors.primaryDark : colors.textSecondary} />
      {label && (
        <Text style={[typography.caption, { color: active ? colors.primaryDark : colors.textSecondary, marginTop: 2 }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
