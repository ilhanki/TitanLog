import {
  isPrimaryWorkingSet,
  isWorkoutSetType,
  validateEffort,
} from '@/features/workouts/domain/set-policy';

describe('workout set policy', () => {
  it.each(['warm_up', 'working', 'drop', 'amrap', 'failure'] as const)(
    'accepts %s',
    (type) => {
      expect(isWorkoutSetType(type)).toBe(true);
    }
  );

  it('excludes warm-up and includes every completed working type', () => {
    expect(isPrimaryWorkingSet('warm_up')).toBe(false);
    for (const type of ['working', 'drop', 'amrap', 'failure'] as const)
      expect(isPrimaryWorkingSet(type)).toBe(true);
  });

  it('validates optional RPE and RIR boundaries without conversion', () => {
    expect(validateEffort('off', null)).toBe(true);
    expect(validateEffort('rpe', 1)).toBe(true);
    expect(validateEffort('rpe', 9.5)).toBe(true);
    expect(validateEffort('rpe', 10.5)).toBe(false);
    expect(validateEffort('rir', 0)).toBe(true);
    expect(validateEffort('rir', 10)).toBe(true);
    expect(validateEffort('rir', 2.5)).toBe(false);
  });
});
