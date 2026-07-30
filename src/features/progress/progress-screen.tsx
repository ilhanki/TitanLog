import { useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { WeightSelectorField } from '@/components/weight-selector-field';
import { appStrings } from '@/constants/strings';
import { BodyProgressRail } from '@/features/body/components/body-progress-rail';
import { MeasurementHistoryRow } from '@/features/body/components/measurement-history-row';
import {
  BodyProfileError,
  createBodyProfileRepository,
} from '@/features/body/data/body-profile-repository';
import { useBodyOverview } from '@/features/body/hooks/use-body-overview';
import {
  formatBodyDate,
  formatSignedBodyValue,
} from '@/features/body/utils/body-formatters';
import {
  formatBodyValue,
  parseBodyWeight,
} from '@/features/body/utils/body-values';
import { theme } from '@/theme/tokens';

export function ProgressScreen() {
  const database = useSQLiteContext();
  const router = useRouter();
  const { data, error, hasMore, loadMore, loading, loadingMore, retry } =
    useBodyOverview();
  const [startingWeight, setStartingWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [startingError, setStartingError] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [relationshipError, setRelationshipError] = useState<string | null>(
    null
  );
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submissionPending = useRef(false);

  const saveProfile = async () => {
    if (submissionPending.current) return;
    setStartingError(null);
    setTargetError(null);
    setRelationshipError(null);
    setSubmissionError(null);
    const starting = parseBodyWeight(startingWeight);
    const target = parseBodyWeight(targetWeight);
    if (starting === null) setStartingError(appStrings.progress.invalidWeight);
    if (target === null) setTargetError(appStrings.progress.invalidWeight);
    if (starting === null || target === null) return;
    if (starting === target) {
      setRelationshipError(appStrings.progress.equalGoal);
      return;
    }
    submissionPending.current = true;
    setPending(true);
    try {
      await createBodyProfileRepository(
        database
      ).createProfileWithInitialMeasurement(starting, target);
      retry();
    } catch (caught) {
      if (
        caught instanceof BodyProfileError &&
        caught.code === 'profile_exists'
      ) {
        retry();
      } else {
        if (__DEV__) {
          console.error('[BodyProfileSetup] Profile creation failed', {
            code: caught instanceof BodyProfileError ? caught.code : 'unknown',
            operation: 'createProfileWithInitialMeasurement',
          });
        }
        setSubmissionError(appStrings.progress.saveError);
      }
    } finally {
      submissionPending.current = false;
      setPending(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppText accessibilityRole="header" variant="title">
          Gelişim
        </AppText>
        <AppCard style={styles.loadingCard}>
          <AppText variant="heading">Verilerin hazırlanıyor</AppText>
          <AppText tone="muted">Kayıtlı ölçümlerin güvenle yükleniyor.</AppText>
        </AppCard>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <AppText accessibilityRole="header" variant="title">
          Gelişim
        </AppText>
        <EmptyState
          description={appStrings.progress.loadError}
          icon="alert-circle-outline"
          title="Gelişim verileri açılamadı"
        />
        <AppButton label={appStrings.progress.retry} onPress={retry} />
      </Screen>
    );
  }

  if (!data.profile || !data.summary) {
    return (
      <Screen keyboardAware>
        <AppText accessibilityRole="header" variant="title">
          Gelişim
        </AppText>
        <AppCard style={styles.setup} tone="raised">
          <AppText accessibilityRole="header" variant="heading">
            Gelişimini Takip Et
          </AppText>
          <AppText selectable tone="muted">
            Kilo hedefini ve ölçümlerini eklediğinde değişimini burada
            görebilirsin.
          </AppText>
          <WeightSelectorField
            editable={!pending}
            error={startingError ?? undefined}
            kind="body"
            label={appStrings.progress.startingWeight}
            onChangeText={setStartingWeight}
            title="Kilonu Seç"
            value={startingWeight}
          />
          <WeightSelectorField
            editable={!pending}
            error={targetError ?? undefined}
            kind="body"
            label={appStrings.progress.targetWeight}
            onChangeText={setTargetWeight}
            title="Hedef Kilonu Seç"
            value={targetWeight}
          />
          {relationshipError || submissionError ? (
            <AppText
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              selectable
              tone="danger"
              variant="caption"
            >
              {relationshipError ?? submissionError}
            </AppText>
          ) : null}
          <AppButton
            disabled={pending}
            label={appStrings.progress.saveGoal}
            onPress={() => void saveProfile()}
          />
        </AppCard>
      </Screen>
    );
  }

  const { summary } = data;
  const { profile, progress } = summary;
  const lastMeasurement = summary.latestMeasurementAt
    ? formatBodyDate(summary.latestMeasurementAt)
    : 'Henüz ölçüm eklenmedi';
  const remainingText = progress.targetReached
    ? 'Hedef değerine ulaşıldı'
    : `${formatBodyValue(progress.remainingWeightKg)} kg kaldı`;
  const statistics = [
    {
      label: 'Toplam Değişim',
      value: formatSignedBodyValue(progress.totalChangeKg),
    },
    { label: 'Hedefe Kalan', value: remainingText },
    { label: 'Son Ölçüm', value: lastMeasurement },
    { label: 'Ölçüm Sayısı', value: String(summary.measurementCount) },
  ];

  return (
    <Screen>
      <AppText accessibilityRole="header" variant="title">
        Gelişim
      </AppText>

      <AppCard
        accessibilityLabel={`Güncel kilo ${formatBodyValue(summary.currentWeightKg)} kilogram. Başlangıç ${formatBodyValue(profile.startingWeightKg)} kilogram. Hedef ${formatBodyValue(profile.targetWeightKg)} kilogram. ${remainingText}.`}
        accessible
        style={styles.hero}
        tone="raised"
      >
        <AppText tone="primary" variant="label">
          Güncel Kilo
        </AppText>
        <AppText selectable style={styles.currentWeight} variant="display">
          {formatBodyValue(summary.currentWeightKg)} kg
        </AppText>
        <View style={styles.heroSupport}>
          <View style={styles.heroMetric}>
            <AppText tone="muted" variant="caption">
              Başlangıçtan
            </AppText>
            <AppText selectable style={styles.number} variant="bodyStrong">
              {formatSignedBodyValue(progress.totalChangeKg)}
            </AppText>
          </View>
          <View style={[styles.heroMetric, styles.heroMetricEnd]}>
            <AppText tone="muted" variant="caption">
              Hedefe Kalan
            </AppText>
            <AppText selectable style={styles.number} variant="bodyStrong">
              {progress.targetReached
                ? '0 kg'
                : `${formatBodyValue(progress.remainingWeightKg)} kg`}
            </AppText>
          </View>
        </View>
        <AppText selectable tone="muted" variant="caption">
          {summary.currentSource === 'measurement'
            ? `Son ölçüm · ${lastMeasurement}`
            : 'Profil başlangıç değeri · Henüz ölçüm değil'}
        </AppText>
      </AppCard>

      <AppCard style={styles.railCard}>
        <BodyProgressRail summary={summary} />
      </AppCard>

      <View style={styles.actions}>
        <AppButton
          label="Yeni Ölçüm"
          onPress={() => router.push('/progress/add' as Href)}
          style={styles.action}
        />
        <AppButton
          label="Hedefi Düzenle"
          onPress={() => router.push('/progress/settings' as Href)}
          style={styles.action}
          variant="secondary"
        />
      </View>

      <View style={styles.statistics}>
        {statistics.map((item) => (
          <View key={item.label} style={styles.statistic}>
            <AppText tone="muted" variant="caption">
              {item.label}
            </AppText>
            <AppText selectable style={styles.number} variant="bodyStrong">
              {item.value || '—'}
            </AppText>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Ölçüm Geçmişi" />
        {data.measurements.length === 0 ? (
          <AppCard style={styles.emptyHistory}>
            <AppText variant="bodyStrong">Henüz ölçüm eklenmedi</AppText>
            <AppText tone="muted">
              İlk ölçümünü eklediğinde değişim burada görünür.
            </AppText>
            <AppButton
              label="İlk Ölçümü Ekle"
              onPress={() => router.push('/progress/add' as Href)}
              variant="secondary"
            />
          </AppCard>
        ) : (
          <View style={styles.historyList}>
            {data.measurements.map((measurement, index) => (
              <MeasurementHistoryRow
                key={measurement.id}
                latest={index === 0}
                measurement={measurement}
                older={data.measurements[index + 1] ?? null}
                onPress={() =>
                  router.push(`/progress/measurement/${measurement.id}` as Href)
                }
              />
            ))}
          </View>
        )}
        {hasMore ? (
          <AppButton
            disabled={loadingMore}
            label={
              loadingMore ? 'Ölçümler Yükleniyor' : 'Daha Fazla Ölçüm Göster'
            }
            onPress={loadMore}
            variant="ghost"
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1 },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  currentWeight: { fontVariant: ['tabular-nums'] },
  emptyHistory: { gap: theme.spacing.md },
  hero: { gap: theme.spacing.md },
  heroMetric: { flex: 1, gap: theme.spacing.xs },
  heroMetricEnd: { alignItems: 'flex-end' },
  heroSupport: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  historyList: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: theme.borders.thin,
    overflow: 'hidden',
  },
  loadingCard: { gap: theme.spacing.md, minHeight: 132 },
  number: { fontVariant: ['tabular-nums'] },
  railCard: { gap: theme.spacing.md },
  section: { gap: theme.spacing.md },
  setup: { gap: theme.spacing.lg },
  statistic: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.borders.hairline,
    flexBasis: '46%',
    flexGrow: 1,
    gap: theme.spacing.xs,
    minHeight: 58,
    padding: theme.spacing.md,
  },
  statistics: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: theme.borders.thin,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
});
