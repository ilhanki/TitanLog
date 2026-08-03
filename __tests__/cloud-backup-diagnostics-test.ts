import {
  createCloudBackupDownloadError,
  logCloudBackupDownloadFailure,
} from '@/features/data-safety/cloud-backup-diagnostics';

describe('cloud backup diagnostics privacy', () => {
  it('does not emit diagnostics outside development', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logCloudBackupDownloadFailure(
      createCloudBackupDownloadError({
        code: 'hash_mismatch',
        hashMatched: false,
        stage: 'hash_validation',
      }),
      false
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
