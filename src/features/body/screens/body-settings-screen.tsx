import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppIcon } from '@/components/app-icon';
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
import { dismissOrReplace } from '@/navigation/safe-navigation';
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
        <AppButton
          label="Kapat"
          onPress={() => dismissOrReplace(router, '/(tabs)/progress')}
        />
      </Screen>
    );
  }

  const parsedTarget = parseBodyWeight(targetWeight);
  const remaining =
    parsedTarget === null ? null : Math.abs(parsedTarget - currentWeight);
  const directionLabel =
    parsedTarget === null
      ? 'Hedef taslağı geçerli değil'
      : parsedTarget < currentWeight
        ? 'Kilo verme hedefi'
        : parsedTarget > currentWeight
          ? 'Kilo alma hedefi'
          : 'Hedef kilondasın';

  return (
    <Screen edges={['top', 'bottom']} keyboardAware>
      <View style={styles.intro}>
        <View style={styles.eyebrow}>
          <AppIcon
            color={theme.colors.primary}
            name="target"
            size={theme.iconSizes.sm}
          />
          <AppText tone="primary" variant="label">
            Kilo Hedefi
          </AppText>
        </View>
        <AppText accessibilityRole="header" variant="title">
          Hedefi Düzenle
        </AppText>
        <AppText selectable tone="muted">
          Güncel kilon korunur; yalnız hedef değerini değiştirirsin.
        </AppText>
      </View>

      <AppCard
        accessibilityLabel={`Güncel kilo ${formatBodyValue(currentWeight)} kilogram. Hedef kilo ${parsedTarget === null ? 'geçersiz' : `${formatBodyValue(parsedTarget)} kilogram`}. ${directionLabel}. ${remaining === null ? 'Hedefe uzaklık hesaplanamadı' : `${formatBodyValue(remaining)} kilogram fark var`}.`}
        accessible
        style={styles.journeyCard}
        tone="raised"
      >
        <View style={styles.journeyHeader}>
          <View style={styles.journeyIcon}>
            <AppIcon
              color={theme.colors.primary}
              name="map-marker-path"
              size={theme.iconSizes.lg}
            />
          </View>
          <View style={styles.copy}>
            <AppText variant="bodyStrong">Hedef Yolculuğu</AppText>
            <AppText tone="muted" variant="caption">
              Güncel değer son kalıcı ölçümünden gelir.
            </AppText>
          </View>
        </View>

        <View style={styles.weightComparison}>
          <View style={styles.metric}>
            <AppText tone="muted" variant="caption">
              Güncel
            </AppText>
            <AppText
              accessibilityLabel={`Güncel kilo, salt okunur, ${formatBodyValue(currentWeight)} kilogram`}
              selectable
              style={styles.number}
              variant="heading"
            >
              {formatBodyValue(currentWeight)} kg
            </AppText>
          </View>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.directionIcon}
          >
            <AppIcon
              color={theme.colors.primary}
              name="arrow-right"
              size={theme.iconSizes.lg}
            />
          </View>
          <View style={[styles.metric, styles.end]}>
            <AppText tone="muted" variant="caption">
              Hedef
            </AppText>
            <AppText
              selectable
              style={styles.number}
              tone="primary"
              variant="heading"
            >
              {parsedTarget === null
                ? '—'
                : `${formatBodyValue(parsedTarget)} kg`}
            </AppText>
          </View>
        </View>

        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.track}
        >
          <View style={styles.trackLine} />
          <View style={styles.trackStart} />
          <View style={styles.trackTarget} />
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <AppIcon
              color={theme.colors.primary}
              name="flag-checkered"
              size={theme.iconSizes.sm}
            />
            <AppText tone="primary" variant="caption">
              {directionLabel}
            </AppText>
          </View>
          <AppText selectable style={styles.number} variant="bodyStrong">
            {remaining === null ? '—' : `${formatBodyValue(remaining)} kg fark`}
          </AppText>
        </View>
      </AppCard>

      <WeightSelectorField
        editable={!pending}
        error={error ?? undefined}
        fallbackValue={parseBodyWeight(originalTarget) ?? undefined}
        kind="body"
        label="Hedef Kilo"
        onChangeText={setTargetWeight}
        presentation="card"
        title="Hedef Kilonu Seç"
        value={targetWeight}
      />
      <View style={styles.actions}>
        <AppButton
          disabled={pending}
          label="Kapat"
          onPress={() => dismissOrReplace(router, '/(tabs)/progress')}
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
  directionIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  end: { alignItems: 'flex-end' },
  eyebrow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  intro: { gap: theme.spacing.sm },
  journeyCard: { gap: theme.spacing.lg },
  journeyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  journeyIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.md,
    height: theme.layout.touchTarget,
    justifyContent: 'center',
    width: theme.layout.touchTarget,
  },
  metric: { flex: 1, gap: theme.spacing.xs },
  number: { fontVariant: ['tabular-nums'] },
  statusBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: 32,
    paddingHorizontal: theme.spacing.md,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  track: { height: 12, justifyContent: 'center', position: 'relative' },
  trackLine: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.pill,
    height: 3,
  },
  trackStart: {
    backgroundColor: theme.colors.textMuted,
    borderRadius: theme.radii.pill,
    height: 10,
    left: 0,
    position: 'absolute',
    width: 10,
  },
  trackTarget: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.strong,
    height: 14,
    position: 'absolute',
    right: 0,
    width: 14,
  },
  weightComparison: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
});
