import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

type AppHeaderProps = {
  actionIcon?: AppIconName;
  actionLabel?: string;
  brand: string;
  onActionPress?: () => void;
};

export function AppHeader({
  actionIcon,
  actionLabel,
  brand,
  onActionPress,
}: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.brandContainer}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={styles.brandMark}
        />
        <AppText variant="brand">{brand}</AppText>
      </View>
      {actionIcon && actionLabel && onActionPress ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={theme.spacing.sm}
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
        >
          <AppIcon color={theme.colors.text} name={actionIcon} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: theme.layout.touchTarget,
  },
  brandContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  brandMark: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.md,
    height: theme.iconSizes.md,
    width: theme.spacing.xs,
  },
  action: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceInteractive,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.thin,
    height: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    width: theme.layout.compactTouchTarget,
  },
  actionPressed: {
    backgroundColor: theme.colors.primarySoft,
  },
});
