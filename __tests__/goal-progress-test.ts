import { calculateGoalProgress } from '@/features/home/calculate-goal-progress';

describe('calculateGoalProgress', () => {
  it('calculates progress from starting, current, and target weights', () => {
    expect(calculateGoalProgress(119.6, 114.8, 99.9)).toBeCloseTo(0.2437, 4);
  });

  it('clamps progress to the supported range', () => {
    expect(calculateGoalProgress(119.6, 125, 99.9)).toBe(0);
    expect(calculateGoalProgress(119.6, 95, 99.9)).toBe(1);
  });
});
