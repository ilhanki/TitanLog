import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { ProfileAvatar } from '@/components/profile-avatar';
import { Screen } from '@/components/screen';
import { useAuth } from '@/features/auth/auth-provider';
import {
  createDatasetOwnershipRepository,
  type DatasetOwnership,
} from '@/features/data-safety/dataset-ownership-repository';
import { ProfileInsights } from '@/features/insights/profile-insights';
import { downloadPrivateProfilePhoto } from '@/features/profile/profile-media-service';
import {
  createProfilePreferencesRepository,
  PROFILE_FALLBACK_NAME,
  type ProfilePreferences,
} from '@/features/profile/profile-preferences';
import { theme } from '@/theme/tokens';

const defaults: ProfilePreferences = {
  avatarUri: null,
  displayName: null,
  weeklyActiveDayTarget: null,
  weeklyWorkoutTarget: null,
  weightUnit: 'kg',
  workoutEffortMode: 'off',
  workoutHapticsEnabled: true,
  workoutKeepAwakeEnabled: true,
  globalRestSeconds: 90,
};

export function ProfileScreen() {
  const router = useRouter();
  const database = useSQLiteContext();
  const { configured, initializing, user } = useAuth();
  const [preferences, setPreferences] = useState(defaults);
  const [ownership, setOwnership] = useState<DatasetOwnership | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const repository = createProfilePreferencesRepository(database);
      void createDatasetOwnershipRepository(database)
        .getOwnership()
        .then((value) => active && setOwnership(value));
      void repository.get().then(async (value) => {
        if (!active) return;
        setPreferences(value);
        const remotePath =
          typeof user?.user_metadata.avatar_path === 'string'
            ? user.user_metadata.avatar_path
            : null;
        if (user && remotePath && !value.avatarUri) {
          try {
            const uri = await downloadPrivateProfilePhoto(user.id, remotePath);
            await repository.saveAvatarUri(uri);
            if (active) setPreferences({ ...value, avatarUri: uri });
          } catch {
            // A missing remote avatar must not block the local profile.
          }
        }
      });
      return () => {
        active = false;
      };
    }, [database, user])
  );

  const remoteName =
    typeof user?.user_metadata.display_name === 'string'
      ? user.user_metadata.display_name
      : null;
  const name = preferences.displayName ?? remoteName ?? PROFILE_FALLBACK_NAME;
  const accountStatus = initializing
    ? 'Hesap durumu yükleniyor…'
    : user
      ? (user.email ?? 'TitanLog hesabı')
      : 'Misafir profili · yalnızca bu cihazda';
  const ownershipStatus = !user
    ? 'Sahipsiz yerel veri'
    : !ownership?.ownerAccountId
      ? 'Sahiplik onayı bekleniyor'
      : ownership.ownerAccountId === user.id
        ? 'Yerel veri bu hesaba ait'
        : 'Hesap uyuşmazlığı';
  const memberSince = user?.created_at
    ? new Intl.DateTimeFormat('tr-TR', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(user.created_at))
    : null;

  return (
    <Screen>
      <AppText accessibilityRole="header" variant="title">
        Profil
      </AppText>
      <AppCard style={styles.identity} tone="raised">
        <Pressable
          accessibilityLabel="Profil fotoğrafını düzenle"
          accessibilityRole="button"
          onPress={() => router.push('/profile/edit' as Href)}
        >
          <ProfileAvatar name={name} size={84} uri={preferences.avatarUri} />
        </Pressable>
        <View style={styles.identityCopy}>
          <AppText variant="heading">{name}</AppText>
          <AppText selectable tone="muted">
            {accountStatus}
          </AppText>
          {user ? (
            <AppText
              tone={user.email_confirmed_at ? 'success' : 'warning'}
              variant="caption"
            >
              {user.email_confirmed_at
                ? 'E-posta doğrulandı'
                : 'E-posta doğrulaması bekleniyor'}
            </AppText>
          ) : null}
          <AppText
            tone={
              ownership?.ownerAccountId &&
              user &&
              ownership.ownerAccountId !== user.id
                ? 'danger'
                : 'information'
            }
            variant="caption"
          >
            {ownershipStatus}
          </AppText>
          {memberSince ? (
            <AppText tone="subtle" variant="caption">
              Üyelik başlangıcı: {memberSince}
            </AppText>
          ) : null}
        </View>
        <AppButton
          icon="pencil-outline"
          label="Profili Düzenle"
          onPress={() => router.push('/profile/edit' as Href)}
          style={styles.fullButton}
          variant="secondary"
        />
      </AppCard>

      {!user ? (
        <AppCard style={styles.card}>
          <View style={styles.headingRow}>
            <AppIcon
              color={theme.colors.primary}
              name="shield-account-outline"
            />
            <View style={styles.copy}>
              <AppText variant="bodyStrong">
                Hesabın olmadan da devam edebilirsin
              </AppText>
              <AppText tone="muted">
                Profil fotoğrafın ve görünen adın bu cihazda özel kalır. Hesap
                açmak bulut yedeği ve cihaz eşitlemeyi etkinleştirir.
              </AppText>
            </View>
          </View>
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
          {!configured ? (
            <AppText tone="muted" variant="caption">
              Uzak hesap hizmeti yapılandırılmadı; yerel kullanım etkilenmez.
            </AppText>
          ) : null}
        </AppCard>
      ) : null}

      <ProfileInsights preferences={preferences} />

      <View style={styles.links}>
        <AppCard style={styles.card}>
          <View style={styles.headingRow}>
            <AppIcon
              color={theme.colors.primary}
              name="database-lock-outline"
            />
            <View style={styles.copy}>
              <AppText variant="heading">Veri ve Yedekleme</AppText>
              <AppText tone="muted">
                Yerel yedek, özel bulut yedeği, cihaz eşitleme ve işlem geçmişi.
              </AppText>
            </View>
          </View>
          <AppButton
            label="Veri Merkezini Aç"
            onPress={() => router.push('/profile/data' as Href)}
          />
        </AppCard>
        <AppCard style={styles.card}>
          <View style={styles.headingRow}>
            <AppIcon color={theme.colors.primary} name="cog-outline" />
            <View style={styles.copy}>
              <AppText variant="heading">Ayarlar</AppText>
              <AppText tone="muted">
                Birim, haftalık hedefler, gizlilik ve hesap işlemleri.
              </AppText>
            </View>
          </View>
          <AppButton
            label="Ayarları Aç"
            onPress={() => router.push('/profile/settings' as Href)}
            variant="secondary"
          />
        </AppCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { flexBasis: 140, flexGrow: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  card: { gap: theme.spacing.lg },
  copy: { flex: 1, gap: theme.spacing.xs },
  fullButton: { alignSelf: 'stretch' },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
  },
  identityCopy: { flex: 1, gap: theme.spacing.xs, minWidth: 180 },
  links: { gap: theme.spacing.lg },
});
