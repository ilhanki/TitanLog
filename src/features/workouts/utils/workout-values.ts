import type { WorkoutSet } from '@/features/workouts/domain/models';
import type { WeightUnit } from '@/features/profile/profile-preferences';

const MAX_WEIGHT_KG = 2000;
const MAX_REPETITIONS = 1000;
const KG_TO_LB = 2.2046226218;

export function getIsoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function parseWeightInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;

  const weight = Number(normalized);
  if (!Number.isFinite(weight) || weight < 0 || weight > MAX_WEIGHT_KG) {
    return null;
  }

  return weight;
}

export function parseRepetitionInput(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const repetitions = Number(normalized);
  if (
    !Number.isSafeInteger(repetitions) ||
    repetitions <= 0 ||
    repetitions > MAX_REPETITIONS
  ) {
    return null;
  }

  return repetitions;
}

export function formatWorkoutWeight(weightKg: number): string {
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 2,
  }).format(weightKg);
}

export function weightForDisplay(weightKg: number, unit: WeightUnit): number {
  const value = unit === 'lb' ? weightKg * KG_TO_LB : weightKg;
  return Math.round(value * 100) / 100;
}

export function displayedWeightToKg(weight: number, unit: WeightUnit): number {
  const value = unit === 'lb' ? weight / KG_TO_LB : weight;
  return Math.round(value * 100) / 100;
}

export function canCompleteSet(
  workoutSet: Pick<WorkoutSet, 'actualReps' | 'weightKg'>
): boolean {
  return (
    workoutSet.actualReps !== null &&
    workoutSet.actualReps > 0 &&
    Number.isFinite(workoutSet.weightKg) &&
    workoutSet.weightKg >= 0
  );
}

export type SessionMetrics = {
  completedSetCount: number;
  completedExerciseCount: number;
  averageEffort: number | null;
  averageEffortMode: 'rpe' | 'rir' | null;
  totalRepetitions: number;
  totalVolume: number;
  warmUpSetCount: number;
};

type SessionMetricsInput = {
  exercises: readonly {
    sets: readonly Pick<
      WorkoutSet,
      | 'actualReps'
      | 'effortMode'
      | 'effortValue'
      | 'isCompleted'
      | 'setType'
      | 'weightKg'
    >[];
    isSkipped?: boolean;
  }[];
};

export function calculateSessionMetrics(
  session: SessionMetricsInput
): SessionMetrics {
  let effortTotal = 0;
  let effortCount = 0;
  let effortMode: 'rpe' | 'rir' | null = null;
  let mixedEffortModes = false;
  const totals = session.exercises.reduce<SessionMetrics>(
    (metrics, exercise) => {
      const exerciseMetrics = exercise.sets.reduce<SessionMetrics>(
        (setMetrics, workoutSet) => {
          if (!workoutSet.isCompleted || workoutSet.actualReps === null) {
            return setMetrics;
          }

          if (
            workoutSet.effortValue !== null &&
            workoutSet.effortValue !== undefined
          ) {
            effortTotal += workoutSet.effortValue;
            effortCount += 1;
            if (workoutSet.effortMode) {
              if (effortMode && effortMode !== workoutSet.effortMode)
                mixedEffortModes = true;
              effortMode = workoutSet.effortMode;
            }
          }
          if (workoutSet.setType === 'warm_up') {
            return {
              ...setMetrics,
              warmUpSetCount: setMetrics.warmUpSetCount + 1,
            };
          }

          return {
            ...setMetrics,
            completedSetCount: setMetrics.completedSetCount + 1,
            totalRepetitions:
              setMetrics.totalRepetitions + workoutSet.actualReps,
            totalVolume:
              setMetrics.totalVolume +
              workoutSet.weightKg * workoutSet.actualReps,
          };
        },
        metrics
      );
      const exerciseCompleted = exercise.sets.some(
        (set) => set.isCompleted && (set.setType ?? 'working') !== 'warm_up'
      );
      return {
        ...exerciseMetrics,
        completedExerciseCount:
          exerciseMetrics.completedExerciseCount +
          (exerciseCompleted && !exercise.isSkipped ? 1 : 0),
      };
    },
    {
      averageEffort: null,
      averageEffortMode: null,
      completedExerciseCount: 0,
      completedSetCount: 0,
      totalRepetitions: 0,
      totalVolume: 0,
      warmUpSetCount: 0,
    }
  );
  return {
    ...totals,
    averageEffort:
      effortCount > 0 && !mixedEffortModes ? effortTotal / effortCount : null,
    averageEffortMode: mixedEffortModes ? null : effortMode,
  };
}

export function adjustWeight(
  weight: number,
  delta: number,
  maximum = MAX_WEIGHT_KG
): number {
  return Math.min(
    maximum,
    Math.max(0, Math.round((weight + delta) * 100) / 100)
  );
}
