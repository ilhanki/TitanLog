import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { WeightSelectorField } from '@/components/weight-selector-field';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { createBodyProfileRepository } from '@/features/body/data/body-profile-repository';
import {
  formatBodyValue,
  parseBodyWeight,
} from '@/features/body/utils/body-values';

export function BodySettingsScreen() {
  const database = useSQLiteContext();
  const router = useRouter();
  const [startingWeight, setStartingWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void createBodyProfileRepository(database)
        .getProfile()
        .then((profile) => {
          if (active && profile) {
            setStartingWeight(formatBodyValue(profile.startingWeightKg));
            setTargetWeight(formatBodyValue(profile.targetWeightKg));
          }
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

  const requestSave = () => {
    const starting = parseBodyWeight(startingWeight);
    const target = parseBodyWeight(targetWeight);
    if (starting === null || target === null) {
      setError(appStrings.progress.invalidWeight);
      return;
    }
    if (starting === target) {
      setError(appStrings.progress.equalGoal);
      return;
    }
    Alert.alert(
      appStrings.progress.settingsConfirmTitle,
      appStrings.progress.settingsConfirmDescription,
      [
        { style: 'cancel', text: appStrings.workout.keepWorkout },
        {
          text: appStrings.progress.updateGoal,
          onPress: () =>
            void (async () => {
              if (pending) return;
              setPending(true);
              setError(null);
              try {
                await createBodyProfileRepository(database).updateGoal(
                  starting,
                  target
                );
                router.replace('/progress');
              } catch {
                setError(appStrings.progress.saveError);
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
          icon="target"
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
        {appStrings.progress.settingsTitle}
      </AppText>
      <AppText selectable tone="muted">
        {appStrings.progress.settingsDescription}
      </AppText>
      <WeightSelectorField
        editable={!pending}
        error={error ?? undefined}
        kind="body"
        label={appStrings.progress.startingWeight}
        onChangeText={setStartingWeight}
        title="Kilonu Seç"
        value={startingWeight}
      />
      <WeightSelectorField
        editable={!pending}
        kind="body"
        label={appStrings.progress.targetWeight}
        onChangeText={setTargetWeight}
        title="Hedef Kilonu Seç"
        value={targetWeight}
      />
      <AppButton
        disabled={pending}
        label={appStrings.progress.updateGoal}
        onPress={requestSave}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ back: { alignSelf: 'flex-start' } });
