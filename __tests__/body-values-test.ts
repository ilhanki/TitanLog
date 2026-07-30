import type { BodyMeasurement } from '@/features/body/domain/models';
import {
  calculateBodyProgress,
  createBodyWeightSummary,
  formatBodyValue,
  isValidOptionalBodyMeasurement,
  parseBodyWeight,
  parseOptionalBodyMeasurement,
} from '@/features/body/utils/body-values';

describe('body value helpers', () => {
  it('parses comma and period weights within the allowed range', () => {
    expect(parseBodyWeight('72,5')).toBe(72.5);
    expect(parseBodyWeight('72.5')).toBe(72.5);
    expect(parseBodyWeight('19.9')).toBeNull();
    expect(parseBodyWeight('400.1')).toBeNull();
    expect(parseBodyWeight('NaN')).toBeNull();
  });

  it('validates nullable circumference values', () => {
    expect(parseOptionalBodyMeasurement('')).toBeNull();
    expect(parseOptionalBodyMeasurement('84,5')).toBe(84.5);
    expect(isValidOptionalBodyMeasurement('')).toBe(true);
    expect(isValidOptionalBodyMeasurement('19')).toBe(false);
    expect(isValidOptionalBodyMeasurement('301')).toBe(false);
  });

  it('formats decimals in Turkish', () => {
    expect(formatBodyValue(72.5)).toBe('72,5');
  });

  it('calculates weight-loss progress and previous change', () => {
    expect(
      calculateBodyProgress(
        { startingWeightKg: 100, targetWeightKg: 80 },
        { weightKg: 90 },
        { weightKg: 92 } as BodyMeasurement
      )
    ).toEqual({
      changeFromPreviousKg: -2,
      currentWeightKg: 90,
      direction: 'loss',
      progress: 0.5,
      progressPercentage: 50,
      remainingWeightKg: 10,
      targetReached: false,
      totalChangeKg: -10,
    });
  });

  it('calculates weight-gain progress', () => {
    const result = calculateBodyProgress(
      { startingWeightKg: 60, targetWeightKg: 80 },
      { weightKg: 70 },
      null
    );
    expect(result.direction).toBe('gain');
    expect(result.progress).toBe(0.5);
    expect(result.remainingWeightKg).toBe(10);
    expect(result.changeFromPreviousKg).toBeNull();
  });

  it('clamps progress and reports reached targets', () => {
    const loss = calculateBodyProgress(
      { startingWeightKg: 100, targetWeightKg: 80 },
      { weightKg: 75 },
      null
    );
    const gain = calculateBodyProgress(
      { startingWeightKg: 60, targetWeightKg: 80 },
      { weightKg: 85 },
      null
    );
    expect(loss).toMatchObject({
      progress: 1,
      remainingWeightKg: 0,
      targetReached: true,
    });
    expect(gain).toMatchObject({
      progress: 1,
      remainingWeightKg: 0,
      targetReached: true,
    });
  });

  it('handles opposite movement, equal endpoints, and targets beyond the current value without NaN', () => {
    const opposite = calculateBodyProgress(
      { startingWeightKg: 100, targetWeightKg: 80 },
      { weightKg: 105 },
      null
    );
    const equalReached = calculateBodyProgress(
      { startingWeightKg: 80, targetWeightKg: 80 },
      { weightKg: 80 },
      null
    );
    const equalNotReached = calculateBodyProgress(
      { startingWeightKg: 80, targetWeightKg: 80 },
      { weightKg: 82 },
      null
    );

    expect(opposite).toMatchObject({ progress: 0, remainingWeightKg: 25 });
    expect(equalReached).toMatchObject({ progress: 1, targetReached: true });
    expect(equalNotReached).toMatchObject({
      progress: 0,
      targetReached: false,
    });
    expect(Number.isNaN(equalNotReached.progress)).toBe(false);
  });

  it('uses the profile initial weight only when no valid measurement exists', () => {
    const profile = {
      createdAt: '2026-07-01T10:00:00.000Z',
      id: 1,
      startingWeightKg: 80,
      targetWeightKg: 70,
      updatedAt: '2026-07-01T10:00:00.000Z',
    };
    const invalid = {
      measuredAt: 'invalid',
      weightKg: Number.NaN,
    } as BodyMeasurement;
    const summary = createBodyWeightSummary(profile, [invalid], 1);

    expect(summary).toMatchObject({
      currentSource: 'profile',
      currentWeightKg: 80,
      latestMeasurementAt: null,
    });
    expect(createBodyWeightSummary(null, [], 0)).toBeNull();
  });

  it('compares the latest measurement with the immediately older valid row', () => {
    const profile = {
      createdAt: '2026-07-01T10:00:00.000Z',
      id: 1,
      startingWeightKg: 100,
      targetWeightKg: 80,
      updatedAt: '2026-07-01T10:00:00.000Z',
    };
    const rows = [
      { measuredAt: '2026-07-30T10:00:00.000Z', weightKg: 92 },
      { measuredAt: 'invalid', weightKg: Number.NaN },
      { measuredAt: '2026-07-20T10:00:00.000Z', weightKg: 94 },
    ] as BodyMeasurement[];

    expect(createBodyWeightSummary(profile, rows, 3)?.previousChangeKg).toBe(
      -2
    );
  });
});
