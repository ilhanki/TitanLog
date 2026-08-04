import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { ProfileAvatar } from '@/components/profile-avatar';
import { Screen } from '@/components/screen';
import { useAuth } from '@/features/auth/auth-provider';
import { getSupabaseClient } from '@/features/auth/supabase-client';
import {
  commitLocalProfilePhoto,
  pickAndStoreProfilePhoto,
  ProfileMediaError,
  removeLocalProfilePhoto,
  removePrivateProfilePhoto,
  uploadPrivateProfilePhoto,
} from '@/features/profile/profile-media-service';
import {
  createProfilePreferencesRepository,
  PROFILE_FALLBACK_NAME,
  validateDisplayName,
} from '@/features/profile/profile-preferences';
import { navigateBackOrReplace } from '@/navigation/safe-navigation';
import { theme } from '@/theme/tokens';

function mediaError(error: unknown): string {
  if (error instanceof ProfileMediaError) {
    if (error.code === 'permission')
      return 'Fotoğraf seçmek için galeri izni vermelisin.';
    if (error.code === 'too_large')
      return 'Fotoğraf çok büyük. En fazla 8 MB bir görsel seç.';
    if (error.code === 'upload')
      return 'Fotoğraf özel alana yüklenemedi. Taslağın korunuyor; tekrar deneyebilirsin.';
  }
  return 'Fotoğraf hazırlanamadı. Başka bir görselle tekrar dene.';
}

export function ProfileEditScreen() {
  const router = useRouter();
  const database = useSQLiteContext();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [savedAvatarUri, setSavedAvatarUri] = useState<string | null>(null);
  const [workoutGoal, setWorkoutGoal] = useState('');
  const [dayGoal, setDayGoal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void createProfilePreferencesRepository(database)
      .get()
      .then((profile) => {
        if (!active) return;
        const remoteName =
          typeof user?.user_metadata.display_name === 'string'
            ? user.user_metadata.display_name
            : null;
        setName(profile.displayName ?? remoteName ?? '');
        setAvatarUri(profile.avatarUri);
        setSavedAvatarUri(profile.avatarUri);
        setWorkoutGoal(profile.weeklyWorkoutTarget?.toString() ?? '');
        setDayGoal(profile.weeklyActiveDayTarget?.toString() ?? '');
      });
    return () => {
      active = false;
    };
  }, [database, user]);

  const selectPhoto = async () => {
    setError(null);
    try {
      const uri = await pickAndStoreProfilePhoto();
      if (uri) setAvatarUri(uri);
    } catch (nextError) {
      setError(mediaError(nextError));
    }
  };

  const save = async () => {
    if (pendingRef.current) return;
    const validation = validateDisplayName(name);
    if (!validation.valid) {
      setError(
        validation.code === 'too_long'
          ? 'Görünen ad en fazla 40 karakter olabilir.'
          : 'Görünen ad en az 2 karakter olmalı.'
      );
      return;
    }
    const workout = workoutGoal ? Number(workoutGoal) : null;
    const days = dayGoal ? Number(dayGoal) : null;
    if (
      (workout !== null &&
        (!Number.isSafeInteger(workout) || workout < 1 || workout > 14)) ||
      (days !== null && (!Number.isSafeInteger(days) || days < 1 || days > 7))
    ) {
      setError('Haftalık hedefler geçerli aralıkta olmalı.');
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const repository = createProfilePreferencesRepository(database);
      const photoChanged = avatarUri !== savedAvatarUri;
      if (user) {
        const client = getSupabaseClient();
        const { error: metadataError } = await client!.auth.updateUser({
          data: { display_name: validation.name },
        });
        if (metadataError) throw new ProfileMediaError('upload');
        if (photoChanged && avatarUri)
          await uploadPrivateProfilePhoto(user.id, avatarUri);
        if (photoChanged && !avatarUri)
          await removePrivateProfilePhoto(user.id);
      }
      await repository.saveDisplayName(validation.name);
      await repository.saveWeeklyGoals(workout, days);
      if (photoChanged) {
        if (!avatarUri) {
          removeLocalProfilePhoto(savedAvatarUri);
          await repository.saveAvatarUri(null);
        } else {
          const committedUri = commitLocalProfilePhoto(avatarUri);
          await repository.saveAvatarUri(committedUri);
        }
      }
      navigateBackOrReplace(router, '/(tabs)/profile');
    } catch (nextError) {
      setError(mediaError(nextError));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const displayName = validateDisplayName(name).valid
    ? name
    : PROFILE_FALLBACK_NAME;
  return (
    <Screen edges={['top', 'bottom']} keyboardAware>
      <View style={styles.header}>
        <AppButton
          icon="arrow-left"
          label="Geri dön"
          onPress={() => navigateBackOrReplace(router, '/(tabs)/profile')}
          variant="ghost"
        />
        <AppText accessibilityRole="header" variant="title">
          Profili Düzenle
        </AppText>
      </View>
      <AppCard style={styles.photo} tone="raised">
        <Pressable
          accessibilityHint="Galeriden yeni bir fotoğraf seçer"
          accessibilityLabel="Profil fotoğrafı seç"
          accessibilityRole="button"
          onPress={() => void selectPhoto()}
        >
          <ProfileAvatar name={displayName} size={96} uri={avatarUri} />
        </Pressable>
        <View style={styles.photoActions}>
          <AppButton
            label="Fotoğraf Seç"
            onPress={() => void selectPhoto()}
            style={styles.action}
            variant="secondary"
          />
          <AppButton
            disabled={!avatarUri}
            label="Fotoğrafı Kaldır"
            onPress={() => setAvatarUri(null)}
            style={styles.action}
            variant="ghost"
          />
        </View>
        <AppText tone="muted" variant="caption">
          Kare kırpılır, 512 piksele küçültülür. Hesaplı kullanımda yalnızca
          özel kullanıcı alanına yüklenir.
        </AppText>
      </AppCard>
      <AppCard style={styles.form}>
        <AppTextInput
          autoCapitalize="words"
          label="Görünen ad"
          maxLength={40}
          onChangeText={setName}
          value={name}
        />
        <View style={styles.row}>
          <AppTextInput
            keyboardType="number-pad"
            label="Haftalık antrenman hedefi"
            onChangeText={setWorkoutGoal}
            style={styles.input}
            value={workoutGoal}
          />
          <AppTextInput
            keyboardType="number-pad"
            label="Haftalık aktif gün hedefi"
            onChangeText={setDayGoal}
            style={styles.input}
            value={dayGoal}
          />
        </View>
        {error ? (
          <AppText
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            tone="danger"
          >
            {error}
          </AppText>
        ) : null}
        <AppButton
          disabled={pending}
          label={pending ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
          onPress={() => void save()}
        />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { flexGrow: 1 },
  form: { gap: theme.spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md },
  input: { minWidth: 110 },
  photo: { alignItems: 'center', gap: theme.spacing.lg },
  photoActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
});
