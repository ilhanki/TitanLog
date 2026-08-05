import type {
  ExerciseDefaultsDraft,
  WeightMode,
  WorkoutDayDraft,
} from '@/features/workouts/domain/models';
import { parseWeightInput } from '@/features/workouts/utils/workout-values';

export const MAX_WORKOUT_DAY_NAME_LENGTH = 60;
export const MAX_EXERCISE_NAME_LENGTH = 80;
export const MAX_OPTIONAL_DESCRIPTION_LENGTH = 120;

export function normalizeRequiredName(
  value: string,
  maximumLength: number
): string | null {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximumLength
    ? normalized
    : null;
}

export function normalizeOptionalText(
  value: string,
  maximumLength = MAX_OPTIONAL_DESCRIPTION_LENGTH
): string | null {
  const normalized = value.trim();
  return normalized.length <= maximumLength ? normalized : null;
}

export function parseDefaultSetCount(value: string): number | null {
  return parseBoundedInteger(value, 1, 10);
}

export function parseDefaultRepetitions(value: string): number | null {
  return parseBoundedInteger(value, 1, 100);
}

export function parseDefaultRestSeconds(value: string): number | null {
  return parseBoundedInteger(value, 15, 1800);
}

function parseBoundedInteger(
  value: string,
  minimum: number,
  maximum: number
): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

export function parseDefaultWeight(value: string): number | null {
  const weight = parseWeightInput(value);
  return weight !== null && weight > 0 ? weight : null;
}

export function isDuplicateExerciseName(
  name: string,
  existingNames: readonly string[]
): boolean {
  const normalized = name.trim().toLocaleLowerCase('tr-TR');
  return existingNames.some(
    (existing) => existing.trim().toLocaleLowerCase('tr-TR') === normalized
  );
}

export function normalizeWeekdays(weekdays: readonly number[]): number[] {
  return [...new Set(weekdays)]
    .filter(
      (weekday) => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7
    )
    .sort((left, right) => left - right);
}

export function hasSequentialSortOrders(
  items: readonly { sortOrder: number }[]
): boolean {
  return items.every((item, index) => item.sortOrder === index + 1);
}

export function isWorkoutDayDraftDirty(
  original: WorkoutDayDraft,
  draft: WorkoutDayDraft
): boolean {
  return (
    original.name !== draft.name ||
    original.subtitle !== draft.subtitle ||
    normalizeWeekdays(original.scheduleWeekdays).join(',') !==
      normalizeWeekdays(draft.scheduleWeekdays).join(',')
  );
}

export function createExerciseDefaultsDraft(
  setCount: string,
  targetReps: string,
  weight: string,
  weightMode: WeightMode,
  defaultRestSeconds?: string
): ExerciseDefaultsDraft | null {
  const parsedSetCount = parseDefaultSetCount(setCount);
  const parsedTargetReps = parseDefaultRepetitions(targetReps);
  const parsedWeight = parseDefaultWeight(weight);
  const parsedRestSeconds =
    defaultRestSeconds === undefined
      ? undefined
      : parseDefaultRestSeconds(defaultRestSeconds);
  if (
    parsedSetCount === null ||
    parsedTargetReps === null ||
    parsedWeight === null ||
    parsedRestSeconds === null
  ) {
    return null;
  }
  return {
    setCount: parsedSetCount,
    targetReps: parsedTargetReps,
    weightKg: parsedWeight,
    weightMode,
    ...(defaultRestSeconds === undefined
      ? {}
      : {
          defaultRestSeconds: parsedRestSeconds,
        }),
  };
}
