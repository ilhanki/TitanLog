import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { createWorkoutPlanRepository } from '@/features/workouts/data/workout-plan-repository';
import type { WorkoutPlan } from '@/features/workouts/domain/models';
import { formatWorkoutWeekdays } from '@/features/workouts/utils/workout-formatters';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { navigateBackOrReplace } from '@/navigation/safe-navigation';
import { theme } from '@/theme/tokens';

export function WorkoutProgramScreen() {
  const database = useSQLiteContext();
  const router = useRouter();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setLoading(true);
      setError(false);
      void createWorkoutPlanRepository(database)
        .getActivePlan()
        .then((nextPlan) => {
          if (active) setPlan(nextPlan);
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [database, reloadKey])
  );

  if (loading) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        <EmptyState
          description={appStrings.workout.loading}
          icon="calendar-edit"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        <EmptyState
          description={appStrings.workout.loadError}
          icon="alert-circle-outline"
          title={appStrings.database.errorTitle}
        />
        <AppButton
          label={appStrings.workout.retry}
          onPress={() => setReloadKey((value) => value + 1)}
        />
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        <EmptyState
          description={appStrings.workout.dayNotFoundDescription}
          icon="calendar-remove"
          title={appStrings.workout.myProgram}
        />
        <AppButton
          label={appStrings.common.goBack}
          onPress={() => navigateBackOrReplace(router, '/(tabs)/workout')}
        />
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={workoutTheme.background} edges={['top', 'bottom']}>
      <AppButton
        label={appStrings.common.goBack}
        onPress={() => navigateBackOrReplace(router, '/(tabs)/workout')}
        style={styles.backButton}
        variant="ghost"
      />
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="title">
          {appStrings.workout.myProgram}
        </AppText>
        <AppText selectable tone="muted">
          {plan.name}
        </AppText>
        <AppText selectable tone="subtle" variant="caption">
          {appStrings.workout.programDescription}
        </AppText>
      </View>
      <View style={styles.list}>
        {plan.days.map((day) => {
          const weekdays =
            formatWorkoutWeekdays(day.scheduleWeekdays) ||
            appStrings.workout.noScheduledDays;
          const summary = `${weekdays}, ${day.exerciseCount} ${appStrings.workout.exercises}, ${day.totalSetCount} ${appStrings.workout.sets}`;
          return (
            <Pressable
              accessibilityLabel={`${appStrings.workout.editWorkoutDay}: ${day.name}. ${summary}`}
              accessibilityRole="button"
              key={day.id}
              onPress={() =>
                router.push(`/workout/program/day/${day.id}` as Href)
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowCopy}>
                <AppText numberOfLines={1} variant="bodyStrong">
                  {day.name}
                </AppText>
                <AppText
                  numberOfLines={1}
                  selectable
                  tone="muted"
                  variant="caption"
                >
                  {summary}
                </AppText>
              </View>
              <AppIcon name="pencil-outline" />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start' },
  header: { gap: theme.spacing.xs },
  list: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    overflow: 'hidden',
  },
  pressed: { backgroundColor: workoutTheme.surfaceActive },
  row: {
    alignItems: 'center',
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.md,
    minHeight: theme.layout.touchTarget,
    padding: theme.spacing.md,
  },
  rowCopy: { flex: 1, gap: theme.spacing.xs },
});
