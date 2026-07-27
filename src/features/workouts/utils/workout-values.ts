import type { WorkoutSet } from '@/features/workouts/domain/models';

const MAX_WEIGHT_KG = 2000;
const MAX_REPETITIONS = 1000;

export function getIsoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function parseWeightInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;

  const weight = Number(normalized);
  if (!Number.isFinite(weight) || weight <= 0 || weight > MAX_WEIGHT_KG) {
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

export function canCompleteSet(
  workoutSet: Pick<WorkoutSet, 'actualReps' | 'weightKg'>
): boolean {
  return (
    workoutSet.actualReps !== null &&
    workoutSet.actualReps > 0 &&
    Number.isFinite(workoutSet.weightKg) &&
    workoutSet.weightKg > 0
  );
}

export type SessionMetrics = {
  completedSetCount: number;
  totalRepetitions: number;
  totalVolume: number;
};

type SessionMetricsInput = {
  exercises: readonly {
    sets: readonly Pick<
      WorkoutSet,
      'actualReps' | 'isCompleted' | 'weightKg'
    >[];
  }[];
};

export function calculateSessionMetrics(
  session: SessionMetricsInput
): SessionMetrics {
  return session.exercises.reduce<SessionMetrics>(
    (metrics, exercise) =>
      exercise.sets.reduce<SessionMetrics>((setMetrics, workoutSet) => {
        if (!workoutSet.isCompleted || workoutSet.actualReps === null) {
          return setMetrics;
        }

        return {
          completedSetCount: setMetrics.completedSetCount + 1,
          totalRepetitions: setMetrics.totalRepetitions + workoutSet.actualReps,
          totalVolume:
            setMetrics.totalVolume +
            workoutSet.weightKg * workoutSet.actualReps,
        };
      }, metrics),
    { completedSetCount: 0, totalRepetitions: 0, totalVolume: 0 }
  );
}
