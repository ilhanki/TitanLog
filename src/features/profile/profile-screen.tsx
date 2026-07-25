import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';

export function ProfileScreen() {
  return (
    <Screen>
      <AppText accessibilityRole="header" variant="title">
        {appStrings.profile.title}
      </AppText>
      <EmptyState
        description={appStrings.profile.description}
        icon="account-circle-outline"
        title={appStrings.profile.emptyTitle}
      />
    </Screen>
  );
}
