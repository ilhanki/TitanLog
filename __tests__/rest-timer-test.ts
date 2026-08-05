import {
  adjustRestTimerDeadline,
  createRestTimerState,
  getRestTimerRemainingSeconds,
  resolveRestDuration,
  shouldEmitRestFinished,
  shouldStartRestAfterSet,
} from '@/features/workouts/domain/rest-timer';

describe('rest timer domain', () => {
  const now = Date.parse('2026-08-05T10:00:00.000Z');

  it('uses an absolute deadline and corrects after background passage', () => {
    const timer = createRestTimerState(90, now, 7);
    expect(timer.deadline).toBe('2026-08-05T10:01:30.000Z');
    expect(getRestTimerRemainingSeconds(timer, now + 61_000)).toBe(29);
    expect(getRestTimerRemainingSeconds(timer, now + 120_000)).toBe(0);
  });

  it('adds, subtracts, skips and prevents duplicate completion', () => {
    const timer = createRestTimerState(60, now, null);
    expect(
      getRestTimerRemainingSeconds(
        adjustRestTimerDeadline(timer, 15, now)!,
        now
      )
    ).toBe(75);
    expect(adjustRestTimerDeadline(timer, -60, now)).toBeNull();
    expect(shouldEmitRestFinished(timer, now + 60_000)).toBe(true);
    expect(
      shouldEmitRestFinished(
        { ...timer, alertedAt: new Date(now).toISOString() },
        now + 60_000
      )
    ).toBe(false);
  });

  it('uses active, program, user and app defaults in order', () => {
    expect(
      resolveRestDuration({
        activeOverrideSeconds: 30,
        programDefaultSeconds: 60,
        globalDefaultSeconds: 120,
      })
    ).toBe(30);
    expect(
      resolveRestDuration({
        programDefaultSeconds: 60,
        globalDefaultSeconds: 120,
      })
    ).toBe(60);
    expect(resolveRestDuration({ globalDefaultSeconds: 120 })).toBe(120);
    expect(resolveRestDuration({})).toBe(90);
  });

  it('starts full rest only after the final superset member', () => {
    expect(
      shouldStartRestAfterSet({
        completedSupersetOrder: 0,
        groupMemberOrders: [0, 1],
      })
    ).toBe(false);
    expect(
      shouldStartRestAfterSet({
        completedSupersetOrder: 1,
        groupMemberOrders: [0, 1],
      })
    ).toBe(true);
    expect(
      shouldStartRestAfterSet({
        completedSupersetOrder: null,
        groupMemberOrders: [],
      })
    ).toBe(true);
  });
});
