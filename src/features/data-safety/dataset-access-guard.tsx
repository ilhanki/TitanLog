import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { signOut } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import {
  createDatasetOwnershipRepository,
  DatasetOwnershipError,
} from '@/features/data-safety/dataset-ownership-repository';
import { theme } from '@/theme/tokens';

export type DatasetAccessState =
  'checking' | 'granted' | 'mismatch' | 'unavailable';

type DatasetAccessContextValue = {
  state: DatasetAccessState;
};

const DatasetAccessContext = createContext<DatasetAccessContextValue>({
  state: 'checking',
});

export function DatasetAccessProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const { initializing, user } = useAuth();
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [checkedState, setCheckedState] =
    useState<DatasetAccessState>('checking');

  useEffect(() => {
    if (!user) {
      setCheckedUserId(null);
      setCheckedState('granted');
      return;
    }
    let active = true;
    setCheckedState('checking');
    void createDatasetOwnershipRepository(database)
      .assertAccountAccess(user.id)
      .then(() => {
        if (active) {
          setCheckedUserId(user.id);
          setCheckedState('granted');
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCheckedUserId(user.id);
        setCheckedState(
          error instanceof DatasetOwnershipError &&
            error.code === 'owner_mismatch'
            ? 'mismatch'
            : 'unavailable'
        );
      });
    return () => {
      active = false;
    };
  }, [database, user]);

  const state: DatasetAccessState = initializing
    ? 'checking'
    : !user
      ? 'granted'
      : checkedUserId !== user.id
        ? 'checking'
        : checkedState;
  const value = useMemo(() => ({ state }), [state]);

  return <DatasetAccessContext value={value}>{children}</DatasetAccessContext>;
}

export function useDatasetAccess(): DatasetAccessContextValue {
  return use(DatasetAccessContext);
}

export function DatasetAccessGuard({ children }: PropsWithChildren) {
  return (
    <DatasetAccessProvider>
      <DatasetAccessBoundary>{children}</DatasetAccessBoundary>
    </DatasetAccessProvider>
  );
}

function DatasetAccessBoundary({ children }: PropsWithChildren) {
  const { state } = useDatasetAccess();
  if (state === 'granted') return children;
  return <DatasetAccessScreen />;
}

export function DatasetAccessScreen() {
  const { state } = useDatasetAccess();
  const [signOutFailed, setSignOutFailed] = useState(false);

  if (state === 'checking') {
    return <AccessStatus title="Veri sahipliği doğrulanıyor…" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <AppIcon
          color={theme.colors.danger}
          name="database-lock-outline"
          size={theme.iconSizes.hero}
        />
      </View>
      <AppText
        accessibilityRole="header"
        style={styles.centered}
        variant="title"
      >
        {state === 'mismatch'
          ? 'Bu veri kümesi başka bir hesaba ait'
          : 'Veri sahipliği doğrulanamadı'}
      </AppText>
      <AppText selectable style={styles.centered} tone="muted">
        Güvenliğin için bu hesaba yerel antrenman ve vücut verileri
        gösterilmiyor; hiçbir veri buluta yüklenmedi. Cihazdaki veriler
        silinmedi.
      </AppText>
      <AppButton
        label="Bu Hesaptan Çıkış Yap"
        onPress={() => {
          setSignOutFailed(false);
          void signOut().catch(() => setSignOutFailed(true));
        }}
        variant="secondary"
      />
      {signOutFailed ? (
        <AppText accessibilityLiveRegion="polite" selectable tone="danger">
          Çıkış tamamlanamadı. İnternet bağlantını kontrol edip yeniden dene.
        </AppText>
      ) : null}
    </View>
  );
}

function AccessStatus({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <AppIcon
        color={theme.colors.primary}
        name="database-search-outline"
        size={theme.iconSizes.hero}
      />
      <AppText
        accessibilityRole="header"
        style={styles.centered}
        variant="title"
      >
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { maxWidth: 360, textAlign: 'center' },
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.lg,
    justifyContent: 'center',
    padding: theme.spacing.xxl,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radii.pill,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
});
