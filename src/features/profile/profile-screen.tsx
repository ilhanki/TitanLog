import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { useAuth } from '@/features/auth/auth-provider';
import {
  createDatasetOwnershipRepository,
  type DatasetOwnership,
} from '@/features/data-safety/dataset-ownership-repository';
import { theme } from '@/theme/tokens';

export function ProfileScreen() {
  const router = useRouter();
  const database = useSQLiteContext();
  const { configured, initializing, user } = useAuth();
  const [ownership, setOwnership] = useState<DatasetOwnership | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void createDatasetOwnershipRepository(database)
        .getOwnership()
        .then((value) => {
          if (active) setOwnership(value);
        });
      return () => {
        active = false;
      };
    }, [database])
  );

  const accountStatus = initializing
    ? 'Hesap durumu yükleniyor…'
    : user
      ? (user.email ?? 'TitanLog hesabı')
      : 'Misafir olarak kullanılıyor';

  return (
    <Screen>
      <AppText accessibilityRole="header" variant="title">
        Profil
      </AppText>
      <AppCard style={styles.card} tone="raised">
        <View style={styles.headingRow}>
          <View style={styles.iconContainer}>
            <AppIcon
              color={theme.colors.primary}
              name="account-outline"
              size={theme.iconSizes.lg}
            />
          </View>
          <View style={styles.copy}>
            <AppText variant="heading">Hesap</AppText>
            <AppText selectable tone="muted">
              {accountStatus}
            </AppText>
          </View>
        </View>
        {user ? (
          <AppText
            selectable
            tone={user.email_confirmed_at ? 'success' : 'muted'}
          >
            {user.email_confirmed_at
              ? 'E-posta doğrulandı'
              : 'E-posta doğrulaması bekleniyor'}
          </AppText>
        ) : (
          <View style={styles.actions}>
            <AppButton
              label="Hesap Oluştur"
              onPress={() => router.push('/auth/sign-up')}
              style={styles.action}
            />
            <AppButton
              label="Giriş Yap"
              onPress={() => router.push('/auth/sign-in')}
              style={styles.action}
              variant="secondary"
            />
          </View>
        )}
        {!configured ? (
          <AppText selectable tone="muted" variant="caption">
            Uzak hesap hizmeti yapılandırılmadı. Misafir kullanımı ve yerel
            yedekleme kullanılabilir.
          </AppText>
        ) : null}
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.headingRow}>
          <AppIcon color={theme.colors.primary} name="database-lock-outline" />
          <View style={styles.copy}>
            <AppText variant="heading">Hesap ve Veriler</AppText>
            <AppText selectable tone="muted">
              Yerel yedeklerini, veri sahipliğini ve isteğe bağlı özel bulut
              yedeğini yönet.
            </AppText>
          </View>
        </View>
        <AppText selectable tone="subtle" variant="caption">
          Veri sahibi:{' '}
          {ownership?.ownerAccountId
            ? 'Bir hesaba bağlı'
            : 'Misafir veri kümesi'}
        </AppText>
        <AppButton
          label="Hesap ve Verileri Yönet"
          onPress={() => router.push('/profile/data' as Href)}
        />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { flexBasis: 140, flexGrow: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  card: { gap: theme.spacing.lg },
  copy: { flex: 1, gap: theme.spacing.xs },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});
