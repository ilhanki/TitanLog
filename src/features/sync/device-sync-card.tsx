import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import type { ManualSyncPhase } from '@/features/sync/sync-types';
import { theme } from '@/theme/tokens';

const STATUS: Record<
  ManualSyncPhase,
  {
    label: string;
    tone: 'muted' | 'primary' | 'success' | 'warning' | 'danger';
  }
> = {
  signed_out: { label: 'Henüz eşitlenmedi', tone: 'muted' },
  dataset_unowned: {
    label: 'Veri sahipliği onayı gerekiyor',
    tone: 'warning',
  },
  account_mismatch: { label: 'Hesap uyuşmazlığı', tone: 'danger' },
  ready: { label: 'Henüz eşitlenmedi', tone: 'muted' },
  checking_cloud: { label: 'Bulut denetleniyor', tone: 'primary' },
  cloud_empty: { label: 'İlk eşitleme hazır', tone: 'primary' },
  uploading: { label: 'Bu cihazdaki veriler yükleniyor', tone: 'primary' },
  downloading: { label: 'Bulut verileri doğrulanıyor', tone: 'primary' },
  unchanged: { label: 'Veriler güncel', tone: 'success' },
  local_changed: { label: 'Bu cihazda değişiklik var', tone: 'warning' },
  cloud_changed: { label: 'Bulutta yeni veri var', tone: 'warning' },
  conflict: { label: 'Çakışma çözümü gerekiyor', tone: 'danger' },
  completed: { label: 'Eşitleme tamamlandı', tone: 'success' },
  offline: { label: 'İnternet bağlantısı bekleniyor', tone: 'warning' },
  unsupported_remote_version: {
    label: 'Uygulama güncellemesi gerekiyor',
    tone: 'danger',
  },
  validation_failure: {
    label: 'Bulut verileri doğrulanamadı',
    tone: 'danger',
  },
  authentication_failure: {
    label: 'Oturum yeniden doğrulanmalı',
    tone: 'warning',
  },
  recoverable_server_failure: {
    label: 'Eşitleme servisine ulaşılamadı',
    tone: 'warning',
  },
};

type DeviceSyncCardProps = {
  disabled: boolean;
  lastSuccessfulSyncAt: string;
  onExportRecovery: () => void;
  onRestoreRecovery: () => void;
  onSync: () => void;
  ownershipLabel: string;
  phase: ManualSyncPhase;
  recoveryAvailable: boolean;
  remoteRevision: number | null;
};

export function DeviceSyncCard({
  disabled,
  lastSuccessfulSyncAt,
  onExportRecovery,
  onRestoreRecovery,
  onSync,
  ownershipLabel,
  phase,
  recoveryAvailable,
  remoteRevision,
}: DeviceSyncCardProps) {
  const status = STATUS[phase];
  return (
    <AppCard
      accessibilityLabel="Cihaz Eşitleme"
      style={styles.card}
      tone="accent"
    >
      <View style={styles.titleRow}>
        <View style={styles.icon}>
          <AppIcon color={theme.colors.primary} name="cloud-sync-outline" />
        </View>
        <View style={styles.titleCopy}>
          <AppText variant="heading">Cihaz Eşitleme</AppText>
          <AppText selectable tone={status.tone} variant="bodyStrong">
            {status.label}
          </AppText>
        </View>
      </View>
      <AppText selectable tone="muted">
        Yalnızca sen “Şimdi Eşitle” dediğinde çalışır. Arka planda veya giriş
        sırasında otomatik eşitleme yapılmaz.
      </AppText>
      <View style={styles.metadata}>
        <AppText selectable variant="caption">
          Hesap ve veri sahipliği: {ownershipLabel}
        </AppText>
        <AppText selectable variant="caption">
          Son başarılı eşitleme: {lastSuccessfulSyncAt}
        </AppText>
        <AppText selectable variant="caption">
          Bulut revizyonu: {remoteRevision ?? '—'}
        </AppText>
        <AppText selectable variant="caption">
          Kurtarma kopyası: {recoveryAvailable ? 'Hazır' : 'Henüz yok'}
        </AppText>
      </View>
      <AppButton
        accessibilityHint="Yerel ve bulut değişikliklerini güvenli biçimde karşılaştırır"
        disabled={disabled}
        icon="sync"
        label={
          ['checking_cloud', 'uploading', 'downloading'].includes(phase)
            ? 'Eşitleme sürüyor…'
            : 'Şimdi Eşitle'
        }
        onPress={onSync}
      />
      {recoveryAvailable ? (
        <View style={styles.actions}>
          <AppButton
            disabled={disabled}
            label="Kurtarma Kopyasını Dışa Aktar"
            onPress={onExportRecovery}
            style={styles.action}
            variant="secondary"
          />
          <AppButton
            disabled={disabled}
            label="Kurtarma Kopyasını Geri Yükle"
            onPress={onRestoreRecovery}
            style={styles.action}
            variant="secondary"
          />
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  action: { flexBasis: 190, flexGrow: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  card: { gap: theme.spacing.lg },
  icon: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.pill,
    height: theme.layout.touchTarget,
    justifyContent: 'center',
    width: theme.layout.touchTarget,
  },
  metadata: { gap: theme.spacing.xs },
  titleCopy: { flex: 1, gap: theme.spacing.xxs },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
});
