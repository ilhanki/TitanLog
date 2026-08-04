import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { AccountDataScreen } from '@/features/profile/account-data-screen';

const mockRouter = { back: jest.fn(), replace: jest.fn() };
const mockDatabase = {
  getAllAsync: jest.fn().mockResolvedValue([]),
  runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  withExclusiveTransactionAsync: jest.fn(
    async (task: (database: typeof mockDatabase) => Promise<void>) => {
      await task(mockDatabase);
    }
  ),
};
const mockGetOwnership = jest.fn();
const mockGetSyncState = jest.fn();
const mockInspectManualSync = jest.fn();
const mockCancelManualSync = jest.fn();
let mockAuth = {
  configured: false,
  initializing: false,
  user: null as null | {
    email: string;
    email_confirmed_at: string;
    id: string;
  },
};
const backup = {
  appVersion: '0.1.0-alpha.10',
  createdAt: '2026-07-31T10:00:00.000Z',
  format: 'titanlog-backup',
  formatVersion: 1,
  schemaVersion: 4,
  deviceId: 'installation-123',
  summary: {
    exercises: 3,
    measurements: 18,
    programs: 3,
    sets: 496,
    workouts: 82,
  },
  data: {},
};

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDatabase }));
jest.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('@/features/data-safety/local-backup-service', () => ({
  localBackupErrorMessage: jest.fn(
    () =>
      'Android paylaşım ekranı açılamadı. Yerel verilerin değişmeden korundu.'
  ),
  pickLocalBackup: jest.fn(),
  shareLocalBackup: jest.fn(),
}));
jest.mock('@/features/data-safety/backup-repository', () => ({
  restoreBackupArchive: jest.fn(),
}));
jest.mock('@/features/sync/manual-sync-service', () => ({
  cancelManualSync: (...args: unknown[]) => mockCancelManualSync(...args),
  hasRecoveryArchive: jest.fn(() => false),
  inspectManualSync: (...args: unknown[]) => mockInspectManualSync(...args),
  pullManualSync: jest.fn(),
  pushManualSync: jest.fn(),
}));
jest.mock('@/features/sync/recovery-archive-service', () => ({
  readRecoveryArchive: jest.fn(),
  shareRecoveryArchive: jest.fn(),
}));
jest.mock('@/features/sync/sync-state-repository', () => ({
  createSyncStateRepository: () => ({ getState: mockGetSyncState }),
}));

import * as BackupRepository from '@/features/data-safety/backup-repository';
import * as CloudBackupService from '@/features/data-safety/cloud-backup-service';
import * as LocalBackupService from '@/features/data-safety/local-backup-service';

const mockPickLocalBackup = LocalBackupService.pickLocalBackup as jest.Mock;
const mockShareLocalBackup = LocalBackupService.shareLocalBackup as jest.Mock;
const mockRestoreBackup = BackupRepository.restoreBackupArchive as jest.Mock;
const mockDownloadCloudBackup =
  CloudBackupService.downloadCloudBackup as jest.Mock;
jest.mock('@/features/data-safety/cloud-backup-service', () => ({
  downloadCloudBackup: jest.fn(),
  uploadCloudBackup: jest.fn(),
}));
jest.mock('@/features/data-safety/dataset-ownership-repository', () => ({
  DatasetOwnershipError: class DatasetOwnershipError extends Error {},
  createDatasetOwnershipRepository: () => ({
    getOwnership: mockGetOwnership,
    markBackup: jest.fn(),
  }),
}));
jest.mock('@/features/auth/auth-service', () => ({
  requestAccountDeletion: jest.fn(),
  signOut: jest.fn(),
}));

describe('account and data screen restore safety', () => {
  const configureOwnedAccount = () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    mockAuth = {
      configured: true,
      initializing: false,
      user: {
        email: 'user@example.com',
        email_confirmed_at: '2026-08-01T08:00:00.000Z',
        id: userId,
      },
    };
    mockGetOwnership.mockResolvedValue({
      installationId: 'installation-123',
      lastCloudBackupAt: null,
      lastLocalBackupAt: null,
      ownerAccountId: userId,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = { configured: false, initializing: false, user: null };
    mockGetOwnership.mockResolvedValue({
      installationId: 'installation-123',
      lastCloudBackupAt: null,
      lastLocalBackupAt: null,
      ownerAccountId: null,
    });
    mockPickLocalBackup.mockResolvedValue(backup);
    mockShareLocalBackup.mockResolvedValue(backup);
    mockRestoreBackup.mockResolvedValue(undefined);
    mockGetSyncState.mockResolvedValue({
      lastLocalContentHash: null,
      lastRemoteContentHash: null,
      lastRemoteRevision: null,
      lastResultCode: null,
      lastSuccessfulSyncAt: null,
      pendingOperationId: null,
    });
    mockCancelManualSync.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert');
  });

  it('shows a truthful preview and requires destructive confirmation', async () => {
    const { getByRole } = await render(<AccountDataScreen />);
    await waitFor(() =>
      expect(
        getByRole('button', { name: 'Yedekten Geri Yükle' }).props
          .accessibilityState.disabled
      ).toBe(false)
    );
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Yedekten Geri Yükle' }));
    });
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(Alert.alert).toHaveBeenCalledWith(
      'Yedekten Geri Yükle',
      expect.stringMatching(
        /82 antrenman[\s\S]*496 tamamlanmış set[\s\S]*18 ölçüm/
      ),
      expect.any(Array)
    );
    expect(mockRestoreBackup).not.toHaveBeenCalled();
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await act(async () => buttons[2].onPress());
    expect(mockRestoreBackup).toHaveBeenCalledWith(mockDatabase, backup);
  });

  it('changes nothing when the system picker is cancelled', async () => {
    mockPickLocalBackup.mockResolvedValue(null);
    const { getByRole } = await render(<AccountDataScreen />);
    await waitFor(() =>
      expect(
        getByRole('button', { name: 'Yedekten Geri Yükle' }).props
          .accessibilityState.disabled
      ).toBe(false)
    );
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Yedekten Geri Yükle' }));
    });
    await waitFor(() => expect(mockPickLocalBackup).toHaveBeenCalled());
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });

  it('shows a safe Turkish message when the Android share sheet cannot open', async () => {
    mockShareLocalBackup.mockRejectedValue(new Error('native private detail'));
    const { getByRole, getByText, queryByText } = await render(
      <AccountDataScreen />
    );
    await waitFor(() =>
      expect(
        getByRole('button', { name: 'Yerel Yedek Oluştur' }).props
          .accessibilityState.disabled
      ).toBe(false)
    );
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Yerel Yedek Oluştur' }));
    });
    await waitFor(() =>
      expect(
        getByText(
          'Android paylaşım ekranı açılamadı. Yerel verilerin değişmeden korundu.'
        )
      ).toBeTruthy()
    );
    expect(queryByText('native private detail')).toBeNull();
  });

  it('shows the generic safe Turkish message when cloud retrieval fails', async () => {
    configureOwnedAccount();
    mockDownloadCloudBackup.mockRejectedValueOnce(
      new Error('private runtime detail')
    );
    const { getByRole, getByText, queryByText } = await render(
      <AccountDataScreen />
    );
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Buluttan Geri Yükle' }));
    });
    await waitFor(() =>
      expect(
        getByText('İşlem tamamlanamadı. Yerel verilerin değişmeden korundu.')
      ).toBeTruthy()
    );
    expect(queryByText('private runtime detail')).toBeNull();
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });

  it('opens the restore preview after a successful cloud retrieval', async () => {
    configureOwnedAccount();
    mockDownloadCloudBackup.mockResolvedValueOnce(backup);
    const { getByRole } = await render(<AccountDataScreen />);
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Buluttan Geri Yükle' }));
    });
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Yedekten Geri Yükle',
        expect.stringMatching(/82 antrenman[\s\S]*18 ölçüm/),
        expect.any(Array)
      )
    );
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });

  it('reports preview generation failure safely without restoring data', async () => {
    configureOwnedAccount();
    mockDownloadCloudBackup.mockResolvedValueOnce(backup);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (Alert.alert as jest.Mock).mockImplementationOnce(() => {
      throw new Error('private preview detail');
    });
    const { getByRole, getByText } = await render(<AccountDataScreen />);
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Buluttan Geri Yükle' }));
    });
    await waitFor(() =>
      expect(
        getByText('İşlem tamamlanamadı. Yerel verilerin değişmeden korundu.')
      ).toBeTruthy()
    );
    expect(warn).toHaveBeenCalledWith(
      'TitanLog manual cloud backup download failed',
      expect.objectContaining({
        code: 'preview_generation_failed',
        stage: 'preview_generation',
      })
    );
    expect(JSON.stringify(warn.mock.calls[0])).not.toContain(
      'private preview detail'
    );
    expect(mockRestoreBackup).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('shows exactly three safe choices for a simultaneous sync conflict', async () => {
    configureOwnedAccount();
    mockInspectManualSync.mockResolvedValue({
      hasLocalChanges: true,
      hasRemoteChanges: true,
      local: {
        archive: backup,
        byteSize: 1000,
        contentHash: 'a'.repeat(64),
        serialized: '{}',
      },
      phase: 'conflict',
      remoteHead: {
        archiveFormatVersion: 1,
        archiveSchemaVersion: 4,
        byteSize: 1000,
        contentHash: 'b'.repeat(64),
        revision: 4,
        summary: backup.summary,
        updatedAt: '2026-08-01T11:00:00.000Z',
      },
      state: {
        lastSuccessfulSyncAt: '2026-08-01T10:00:00.000Z',
      },
    });
    const { getByRole } = await render(<AccountDataScreen />);
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Şimdi Eşitle' }));
    });
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Eşitleme Çakışması',
        expect.any(String),
        expect.any(Array),
        { cancelable: false }
      )
    );
    const call = (Alert.alert as jest.Mock).mock.calls.find(
      ([title]) => title === 'Eşitleme Çakışması'
    );
    expect(call[2].map((button: { text: string }) => button.text)).toEqual([
      'Bu cihazdaki verileri kullan',
      'Buluttaki verileri kullan',
      'Vazgeç',
    ]);
    expect(call[1]).not.toMatch(/[ab]{32,}|user@example|installation-123/);
  });
});
