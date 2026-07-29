import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { theme } from '@/theme/tokens';

export function MotivationBanner() {
  return (
    <View style={styles.banner}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.emblem}
      >
        <AppIcon
          color={theme.colors.accent}
          name="shield-crown-outline"
          size={theme.iconSizes.xl}
        />
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{appStrings.home.motivationTitle}</AppText>
        <AppText selectable tone="muted" variant="caption">
          {appStrings.home.motivationDescription}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    borderColor: theme.colors.borderStrong,
    borderCurve: 'continuous',
    borderRadius: theme.radii.lg,
    borderWidth: theme.borders.thin,
    backgroundColor: theme.colors.surfaceMuted,
    flexDirection: 'row',
    gap: theme.spacing.lg,
    padding: theme.spacing.xl,
  },
  emblem: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceInteractive,
    borderRadius: theme.radii.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
});
