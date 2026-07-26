import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { BodyMeasurementForm } from '@/features/body/components/body-measurement-form';
import { createBodyMeasurementRepository } from '@/features/body/data/body-measurement-repository';
import type { BodyMeasurementInput } from '@/features/body/domain/models';

export function AddMeasurementScreen() {
  const database = useSQLiteContext();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

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
        onSubmit={submit}
        pending={pending}
        submitLabel={appStrings.progress.saveMeasurement}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ back: { alignSelf: 'flex-start' } });
