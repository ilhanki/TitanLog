import type {
  ExerciseAppearance,
  ExercisePerformanceSet,
} from '@/features/workouts/domain/exercise-performance';
import type {
  WorkoutSession,
  WorkoutSetType,
} from '@/features/workouts/domain/models';
import {
  isPrimaryWorkingSet,
  isWorkoutSetType,
  SET_TYPE_LABELS,
  WORKOUT_SET_TYPES,
} from '@/features/workouts/domain/set-policy';
import {
  calculateExerciseRecords,
  comparePersonalRecords,
  createExerciseAppearance,
  formatPreviousPerformance,
} from '@/features/workouts/utils/exercise-performance';
import { calculateSessionMetrics } from '@/features/workouts/utils/workout-values';
import {
  calculateWorkoutDurationMinutes,
  createCompletedWorkoutDetail,
} from '@/features/workouts/utils/workout-history';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSet(
  overrides: Partial<ExercisePerformanceSet> = {}
): ExercisePerformanceSet {
  return {
    actualReps: 8,
    setNumber: 1,
    weightKg: 40,
    ...overrides,
  };
}

function makeAppearance(
  sessionId: number,
  completedAt: string,
  sets: ExercisePerformanceSet[]
): ExerciseAppearance {
  return createExerciseAppearance({
    completedAt,
    exerciseId: 7,
    legacyMatched: false,
    sessionExerciseId: sessionId * 10,
    sessionId,
    sets,
    weightMode: 'total',
    workoutName: 'Push',
  });
}

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    cancelledAt: null,
    completedAt: '2026-07-28T19:12:00.000Z',
    exercises: [
      {
        exerciseId: 2,
        id: 20,
        muscleGroup: 'Chest',
        name: 'Bench Press',
        sets: [
          {
            actualReps: 8,
            completedAt: '2026-07-28T18:50:00.000Z',
            id: 30,
            isCompleted: true,
            setType: 'amrap',
            setNumber: 1,
            targetReps: 8,
            weightKg: 60,
          },
        ],
        sortOrder: 1,
        weightMode: 'total',
      },
    ],
    id: 10,
    startedAt: '2026-07-28T18:00:00.000Z',
    status: 'completed',
    workoutDayId: 1,
    workoutName: 'Push Day',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AMRAP set type policy
// ---------------------------------------------------------------------------

describe('AMRAP set type coverage', () => {
  describe('type system and validation', () => {
    it('includes amrap in the canonical set type array', () => {
      expect(WORKOUT_SET_TYPES).toContain('amrap');
    });

    it('accepts amrap as a valid WorkoutSetType', () => {
      expect(isWorkoutSetType('amrap')).toBe(true);
    });

    it('classifies amrap as a primary working set', () => {
      expect(isPrimaryWorkingSet('amrap')).toBe(true);
    });

    it('does not classify warm_up as a primary working set', () => {
      expect(isPrimaryWorkingSet('warm_up')).toBe(false);
    });

    it('rejects invalid set type strings', () => {
      expect(isWorkoutSetType('AMRAP')).toBe(false);
      expect(isWorkoutSetType('max_effort')).toBe(false);
      expect(isWorkoutSetType('')).toBe(false);
      expect(isWorkoutSetType(null)).toBe(false);
      expect(isWorkoutSetType(undefined)).toBe(false);
    });
  });

  describe('Turkish accessibility labels', () => {
    it('maps amrap to AMRAP label', () => {
      expect(SET_TYPE_LABELS.amrap).toBe('AMRAP');
    });

    it('provides labels for all five set types', () => {
      for (const type of WORKOUT_SET_TYPES) {
        expect(SET_TYPE_LABELS[type]).toBeDefined();
        expect(typeof SET_TYPE_LABELS[type]).toBe('string');
        expect(SET_TYPE_LABELS[type].length).toBeGreaterThan(0);
      }
    });
  });

  describe('session metrics with AMRAP sets', () => {
    it('counts a completed AMRAP set as a working set', () => {
      const session = {
        exercises: [
          {
            sets: [
              {
                actualReps: 12,
                isCompleted: true,
                setType: 'amrap' as const,
                weightKg: 40,
              },
            ],
          },
        ],
      };
      const metrics = calculateSessionMetrics(session);
      expect(metrics.completedSetCount).toBe(1);
      expect(metrics.warmUpSetCount).toBe(0);
      expect(metrics.totalRepetitions).toBe(12);
      expect(metrics.totalVolume).toBe(480);
    });

    it('includes AMRAP repetitions and volume in totals', () => {
      const session = {
        exercises: [
          {
            sets: [
              {
                actualReps: 10,
                isCompleted: true,
                setType: 'working' as const,
                weightKg: 50,
              },
              {
                actualReps: 15,
                isCompleted: true,
                setType: 'amrap' as const,
                weightKg: 50,
              },
            ],
          },
        ],
      };
      const metrics = calculateSessionMetrics(session);
      expect(metrics.completedSetCount).toBe(2);
      expect(metrics.totalRepetitions).toBe(25);
      expect(metrics.totalVolume).toBe(1250);
    });

    it('excludes incomplete AMRAP sets from totals', () => {
      const session = {
        exercises: [
          {
            sets: [
              {
                actualReps: 12,
                isCompleted: true,
                setType: 'amrap' as const,
                weightKg: 40,
              },
              {
                actualReps: 8,
                isCompleted: false,
                setType: 'amrap' as const,
                weightKg: 40,
              },
            ],
          },
        ],
      };
      const metrics = calculateSessionMetrics(session);
      expect(metrics.completedSetCount).toBe(1);
      expect(metrics.totalRepetitions).toBe(12);
      expect(metrics.totalVolume).toBe(480);
    });

    it('excludes AMRAP sets with null actualReps from totals', () => {
      const session = {
        exercises: [
          {
            sets: [
              {
                actualReps: null,
                isCompleted: true,
                setType: 'amrap' as const,
                weightKg: 40,
              },
            ],
          },
        ],
      };
      const metrics = calculateSessionMetrics(session);
      expect(metrics.completedSetCount).toBe(0);
    });

    it('does not require RPE or RIR on an AMRAP set', () => {
      const session = {
        exercises: [
          {
            sets: [
              {
                actualReps: 15,
                isCompleted: true,
                setType: 'amrap' as const,
                weightKg: 50,
                effortMode: undefined,
                effortValue: undefined,
              },
            ],
          },
        ],
      };
      const metrics = calculateSessionMetrics(session);
      expect(metrics.completedSetCount).toBe(1);
      expect(metrics.averageEffort).toBeNull();
      expect(metrics.averageEffortMode).toBeNull();
    });

    it('includes effort when AMRAP set has optional RPE', () => {
      const session = {
        exercises: [
          {
            sets: [
              {
                actualReps: 15,
                isCompleted: true,
                setType: 'amrap' as const,
                weightKg: 50,
                effortMode: 'rpe' as const,
                effortValue: 10,
              },
            ],
          },
        ],
      };
      const metrics = calculateSessionMetrics(session);
      expect(metrics.averageEffort).toBe(10);
      expect(metrics.averageEffortMode).toBe('rpe');
    });

    it('treats every non-warm-up set type equivalently in working set count', () => {
      const types: WorkoutSetType[] = ['working', 'drop', 'amrap', 'failure'];
      for (const type of types) {
        const session = {
          exercises: [
            {
              sets: [
                {
                  actualReps: 10,
                  isCompleted: true,
                  setType: type,
                  weightKg: 50,
                },
              ],
            },
          ],
        };
        const metrics = calculateSessionMetrics(session);
        expect(metrics.completedSetCount).toBe(1);
        expect(metrics.warmUpSetCount).toBe(0);
      }
    });
  });

  describe('personal record eligibility', () => {
    it('qualifies a completed AMRAP set for a weight personal record', () => {
      const prior = calculateExerciseRecords([
        makeAppearance(1, '2026-07-01T10:00:00.000Z', [
          makeSet({ actualReps: 8, weightKg: 50 }),
        ]),
      ]);
      const amrapSet = makeSet({
        actualReps: 10,
        setType: 'amrap',
        weightKg: 55,
      });
      const results = comparePersonalRecords(amrapSet, 550, prior);
      expect(results.map((r) => r.kind)).toContain('weight');
    });

    it('qualifies a completed AMRAP set for a repetition personal record', () => {
      const prior = calculateExerciseRecords([
        makeAppearance(1, '2026-07-01T10:00:00.000Z', [
          makeSet({ actualReps: 8, weightKg: 50 }),
        ]),
      ]);
      const amrapSet = makeSet({
        actualReps: 15,
        setType: 'amrap',
        weightKg: 50,
      });
      const results = comparePersonalRecords(amrapSet, 750, prior);
      expect(results.map((r) => r.kind)).toContain('repetitions');
    });

    it('qualifies a completed AMRAP set for a volume personal record', () => {
      const prior = calculateExerciseRecords([
        makeAppearance(1, '2026-07-01T10:00:00.000Z', [
          makeSet({ actualReps: 8, weightKg: 50 }),
        ]),
      ]);
      const amrapSet = makeSet({
        actualReps: 12,
        setType: 'amrap',
        weightKg: 50,
      });
      const results = comparePersonalRecords(amrapSet, 700, prior);
      expect(results.map((r) => r.kind)).toContain('volume');
    });

    it('does not award a personal record when values are tied', () => {
      const prior = calculateExerciseRecords([
        makeAppearance(1, '2026-07-01T10:00:00.000Z', [
          makeSet({ actualReps: 8, weightKg: 50 }),
        ]),
      ]);
      const amrapSet = makeSet({
        actualReps: 8,
        setType: 'amrap',
        weightKg: 50,
      });
      const results = comparePersonalRecords(amrapSet, 400, prior);
      expect(results).toEqual([]);
    });
  });

  describe('exercise history and previous performance', () => {
    it('includes AMRAP sets in exercise appearance totals', () => {
      const appearance = makeAppearance(1, '2026-07-01T10:00:00.000Z', [
        makeSet({ actualReps: 10, setType: 'amrap', weightKg: 40 }),
        makeSet({
          actualReps: 8,
          setNumber: 2,
          setType: 'amrap',
          weightKg: 40,
        }),
      ]);
      expect(appearance.completedSetCount).toBe(2);
      expect(appearance.totalRepetitions).toBe(18);
      expect(appearance.totalVolume).toBe(720);
      expect(appearance.highestWeightKg).toBe(40);
    });

    it('formats AMRAP previous performance correctly', () => {
      const appearance = makeAppearance(1, '2026-07-01T10:00:00.000Z', [
        makeSet({ actualReps: 15, setType: 'amrap', weightKg: 40 }),
      ]);
      const formatted = formatPreviousPerformance(appearance);
      expect(formatted.compact).toContain('Geçen:');
      expect(formatted.accessibility).toContain('set');
      expect(formatted.wheel).toContain('antrenman');
    });

    it('does not alias AMRAP to working or failure in appearance set type', () => {
      const appearance = makeAppearance(1, '2026-07-01T10:00:00.000Z', [
        makeSet({ actualReps: 15, setType: 'amrap', weightKg: 40 }),
      ]);
      expect(appearance.sets[0]?.setType).toBe('amrap');
    });
  });

  describe('completed workout detail with AMRAP', () => {
    it('includes AMRAP sets in completed workout metrics', () => {
      const session = makeSession();
      const detail = createCompletedWorkoutDetail(session, null);
      expect(detail).not.toBeNull();
      expect(detail!.completedSetCount).toBe(1);
      expect(detail!.totalRepetitions).toBe(8);
      expect(detail!.totalVolume).toBe(480);
    });

    it('counts AMRAP exercise as having a completed working set', () => {
      const session = makeSession();
      const detail = createCompletedWorkoutDetail(session, null);
      expect(detail!.exercises[0]!.completedSetCount).toBe(1);
    });

    it('computes volume comparison correctly when AMRAP is present', () => {
      const previous = makeSession({
        id: 9,
        completedAt: '2026-07-21T19:00:00.000Z',
        startedAt: '2026-07-21T18:00:00.000Z',
        exercises: [
          {
            ...makeSession().exercises[0]!,
            sets: [
              {
                actualReps: 6,
                completedAt: '2026-07-21T18:50:00.000Z',
                id: 29,
                isCompleted: true,
                setType: 'amrap',
                setNumber: 1,
                targetReps: 6,
                weightKg: 60,
              },
            ],
          },
        ],
      });
      const current = makeSession();
      const detail = createCompletedWorkoutDetail(current, previous);
      expect(detail!.comparison).not.toBeNull();
      expect(detail!.comparison!.totalVolumeDifference).toBe(480 - 360);
      expect(detail!.comparison!.totalRepetitionDifference).toBe(8 - 6);
    });
  });

  describe('backup and archive set type support', () => {
    it('preserves AMRAP type identity through createExerciseAppearance', () => {
      const appearance = makeAppearance(1, '2026-07-01T10:00:00.000Z', [
        makeSet({ setType: 'amrap', actualReps: 10, weightKg: 50 }),
      ]);
      expect(appearance.sets[0]!.setType).toBe('amrap');
    });

    it('validates all five set types including amrap', () => {
      const allTypes: WorkoutSetType[] = [
        'warm_up',
        'working',
        'drop',
        'amrap',
        'failure',
      ];
      for (const type of allTypes) {
        expect(isWorkoutSetType(type)).toBe(true);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Comparable workout selection rule
// ---------------------------------------------------------------------------

describe('comparable workout comparison rule', () => {
  it('compares with the previous workout from the same program day', () => {
    const previous = makeSession({
      id: 9,
      completedAt: '2026-07-21T19:00:00.000Z',
      startedAt: '2026-07-21T18:00:00.000Z',
      workoutDayId: 1,
    });
    const current = makeSession({ workoutDayId: 1 });
    const detail = createCompletedWorkoutDetail(current, previous);
    expect(detail!.comparison).not.toBeNull();
    expect(detail!.comparison!.previousSessionId).toBe(9);
  });

  it('returns null comparison when no previous session exists', () => {
    const detail = createCompletedWorkoutDetail(makeSession(), null);
    expect(detail!.comparison).toBeNull();
  });

  it('omits volume percentage when previous volume is zero', () => {
    const previous = makeSession({
      id: 9,
      exercises: [
        {
          ...makeSession().exercises[0]!,
          sets: [],
        },
      ],
    });
    const detail = createCompletedWorkoutDetail(makeSession(), previous);
    expect(detail!.comparison!.volumePercentageDifference).toBeNull();
  });

  it('does not generate comparison for cancelled sessions', () => {
    const cancelled = makeSession({
      id: 9,
      completedAt: null,
      status: 'cancelled',
      cancelledAt: '2026-07-21T19:00:00.000Z',
    });
    const detail = createCompletedWorkoutDetail(makeSession(), cancelled);
    expect(detail!.comparison).toBeNull();
  });

  it('does not generate comparison for incomplete sessions', () => {
    const incomplete = makeSession({
      id: 9,
      completedAt: null,
      status: 'active',
    });
    const detail = createCompletedWorkoutDetail(makeSession(), incomplete);
    expect(detail!.comparison).toBeNull();
  });

  it('handles duration comparison when both sessions have valid timestamps', () => {
    const previous = makeSession({
      id: 9,
      completedAt: '2026-07-21T19:00:00.000Z',
      startedAt: '2026-07-21T18:00:00.000Z',
    });
    const current = makeSession({
      completedAt: '2026-07-28T19:12:00.000Z',
      startedAt: '2026-07-28T18:00:00.000Z',
    });
    const detail = createCompletedWorkoutDetail(current, previous);
    expect(detail!.comparison!.durationDifferenceMinutes).toBe(12);
  });

  it('returns null duration difference when timestamps are invalid', () => {
    const previous = makeSession({
      id: 9,
      completedAt: 'invalid',
      startedAt: 'also-invalid',
    });
    const detail = createCompletedWorkoutDetail(makeSession(), previous);
    expect(detail!.comparison!.durationDifferenceMinutes).toBeNull();
  });

  it('returns null for a session that is not completed', () => {
    const active = makeSession({ status: 'active', completedAt: null });
    const detail = createCompletedWorkoutDetail(active, null);
    expect(detail).toBeNull();
  });
});
