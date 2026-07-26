import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { createBodyMeasurementRepository } from '@/features/body/data/body-measurement-repository';
import { createBodyProfileRepository } from '@/features/body/data/body-profile-repository';
import type {
  BodyMeasurement,
  BodyProfile,
  BodyProgress,
} from '@/features/body/domain/models';
import { calculateBodyProgress } from '@/features/body/utils/body-values';

export type BodyOverview = {
  latest: BodyMeasurement | null;
  measurements: BodyMeasurement[];
  previous: BodyMeasurement | null;
  profile: BodyProfile | null;
  progress: BodyProgress | null;
};

const emptyOverview: BodyOverview = {
  latest: null,
  measurements: [],
  previous: null,
  profile: null,
  progress: null,
};

export function useBodyOverview() {
  const database = useSQLiteContext();
  const [data, setData] = useState(emptyOverview);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setLoading(true);
      setError(false);
      const profileRepository = createBodyProfileRepository(database);
      const measurementRepository = createBodyMeasurementRepository(database);
      void Promise.all([
        profileRepository.getProfile(),
        measurementRepository.listMeasurements(),
      ])
        .then(([profile, measurements]) => {
          if (!active) return;
          const latest = measurements[0] ?? null;
          const previous = measurements[1] ?? null;
          setData({
            latest,
            measurements,
            previous,
            profile,
            progress:
              profile && latest
                ? calculateBodyProgress(profile, latest, previous)
                : null,
          });
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
    }, [database, reloadKey])
  );

  return {
    data,
    error,
    loading,
    retry: () => setReloadKey((value) => value + 1),
  };
}
