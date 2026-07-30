import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { BodyMeasurementForm } from '@/features/body/components/body-measurement-form';
import { createBodyMeasurementRepository } from '@/features/body/data/body-measurement-repository';
import { createBodyProfileRepository } from '@/features/body/data/body-profile-repository';
import type { BodyMeasurementInput } from '@/features/body/domain/models';
import { useUnsavedChangesGuard } from '@/features/workouts/hooks/use-unsaved-changes-guard';

const todayLabel = () =>
  new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(new Date());

export function AddMeasurementScreen() {
  const database = useSQLiteContext();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [initialWeightKg, setInitialWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const pendingRef = useRef(false);
  const allowNavigation = useUnsavedChangesGuard(dirty);

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
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(false);
    try {
      await createBodyMeasurementRepository(database).createMeasurement(input);
      allowNavigation();
      Keyboard.dismiss();
      router.replace('/progress');
    } catch {
      setError(true);
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
          icon="scale-bathroom"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  if (initialWeightKg === null) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          description={
            error
              ? appStrings.progress.loadError
              : 'Ölçüm eklemek için önce vücut profilini oluşturmalısın.'
          }
          icon="alert-circle-outline"
          title={error ? 'Güncel kilo yüklenemedi' : 'Vücut profili gerekli'}
        />
        <AppButton
          label="Kapat"
          onPress={() => router.back()}
          variant="secondary"
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} keyboardAware>
      <AppText accessibilityRole="header" variant="title">
        Yeni Ölçüm
      </AppText>
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {appStrings.progress.saveError}
        </AppText>
      ) : null}
      <BodyMeasurementForm
        initialWeightKg={initialWeightKg}
        measurementDate={todayLabel()}
        onCancel={() => router.back()}
        onDirtyChange={setDirty}
        onSubmit={submit}
        pending={pending}
        submitLabel={pending ? 'Kaydediliyor…' : 'Kaydet'}
      />
    </Screen>
  );
}
