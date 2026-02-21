// =====================================================
//  FieldCorrect Mobile — Theme & Design Tokens
// =====================================================

export const colors = {
  // Primary palette
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#93C5FD',

  // Semantic
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#0EA5E9',

  // Neutral
  white: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  disabled: '#CBD5E1',

  // Status colors (feature status)
  statusDraft: '#94A3B8',
  statusPending: '#F59E0B',
  statusLocked: '#EF4444',
  statusCorrected: '#8B5CF6',
  statusValidated: '#16A34A',
  statusRejected: '#DC2626',

  // Map
  mapBackground: '#E8E8E8',
  gpsAccuracy: 'rgba(37, 99, 235, 0.15)',
  selectionHighlight: '#FBBF24',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyBold: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  captionBold: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

export const statusColorMap: Record<string, string> = {
  draft: colors.statusDraft,
  pending: colors.statusPending,
  locked: colors.statusLocked,
  corrected: colors.statusCorrected,
  validated: colors.statusValidated,
  rejected: colors.statusRejected,
};
