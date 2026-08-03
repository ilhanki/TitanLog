import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import {
  claimPostAuthDestination,
  completePostAuthDestination,
  releasePostAuthDestination,
  useAuthNavigationState,
  type PostAuthDestination,
} from '@/features/auth/auth-navigation-state';
import { useAuth } from '@/features/auth/auth-provider';
import { useDatasetAccess } from '@/features/data-safety/dataset-access-guard';

const destinationRoutes: Record<PostAuthDestination, Href> = {
  password_update_complete: '/(tabs)/profile',
  profile: '/(tabs)/profile',
};

export function PostAuthDestinationConsumer() {
  const router = useRouter();
  const { initializing, session } = useAuth();
  const { state: datasetAccess } = useDatasetAccess();
  const { pendingDestination } = useAuthNavigationState();

  useEffect(() => {
    if (
      initializing ||
      !session ||
      datasetAccess !== 'granted' ||
      !pendingDestination ||
      pendingDestination.claimed
    ) {
      return;
    }

    const claimed = claimPostAuthDestination();
    if (!claimed) return;
    try {
      router.replace(destinationRoutes[claimed.destination]);
      completePostAuthDestination(claimed.id);
    } catch (error) {
      releasePostAuthDestination(claimed.id);
      throw error;
    }
  }, [datasetAccess, initializing, pendingDestination, router, session]);

  return null;
}
