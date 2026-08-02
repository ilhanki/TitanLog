import { useRootNavigationState, useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { claimAuthCallbackNavigation } from '@/features/auth/auth-callback-coordinator';

export const AUTH_PROFILE_ROUTE = '/(tabs)/profile' as const;

export function useAuthCallbackNavigation(
  callbackId: string | null,
  enabled: boolean,
  destination: Href = AUTH_PROFILE_ROUTE
): boolean {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const navigationFinished = useRef(false);
  const navigationReady = Boolean(rootNavigationState?.key);

  useEffect(() => {
    if (
      !enabled ||
      !callbackId ||
      !navigationReady ||
      navigationFinished.current
    )
      return;
    navigationFinished.current = true;
    if (!claimAuthCallbackNavigation(callbackId)) return;
    router.replace(destination);
  }, [callbackId, destination, enabled, navigationReady, router]);

  return navigationReady;
}
