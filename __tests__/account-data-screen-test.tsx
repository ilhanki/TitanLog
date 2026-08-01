import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { AccountDataScreen } from '@/features/profile/account-data-screen';

const mockRouter = { back: jest.fn(), replace: jest.fn() };
const mockDatabase = {};
const mockGetOwnership = jest.fn();
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
  useAuth: () => ({ configured: false, initializing: false, user: null }),
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

import * as BackupRepository from '@/features/data-safety/backup-repository';
import * as LocalBackupService from '@/features/data-safety/local-backup-service';

const mockPickLocalBackup = LocalBackupService.pickLocalBackup as jest.Mock;
const mockShareLocalBackup = LocalBackupService.shareLocalBackup as jest.Mock;
const mockRestoreBackup = BackupRepository.restoreBackupArchive as jest.Mock;
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOwnership.mockResolvedValue({
      installationId: 'installation-123',
      lastCloudBackupAt: null,
      lastLocalBackupAt: null,
      ownerAccountId: null,
    });
    mockPickLocalBackup.mockResolvedValue(backup);
    mockShareLocalBackup.mockResolvedValue(backup);
    mockRestoreBackup.mockResolvedValue(undefined);
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
});
