import type { RestTimerState } from '@/features/workouts/domain/models';

export const REST_TIMER_PRESETS = [30, 60, 90, 120, 180] as const;
export const APP_REST_FALLBACK_SECONDS = 90;
export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 1800;

export function clampRestDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return APP_REST_FALLBACK_SECONDS;
  return Math.min(
    MAX_REST_SECONDS,
    Math.max(MIN_REST_SECONDS, Math.round(seconds))
  );
}

export function createRestTimerState(
  durationSeconds: number,
  now: number,
  sessionExerciseId: number | null,
  notificationIdentifier: string | null = null
): RestTimerState {
  const duration = clampRestDuration(durationSeconds);
  return {
    alertedAt: null,
    deadline: new Date(now + duration * 1000).toISOString(),
    durationSeconds: duration,
    notificationIdentifier,
    sessionExerciseId,
  };
}

export function getRestTimerRemainingSeconds(
  timer: RestTimerState,
  now: number
): number {
  const deadline = Date.parse(timer.deadline);
  if (!Number.isFinite(deadline)) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function getRestTimerProgress(
  timer: RestTimerState,
  now: number
): number {
  if (timer.durationSeconds <= 0) return 0;
  return Math.min(
    1,
    Math.max(
      0,
      getRestTimerRemainingSeconds(timer, now) / timer.durationSeconds
    )
  );
}

export function adjustRestTimerDeadline(
  timer: RestTimerState,
  deltaSeconds: number,
  now: number
): RestTimerState | null {
  const remaining = getRestTimerRemainingSeconds(timer, now);
  const adjusted = Math.min(
    MAX_REST_SECONDS,
    Math.max(0, remaining + deltaSeconds)
  );
  if (adjusted === 0) return null;
  return {
    ...timer,
    alertedAt: null,
    deadline: new Date(now + adjusted * 1000).toISOString(),
    durationSeconds: Math.max(timer.durationSeconds, adjusted),
    notificationIdentifier: null,
  };
}

export function shouldEmitRestFinished(
  timer: RestTimerState,
  now: number
): boolean {
  return (
    timer.alertedAt === null && getRestTimerRemainingSeconds(timer, now) === 0
  );
}

export function resolveRestDuration(input: {
  activeOverrideSeconds?: number | null;
  globalDefaultSeconds?: number | null;
  programDefaultSeconds?: number | null;
}): number {
  return clampRestDuration(
    input.activeOverrideSeconds ??
      input.programDefaultSeconds ??
      input.globalDefaultSeconds ??
      APP_REST_FALLBACK_SECONDS
  );
}

export function shouldStartRestAfterSet(input: {
  completedSupersetOrder: number | null | undefined;
  groupMemberOrders: readonly number[];
}): boolean {
  if (
    input.completedSupersetOrder === null ||
    input.completedSupersetOrder === undefined
  )
    return true;
  if (input.groupMemberOrders.length < 2) return true;
  return input.completedSupersetOrder === Math.max(...input.groupMemberOrders);
}
