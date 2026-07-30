import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router/stack';

import { DatabaseProvider } from '@/database/database-provider';
import { theme } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/sign-in" />
        <Stack.Screen name="auth/sign-up" />
        <Stack.Screen
          name="progress/add"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen name="progress/measurement/[measurementId]" />
        <Stack.Screen
          name="progress/settings"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
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
      </Stack>
      <StatusBar style="light" />
    </DatabaseProvider>
  );
}
