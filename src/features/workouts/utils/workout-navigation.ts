import type {
  WorkoutDayDetails,
  WorkoutSession,
} from '@/features/workouts/domain/models';

export type WorkoutStartDecision =
  | { kind: 'resume'; sessionId: number }
  | { dayId: number; kind: 'start' }
  | { kind: 'rest' };

export function decideWorkoutStart(
  activeSession: WorkoutSession | null,
  scheduledWorkout: WorkoutDayDetails | null
): WorkoutStartDecision {
  if (activeSession) return { kind: 'resume', sessionId: activeSession.id };
  if (scheduledWorkout) return { dayId: scheduledWorkout.id, kind: 'start' };
  return { kind: 'rest' };
}
