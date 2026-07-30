import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';

import { createBodyMeasurementRepository } from '@/features/body/data/body-measurement-repository';
import { createBodyProfileRepository } from '@/features/body/data/body-profile-repository';
import type {
  BodyMeasurement,
  BodyProfile,
  BodyProgress,
  BodyWeightSummary,
} from '@/features/body/domain/models';
import {
  createBodyWeightSummary,
  getValidBodyMeasurements,
} from '@/features/body/utils/body-values';

const BODY_HISTORY_PAGE_SIZE = 20;

export type BodyOverview = {
  latest: BodyMeasurement | null;
  measurements: BodyMeasurement[];
  measurementCount: number;
  previous: BodyMeasurement | null;
  profile: BodyProfile | null;
  progress: BodyProgress | null;
  summary: BodyWeightSummary | null;
};

const emptyOverview: BodyOverview = {
  latest: null,
  measurements: [],
  measurementCount: 0,
  previous: null,
  profile: null,
  progress: null,
  summary: null,
};

export function useBodyOverview() {
  const database = useSQLiteContext();
  const [data, setData] = useState(emptyOverview);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasLoaded = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [measurementLimit, setMeasurementLimit] = useState(
    BODY_HISTORY_PAGE_SIZE
  );

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      const isLoadingMore =
        hasLoaded.current && measurementLimit > BODY_HISTORY_PAGE_SIZE;
      if (isLoadingMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(false);
      const profileRepository = createBodyProfileRepository(database);
      const measurementRepository = createBodyMeasurementRepository(database);
      void Promise.all([
        profileRepository.getProfile(),
        measurementRepository.listMeasurements(measurementLimit),
        measurementRepository.countMeasurements(),
      ])
        .then(([profile, rawMeasurements, measurementCount]) => {
          if (!active) return;
          const measurements = getValidBodyMeasurements(rawMeasurements);
          const latest = measurements[0] ?? null;
          const previous = measurements[1] ?? null;
          const summary = createBodyWeightSummary(
            profile,
            measurements,
            measurementCount
          );
          setData({
            latest,
            measurements,
            measurementCount,
            previous,
            profile,
            progress: summary?.progress ?? null,
            summary,
          });
          hasLoaded.current = true;
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) {
            setLoading(false);
            setLoadingMore(false);
          }
        });
      return () => {
        active = false;
      };
    }, [database, measurementLimit, reloadKey])
  );

  return {
    data,
    error,
    hasMore: data.measurements.length < data.measurementCount,
    loadMore: () =>
      setMeasurementLimit((value) => value + BODY_HISTORY_PAGE_SIZE),
    loading,
    loadingMore,
    retry: () => {
      hasLoaded.current = false;
      setMeasurementLimit(BODY_HISTORY_PAGE_SIZE);
      setReloadKey((value) => value + 1);
    },
  };
}
