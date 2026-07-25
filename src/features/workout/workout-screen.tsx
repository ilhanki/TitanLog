import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';

export function WorkoutScreen() {
  return (
    <Screen>
      <AppText accessibilityRole="header" variant="title">
        {appStrings.workout.title}
      </AppText>
      <EmptyState
        description={appStrings.workout.description}
        icon="dumbbell"
        title={appStrings.workout.emptyTitle}
      />
    </Screen>
  );
}
