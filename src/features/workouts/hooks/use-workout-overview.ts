import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { createWorkoutPlanRepository } from '@/features/workouts/data/workout-plan-repository';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';
import type {
  CompletedWorkoutSummary,
  WorkoutDayDetails,
  WorkoutPlan,
  WorkoutSession,
} from '@/features/workouts/domain/models';
import { getIsoWeekday } from '@/features/workouts/utils/workout-values';

export type WorkoutOverview = {
  activeSession: WorkoutSession | null;
  completedSessionCount: number;
  plan: WorkoutPlan | null;
  recentSessions: CompletedWorkoutSummary[];
  scheduledWorkout: WorkoutDayDetails | null;
};

const emptyOverview: WorkoutOverview = {
  activeSession: null,
  completedSessionCount: 0,
  plan: null,
  recentSessions: [],
  scheduledWorkout: null,
};

export function useWorkoutOverview(now = new Date()) {
  const database = useSQLiteContext();
  const [data, setData] = useState(emptyOverview);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const isoWeekday = getIsoWeekday(now);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setLoading(true);
      setError(false);
      const planRepository = createWorkoutPlanRepository(database);
      const sessionRepository = createWorkoutSessionRepository(database);
      void Promise.all([
        planRepository.getActivePlan(),
        planRepository.getScheduledWorkout(isoWeekday),
        sessionRepository.getActiveSession(),
        sessionRepository.getRecentCompletedSessions(5),
        sessionRepository.getCompletedSessionCount(),
      ])
        .then(
          ([plan, scheduledWorkout, activeSession, recentSessions, count]) => {
            if (active) {
              setData({
                activeSession,
                completedSessionCount: count,
                plan,
                recentSessions,
                scheduledWorkout,
              });
            }
          }
        )
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [database, isoWeekday, reloadKey])
  );

  return {
    data,
    error,
    loading,
    retry: () => setReloadKey((value) => value + 1),
  };
}
