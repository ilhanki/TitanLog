import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { theme } from '@/theme/tokens';

export function MotivationBanner() {
  return (
    <LinearGradient
      colors={[theme.colors.primarySoft, theme.colors.backgroundElevated]}
      end={{ x: 1, y: 0 }}
      start={{ x: 0, y: 1 }}
      style={styles.banner}
    >
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    borderColor: theme.colors.borderStrong,
    borderCurve: 'continuous',
    borderRadius: theme.radii.lg,
    borderWidth: theme.borders.thin,
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
