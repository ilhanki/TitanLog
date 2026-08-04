import type { Router } from 'expo-router';

import {
  dismissOrReplace,
  navigateBackOrReplace,
} from '@/navigation/safe-navigation';

function createRouter({
  canDismiss = false,
  canGoBack = false,
}: {
  canDismiss?: boolean;
  canGoBack?: boolean;
} = {}) {
  return {
    back: jest.fn(),
    canDismiss: jest.fn(() => canDismiss),
    canGoBack: jest.fn(() => canGoBack),
    dismiss: jest.fn(),
    replace: jest.fn(),
  } as unknown as jest.Mocked<Router>;
}

describe('safe navigation', () => {
  it('goes back exactly once when history exists', () => {
    const router = createRouter({ canGoBack: true });
    expect(navigateBackOrReplace(router, '/(tabs)/profile')).toBe('back');
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('never dispatches back without history and replaces once', () => {
    const router = createRouter();
    expect(navigateBackOrReplace(router, '/(tabs)/profile')).toBe('replace');
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/profile');
  });

  it('dismisses a modal only when the stack can dismiss it', () => {
    const router = createRouter({ canDismiss: true });
    expect(dismissOrReplace(router, '/(tabs)/progress')).toBe('dismiss');
    expect(router.dismiss).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces a directly opened modal with its trusted parent', () => {
    const router = createRouter();
    expect(dismissOrReplace(router, '/(tabs)/progress')).toBe('replace');
    expect(router.dismiss).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/progress');
  });
});
