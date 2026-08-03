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
import {
  createCloudBackupDownloadError,
  logCloudBackupDownloadFailure,
} from '@/features/data-safety/cloud-backup-diagnostics';
import { restoreBackupArchive } from '@/features/data-safety/backup-repository';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';
import {
  createDatasetOwnershipRepository,
  DatasetOwnershipError,
  type DatasetOwnership,
} from '@/features/data-safety/dataset-ownership-repository';
import {
  localBackupErrorMessage,
  pickLocalBackup,
  shareLocalBackup,
} from '@/features/data-safety/local-backup-service';
import { DeviceSyncCard } from '@/features/sync/device-sync-card';
import {
  cancelManualSync,
  hasRecoveryArchive,
  inspectManualSync,
  pullManualSync,
  pushManualSync,
} from '@/features/sync/manual-sync-service';
import {
  readRecoveryArchive,
  shareRecoveryArchive,
} from '@/features/sync/recovery-archive-service';
import { createSyncStateRepository } from '@/features/sync/sync-state-repository';
import type {
  ManualSyncPhase,
  SyncCheck,
  SyncIdentityState,
  SyncState,
} from '@/features/sync/sync-types';
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

function syncPreview(check: SyncCheck, title: string): string {
  const local = check.local?.archive.summary;
  const cloud = check.remoteHead?.summary;
  return [
    title,
    '',
    local
      ? `Bu cihaz: ${local.programs} program · ${local.workouts} antrenman · ${local.measurements} ölçüm`
      : null,
    cloud
      ? `Bulut: ${cloud.programs} program · ${cloud.workouts} antrenman · ${cloud.measurements} ölçüm`
      : 'Bulutta henüz TitanLog verisi yok.',
    check.remoteHead ? `Bulut revizyonu: ${check.remoteHead.revision}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function syncMessage(phase: ManualSyncPhase): string {
  const messages: Partial<Record<ManualSyncPhase, string>> = {
    signed_out: 'Cihaz eşitleme için hesabına giriş yapmalısın.',
    dataset_unowned: 'Önce yerel veri kümesini açıkça bu hesaba bağlamalısın.',
    account_mismatch:
      'Bu cihazdaki veri kümesi başka bir hesaba ait. Eşitleme engellendi.',
    unchanged: 'Bu cihaz ve bulut zaten eşitlenmiş durumda.',
    completed: 'Cihaz eşitleme güvenle tamamlandı.',
    offline: 'İnternet bağlantısı yok. Yerel verilerin değişmeden korunuyor.',
    unsupported_remote_version:
      'Bulut verisi bu uygulama sürümünden daha yeni. Uygulamayı güncellemelisin.',
    validation_failure:
      'Bulut verileri doğrulanamadı. Yerel verilerin değiştirilmedi.',
    authentication_failure:
      'Oturum doğrulanamadı. Yeniden giriş yaptıktan sonra tekrar deneyebilirsin.',
    recoverable_server_failure:
      'Eşitleme servisine ulaşılamadı. Yerel verilerin değiştirilmedi.',
    conflict:
      'Bulut bu sırada değişti. Güncel durum yeniden karşılaştırılmalı.',
  };
  return messages[phase] ?? 'Eşitleme durumu güncellendi.';
}

export function AccountDataScreen() {
  const router = useRouter();
  const database = useSQLiteContext();
  const { configured, user } = useAuth();
  const [ownership, setOwnership] = useState<DatasetOwnership | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [syncCheck, setSyncCheck] = useState<SyncCheck | null>(null);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const loadOwnership = useCallback(async () => {
    const [nextOwnership, nextSyncState] = await Promise.all([
      createDatasetOwnershipRepository(database).getOwnership(),
      createSyncStateRepository(database).getState(),
    ]);
    setOwnership(nextOwnership);
    setSyncState(nextSyncState);
    setRecoveryAvailable(hasRecoveryArchive());
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
        name === 'local-export'
          ? localBackupErrorMessage(error)
          : error instanceof DatasetOwnershipError &&
              error.code === 'owner_mismatch'
            ? 'Bu cihazdaki veri kümesi başka bir hesaba ait. Bulut işlemi engellendi.'
            : error instanceof DatasetOwnershipError &&
                error.code === 'unclaimed'
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
  const syncIdentity: SyncIdentityState = !user
    ? 'signed_out'
    : ownerMismatch
      ? 'account_mismatch'
      : !claimed
        ? 'dataset_unowned'
        : 'owned';
  useEffect(() => {
    setSyncCheck(null);
  }, [syncIdentity]);
  const syncPhase: ManualSyncPhase =
    pending === 'sync-check'
      ? 'checking_cloud'
      : pending === 'sync-upload'
        ? 'uploading'
        : pending === 'sync-download'
          ? 'downloading'
          : (syncCheck?.phase ??
            (syncIdentity === 'owned' ? 'ready' : syncIdentity));

  const applySyncResult = async (result: SyncCheck) => {
    setSyncCheck(result);
    await loadOwnership();
    setNotice(syncMessage(result.phase));
  };

  const runSyncPush = (check: SyncCheck) =>
    void run('sync-upload', async () => {
      await applySyncResult(
        await pushManualSync(database, check, user?.id ?? null)
      );
    });

  const runSyncPull = (check: SyncCheck) =>
    void run('sync-download', async () => {
      await applySyncResult(
        await pullManualSync(database, check, user?.id ?? null)
      );
    });

  const cancelSyncChoice = () => {
    void cancelManualSync(database);
    setNotice('Eşitleme iptal edildi. Yerel ve bulut verileri değiştirilmedi.');
  };

  const confirmLocalOverwrite = (check: SyncCheck) => {
    Alert.alert(
      'Bulut verilerinin üzerine yazılsın mı?',
      syncPreview(
        check,
        'Bu cihazdaki veriler yeni bir immutable revizyon olarak yüklenecek. Buluttaki mevcut revizyon doğrudan silinmeyecek.'
      ),
      [
        { style: 'cancel', text: 'Vazgeç' },
        {
          style: 'destructive',
          text: 'Bu Cihazdaki Verileri Kullan',
          onPress: () => runSyncPush(check),
        },
      ],
      { cancelable: false }
    );
  };

  const confirmCloudReplacement = (check: SyncCheck) => {
    Alert.alert(
      'Bu cihazdaki veriler değiştirilsin mi?',
      syncPreview(
        check,
        'Bulut verileri yeniden indirilecek ve doğrulanacak. Yerel değişiklikten önce app-private bir kurtarma kopyası oluşturulacak.'
      ),
      [
        { style: 'cancel', text: 'Vazgeç' },
        {
          style: 'destructive',
          text: 'Buluttaki Verileri Kullan',
          onPress: () => runSyncPull(check),
        },
      ],
      { cancelable: false }
    );
  };

  const showConflict = (check: SyncCheck) => {
    Alert.alert(
      'Eşitleme Çakışması',
      syncPreview(
        check,
        `Bu cihaz ve bulut son eşitlemeden sonra ayrı ayrı değişti. Son eşitleme: ${formatDate(
          check.state?.lastSuccessfulSyncAt
        )}\nBulut güncellemesi: ${formatDate(check.remoteHead?.updatedAt)}`
      ),
      [
        {
          text: 'Bu cihazdaki verileri kullan',
          onPress: () => confirmLocalOverwrite(check),
        },
        {
          text: 'Buluttaki verileri kullan',
          onPress: () => confirmCloudReplacement(check),
        },
        { style: 'cancel', text: 'Vazgeç', onPress: cancelSyncChoice },
      ],
      { cancelable: false }
    );
  };

  const handleSyncCheck = () =>
    void run('sync-check', async () => {
      const check = await inspectManualSync(database, user?.id ?? null);
      setSyncCheck(check);
      await loadOwnership();
      if (check.phase === 'cloud_empty' || check.phase === 'local_changed') {
        Alert.alert(
          check.phase === 'cloud_empty'
            ? 'İlk Cihaz Eşitlemesi'
            : 'Bu Cihazdaki Değişiklikleri Yükle',
          syncPreview(
            check,
            check.phase === 'cloud_empty'
              ? 'Bulutta veri yok. Bu cihazdaki doğrulanmış veriler ilk revizyon olarak yüklensin mi?'
              : 'Bulut son kabul edilen revizyonda. Bu cihazdaki değişiklikler yeni revizyon olarak yüklensin mi?'
          ),
          [
            { style: 'cancel', text: 'Vazgeç', onPress: cancelSyncChoice },
            {
              text: 'Bu Cihazdaki Verileri Yükle',
              onPress: () => runSyncPush(check),
            },
          ],
          { cancelable: false }
        );
      } else if (check.phase === 'cloud_changed') {
        confirmCloudReplacement(check);
      } else if (check.phase === 'conflict') {
        showConflict(check);
      } else {
        setNotice(syncMessage(check.phase));
      }
    });

  const ownershipLabel =
    syncIdentity === 'signed_out'
      ? 'Oturum kapalı'
      : syncIdentity === 'dataset_unowned'
        ? 'Sahiplik onayı bekleniyor'
        : syncIdentity === 'account_mismatch'
          ? 'Hesap uyuşmazlığı'
          : 'Bu hesaba bağlı';

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

      <DeviceSyncCard
        disabled={pending !== null}
        lastSuccessfulSyncAt={formatDate(syncState?.lastSuccessfulSyncAt)}
        onExportRecovery={() =>
          void run('recovery-export', async () => {
            await shareRecoveryArchive();
            setNotice('Kurtarma kopyası paylaşım için hazırlandı.');
          })
        }
        onRestoreRecovery={() =>
          void run('recovery-restore', async () => {
            confirmRestore(await readRecoveryArchive());
          })
        }
        onSync={handleSyncCheck}
        ownershipLabel={ownershipLabel}
        phase={syncPhase}
        recoveryAvailable={recoveryAvailable}
        remoteRevision={
          syncCheck?.remoteHead?.revision ??
          syncState?.lastRemoteRevision ??
          null
        }
      />

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
                const archive = await downloadCloudBackup(database);
                try {
                  confirmRestore(archive);
                } catch {
                  const error = createCloudBackupDownloadError({
                    archiveFitnessSchemaVersion: archive.schemaVersion,
                    archiveFormatVersion: archive.formatVersion,
                    code: 'preview_generation_failed',
                    stage: 'preview_generation',
                  });
                  logCloudBackupDownloadFailure(error);
                  throw error;
                }
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
