import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import {
  Component,
  Suspense,
  useMemo,
  useState,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { DATABASE_NAME } from '@/database/database-name';
import { initializeDatabase } from '@/database/initialize-database';
import { DatasetAccessGuard } from '@/features/data-safety/dataset-access-guard';
import { theme } from '@/theme/tokens';

type DatabaseErrorBoundaryProps = PropsWithChildren<{
  onRetry: () => void;
  resetKey: number;
}>;

type DatabaseErrorBoundaryState = {
  hasError: boolean;
};

class DatabaseErrorBoundary extends Component<
  DatabaseErrorBoundaryProps,
  DatabaseErrorBoundaryState
> {
  state: DatabaseErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): DatabaseErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {}

  componentDidUpdate(previousProps: DatabaseErrorBoundaryProps): void {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <DatabaseStatusScreen error onRetry={this.props.onRetry} />;
    }

    return this.props.children;
  }
}

type DatabaseStatusScreenProps = {
  error?: boolean;
  onRetry?: () => void;
};

function DatabaseStatusScreen({
  error = false,
  onRetry,
}: DatabaseStatusScreenProps) {
  return (
    <View accessibilityRole="summary" style={styles.statusScreen}>
      <View style={styles.statusIcon}>
        <AppIcon
          color={error ? theme.colors.danger : theme.colors.primary}
          name={error ? 'database-alert-outline' : 'database-sync-outline'}
          size={theme.iconSizes.hero}
        />
      </View>
      <AppText variant="brand">{appStrings.brandName}</AppText>
      <AppText
        accessibilityRole="header"
        style={styles.centered}
        variant="title"
      >
        {error
          ? appStrings.database.errorTitle
          : appStrings.database.loadingTitle}
      </AppText>
      <AppText selectable style={styles.centered} tone="muted">
        {error
          ? appStrings.database.errorDescription
          : appStrings.database.loadingDescription}
      </AppText>
      {error && onRetry ? (
        <AppButton
          label={appStrings.database.retry}
          onPress={onRetry}
          style={styles.retryButton}
        />
      ) : null}
    </View>
  );
}

export function DatabaseProvider({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  const onInit = useMemo(
    () => async (database: SQLiteDatabase) => {
      void attempt;
      await initializeDatabase(database);
    },
    [attempt]
  );

  return (
    <DatabaseErrorBoundary
      onRetry={() => setAttempt((current) => current + 1)}
      resetKey={attempt}
    >
      <Suspense fallback={<DatabaseStatusScreen />}>
        <SQLiteProvider
          databaseName={DATABASE_NAME}
          key={attempt}
          onInit={onInit}
          useSuspense
        >
          <DatasetAccessGuard>{children}</DatasetAccessGuard>
        </SQLiteProvider>
      </Suspense>
    </DatabaseErrorBoundary>
  );
}

const styles = StyleSheet.create({
  statusScreen: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.lg,
    justifyContent: 'center',
    padding: theme.spacing.xxl,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  centered: {
    maxWidth: 360,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 180,
  },
});
