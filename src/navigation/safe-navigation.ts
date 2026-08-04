import type { Router } from 'expo-router';

export type SafeFallbackRoute =
  | '/(tabs)/history'
  | '/(tabs)/profile'
  | '/(tabs)/progress'
  | '/(tabs)/workout'
  | '/profile/settings'
  | '/workout/program';

export function navigateBackOrReplace(
  router: Router,
  fallback: SafeFallbackRoute
): 'back' | 'replace' {
  if (router.canGoBack()) {
    router.back();
    return 'back';
  }
  router.replace(fallback);
  return 'replace';
}

export function dismissOrReplace(
  router: Router,
  fallback: SafeFallbackRoute
): 'dismiss' | 'replace' {
  if (router.canDismiss()) {
    router.dismiss();
    return 'dismiss';
  }
  router.replace(fallback);
  return 'replace';
}
