import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { theme } from '@/theme/tokens';

type AuthScreenHeaderProps = {
  description: string;
  title: string;
};

export function AuthScreenHeader({
  description,
  title,
}: AuthScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={appStrings.common.goBack}
        accessibilityRole="button"
        hitSlop={theme.spacing.sm}
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.backButtonPressed,
        ]}
      >
        <AppIcon color={theme.colors.text} name="arrow-left" />
      </Pressable>
      <View style={styles.copy}>
        <AppText variant="brand">{appStrings.brandName}</AppText>
        <AppText accessibilityRole="header" variant="display">
          {title}
        </AppText>
        <AppText selectable tone="muted">
          {description}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceInteractive,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    height: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    width: theme.layout.compactTouchTarget,
  },
  backButtonPressed: {
    backgroundColor: theme.colors.primarySoft,
  },
  copy: {
    gap: theme.spacing.md,
  },
});
