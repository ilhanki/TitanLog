import { StyleSheet, View, type ViewProps } from 'react-native';

import { theme } from '@/theme/tokens';

type AppCardProps = ViewProps & {
  tone?: 'default' | 'raised' | 'accent';
};

export function AppCard({ style, tone = 'default', ...props }: AppCardProps) {
  return <View style={[styles.base, styles[tone], style]} {...props} />;
}

const styles = StyleSheet.create({
  base: {
    borderCurve: 'continuous',
    borderRadius: theme.radii.lg,
    borderWidth: theme.borders.thin,
    padding: theme.spacing.xl,
  },
  default: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  raised: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.borderStrong,
    boxShadow: theme.shadows.card,
  },
  accent: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
    boxShadow: theme.shadows.accent,
  },
});
