import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';

export function ProgressScreen() {
  return (
    <Screen>
      <AppText accessibilityRole="header" variant="title">
        {appStrings.progress.title}
      </AppText>
      <EmptyState
        description={appStrings.progress.description}
        icon="chart-timeline-variant"
        title={appStrings.progress.emptyTitle}
      />
    </Screen>
  );
}
