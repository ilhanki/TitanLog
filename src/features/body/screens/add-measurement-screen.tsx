import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { BodyMeasurementForm } from '@/features/body/components/body-measurement-form';
import { createBodyMeasurementRepository } from '@/features/body/data/body-measurement-repository';
import { createBodyProfileRepository } from '@/features/body/data/body-profile-repository';
import type { BodyMeasurementInput } from '@/features/body/domain/models';

export function AddMeasurementScreen() {
  const database = useSQLiteContext();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [initialWeightKg, setInitialWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(false);
      void Promise.all([
        createBodyMeasurementRepository(database).getLatestMeasurement(),
        createBodyProfileRepository(database).getProfile(),
      ])
        .then(([latest, profile]) => {
          if (active) {
            setInitialWeightKg(
              latest?.weightKg ?? profile?.startingWeightKg ?? null
            );
          }
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [database])
  );

  const submit = async (input: BodyMeasurementInput) => {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      await createBodyMeasurementRepository(database).createMeasurement(input);
      router.replace('/progress');
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          description={appStrings.progress.loading}
          icon="scale-bathroom"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} keyboardAware>
      <AppButton
        label={appStrings.common.goBack}
        onPress={() => router.back()}
        style={styles.back}
        variant="ghost"
      />
      <AppText accessibilityRole="header" variant="title">
        {appStrings.progress.addMeasurement}
      </AppText>
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {appStrings.progress.saveError}
        </AppText>
      ) : null}
      <BodyMeasurementForm
        initialWeightKg={initialWeightKg ?? undefined}
        onSubmit={submit}
        pending={pending}
        submitLabel={appStrings.progress.saveMeasurement}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ back: { alignSelf: 'flex-start' } });
