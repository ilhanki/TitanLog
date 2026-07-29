import { theme } from '@/theme/tokens';

export const workoutTheme = {
  background: theme.colors.background,
  completed: theme.colors.surfaceMuted,
  input: theme.colors.surface,
  separator: theme.colors.border,
  surface: theme.colors.surface,
  surfaceActive: theme.colors.surfaceRaised,
} as const;
