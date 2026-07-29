import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppIcon, type AppIconName } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

type StatCardProps = {
  icon: AppIconName;
  label: string;
  style?: StyleProp<ViewStyle>;
  value: string;
};

export function StatCard({ icon, label, style, value }: StatCardProps) {
  return (
    <AppCard style={[styles.card, style]}>
      <View style={styles.iconContainer}>
        <AppIcon color={theme.colors.accent} name={icon} />
      </View>
      <View style={styles.copy}>
        <AppText selectable tone="muted" variant="caption">
          {label}
        </AppText>
        <AppText selectable variant="metric">
          {value}
        </AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    minHeight: 88,
  },
  copy: { flex: 1, gap: theme.spacing.xs },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
