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

export type WorkoutOverviewErrors = {
  core: boolean;
  recent: boolean;
  statistics: boolean;
};

const emptyOverview: WorkoutOverview = {
  activeSession: null,
  completedSessionCount: 0,
  plan: null,
  recentSessions: [],
  scheduledWorkout: null,
};

export function useWorkoutOverview(now = new Date(), recentLimit = 5) {
  const database = useSQLiteContext();
  const [data, setData] = useState(emptyOverview);
  const [error, setError] = useState(false);
  const [errors, setErrors] = useState<WorkoutOverviewErrors>({
    core: false,
    recent: false,
    statistics: false,
  });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const isoWeekday = getIsoWeekday(now);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setLoading(true);
      setError(false);
      setErrors({ core: false, recent: false, statistics: false });
      const planRepository = createWorkoutPlanRepository(database);
      const sessionRepository = createWorkoutSessionRepository(database);
      void Promise.allSettled([
        planRepository.getActivePlan(),
        planRepository.getScheduledWorkout(isoWeekday),
        sessionRepository.getActiveSession(),
        sessionRepository.getRecentCompletedSessions(recentLimit),
        sessionRepository.getCompletedSessionCount(),
      ])
        .then((results) => {
          if (!active) return;
          const [plan, scheduledWorkout, activeSession, recentSessions, count] =
            results;
          const hasActiveSession =
            activeSession.status === 'fulfilled' &&
            activeSession.value !== null;
          const hasScheduledWorkout =
            scheduledWorkout.status === 'fulfilled' &&
            scheduledWorkout.value !== null;
          const coreError =
            activeSession.status === 'rejected' ||
            (!hasActiveSession && scheduledWorkout.status === 'rejected') ||
            (!hasActiveSession &&
              !hasScheduledWorkout &&
              plan.status === 'rejected');
          setData({
            activeSession:
              activeSession.status === 'fulfilled' ? activeSession.value : null,
            completedSessionCount:
              count.status === 'fulfilled' ? count.value : 0,
            plan: plan.status === 'fulfilled' ? plan.value : null,
            recentSessions:
              recentSessions.status === 'fulfilled' ? recentSessions.value : [],
            scheduledWorkout:
              scheduledWorkout.status === 'fulfilled'
                ? scheduledWorkout.value
                : null,
          });
          setErrors({
            core: coreError,
            recent: recentSessions.status === 'rejected',
            statistics: count.status === 'rejected',
          });
          setError(coreError);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [database, isoWeekday, recentLimit, reloadKey])
  );

  return {
    data,
    error,
    errors,
    loading,
    retry: () => setReloadKey((value) => value + 1),
  };
}
