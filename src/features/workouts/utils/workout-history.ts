import type {
  CompletedWorkoutComparison,
  CompletedWorkoutDetail,
  CompletedWorkoutExerciseDetail,
  WorkoutSession,
} from '@/features/workouts/domain/models';
import { calculateSessionMetrics } from '@/features/workouts/utils/workout-values';

export function calculateWorkoutDurationMinutes(
  startedAt: string,
  completedAt: string
): number | null {
  const started = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  if (
    !Number.isFinite(started) ||
    !Number.isFinite(completed) ||
    completed < started
  ) {
    return null;
  }
  return Math.floor((completed - started) / 60_000);
}

function createExerciseDetail(
  exercise: WorkoutSession['exercises'][number]
): CompletedWorkoutExerciseDetail {
  const metrics = calculateSessionMetrics({ exercises: [exercise] });
  return {
    ...exercise,
    completedSetCount: metrics.completedSetCount,
    totalRepetitions: metrics.totalRepetitions,
    totalVolume: metrics.totalVolume,
  };
}

function createComparison(
  current: WorkoutSession,
  previous: WorkoutSession | null
): CompletedWorkoutComparison | null {
  if (!previous?.completedAt || !current.completedAt) return null;
  const currentMetrics = calculateSessionMetrics(current);
  const previousMetrics = calculateSessionMetrics(previous);
  const currentDuration = calculateWorkoutDurationMinutes(
    current.startedAt,
    current.completedAt
  );
  const previousDuration = calculateWorkoutDurationMinutes(
    previous.startedAt,
    previous.completedAt
  );
  const totalVolumeDifference =
    currentMetrics.totalVolume - previousMetrics.totalVolume;

  return {
    completedSetDifference:
      currentMetrics.completedSetCount - previousMetrics.completedSetCount,
    durationDifferenceMinutes:
      currentDuration === null || previousDuration === null
        ? null
        : currentDuration - previousDuration,
    previousCompletedAt: previous.completedAt,
    previousSessionId: previous.id,
    totalRepetitionDifference:
      currentMetrics.totalRepetitions - previousMetrics.totalRepetitions,
    totalVolumeDifference,
    volumePercentageDifference:
      previousMetrics.totalVolume > 0
        ? (totalVolumeDifference / previousMetrics.totalVolume) * 100
        : null,
  };
}

export function createCompletedWorkoutDetail(
  session: WorkoutSession,
  previousSession: WorkoutSession | null
): CompletedWorkoutDetail | null {
  if (session.status !== 'completed' || !session.completedAt) return null;
  const metrics = calculateSessionMetrics(session);
  return {
    comparison: createComparison(session, previousSession),
    completedAt: session.completedAt,
    completedSetCount: metrics.completedSetCount,
    durationMinutes: calculateWorkoutDurationMinutes(
      session.startedAt,
      session.completedAt
    ),
    exercises: session.exercises.map(createExerciseDetail),
    id: session.id,
    startedAt: session.startedAt,
    totalRepetitions: metrics.totalRepetitions,
    totalVolume: metrics.totalVolume,
    workoutDayId: session.workoutDayId,
    workoutName: session.workoutName,
  };
}
