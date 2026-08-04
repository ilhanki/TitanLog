import { useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import {
  createProfilePreferencesRepository,
  type WeightUnit,
} from '@/features/profile/profile-preferences';
import { navigateBackOrReplace } from '@/navigation/safe-navigation';
import { theme } from '@/theme/tokens';

const unitOptions = [
  { label: 'Kilogram', value: 'kg' },
  { label: 'Pound', value: 'lb' },
] as const;

export function ProfileSettingsScreen() {
  const router = useRouter();
  const database = useSQLiteContext();
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    void createProfilePreferencesRepository(database)
      .get()
      .then((value) => setUnit(value.weightUnit));
  }, [database]);
  const changeUnit = (next: WeightUnit) => {
    setUnit(next);
    void createProfilePreferencesRepository(database)
      .saveWeightUnit(next)
      .then(() => setNotice(`Ağırlık birimi ${next} olarak ayarlandı.`));
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppButton
          icon="arrow-left"
          label="Geri dön"
          onPress={() => navigateBackOrReplace(router, '/(tabs)/profile')}
          variant="ghost"
        />
        <AppText accessibilityRole="header" variant="title">
          Ayarlar
        </AppText>
      </View>
      <AppCard style={styles.section} tone="raised">
        <AppText variant="heading">Birim ve Hedefler</AppText>
        <AppText tone="muted">
          Veriler veritabanında kilogram olarak korunur; seçimin yalnızca
          gösterimi değiştirir.
        </AppText>
        <SegmentedControl
          accessibilityLabel="Ağırlık birimi"
          onChange={changeUnit}
          options={unitOptions}
          value={unit}
        />
        <AppButton
          label="Haftalık Hedefleri Düzenle"
          onPress={() => router.push('/profile/edit' as Href)}
          variant="secondary"
        />
      </AppCard>
      <AppCard style={styles.section}>
        <AppText variant="heading">Görünüm ve Bildirimler</AppText>
        <AppText tone="muted">
          Titan Iron koyu görünümü tüm uygulamada tutarlı biçimde kullanılır.
        </AppText>
        <AppText tone="muted">
          Sprint 13 bildirim izni istemez ve arka planda bildirim göndermez.
        </AppText>
      </AppCard>
      <AppCard style={styles.section}>
        <AppText variant="heading">Gizlilik</AppText>
        <AppText tone="muted">
          Misafir profilin yalnızca cihazında kalır. Hesaplı kullanımda
          fotoğrafın özel depoda, kullanıcı kimliğinle ayrılmış bir yolda
          tutulur; herkese açık bağlantı oluşturulmaz.
        </AppText>
        <AppButton
          label="Veri Merkezini Aç"
          onPress={() => router.push('/profile/data' as Href)}
          variant="secondary"
        />
      </AppCard>
      {notice ? (
        <AppText accessibilityLiveRegion="polite" tone="success">
          {notice}
        </AppText>
      ) : null}
      <AppButton
        label="Hesap ve Tehlikeli İşlemler"
        onPress={() => router.push('/profile/danger' as Href)}
        variant="danger"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md },
  section: { gap: theme.spacing.lg },
});
