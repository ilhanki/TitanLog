import {
  calculateSessionMetrics,
  canCompleteSet,
  displayedWeightToKg,
  formatWorkoutWeight,
  getIsoWeekday,
  parseRepetitionInput,
  parseWeightInput,
  weightForDisplay,
} from '@/features/workouts/utils/workout-values';

describe('workout value helpers', () => {
  it('maps JavaScript weekdays to ISO weekdays', () => {
    expect(getIsoWeekday(new Date(2026, 6, 26))).toBe(7);
    expect(getIsoWeekday(new Date(2026, 6, 27))).toBe(1);
    expect(getIsoWeekday(new Date(2026, 6, 31))).toBe(5);
  });

  it('accepts Turkish and international decimal weights within limits', () => {
    expect(parseWeightInput(' 12,5 ')).toBe(12.5);
    expect(parseWeightInput('12.50')).toBe(12.5);
    expect(parseWeightInput('2000')).toBe(2000);
    expect(parseWeightInput('0')).toBe(0);
    expect(parseWeightInput('-1')).toBeNull();
    expect(parseWeightInput('12,555')).toBeNull();
    expect(parseWeightInput('2000.01')).toBeNull();
  });

  it('accepts only bounded whole-number repetitions', () => {
    expect(parseRepetitionInput('0')).toBeNull();
    expect(parseRepetitionInput('12')).toBe(12);
    expect(parseRepetitionInput('1000')).toBe(1000);
    expect(parseRepetitionInput('-1')).toBeNull();
    expect(parseRepetitionInput('12,5')).toBeNull();
    expect(parseRepetitionInput('1001')).toBeNull();
  });

  it('formats decimal weights with a Turkish comma', () => {
    expect(formatWorkoutWeight(17.5)).toBe('17,5');
    expect(formatWorkoutWeight(50)).toBe('50');
  });

  it('requires a positive repetition count before a set can complete', () => {
    expect(canCompleteSet({ actualReps: 10, weightKg: 0 })).toBe(true);
    expect(canCompleteSet({ actualReps: 0, weightKg: 20 })).toBe(false);
    expect(canCompleteSet({ actualReps: null, weightKg: 20 })).toBe(false);
  });

  it('round-trips lb display values without changing kg storage', () => {
    const pounds = weightForDisplay(40, 'lb');
    expect(pounds).toBe(88.18);
    expect(displayedWeightToKg(pounds, 'lb')).toBeCloseTo(40, 1);
    expect(displayedWeightToKg(weightForDisplay(40, 'kg'), 'kg')).toBe(40);
  });

  it('calculates completed metrics and counts per-hand weight only once', () => {
    const session = {
      exercises: [
        {
          sets: [
            { actualReps: 10, isCompleted: true, weightKg: 12.5 },
            { actualReps: 8, isCompleted: false, weightKg: 12.5 },
          ],
        },
        {
          sets: [{ actualReps: 6, isCompleted: true, weightKg: 20 }],
        },
      ],
    };

    expect(calculateSessionMetrics(session)).toEqual({
      averageEffort: null,
      averageEffortMode: null,
      completedExerciseCount: 2,
      completedSetCount: 2,
      totalRepetitions: 16,
      totalVolume: 245,
      warmUpSetCount: 0,
    });
  });
});
