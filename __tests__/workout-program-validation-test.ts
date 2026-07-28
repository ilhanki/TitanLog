import {
  createExerciseDefaultsDraft,
  hasSequentialSortOrders,
  isDuplicateExerciseName,
  isWorkoutDayDraftDirty,
  normalizeRequiredName,
  normalizeWeekdays,
  parseDefaultRepetitions,
  parseDefaultSetCount,
  parseDefaultWeight,
} from '@/features/workouts/utils/workout-program-validation';

describe('workout program validation', () => {
  it('accepts comma and period decimal weights', () => {
    expect(parseDefaultWeight('17,5')).toBe(17.5);
    expect(parseDefaultWeight('17.5')).toBe(17.5);
  });

  it('rejects invalid and unreasonable weights', () => {
    for (const value of ['', '0', '-1', 'NaN', 'Infinity', '2001']) {
      expect(parseDefaultWeight(value)).toBeNull();
    }
  });

  it('enforces set and repetition ranges', () => {
    expect(parseDefaultSetCount('1')).toBe(1);
    expect(parseDefaultSetCount('10')).toBe(10);
    expect(parseDefaultSetCount('0')).toBeNull();
    expect(parseDefaultSetCount('11')).toBeNull();
    expect(parseDefaultRepetitions('1')).toBe(1);
    expect(parseDefaultRepetitions('100')).toBe(100);
    expect(parseDefaultRepetitions('101')).toBeNull();
  });

  it('trims required names and rejects empty or long names', () => {
    expect(normalizeRequiredName('  Omuz  ', 10)).toBe('Omuz');
    expect(normalizeRequiredName('   ', 10)).toBeNull();
    expect(normalizeRequiredName('Uzun egzersiz', 5)).toBeNull();
  });

  it('detects case-insensitive Turkish duplicate names', () => {
    expect(isDuplicateExerciseName('  dumbbell curl ', ['Dumbbell Curl'])).toBe(
      true
    );
    expect(isDuplicateExerciseName('Cable Curl', ['Dumbbell Curl'])).toBe(
      false
    );
  });

  it('normalizes weekdays and detects dirty drafts', () => {
    expect(normalizeWeekdays([7, 1, 1, 9])).toEqual([1, 7]);
    const original = {
      name: 'Bacak',
      scheduleWeekdays: [1, 4],
      subtitle: 'Alt vücut',
    };
    expect(
      isWorkoutDayDraftDirty(original, {
        ...original,
        scheduleWeekdays: [4, 1],
      })
    ).toBe(false);
    expect(
      isWorkoutDayDraftDirty(original, { ...original, name: 'Omuz' })
    ).toBe(true);
  });

  it('recognizes sequential order and builds valid defaults', () => {
    expect(hasSequentialSortOrders([{ sortOrder: 1 }, { sortOrder: 2 }])).toBe(
      true
    );
    expect(hasSequentialSortOrders([{ sortOrder: 1 }, { sortOrder: 3 }])).toBe(
      false
    );
    expect(createExerciseDefaultsDraft('3', '12', '17,5', 'per_hand')).toEqual({
      setCount: 3,
      targetReps: 12,
      weightKg: 17.5,
      weightMode: 'per_hand',
    });
  });
});
