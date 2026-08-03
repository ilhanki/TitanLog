import { useSyncExternalStore } from 'react';

export type PostAuthDestination = 'password_update_complete' | 'profile';
export type AuthRouteFlow =
  'password_recovery' | 'password_recovery_complete' | 'standard';

type PendingDestination = {
  claimed: boolean;
  destination: PostAuthDestination;
  id: number;
};

type AuthNavigationSnapshot = {
  flow: AuthRouteFlow;
  pendingDestination: PendingDestination | null;
};

const listeners = new Set<() => void>();
let nextDestinationId = 1;
let snapshot: AuthNavigationSnapshot = {
  flow: 'standard',
  pendingDestination: null,
};

function publish(next: AuthNavigationSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuthNavigationState(): AuthNavigationSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot
  );
}

export function getAuthNavigationStateSnapshot(): AuthNavigationSnapshot {
  return snapshot;
}

export function requestPostAuthDestination(
  destination: PostAuthDestination
): void {
  const safeDestination: PostAuthDestination =
    destination === 'password_update_complete'
      ? 'password_update_complete'
      : 'profile';
  publish({
    ...snapshot,
    pendingDestination: {
      claimed: false,
      destination: safeDestination,
      id: nextDestinationId++,
    },
  });
}

export function releasePostAuthDestination(id: number): void {
  const pending = snapshot.pendingDestination;
  if (!pending || pending.id !== id || !pending.claimed) return;
  publish({
    ...snapshot,
    pendingDestination: { ...pending, claimed: false },
  });
}

export function claimPostAuthDestination(): PendingDestination | null {
  const pending = snapshot.pendingDestination;
  if (!pending || pending.claimed) return null;
  const claimed = { ...pending, claimed: true };
  publish({ ...snapshot, pendingDestination: claimed });
  return claimed;
}

export function completePostAuthDestination(id: number): void {
  if (snapshot.pendingDestination?.id !== id) return;
  publish({ ...snapshot, pendingDestination: null });
}

export function clearPostAuthDestination(): void {
  if (!snapshot.pendingDestination) return;
  publish({ ...snapshot, pendingDestination: null });
}

export function beginPasswordRecovery(): void {
  if (snapshot.flow === 'password_recovery') return;
  publish({ ...snapshot, flow: 'password_recovery' });
}

export function finishPasswordRecovery(): void {
  if (snapshot.flow === 'password_recovery_complete') return;
  publish({ ...snapshot, flow: 'password_recovery_complete' });
}

export function clearAuthNavigationState(): void {
  publish({ flow: 'standard', pendingDestination: null });
}

export function resetAuthNavigationStateForTests(): void {
  nextDestinationId = 1;
  clearAuthNavigationState();
}
