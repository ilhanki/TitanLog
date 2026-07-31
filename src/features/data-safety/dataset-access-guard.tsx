import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type PropsWithChildren } from 'react';
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

type AccessState = 'checking' | 'granted' | 'mismatch' | 'unavailable';

export function DatasetAccessGuard({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const { initializing, user } = useAuth();
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessState>('checking');
  const [signOutFailed, setSignOutFailed] = useState(false);

  useEffect(() => {
    if (!user) {
      setCheckedUserId(null);
      setAccess('granted');
      return;
    }
    let active = true;
    setAccess('checking');
    void createDatasetOwnershipRepository(database)
      .assertAccountAccess(user.id)
      .then(() => {
        if (active) {
          setCheckedUserId(user.id);
          setAccess('granted');
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCheckedUserId(user.id);
        setAccess(
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

  if (!initializing && !user) return children;
  if (
    initializing ||
    !user ||
    checkedUserId !== user.id ||
    access === 'checking'
  ) {
    return <AccessStatus title="Veri sahipliği doğrulanıyor…" />;
  }
  if (access === 'granted') return children;

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
        {access === 'mismatch'
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
