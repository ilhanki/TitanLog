import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppIcon, type AppIconName } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

type EmptyStateProps = {
  description: string;
  icon: AppIconName;
  title: string;
};

export function EmptyState({ description, icon, title }: EmptyStateProps) {
  return (
    <AppCard style={styles.card} tone="raised">
      <View style={styles.iconContainer}>
        <AppIcon
          color={theme.colors.primary}
          name={icon}
          size={theme.iconSizes.md}
        />
      </View>
      <AppText
        accessibilityRole="header"
        style={styles.centeredText}
        variant="heading"
      >
        {title}
      </AppText>
      <AppText selectable style={styles.centeredText} tone="muted">
        {description}
      </AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xxl,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.md,
    height: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    width: theme.layout.compactTouchTarget,
  },
  centeredText: {
    textAlign: 'center',
  },
});
