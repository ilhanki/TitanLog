import { useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { requestAccountDeletion, signOut } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import {
  downloadCloudBackup,
  uploadCloudBackup,
} from '@/features/data-safety/cloud-backup-service';
import { restoreBackupArchive } from '@/features/data-safety/backup-repository';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';
import {
  createDatasetOwnershipRepository,
  DatasetOwnershipError,
  type DatasetOwnership,
} from '@/features/data-safety/dataset-ownership-repository';
import {
  pickLocalBackup,
  shareLocalBackup,
} from '@/features/data-safety/local-backup-service';
import { theme } from '@/theme/tokens';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}

function previewText(archive: TitanLogBackup): string {
  return [
    `Yedek Tarihi\n${formatDate(archive.createdAt)}`,
    `${archive.summary.programs} program`,
    `${archive.summary.workouts} antrenman`,
    `${archive.summary.sets} tamamlanmış set`,
    `${archive.summary.measurements} ölçüm`,
    `Uygulama: ${archive.appVersion} · Biçim: v${archive.formatVersion}`,
    '',
    'Geri yükleme bu cihazdaki mevcut TitanLog verilerinin yerini alır.',
  ].join('\n');
}

export function AccountDataScreen() {
  const router = useRouter();
  const database = useSQLiteContext();
  const { configured, user } = useAuth();
  const [ownership, setOwnership] = useState<DatasetOwnership | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const loadOwnership = useCallback(async () => {
    setOwnership(
      await createDatasetOwnershipRepository(database).getOwnership()
    );
  }, [database]);
  useEffect(() => {
    void loadOwnership();
  }, [loadOwnership]);

  const run = async (name: string, operation: () => Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(name);
    setNotice(null);
    try {
      await operation();
    } catch (error) {
      setNotice(
        error instanceof DatasetOwnershipError &&
          error.code === 'owner_mismatch'
          ? 'Bu cihazdaki veri kümesi başka bir hesaba ait. Bulut işlemi engellendi.'
          : error instanceof DatasetOwnershipError && error.code === 'unclaimed'
            ? 'Bulut yedeğinden önce bu yerel veri kümesini hesabına bağlamalısın.'
            : 'İşlem tamamlanamadı. Yerel verilerin değişmeden korundu.'
      );
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  };

  const confirmRestore = (archive: TitanLogBackup) => {
    Alert.alert('Yedekten Geri Yükle', previewText(archive), [
      { style: 'cancel', text: 'Vazgeç' },
      {
        text: 'Önce Güvenlik Yedeği Oluştur',
        onPress: () =>
          void run('local-export', async () => {
            await shareLocalBackup(database);
            await loadOwnership();
            setNotice(
              'Güvenlik yedeği oluşturuldu. Hazır olduğunda geri yüklemeyi yeniden başlat.'
            );
          }),
      },
      {
        style: 'destructive',
        text: 'Mevcut Verilerin Yerine Yükle',
        onPress: () =>
          void run('restore', async () => {
            await restoreBackupArchive(database, archive);
            setNotice('Yedek eksiksiz geri yüklendi.');
            router.replace('/(tabs)/profile' as Href);
          }),
      },
    ]);
  };

  const ownerMismatch = Boolean(
    user && ownership?.ownerAccountId && ownership.ownerAccountId !== user.id
  );
  const claimed = Boolean(user && ownership?.ownerAccountId === user.id);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppButton
          label="Geri dön"
          onPress={() => router.back()}
          variant="ghost"
        />
        <AppText
          accessibilityRole="header"
          style={styles.title}
          variant="title"
        >
          Hesap ve Veriler
        </AppText>
      </View>

      {notice ? (
        <AppText accessibilityLiveRegion="polite" selectable tone="muted">
          {notice}
        </AppText>
      ) : null}

      <AppCard style={styles.section} tone="raised">
        <AppText variant="heading">Yerel Yedekleme</AppText>
        <AppText selectable tone="muted">
          Hesap gerektirmez. Yedek yalnızca sen açıkça paylaşınca cihazdan
          çıkar.
        </AppText>
        <AppText selectable variant="caption">
          Son yerel yedek: {formatDate(ownership?.lastLocalBackupAt)}
        </AppText>
        <View style={styles.actions}>
          <AppButton
            disabled={pending !== null}
            label={
              pending === 'local-export'
                ? 'Hazırlanıyor…'
                : 'Yerel Yedek Oluştur'
            }
            onPress={() =>
              void run('local-export', async () => {
                const archive = await shareLocalBackup(database);
                await loadOwnership();
                setNotice(
                  `${formatDate(archive.createdAt)} tarihli yerel yedek hazırlandı.`
                );
              })
            }
            style={styles.action}
          />
          <AppButton
            disabled={pending !== null}
            label="Yedekten Geri Yükle"
            onPress={() =>
              void run('local-import', async () => {
                const archive = await pickLocalBackup();
                if (archive) confirmRestore(archive);
              })
            }
            style={styles.action}
            variant="secondary"
          />
        </View>
      </AppCard>

      <AppCard style={styles.section}>
        <AppText variant="heading">Özel Bulut Yedeği</AppText>
        <AppText selectable tone="muted">
          Canlı eşitleme değildir. Yalnızca düğmeye bastığında tek özel yedek
          yüklenir veya indirilir.
        </AppText>
        <AppText selectable variant="caption">
          Son bulut yedeği: {formatDate(ownership?.lastCloudBackupAt)}
        </AppText>
        {!user ? (
          <AppText selectable tone="muted">
            Bulut işlemleri için doğrulanmış bir hesap gerekir.
          </AppText>
        ) : null}
        {ownerMismatch ? (
          <AppText selectable tone="danger">
            Bu yerel veri başka bir hesaba ait. Veri gösterimi ve yükleme
            engellendi.
          </AppText>
        ) : null}
        {user && !ownership?.ownerAccountId ? (
          <AppButton
            disabled={pending !== null}
            label="Yerel Verileri Bu Hesaba Bağla"
            onPress={() =>
              Alert.alert(
                'Yerel veri hesabına bağlansın mı?',
                'Bu cihazdaki mevcut veri kümesi hesabına ait olarak işaretlenecek. Otomatik yükleme yapılmayacak.',
                [
                  { style: 'cancel', text: 'Vazgeç' },
                  {
                    text: 'Hesabıma Bağla',
                    onPress: () =>
                      void run('claim', async () => {
                        await createDatasetOwnershipRepository(
                          database
                        ).claimDataset(user.id);
                        await loadOwnership();
                        setNotice(
                          'Yerel veri kümesi hesabına bağlandı. Hiçbir veri otomatik yüklenmedi.'
                        );
                      }),
                  },
                ]
              )
            }
          />
        ) : null}
        <View style={styles.actions}>
          <AppButton
            disabled={
              pending !== null || !configured || !claimed || ownerMismatch
            }
            label={
              pending === 'cloud-upload' ? 'Yükleniyor…' : 'Buluta Yedekle'
            }
            onPress={() =>
              void run('cloud-upload', async () => {
                await uploadCloudBackup(database);
                await loadOwnership();
                setNotice('Özel bulut yedeği güncellendi.');
              })
            }
            style={styles.action}
          />
          <AppButton
            disabled={
              pending !== null || !configured || !claimed || ownerMismatch
            }
            label="Buluttan Geri Yükle"
            onPress={() =>
              void run('cloud-download', async () => {
                confirmRestore(await downloadCloudBackup(database));
              })
            }
            style={styles.action}
            variant="secondary"
          />
        </View>
      </AppCard>

      {user ? (
        <AppCard style={styles.section}>
          <AppText variant="heading">Hesap Güvenliği</AppText>
          <AppText selectable>{user.email}</AppText>
          <AppText
            selectable
            tone={user.email_confirmed_at ? 'success' : 'muted'}
          >
            {user.email_confirmed_at
              ? 'E-posta doğrulandı'
              : 'E-posta doğrulaması bekleniyor'}
          </AppText>
          <AppButton
            disabled={pending !== null}
            label="Çıkış Yap"
            onPress={() =>
              void run('sign-out', async () => {
                await signOut();
                setNotice(
                  'Çıkış yapıldı. Bu cihazdaki antrenman ve vücut verileri korunuyor.'
                );
              })
            }
            variant="secondary"
          />
          <AppButton
            disabled={pending !== null}
            label="Hesap Silme İsteği"
            onPress={() =>
              Alert.alert(
                'Hesap kalıcı olarak silinsin mi?',
                'Özel bulut yedeğin ve uzak hesap kayıtların silinir. Bu cihazdaki yerel veriler ayrıca onay vermediğin sürece korunur. Yakın tarihli oturum doğrulaması gerekebilir.',
                [
                  { style: 'cancel', text: 'Vazgeç' },
                  {
                    style: 'destructive',
                    text: 'Hesabımı Sil',
                    onPress: () =>
                      void run('delete-account', async () => {
                        await requestAccountDeletion();
                        setNotice(
                          'Uzak hesap silme isteği tamamlandı. Yerel verilerin korundu.'
                        );
                      }),
                  },
                ]
              )
            }
            variant="danger"
          />
        </AppCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { flexBasis: 150, flexGrow: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  header: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md },
  section: { gap: theme.spacing.lg },
  title: { flex: 1 },
});
