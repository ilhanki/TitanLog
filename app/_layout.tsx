import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router/stack';

import { DatabaseProvider } from '@/database/database-provider';
import { useAuthNavigationState } from '@/features/auth/auth-navigation-state';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { getAuthRouteActivation } from '@/features/auth/auth-route-activation';
import { AuthRouteLoadingScreen } from '@/features/auth/auth-route-loading-screen';
import { isPasswordResetCallbackUrl } from '@/features/auth/auth-service';
import { useDatasetAccess } from '@/features/data-safety/dataset-access-guard';
import { theme } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <AuthProvider>
      <DatabaseProvider>
        <RootNavigator />
      </DatabaseProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const callbackUrl = Linking.useLinkingURL();
  const { initializing, session } = useAuth();
  const { flow } = useAuthNavigationState();
  const { state: datasetAccess } = useDatasetAccess();

  const authenticated = Boolean(session);
  const activation = getAuthRouteActivation({
    authenticated,
    datasetAccess,
    flow,
    initializing,
    passwordResetLink: isPasswordResetCallbackUrl(callbackUrl),
  });

  if (activation.loading) return <AuthRouteLoadingScreen />;

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false,
        }}
      >
        <Stack.Protected guard={activation.localRoutesAvailable}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile/data" />
          <Stack.Screen name="profile/edit" />
          <Stack.Screen name="profile/settings" />
          <Stack.Screen name="profile/danger" />
          <Stack.Screen
            name="progress/add"
            options={{
              animation: 'slide_from_bottom',
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="progress/measurement/[measurementId]" />
          <Stack.Screen
            name="progress/settings"
            options={{
              animation: 'slide_from_bottom',
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="workout/day/[dayId]" />
          <Stack.Screen name="workout/exercise/[exerciseId]/history" />
          <Stack.Screen name="workout/history/index" />
          <Stack.Screen name="workout/history/[sessionId]" />
          <Stack.Screen name="workout/program/index" />
          <Stack.Screen name="workout/program/day/[dayId]/index" />
          <Stack.Screen name="workout/program/day/[dayId]/add-exercise/index" />
          <Stack.Screen name="workout/program/day/[dayId]/add-exercise/custom" />
          <Stack.Screen name="workout/session/[sessionId]/index" />
          <Stack.Screen name="workout/session/[sessionId]/summary" />
        </Stack.Protected>
        <Stack.Protected guard={activation.signedOutAuthRoutesAvailable}>
          <Stack.Screen name="auth/sign-in" />
          <Stack.Screen name="auth/sign-up" />
          <Stack.Screen name="auth/callback" />
        </Stack.Protected>
        <Stack.Protected guard={activation.passwordResetRouteAvailable}>
          <Stack.Screen name="auth/reset-password" />
        </Stack.Protected>
        <Stack.Protected guard={activation.datasetAccessRouteAvailable}>
          <Stack.Screen name="auth/dataset-access" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
