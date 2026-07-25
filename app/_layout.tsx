import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router/stack';

import { theme } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/sign-in" />
        <Stack.Screen name="auth/sign-up" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
