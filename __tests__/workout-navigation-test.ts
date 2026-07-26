import type {
  WorkoutDayDetails,
  WorkoutSession,
} from '@/features/workouts/domain/models';
import { decideWorkoutStart } from '@/features/workouts/utils/workout-navigation';

describe('workout start decision', () => {
  it('always resumes an active session before considering the schedule', () => {
    expect(
      decideWorkoutStart(
        { id: 42 } as WorkoutSession,
        { id: 7 } as WorkoutDayDetails
      )
    ).toEqual({ kind: 'resume', sessionId: 42 });
  });

  it('starts the scheduled workout when no session is active', () => {
    expect(decideWorkoutStart(null, { id: 7 } as WorkoutDayDetails)).toEqual({
      dayId: 7,
      kind: 'start',
    });
  });

  it('returns a rest decision when no workout is scheduled', () => {
    expect(decideWorkoutStart(null, null)).toEqual({ kind: 'rest' });
  });
});
