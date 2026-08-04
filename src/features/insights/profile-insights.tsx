import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ProgressBar } from '@/components/progress-bar';
import { SegmentedControl } from '@/components/segmented-control';
import {
  comparisonMessage,
  formatVolume,
  formatWeight,
  weightChangeMessage,
} from '@/features/insights/insight-formatters';
import {
  periodLabel,
  type InsightPeriod,
} from '@/features/insights/insight-periods';
import {
  createInsightsRepository,
  type InsightComparison,
  type InsightSummary,
} from '@/features/insights/insights-repository';
import type { ProfilePreferences } from '@/features/profile/profile-preferences';
import { theme } from '@/theme/tokens';

const options = [
  { label: 'Hafta', value: 'week' },
  { label: 'Ay', value: 'month' },
  { label: 'Yıl', value: 'year' },
] as const;

export function ProfileInsights({
  preferences,
}: {
  preferences: ProfilePreferences;
}) {
  const database = useSQLiteContext();
  const [period, setPeriod] = useState<InsightPeriod>('week');
  const [summary, setSummary] = useState<InsightSummary | null>(null);
  const [comparison, setComparison] = useState<InsightComparison | null>(null);
  useEffect(() => {
    let active = true;
    const repository = createInsightsRepository(database);
    void Promise.all([
      repository.getSummary(period),
      repository.getPreviousComparison(period),
    ]).then(([value, previous]) => {
      if (active) {
        setSummary(value);
        setComparison(previous);
      }
    });
    return () => {
      active = false;
    };
  }, [database, period]);

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <AppText variant="heading">İçgörüler</AppText>
        <AppText tone="muted" variant="caption">
          {periodLabel(period)}
        </AppText>
      </View>
      <SegmentedControl
        accessibilityLabel="İçgörü dönemi"
        onChange={setPeriod}
        options={options}
        value={period}
      />
      {!summary ? (
        <AppText accessibilityLiveRegion="polite" tone="muted">
          İçgörüler hazırlanıyor…
        </AppText>
      ) : (
        <>
          {summary.workouts === 0 ? (
            <AppCard>
              <AppText variant="bodyStrong">
                Bu dönemde tamamlanan antrenman yok.
              </AppText>
              <AppText tone="muted">
                İlk antrenmanını tamamladığında gerçek verilerin burada
                özetlenecek.
              </AppText>
            </AppCard>
          ) : null}
          {period === 'week' && preferences.weeklyWorkoutTarget ? (
            <AppCard style={styles.insights} tone="accent">
              <AppText variant="bodyStrong">
                Haftalık hedef · {summary.workouts} /{' '}
                {preferences.weeklyWorkoutTarget} antrenman
              </AppText>
              <ProgressBar
                accessibilityLabel={`Haftalık antrenman hedefinin ${summary.workouts} / ${preferences.weeklyWorkoutTarget} kadarı tamamlandı`}
                progress={summary.workouts / preferences.weeklyWorkoutTarget}
              />
              <AppText tone="muted">
                {Math.max(
                  0,
                  preferences.weeklyWorkoutTarget - summary.workouts
                ) === 0
                  ? 'Haftalık hedef tamamlandı.'
                  : `Hedefine ${preferences.weeklyWorkoutTarget - summary.workouts} antrenman kaldı.`}
              </AppText>
            </AppCard>
          ) : null}
          {summary.measurementCount > 0 ? (
            <AppCard style={styles.insights}>
              <AppText variant="bodyStrong">Kilo özeti</AppText>
              <AppText variant="metric">
                {formatWeight(summary.latestWeightKg, preferences.weightUnit)}
              </AppText>
              <AppText tone="information">
                {weightChangeMessage(
                  summary.measurementCount > 1 ? summary.firstWeightKg : null,
                  summary.measurementCount > 1 ? summary.latestWeightKg : null,
                  preferences.weightUnit
                )}
              </AppText>
            </AppCard>
          ) : (
            <AppCard>
              <AppText variant="bodyStrong">
                Bu dönemde kilo ölçümü yok.
              </AppText>
              <AppText tone="muted">
                Ölçüm eklediğinde değişim gerçek kayıt tarihlerine göre
                hesaplanır.
              </AppText>
            </AppCard>
          )}
          {summary.workouts > 0 ? (
            <>
              <View
                accessibilityLabel={`${summary.workouts} antrenman, ${summary.activeDays} aktif gün`}
                style={styles.metrics}
              >
                <Metric label="Antrenman" value={String(summary.workouts)} />
                <Metric label="Aktif gün" value={String(summary.activeDays)} />
                <Metric
                  label="Set / tekrar"
                  value={`${summary.completedSets} / ${summary.totalRepetitions}`}
                />
                <Metric
                  label="Hacim"
                  value={formatVolume(
                    summary.totalVolumeKg,
                    preferences.weightUnit
                  )}
                />
                <Metric label="Süre" value={`${summary.durationMinutes} dk`} />
                <Metric
                  label="Ölçüm"
                  value={String(summary.measurementCount)}
                />
              </View>
              <AppCard style={styles.chart}>
                <AppText variant="bodyStrong">Antrenman dağılımı</AppText>
                <View
                  accessibilityLabel={summary.points
                    .map((point) => `${point.label}: ${point.value}`)
                    .join(', ')}
                  style={styles.bars}
                >
                  {summary.points.map((point) => (
                    <View key={point.label} style={styles.barColumn}>
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(10, point.value * 18) },
                        ]}
                      />
                      <AppText tone="subtle" variant="caption">
                        {point.label}
                      </AppText>
                    </View>
                  ))}
                </View>
              </AppCard>
              <AppCard style={styles.insights}>
                <AppText variant="bodyStrong">Dönem özeti</AppText>
                <AppText tone="muted">
                  En sık hareket: {summary.mostFrequentExercise ?? '—'}
                </AppText>
                <AppText tone="muted">
                  En yüksek hacimli hareket:{' '}
                  {summary.highestVolumeExercise ?? '—'}
                </AppText>
                <AppText tone="muted">
                  En aktif gün: {summary.mostActiveWeekday ?? '—'}
                </AppText>
                <AppText tone="muted">
                  Yeni kişisel rekor: {summary.personalRecords}
                </AppText>
                <AppText tone="muted">
                  Kilo:{' '}
                  {formatWeight(summary.firstWeightKg, preferences.weightUnit)}{' '}
                  →{' '}
                  {formatWeight(summary.latestWeightKg, preferences.weightUnit)}
                </AppText>
                <AppText tone="information">
                  {weightChangeMessage(
                    summary.measurementCount > 1 ? summary.firstWeightKg : null,
                    summary.measurementCount > 1
                      ? summary.latestWeightKg
                      : null,
                    preferences.weightUnit
                  )}
                </AppText>
              </AppCard>
              <AppCard style={styles.insights}>
                <AppText variant="bodyStrong">
                  Önceki dönemle karşılaştırma
                </AppText>
                {!comparison ||
                (comparison.workouts === 0 &&
                  comparison.completedSets === 0) ? (
                  <AppText tone="muted">
                    Karşılaştırma için yeterli veri yok.
                  </AppText>
                ) : (
                  <>
                    <AppText tone="muted">
                      {comparisonMessage(
                        summary.workouts,
                        comparison.workouts,
                        'antrenman'
                      )}
                    </AppText>
                    <AppText tone="muted">
                      {comparisonMessage(
                        summary.activeDays,
                        comparison.activeDays,
                        'aktif gün'
                      )}
                    </AppText>
                    <AppText tone="muted">
                      {comparisonMessage(
                        summary.completedSets,
                        comparison.completedSets,
                        'set'
                      )}
                    </AppText>
                    {comparison.totalVolumeKg > 0 ? (
                      <AppText tone="muted">
                        Önceki dönem hacmi:{' '}
                        {formatVolume(
                          comparison.totalVolumeKg,
                          preferences.weightUnit
                        )}
                      </AppText>
                    ) : (
                      <AppText tone="muted">
                        Hacim karşılaştırması için yeterli veri yok.
                      </AppText>
                    )}
                  </>
                )}
              </AppCard>
              <AppText tone="subtle" variant="caption">
                Hacim, tamamlanan setlerde kayıtlı ağırlık × tekrar toplamıdır.
                Tamamlanmayan/iptal edilen setler dışarıda kalır; her el
                hareketlerinde kayıtlı değer mevcut TitanLog kuralına göre bir
                kez sayılır. Vücut ağırlığı hareketlerinde ek yük yoksa hacim
                sıfırdır.
              </AppText>
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <AppCard style={styles.metric}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText variant="metric">{value}</AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.pill,
    minWidth: 12,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.xs,
    justifyContent: 'flex-end',
  },
  bars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: 90,
  },
  chart: { gap: theme.spacing.lg },
  heading: { gap: theme.spacing.xs },
  insights: { gap: theme.spacing.sm },
  metric: { flexBasis: 145, flexGrow: 1, gap: theme.spacing.xs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  section: { gap: theme.spacing.lg },
});
