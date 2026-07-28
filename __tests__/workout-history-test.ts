import type { WorkoutSession } from '@/features/workouts/domain/models';
import {
  calculateWorkoutDurationMinutes,
  createCompletedWorkoutDetail,
} from '@/features/workouts/utils/workout-history';

function createSession(
  overrides: Partial<WorkoutSession> = {}
): WorkoutSession {
  return {
    cancelledAt: null,
    completedAt: '2026-07-28T19:12:00.000Z',
    exercises: [
      {
        exerciseId: 2,
        id: 20,
        muscleGroup: 'Biceps',
        name: 'Dumbbell Curl',
        sets: [
          {
            actualReps: 10,
            completedAt: '2026-07-28T18:50:00.000Z',
            id: 30,
            isCompleted: true,
            setNumber: 1,
            targetReps: 12,
            weightKg: 17.5,
          },
          {
            actualReps: 12,
            completedAt: null,
            id: 31,
            isCompleted: false,
            setNumber: 2,
            targetReps: 12,
            weightKg: 17.5,
          },
        ],
        sortOrder: 1,
        weightMode: 'per_hand',
      },
    ],
    id: 10,
    startedAt: '2026-07-28T18:00:00.000Z',
    status: 'completed',
    workoutDayId: 1,
    workoutName: 'Sırt + Biceps',
    ...overrides,
  };
}

describe('workout history calculations', () => {
  it('calculates non-negative duration and reports invalid timestamps honestly', () => {
    expect(
      calculateWorkoutDurationMinutes(
        '2026-07-28T18:00:00.000Z',
        '2026-07-28T19:12:00.000Z'
      )
    ).toBe(72);
    expect(
      calculateWorkoutDurationMinutes('invalid', 'also-invalid')
    ).toBeNull();
    expect(
      calculateWorkoutDurationMinutes(
        '2026-07-28T19:12:00.000Z',
        '2026-07-28T18:00:00.000Z'
      )
    ).toBeNull();
  });

  it('uses only completed sets and counts per-hand weight once', () => {
    const detail = createCompletedWorkoutDetail(createSession(), null);

    expect(detail).toMatchObject({
      completedSetCount: 1,
      durationMinutes: 72,
      totalRepetitions: 10,
      totalVolume: 175,
    });
    expect(detail?.exercises[0]).toMatchObject({
      completedSetCount: 1,
      totalRepetitions: 10,
      totalVolume: 175,
    });
    expect(detail?.exercises[0]?.sets).toHaveLength(2);
  });

  it('compares with the previous same-program workout without judging duration', () => {
    const previous = createSession({
      completedAt: '2026-07-21T19:00:00.000Z',
      id: 9,
      startedAt: '2026-07-21T18:00:00.000Z',
    });
    const current = createSession({
      exercises: [
        {
          ...createSession().exercises[0]!,
          sets: [
            {
              ...createSession().exercises[0]!.sets[0]!,
              actualReps: 12,
              weightKg: 20,
            },
          ],
        },
      ],
    });

    expect(createCompletedWorkoutDetail(current, previous)?.comparison).toEqual(
      {
        completedSetDifference: 0,
        durationDifferenceMinutes: 12,
        previousCompletedAt: '2026-07-21T19:00:00.000Z',
        previousSessionId: 9,
        totalRepetitionDifference: 2,
        totalVolumeDifference: 65,
        volumePercentageDifference: (65 / 175) * 100,
      }
    );
  });

  it('omits a percentage when the previous volume is zero', () => {
    const previous = createSession({
      exercises: [
        {
          ...createSession().exercises[0]!,
          sets: [],
        },
      ],
      id: 9,
    });

    expect(
      createCompletedWorkoutDetail(createSession(), previous)?.comparison
        ?.volumePercentageDifference
    ).toBeNull();
  });
});
