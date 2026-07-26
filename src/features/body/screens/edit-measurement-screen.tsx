import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { BodyMeasurementForm } from '@/features/body/components/body-measurement-form';
import {
  BodyMeasurementError,
  createBodyMeasurementRepository,
} from '@/features/body/data/body-measurement-repository';
import type {
  BodyMeasurement,
  BodyMeasurementInput,
} from '@/features/body/domain/models';

export function EditMeasurementScreen() {
  const { measurementId: rawId } = useLocalSearchParams<{
    measurementId: string;
  }>();
  const measurementId = Number(rawId);
  const database = useSQLiteContext();
  const router = useRouter();
  const [measurement, setMeasurement] = useState<BodyMeasurement | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      if (!Number.isSafeInteger(measurementId) || measurementId <= 0) {
        setLoading(false);
        return () => {
          active = false;
        };
      }
      void createBodyMeasurementRepository(database)
        .getMeasurement(measurementId)
        .then((value) => {
          if (active) setMeasurement(value);
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
    }, [database, measurementId])
  );

  const submit = async (input: BodyMeasurementInput) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await createBodyMeasurementRepository(database).updateMeasurement(
        measurementId,
        input
      );
      router.replace('/progress');
    } catch {
      setError(appStrings.progress.saveError);
    } finally {
      setPending(false);
    }
  };

  const remove = () => {
    Alert.alert(
      appStrings.progress.deleteTitle,
      appStrings.progress.deleteDescription,
      [
        { style: 'cancel', text: appStrings.workout.keepWorkout },
        {
          style: 'destructive',
          text: appStrings.progress.deleteConfirm,
          onPress: () =>
            void (async () => {
              if (pending) return;
              setPending(true);
              setError(null);
              try {
                await createBodyMeasurementRepository(
                  database
                ).deleteMeasurement(measurementId);
                router.replace('/progress');
              } catch (caught) {
                setError(
                  caught instanceof BodyMeasurementError &&
                    caught.code === 'only_measurement'
                    ? appStrings.progress.onlyMeasurement
                    : appStrings.progress.saveError
                );
              } finally {
                setPending(false);
              }
            })(),
        },
      ]
    );
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

  if (!measurement) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          description={appStrings.progress.measurementNotFoundDescription}
          icon="alert-circle-outline"
          title={appStrings.progress.measurementNotFound}
        />
        <AppButton
          label={appStrings.common.goBack}
          onPress={() => router.back()}
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
        {appStrings.progress.editMeasurement}
      </AppText>
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      <BodyMeasurementForm
        initial={measurement}
        onSubmit={submit}
        pending={pending}
        submitLabel={appStrings.progress.updateMeasurement}
      />
      <AppButton
        disabled={pending}
        label={appStrings.progress.deleteMeasurement}
        onPress={remove}
        variant="ghost"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ back: { alignSelf: 'flex-start' } });
