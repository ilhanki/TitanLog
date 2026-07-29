import type { ExerciseAppearance } from '@/features/workouts/domain/exercise-performance';
import {
  calculateExerciseRecords,
  comparePersonalRecords,
  createExerciseAppearance,
  formatPreviousPerformance,
  normalizeExerciseName,
  resolveExerciseIdentity,
} from '@/features/workouts/utils/exercise-performance';

function appearance(
  sessionId: number,
  completedAt: string,
  sets: { actualReps: number; setNumber: number; weightKg: number }[]
): ExerciseAppearance {
  return createExerciseAppearance({
    completedAt,
    exerciseId: 7,
    legacyMatched: false,
    sessionExerciseId: sessionId * 10,
    sessionId,
    sets,
    weightMode: 'per_hand',
    workoutName: 'Sırt',
  });
}

describe('exercise performance calculations', () => {
  it('prefers stable identity and only uses unambiguous exact legacy matches', () => {
    const exercises = [
      { id: 1, name: 'İtiş' },
      { id: 2, name: 'Çekiş' },
    ];
    expect(
      resolveExerciseIdentity({ exerciseId: 44, name: 'Eski Ad' }, exercises)
    ).toMatchObject({ exerciseId: 44, legacyMatched: false });
    expect(
      resolveExerciseIdentity({ exerciseId: null, name: '  İTİŞ ' }, exercises)
    ).toMatchObject({ exerciseId: 1, legacyMatched: true });
    expect(normalizeExerciseName(' İSTANBUL ')).toBe('istanbul');
    expect(
      resolveExerciseIdentity({ exerciseId: null, name: 'İtiş' }, [
        ...exercises,
        { id: 3, name: 'itiş' },
      ])
    ).toBeNull();
    expect(
      resolveExerciseIdentity({ exerciseId: null, name: 'İti' }, exercises)
    ).toBeNull();
  });

  it('calculates completed-set records and counts per-hand weight once', () => {
    const first = appearance(1, '2026-07-01T10:00:00.000Z', [
      { actualReps: 12, setNumber: 1, weightKg: 20 },
      { actualReps: 10, setNumber: 2, weightKg: 25 },
    ]);
    const second = appearance(2, '2026-07-02T10:00:00.000Z', [
      { actualReps: 15, setNumber: 1, weightKg: 25 },
    ]);
    const records = calculateExerciseRecords([second, first]);

    expect(first.totalVolume).toBe(490);
    expect(records.highestWeight).toMatchObject({ sessionId: 1, value: 25 });
    expect(records.highestRepetitions).toMatchObject({
      sessionId: 2,
      value: 15,
    });
    expect(records.highestSessionVolume).toMatchObject({
      sessionId: 1,
      value: 490,
    });
    expect(records.lastPerformance?.sessionId).toBe(2);
  });

  it('preserves earliest record dates on ties and ignores malformed sets', () => {
    const first = appearance(1, '2026-07-01T10:00:00.000Z', [
      { actualReps: 12, setNumber: 1, weightKg: 50 },
    ]);
    const tied = appearance(2, '2026-07-02T10:00:00.000Z', [
      { actualReps: 12, setNumber: 1, weightKg: 50 },
      { actualReps: Number.NaN, setNumber: 2, weightKg: 999 },
    ]);
    const records = calculateExerciseRecords([tied, first]);

    expect(tied.sets).toHaveLength(1);
    expect(records.highestWeight?.sessionId).toBe(1);
    expect(records.highestRepetitions?.sessionId).toBe(1);
  });

  it('detects only strict records and requires a prior baseline', () => {
    const prior = calculateExerciseRecords([
      appearance(1, '2026-07-01T10:00:00.000Z', [
        { actualReps: 12, setNumber: 1, weightKg: 50 },
      ]),
    ]);
    expect(
      comparePersonalRecords(
        { actualReps: 12, setNumber: 1, weightKg: 50 },
        600,
        prior
      )
    ).toEqual([]);
    expect(
      comparePersonalRecords(
        { actualReps: 13, setNumber: 1, weightKg: 55 },
        715,
        prior
      ).map((record) => record.kind)
    ).toEqual(['weight', 'repetitions', 'volume']);
    expect(
      comparePersonalRecords(
        { actualReps: 13, setNumber: 1, weightKg: 55 },
        715,
        null
      )
    ).toEqual([]);
  });

  it('formats uniform and varied previous sessions truthfully', () => {
    const uniform = appearance(1, '2026-07-01T10:00:00.000Z', [
      { actualReps: 12, setNumber: 1, weightKg: 50 },
      { actualReps: 12, setNumber: 2, weightKg: 50 },
    ]);
    const varied = appearance(2, '2026-07-02T10:00:00.000Z', [
      { actualReps: 12, setNumber: 1, weightKg: 50 },
      { actualReps: 10, setNumber: 2, weightKg: 55 },
    ]);
    expect(formatPreviousPerformance(uniform).compact).toBe(
      'Geçen: 50×12 · 2 set'
    );
    expect(formatPreviousPerformance(varied).compact).toBe(
      'Geçen: en yüksek 55 kg · 2 set'
    );
    expect(formatPreviousPerformance(null).compact).toBe('İlk kayıt');
  });
});
