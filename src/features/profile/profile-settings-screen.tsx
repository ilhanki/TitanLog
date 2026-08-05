import { useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import {
  createProfilePreferencesRepository,
  type WeightUnit,
} from '@/features/profile/profile-preferences';
import type { WorkoutEffortMode } from '@/features/workouts/domain/models';
import { navigateBackOrReplace } from '@/navigation/safe-navigation';
import { theme } from '@/theme/tokens';

const unitOptions = [
  { label: 'Kilogram', value: 'kg' },
  { label: 'Pound', value: 'lb' },
] as const;
const effortOptions = [
  { label: 'Kapalı', value: 'off' },
  { label: 'RPE', value: 'rpe' },
  { label: 'RIR', value: 'rir' },
] as const;

export function ProfileSettingsScreen() {
  const router = useRouter();
  const database = useSQLiteContext();
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [notice, setNotice] = useState<string | null>(null);
  const [effortMode, setEffortMode] = useState<WorkoutEffortMode>('off');
  const [globalRestSeconds, setGlobalRestSeconds] = useState(90);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(true);
  useEffect(() => {
    void createProfilePreferencesRepository(database)
      .get()
      .then((value) => {
        setUnit(value.weightUnit);
        setEffortMode(value.workoutEffortMode);
        setGlobalRestSeconds(value.globalRestSeconds);
        setHapticsEnabled(value.workoutHapticsEnabled);
        setKeepAwakeEnabled(value.workoutKeepAwakeEnabled);
      });
  }, [database]);
  const changeUnit = (next: WeightUnit) => {
    setUnit(next);
    void createProfilePreferencesRepository(database)
      .saveWeightUnit(next)
      .then(() => setNotice(`Ağırlık birimi ${next} olarak ayarlandı.`));
  };
  const saveWorkoutPreferences = (next: {
    effortMode?: WorkoutEffortMode;
    globalRestSeconds?: number;
    hapticsEnabled?: boolean;
    keepAwakeEnabled?: boolean;
  }) => {
    const values = {
      effortMode: next.effortMode ?? effortMode,
      globalRestSeconds: next.globalRestSeconds ?? globalRestSeconds,
      hapticsEnabled: next.hapticsEnabled ?? hapticsEnabled,
      keepAwakeEnabled: next.keepAwakeEnabled ?? keepAwakeEnabled,
    };
    setEffortMode(values.effortMode);
    setGlobalRestSeconds(values.globalRestSeconds);
    setHapticsEnabled(values.hapticsEnabled);
    setKeepAwakeEnabled(values.keepAwakeEnabled);
    void createProfilePreferencesRepository(database)
      .saveWorkoutPreferences(values)
      .then(() => setNotice('Antrenman tercihleri kaydedildi.'));
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
        <AppText variant="heading">Antrenman Deneyimi</AppText>
        <AppText tone="muted">
          Dinlenme, efor ve cihaz geri bildirimlerini isteğine göre ayarla.
        </AppText>
        <AppText variant="bodyStrong">Efor takibi</AppText>
        <SegmentedControl
          accessibilityLabel="Efor takip modu"
          onChange={(value) =>
            saveWorkoutPreferences({ effortMode: value as WorkoutEffortMode })
          }
          options={effortOptions}
          value={effortMode}
        />
        <AppText variant="bodyStrong">Varsayılan dinlenme</AppText>
        <View style={styles.restOptions}>
          {[60, 90, 120, 180].map((seconds) => (
            <AppButton
              key={seconds}
              label={`${seconds} sn`}
              onPress={() =>
                saveWorkoutPreferences({ globalRestSeconds: seconds })
              }
              style={styles.restOption}
              variant={globalRestSeconds === seconds ? 'primary' : 'secondary'}
            />
          ))}
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <AppText variant="bodyStrong">Antrenman haptikleri</AppText>
            <AppText tone="muted" variant="caption">
              Set, zamanlayıcı ve bitirişlerde kısa cihaz geri bildirimi.
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Antrenman haptiklerini etkinleştir"
            onValueChange={(value) =>
              saveWorkoutPreferences({ hapticsEnabled: value })
            }
            value={hapticsEnabled}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <AppText variant="bodyStrong">Ekranı açık tut</AppText>
            <AppText tone="muted" variant="caption">
              Yalnızca aktif antrenman ekranındayken çalışır ve pil tüketimini
              artırabilir.
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Aktif antrenmanda ekranı açık tut"
            onValueChange={(value) =>
              saveWorkoutPreferences({ keepAwakeEnabled: value })
            }
            value={keepAwakeEnabled}
          />
        </View>
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
  restOption: { flex: 1 },
  restOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  switchCopy: { flex: 1, gap: theme.spacing.xs },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
});
