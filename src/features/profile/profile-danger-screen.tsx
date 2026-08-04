import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { requestAccountDeletion, signOut } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { createProfilePreferencesRepository } from '@/features/profile/profile-preferences';
import {
  removeLocalProfilePhoto,
  removePrivateProfilePhoto,
} from '@/features/profile/profile-media-service';
import { theme } from '@/theme/tokens';

export function ProfileDangerScreen() {
  const router = useRouter();
  const database = useSQLiteContext();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const removePhoto = async () => {
    setPending(true);
    try {
      const repository = createProfilePreferencesRepository(database);
      const profile = await repository.get();
      if (user) await removePrivateProfilePhoto(user.id);
      removeLocalProfilePhoto(profile.avatarUri);
      await repository.saveAvatarUri(null);
      setNotice('Profil fotoğrafı kaldırıldı.');
    } catch {
      setNotice('Profil fotoğrafı kaldırılamadı; mevcut fotoğrafın korundu.');
    } finally {
      setPending(false);
    }
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppButton
          icon="arrow-left"
          label="Geri dön"
          onPress={() => router.back()}
          variant="ghost"
        />
        <AppText accessibilityRole="header" variant="title">
          Hesap İşlemleri
        </AppText>
      </View>
      <AppCard style={styles.section}>
        <AppText variant="heading">Profil Fotoğrafı</AppText>
        <AppText tone="muted">
          Fotoğrafı bu cihazdan ve giriş yaptıysan özel profil alanından
          kaldırır. Fitness verilerine dokunmaz.
        </AppText>
        <AppButton
          disabled={pending}
          label="Profil Fotoğrafını Kaldır"
          onPress={() =>
            Alert.alert(
              'Profil fotoğrafı kaldırılsın mı?',
              'Bu işlem fitness verilerini silmez.',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Kaldır',
                  style: 'destructive',
                  onPress: () => void removePhoto(),
                },
              ]
            )
          }
          variant="danger"
        />
      </AppCard>
      {user ? (
        <AppCard style={styles.section}>
          <AppText variant="heading">Oturum</AppText>
          <AppText tone="muted">
            Çıkış yapmak bu cihazdaki antrenman, ölçüm ve profil tercihlerini
            silmez.
          </AppText>
          <AppButton
            disabled={pending}
            label="Çıkış Yap"
            onPress={() => void signOut()}
            variant="secondary"
          />
        </AppCard>
      ) : null}
      {user ? (
        <AppCard style={styles.section} tone="accent">
          <AppText variant="heading">Hesabı Kalıcı Olarak Sil</AppText>
          <AppText tone="danger">
            Uzak hesap, özel yedekler, eşitleme kayıtları ve profil medyası
            silinir. Yerel fitness verileri ayrıca onay vermediğin sürece
            korunur.
          </AppText>
          <AppButton
            disabled={pending}
            label="Hesabımı Sil"
            onPress={() =>
              Alert.alert(
                'Hesap kalıcı olarak silinsin mi?',
                'Bu uzak işlem geri alınamaz ve yakın tarihli oturum doğrulaması gerektirebilir.',
                [
                  { text: 'Vazgeç', style: 'cancel' },
                  {
                    text: 'Hesabımı Sil',
                    style: 'destructive',
                    onPress: () =>
                      void requestAccountDeletion().catch(() =>
                        setNotice(
                          'Hesap silme tamamlanamadı. Verilerin değiştirilmedi.'
                        )
                      ),
                  },
                ],
                { cancelable: false }
              )
            }
            variant="danger"
          />
        </AppCard>
      ) : (
        <AppText tone="muted">
          Misafir kullanımında silinecek uzak hesap yok.
        </AppText>
      )}
      {notice ? (
        <AppText accessibilityLiveRegion="polite">{notice}</AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md },
  section: { gap: theme.spacing.lg },
});
