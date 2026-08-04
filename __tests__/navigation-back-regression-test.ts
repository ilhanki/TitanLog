import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Router } from 'expo-router';

import {
  dismissOrReplace,
  navigateBackOrReplace,
  type SafeFallbackRoute,
} from '@/navigation/safe-navigation';

function routerWithHistory(canGoBack: boolean) {
  return {
    back: jest.fn(),
    canGoBack: jest.fn(() => canGoBack),
    replace: jest.fn(),
  } as unknown as jest.Mocked<Router>;
}

const secondaryScreens: {
  fallback: SafeFallbackRoute;
  name: string;
  route: string;
}[] = [
  {
    fallback: '/(tabs)/profile',
    name: 'profile edit',
    route: '/profile/edit',
  },
  {
    fallback: '/(tabs)/profile',
    name: 'Data Center',
    route: '/profile/data',
  },
  {
    fallback: '/(tabs)/profile',
    name: 'settings',
    route: '/profile/settings',
  },
  {
    fallback: '/profile/settings',
    name: 'Danger Zone',
    route: '/profile/danger',
  },
  {
    fallback: '/(tabs)/history',
    name: 'workout analytics detail',
    route: '/workout/history/[sessionId]',
  },
  {
    fallback: '/(tabs)/history',
    name: 'exercise analytics detail',
    route: '/workout/exercise/[exerciseId]/history',
  },
];

describe.each(secondaryScreens)(
  '$name back behavior',
  ({ fallback, route }) => {
    it('uses navigator history when opened normally', () => {
      const router = routerWithHistory(true);
      navigateBackOrReplace(router, fallback);
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('uses its trusted parent when opened directly', () => {
      const router = routerWithHistory(false);
      navigateBackOrReplace(router, fallback);
      expect(router.back).not.toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith(fallback);
      expect(fallback).not.toBe(route);
      expect(fallback).not.toMatch(/auth\/(callback|reset-password)|[?&]/);
    });
  }
);

describe('Android Back and protected history audit', () => {
  const repositoryRoot = process.cwd();
  const read = (path: string) =>
    readFileSync(join(repositoryRoot, path), 'utf8');

  it('contains no unconditional back dispatch outside the guard', () => {
    const sourceFiles = [
      'src/features/auth/auth-screen-header.tsx',
      'src/features/body/screens/add-measurement-screen.tsx',
      'src/features/body/screens/body-settings-screen.tsx',
      'src/features/body/screens/edit-measurement-screen.tsx',
      'src/features/profile/account-data-screen.tsx',
      'src/features/profile/profile-danger-screen.tsx',
      'src/features/profile/profile-edit-screen.tsx',
      'src/features/profile/profile-settings-screen.tsx',
      'src/features/workouts/screens/active-workout-screen.tsx',
      'src/features/workouts/screens/add-workout-exercise-screen.tsx',
      'src/features/workouts/screens/completed-workout-detail-screen.tsx',
      'src/features/workouts/screens/custom-workout-exercise-screen.tsx',
      'src/features/workouts/screens/exercise-history-screen.tsx',
      'src/features/workouts/screens/workout-day-screen.tsx',
      'src/features/workouts/screens/workout-history-screen.tsx',
      'src/features/workouts/screens/workout-program-day-screen.tsx',
      'src/features/workouts/screens/workout-program-screen.tsx',
    ];
    for (const file of sourceFiles)
      expect(read(file)).not.toMatch(/router\.back\(/);
    expect(read('src/navigation/safe-navigation.ts')).toMatch(
      /if \(router\.canGoBack\(\)\)[\s\S]*router\.back\(\)/
    );
  });

  it('does not add raw GO_BACK or competing Android Back handlers', () => {
    const source = [
      read('app/_layout.tsx'),
      read('app/(tabs)/_layout.tsx'),
      read('src/navigation/safe-navigation.ts'),
    ].join('\n');
    expect(source).not.toMatch(
      /GO_BACK|CommonActions\.goBack|navigation\.goBack/
    );
    expect(source).not.toMatch(/BackHandler/);
  });

  it('keeps root tabs free of manual back dispatches', () => {
    for (const route of [
      'index',
      'workout',
      'history',
      'progress',
      'profile',
    ]) {
      expect(read(`app/(tabs)/${route}.tsx`)).not.toMatch(
        /router\.back|navigateBackOrReplace|dismissOrReplace/
      );
    }
  });

  it('keeps callback and password-reset completion out of usable history', () => {
    const callback = read('src/features/auth/auth-callback-coordinator.ts');
    const routes = read('src/features/auth/auth-route-activation.ts');
    expect(callback).not.toMatch(/router\.back|GO_BACK/);
    expect(routes).not.toMatch(/router\.back|GO_BACK/);
    expect(routes).toMatch(/passwordReset/);
  });

  it('uses modal dismissal only when available', () => {
    const router = {
      canDismiss: jest.fn(() => false),
      dismiss: jest.fn(),
      replace: jest.fn(),
    } as unknown as jest.Mocked<Router>;
    dismissOrReplace(router, '/(tabs)/progress');
    expect(router.dismiss).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
  });
});
