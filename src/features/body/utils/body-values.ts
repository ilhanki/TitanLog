import type {
  BodyMeasurement,
  BodyProfile,
  BodyProgress,
} from '@/features/body/domain/models';

const WEIGHT_MIN_KG = 20;
const WEIGHT_MAX_KG = 400;
const MEASUREMENT_MIN_CM = 20;
const MEASUREMENT_MAX_CM = 300;
export const BODY_NOTE_MAX_LENGTH = 250;

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseBodyWeight(value: string): number | null {
  const parsed = parseDecimal(value);
  return parsed !== null && parsed >= WEIGHT_MIN_KG && parsed <= WEIGHT_MAX_KG
    ? parsed
    : null;
}

export function parseOptionalBodyMeasurement(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = parseDecimal(value);
  return parsed !== null &&
    parsed >= MEASUREMENT_MIN_CM &&
    parsed <= MEASUREMENT_MAX_CM
    ? parsed
    : null;
}

export function isValidOptionalBodyMeasurement(value: string): boolean {
  return value.trim() === '' || parseOptionalBodyMeasurement(value) !== null;
}

export function formatBodyValue(value: number): string {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(
    value
  );
}

export function calculateBodyProgress(
  profile: Pick<BodyProfile, 'startingWeightKg' | 'targetWeightKg'>,
  latest: Pick<BodyMeasurement, 'weightKg'>,
  previous: Pick<BodyMeasurement, 'weightKg'> | null
): BodyProgress {
  const { startingWeightKg, targetWeightKg } = profile;
  const currentWeightKg = latest.weightKg;
  const direction = targetWeightKg > startingWeightKg ? 'gain' : 'loss';
  const rawProgress =
    direction === 'loss'
      ? (startingWeightKg - currentWeightKg) /
        (startingWeightKg - targetWeightKg)
      : (currentWeightKg - startingWeightKg) /
        (targetWeightKg - startingWeightKg);
  const progress = Math.min(Math.max(rawProgress, 0), 1);
  const targetReached =
    direction === 'loss'
      ? currentWeightKg <= targetWeightKg
      : currentWeightKg >= targetWeightKg;

  return {
    changeFromPreviousKg: previous ? currentWeightKg - previous.weightKg : null,
    currentWeightKg,
    direction,
    progress,
    progressPercentage: Math.round(progress * 100),
    remainingWeightKg: targetReached
      ? 0
      : Math.abs(targetWeightKg - currentWeightKg),
    targetReached,
    totalChangeKg: currentWeightKg - startingWeightKg,
  };
}
