import type {
  ExerciseAppearance,
  ExerciseIdentity,
  ExercisePerformanceSet,
  ExerciseRecord,
  ExerciseRecords,
  PersonalRecordResult,
} from '@/features/workouts/domain/exercise-performance';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';

export function normalizeExerciseName(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('tr-TR');
}

export function resolveExerciseIdentity(
  snapshot: { exerciseId: number | null; name: string },
  currentExercises: readonly { id: number; name: string }[]
): ExerciseIdentity | null {
  if (snapshot.exerciseId !== null) {
    return {
      exerciseId: snapshot.exerciseId,
      legacyMatched: false,
      name: snapshot.name,
    };
  }
  const normalized = normalizeExerciseName(snapshot.name);
  const matches = currentExercises.filter(
    (exercise) => normalizeExerciseName(exercise.name) === normalized
  );
  return matches.length === 1
    ? {
        exerciseId: matches[0]!.id,
        legacyMatched: true,
        name: snapshot.name,
      }
    : null;
}

function validNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function sanitizeCompletedSets(
  sets: readonly ExercisePerformanceSet[]
): ExercisePerformanceSet[] {
  return sets
    .filter(
      (set) =>
        Number.isSafeInteger(set.setNumber) &&
        set.setNumber > 0 &&
        Number.isSafeInteger(set.actualReps) &&
        set.actualReps >= 0 &&
        validNumber(set.weightKg)
    )
    .sort((left, right) => left.setNumber - right.setNumber);
}

export function createExerciseAppearance(
  appearance: Omit<
    ExerciseAppearance,
    | 'completedSetCount'
    | 'highestWeightKg'
    | 'sets'
    | 'totalRepetitions'
    | 'totalVolume'
  > & { sets: readonly ExercisePerformanceSet[] }
): ExerciseAppearance {
  const sets = sanitizeCompletedSets(appearance.sets);
  return {
    ...appearance,
    completedSetCount: sets.length,
    highestWeightKg:
      sets.length > 0
        ? Math.max(...sets.map((workoutSet) => workoutSet.weightKg))
        : null,
    sets,
    totalRepetitions: sets.reduce(
      (total, workoutSet) => total + workoutSet.actualReps,
      0
    ),
    totalVolume: sets.reduce(
      (total, workoutSet) =>
        total + workoutSet.weightKg * workoutSet.actualReps,
      0
    ),
  };
}

function laterThan(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime)) return false;
  if (!Number.isFinite(rightTime)) return true;
  return leftTime > rightTime;
}

function updateRecord(
  current: ExerciseRecord | null,
  value: number,
  appearance: ExerciseAppearance
): ExerciseRecord {
  if (current && value <= current.value) return current;
  return {
    achievedAt: appearance.completedAt,
    sessionId: appearance.sessionId,
    value,
  };
}

export function calculateExerciseRecords(
  appearances: readonly ExerciseAppearance[]
): ExerciseRecords {
  let highestWeight: ExerciseRecord | null = null;
  let highestRepetitions: ExerciseRecord | null = null;
  let highestSessionVolume: ExerciseRecord | null = null;
  let lastPerformance: ExerciseAppearance | null = null;

  for (const appearance of [...appearances].sort((left, right) => {
    const dateDifference =
      Date.parse(left.completedAt) - Date.parse(right.completedAt);
    return dateDifference || left.sessionId - right.sessionId;
  })) {
    if (
      !lastPerformance ||
      laterThan(appearance.completedAt, lastPerformance.completedAt) ||
      (appearance.completedAt === lastPerformance.completedAt &&
        appearance.sessionId > lastPerformance.sessionId)
    ) {
      lastPerformance = appearance;
    }
    if (appearance.highestWeightKg !== null) {
      highestWeight = updateRecord(
        highestWeight,
        appearance.highestWeightKg,
        appearance
      );
    }
    for (const set of appearance.sets) {
      highestRepetitions = updateRecord(
        highestRepetitions,
        set.actualReps,
        appearance
      );
    }
    highestSessionVolume = updateRecord(
      highestSessionVolume,
      appearance.totalVolume,
      appearance
    );
  }

  return {
    appearanceCount: appearances.length,
    highestRepetitions,
    highestSessionVolume,
    highestWeight,
    lastPerformance,
    legacyMatched: appearances.some((appearance) => appearance.legacyMatched),
  };
}

export function comparePersonalRecords(
  set: ExercisePerformanceSet,
  currentSessionVolume: number,
  prior: ExerciseRecords | null
): PersonalRecordResult[] {
  if (!prior || prior.appearanceCount === 0) return [];
  const results: PersonalRecordResult[] = [];
  if (prior.highestWeight && set.weightKg > prior.highestWeight.value) {
    results.push({ kind: 'weight', value: set.weightKg });
  }
  if (
    prior.highestRepetitions &&
    set.actualReps > prior.highestRepetitions.value
  ) {
    results.push({ kind: 'repetitions', value: set.actualReps });
  }
  if (
    prior.highestSessionVolume &&
    currentSessionVolume > prior.highestSessionVolume.value
  ) {
    results.push({ kind: 'volume', value: currentSessionVolume });
  }
  return results;
}

export function formatPreviousPerformance(
  appearance: ExerciseAppearance | null
): { accessibility: string; compact: string; wheel: string } {
  if (!appearance || appearance.sets.length === 0) {
    return {
      accessibility: 'Bu egzersiz için önceki tamamlanmış kayıt yok.',
      compact: 'İlk kayıt',
      wheel: 'Önceki tamamlanmış kayıt yok',
    };
  }
  const pairs = appearance.sets.map(
    (set) => `${formatWorkoutWeight(set.weightKg)}×${set.actualReps}`
  );
  const uniform = pairs.every((pair) => pair === pairs[0]);
  const compact = uniform
    ? `Geçen: ${pairs[0]} · ${appearance.completedSetCount} set`
    : `Geçen: en yüksek ${formatWorkoutWeight(appearance.highestWeightKg ?? 0)} kg · ${appearance.completedSetCount} set`;
  const full = `Geçen antrenman: ${pairs.join(' · ')}. Toplam ${appearance.completedSetCount} set.`;
  return {
    accessibility: full,
    compact,
    wheel: compact.replace('Geçen:', 'Geçen antrenman:'),
  };
}
