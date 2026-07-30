import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { WeightSelectorField } from '@/components/weight-selector-field';
import { appStrings } from '@/constants/strings';
import { createBodyMeasurementRepository } from '@/features/body/data/body-measurement-repository';
import {
  BodyProfileError,
  createBodyProfileRepository,
} from '@/features/body/data/body-profile-repository';
import {
  formatBodyValue,
  parseBodyWeight,
} from '@/features/body/utils/body-values';
import { useUnsavedChangesGuard } from '@/features/workouts/hooks/use-unsaved-changes-guard';
import { theme } from '@/theme/tokens';

export function BodySettingsScreen() {
  const database = useSQLiteContext();
  const router = useRouter();
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [startingWeight, setStartingWeight] = useState<number | null>(null);
  const [originalTarget, setOriginalTarget] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const dirty = targetWeight !== originalTarget;
  const allowNavigation = useUnsavedChangesGuard(dirty);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      void Promise.all([
        createBodyProfileRepository(database).getProfile(),
        createBodyMeasurementRepository(database).getLatestMeasurement(),
      ])
        .then(([profile, latest]) => {
          if (!active || !profile) return;
          const current = latest?.weightKg ?? profile.startingWeightKg;
          const target = formatBodyValue(profile.targetWeightKg);
          setCurrentWeight(current);
          setStartingWeight(profile.startingWeightKg);
          setOriginalTarget(target);
          setTargetWeight(target);
        })
        .catch(() => {
          if (active) setError(appStrings.progress.loadError);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [database])
  );

  const save = async () => {
    if (pendingRef.current || currentWeight === null || startingWeight === null)
      return;
    const target = parseBodyWeight(targetWeight);
    if (target === null) {
      setError(appStrings.progress.invalidWeight);
      return;
    }
    if (target === startingWeight) {
      setError(appStrings.progress.equalGoal);
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await createBodyProfileRepository(database).updateTargetWeight(target);
      allowNavigation();
      Keyboard.dismiss();
      router.replace('/progress');
    } catch (caught) {
      setError(
        caught instanceof BodyProfileError && caught.code === 'invalid_goal'
          ? appStrings.progress.equalGoal
          : appStrings.progress.saveError
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          description={appStrings.progress.loading}
          icon="target"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  if (currentWeight === null || startingWeight === null) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          description={
            error ??
            'Hedef düzenlemek için önce vücut profilini oluşturmalısın.'
          }
          icon="alert-circle-outline"
          title="Hedef bilgisi bulunamadı"
        />
        <AppButton label="Kapat" onPress={() => router.back()} />
      </Screen>
    );
  }

  const parsedTarget = parseBodyWeight(targetWeight);
  const remaining =
    parsedTarget === null ? null : Math.abs(parsedTarget - currentWeight);

  return (
    <Screen edges={['top', 'bottom']} keyboardAware>
      <AppText accessibilityRole="header" variant="title">
        Hedefi Düzenle
      </AppText>
      <AppCard style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.copy}>
            <AppText tone="muted" variant="caption">
              Güncel Kilo
            </AppText>
            <AppText
              accessibilityLabel={`Güncel kilo, salt okunur, ${formatBodyValue(currentWeight)} kilogram`}
              accessible
              selectable
              style={styles.number}
              variant="heading"
            >
              {formatBodyValue(currentWeight)} kg
            </AppText>
          </View>
          <View style={[styles.copy, styles.end]}>
            <AppText tone="muted" variant="caption">
              Hedefe Uzaklık
            </AppText>
            <AppText selectable style={styles.number} variant="bodyStrong">
              {remaining === null ? '—' : `${formatBodyValue(remaining)} kg`}
            </AppText>
          </View>
        </View>
        <AppText tone="subtle" variant="caption">
          Güncel kilo son ölçümden gelir ve bu ekranda değiştirilemez.
        </AppText>
      </AppCard>
      <WeightSelectorField
        editable={!pending}
        error={error ?? undefined}
        fallbackValue={parseBodyWeight(originalTarget) ?? undefined}
        kind="body"
        label="Hedef Kilo"
        onChangeText={setTargetWeight}
        title="Hedef Kilonu Seç"
        value={targetWeight}
      />
      <View style={styles.actions}>
        <AppButton
          disabled={pending}
          label="Kapat"
          onPress={() => router.back()}
          style={styles.action}
          variant="ghost"
        />
        <AppButton
          disabled={pending}
          label={pending ? 'Kaydediliyor…' : 'Kaydet'}
          onPress={() => void save()}
          style={styles.action}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1 },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  copy: { flex: 1, gap: theme.spacing.xs },
  end: { alignItems: 'flex-end' },
  number: { fontVariant: ['tabular-nums'] },
  summary: { gap: theme.spacing.md },
  summaryRow: { flexDirection: 'row', gap: theme.spacing.md },
});
