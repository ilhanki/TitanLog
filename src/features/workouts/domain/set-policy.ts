import type {
  WorkoutEffortMode,
  WorkoutSetType,
} from '@/features/workouts/domain/models';

export const WORKOUT_SET_TYPES: readonly WorkoutSetType[] = [
  'warm_up',
  'working',
  'drop',
  'amrap',
  'failure',
];

export const SET_TYPE_LABELS: Record<WorkoutSetType, string> = {
  amrap: 'AMRAP',
  drop: 'Drop set',
  failure: 'Tükeniş',
  warm_up: 'Isınma',
  working: 'Çalışma',
};

export function isWorkoutSetType(value: unknown): value is WorkoutSetType {
  return WORKOUT_SET_TYPES.includes(value as WorkoutSetType);
}

export function isPrimaryWorkingSet(type: WorkoutSetType | undefined): boolean {
  return (type ?? 'working') !== 'warm_up';
}

export function validateEffort(
  mode: WorkoutEffortMode,
  value: number | null
): boolean {
  if (mode === 'off') return value === null;
  if (value === null || !Number.isFinite(value)) return false;
  if (mode === 'rpe') return value >= 1 && value <= 10 && (value * 2) % 1 === 0;
  return Number.isSafeInteger(value) && value >= 0 && value <= 10;
}
