import { useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { EmptyState } from '@/components/empty-state';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { appStrings } from '@/constants/strings';
import { createBodyProfileRepository } from '@/features/body/data/body-profile-repository';
import type { BodyMeasurement } from '@/features/body/domain/models';
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

function MeasurementCard({
  measurement,
  older,
  onOpen,
}: {
  measurement: BodyMeasurement;
  older: BodyMeasurement | null;
  onOpen: () => void;
}) {
  const dimensions = [
    measurement.waistCm
      ? `${appStrings.progress.waist}: ${formatBodyValue(measurement.waistCm)} cm`
      : null,
    measurement.chestCm
      ? `${appStrings.progress.chest}: ${formatBodyValue(measurement.chestCm)} cm`
      : null,
  ].filter(Boolean);
  return (
    <AppCard style={styles.historyCard}>
      <View style={styles.rowBetween}>
        <View style={styles.copy}>
          <AppText variant="bodyStrong">
            {formatBodyValue(measurement.weightKg)} kg
          </AppText>
          <AppText tone="muted" variant="caption">
            {formatBodyDate(measurement.measuredAt)}
          </AppText>
        </View>
        {older ? (
          <AppText tone="primary" variant="bodyStrong">
            {formatSignedBodyValue(measurement.weightKg - older.weightKg)}
          </AppText>
        ) : null}
      </View>
      {dimensions.length ? (
        <AppText selectable tone="muted">
          {dimensions.join(' · ')}
        </AppText>
      ) : null}
      {measurement.note ? (
        <AppText selectable tone="muted">
          {measurement.note}
        </AppText>
      ) : null}
      <AppButton
        label={appStrings.progress.editMeasurement}
        onPress={onOpen}
        variant="secondary"
      />
    </AppCard>
  );
}

export function ProgressScreen() {
  const database = useSQLiteContext();
  const router = useRouter();
  const { data, error, loading, retry } = useBodyOverview();
  const [startingWeight, setStartingWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const saveProfile = async () => {
    const starting = parseBodyWeight(startingWeight);
    const target = parseBodyWeight(targetWeight);
    if (starting === null || target === null) {
      setFormError(appStrings.progress.invalidWeight);
      return;
    }
    if (starting === target) {
      setFormError(appStrings.progress.equalGoal);
      return;
    }
    if (pending) return;
    setPending(true);
    setFormError(null);
    try {
      await createBodyProfileRepository(
        database
      ).createProfileWithInitialMeasurement(starting, target);
      retry();
    } catch {
      setFormError(appStrings.progress.saveError);
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <EmptyState
          description={appStrings.progress.loading}
          icon="chart-timeline-variant"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <EmptyState
          description={appStrings.progress.loadError}
          icon="alert-circle-outline"
          title={appStrings.database.errorTitle}
        />
        <AppButton label={appStrings.progress.retry} onPress={retry} />
      </Screen>
    );
  }

  if (!data.profile || !data.latest || !data.progress) {
    return (
      <Screen keyboardAware>
        <AppText accessibilityRole="header" variant="title">
          {appStrings.progress.title}
        </AppText>
        <AppCard style={styles.setup} tone="raised">
          <AppText accessibilityRole="header" variant="heading">
            {appStrings.progress.setupTitle}
          </AppText>
          <AppText selectable tone="muted">
            {appStrings.progress.setupDescription}
          </AppText>
          <AppTextInput
            editable={!pending}
            error={formError ?? undefined}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label={appStrings.progress.startingWeight}
            onChangeText={setStartingWeight}
            value={startingWeight}
          />
          <AppTextInput
            editable={!pending}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label={appStrings.progress.targetWeight}
            onChangeText={setTargetWeight}
            value={targetWeight}
          />
          <AppButton
            disabled={pending}
            label={appStrings.progress.saveGoal}
            onPress={() => void saveProfile()}
          />
        </AppCard>
      </Screen>
    );
  }

  const { profile, progress } = data;
  const summary = [
    { label: appStrings.progress.start, value: profile.startingWeightKg },
    { label: appStrings.progress.current, value: progress.currentWeightKg },
    { label: appStrings.progress.target, value: profile.targetWeightKg },
  ];

  return (
    <Screen>
      <AppText accessibilityRole="header" variant="title">
        {appStrings.progress.title}
      </AppText>
      <AppCard style={styles.mainCard} tone="accent">
        <View style={styles.rowBetween}>
          <View style={styles.copy}>
            <AppText tone="primary" variant="label">
              {appStrings.progress.currentWeight}
            </AppText>
            <AppText variant="metric">
              {formatBodyValue(progress.currentWeightKg)} kg
            </AppText>
          </View>
          <AppText tone="primary" variant="heading">
            %{progress.progressPercentage}
          </AppText>
        </View>
        <ProgressBar
          accessibilityLabel={`${appStrings.progress.title}: %${progress.progressPercentage}`}
          progress={progress.progress}
        />
        <AppText selectable tone={progress.targetReached ? 'success' : 'muted'}>
          {progress.targetReached
            ? appStrings.progress.reached
            : `${appStrings.progress.remaining}: ${formatBodyValue(progress.remainingWeightKg)} kg`}
        </AppText>
      </AppCard>

      <View style={styles.summaryGrid}>
        {summary.map((item) => (
          <AppCard key={item.label} style={styles.summaryCard}>
            <AppText tone="muted" variant="caption">
              {item.label}
            </AppText>
            <AppText variant="bodyStrong">
              {formatBodyValue(item.value)} kg
            </AppText>
          </AppCard>
        ))}
        <AppCard style={styles.summaryCard}>
          <AppText tone="muted" variant="caption">
            {appStrings.progress.totalChange}
          </AppText>
          <AppText variant="bodyStrong">
            {formatSignedBodyValue(progress.totalChangeKg)}
          </AppText>
        </AppCard>
      </View>

      <AppCard style={styles.copy}>
        <AppText variant="bodyStrong">
          {appStrings.progress.latestChange}
        </AppText>
        <AppText selectable tone="muted">
          {progress.changeFromPreviousKg === null
            ? appStrings.progress.noPreviousChange
            : formatSignedBodyValue(progress.changeFromPreviousKg)}
        </AppText>
      </AppCard>

      <View style={styles.actions}>
        <AppButton
          label={appStrings.progress.addMeasurement}
          onPress={() => router.push('/progress/add' as Href)}
          style={styles.action}
        />
        <AppButton
          label={appStrings.progress.editGoal}
          onPress={() => router.push('/progress/settings' as Href)}
          style={styles.action}
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={appStrings.progress.history} />
        {data.measurements.length === 1 ? (
          <EmptyState
            description={appStrings.progress.noExtraMeasurementDescription}
            icon="scale-bathroom"
            title={appStrings.progress.noExtraMeasurement}
          />
        ) : null}
        {data.measurements.map((measurement, index) => (
          <MeasurementCard
            key={measurement.id}
            measurement={measurement}
            older={data.measurements[index + 1] ?? null}
            onOpen={() =>
              router.push(`/progress/measurement/${measurement.id}` as Href)
            }
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { flexGrow: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  copy: { gap: theme.spacing.sm },
  historyCard: { gap: theme.spacing.md },
  mainCard: { gap: theme.spacing.lg },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  section: { gap: theme.spacing.lg },
  setup: { gap: theme.spacing.lg },
  summaryCard: { flexBasis: '46%', flexGrow: 1, gap: theme.spacing.xs },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
});
