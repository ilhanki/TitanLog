import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { theme } from '@/theme/tokens';

type AuthEntryCardProps = {
  compact: boolean;
};

export function AuthEntryCard({ compact }: AuthEntryCardProps) {
  const router = useRouter();

  return (
    <AppCard style={styles.card}>
      <AppText selectable tone="muted">
        {appStrings.home.authPrompt}
      </AppText>
      <View style={[styles.actions, compact && styles.compactActions]}>
        <AppButton
          label={appStrings.auth.signIn}
          onPress={() => router.push('/auth/sign-in')}
          style={styles.action}
          variant="secondary"
        />
        <AppButton
          label={appStrings.auth.signUp}
          onPress={() => router.push('/auth/sign-up')}
          style={styles.action}
        />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  compactActions: {
    flexDirection: 'column',
  },
  action: {
    flex: 1,
  },
});
