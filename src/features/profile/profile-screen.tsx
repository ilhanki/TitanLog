import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { theme } from '@/theme/tokens';

export function ProfileScreen() {
  const router = useRouter();

  return (
    <Screen>
      <AppText accessibilityRole="header" variant="title">
        {appStrings.profile.title}
      </AppText>
      <AppCard style={styles.card} tone="raised">
        <View style={styles.iconContainer}>
          <AppIcon
            color={theme.colors.primary}
            name="account-circle-outline"
            size={theme.iconSizes.hero}
          />
        </View>
        <AppText style={styles.centeredText} variant="heading">
          {appStrings.profile.emptyTitle}
        </AppText>
        <AppText selectable style={styles.centeredText} tone="muted">
          {appStrings.profile.description}
        </AppText>
        <View style={styles.actions}>
          <AppButton
            label={appStrings.auth.signUp}
            onPress={() => router.push('/auth/sign-up')}
            style={styles.action}
          />
          <AppButton
            label={appStrings.auth.signIn}
            onPress={() => router.push('/auth/sign-in')}
            style={styles.action}
            variant="secondary"
          />
        </View>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.xxxl,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  centeredText: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    width: '100%',
  },
  action: {
    flexBasis: 150,
    flexGrow: 1,
  },
});
