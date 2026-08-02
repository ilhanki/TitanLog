jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(
    async (_algorithm: string, value: string) => `test-digest:${value}`
  ),
}));

import {
  claimAuthCallbackNavigation,
  completeAuthCallbackOnce,
  processAuthCallbackOnce,
  resetAuthCallbackCoordinatorForTests,
} from '@/features/auth/auth-callback-coordinator';

describe('auth callback coordinator', () => {
  beforeEach(() => resetAuthCallbackCoordinatorForTests());

  it('shares concurrent callback processing and marks the duplicate delivery', async () => {
    const process = jest.fn().mockResolvedValue(undefined);
    const callbackUrl = 'titanlog://auth/callback?code=duplicate-code';

    const [first, second] = await Promise.all([
      processAuthCallbackOnce('email_verification', callbackUrl, process),
      processAuthCallbackOnce('email_verification', callbackUrl, process),
    ]);

    expect(process).toHaveBeenCalledTimes(1);
    expect([first.duplicate, second.duplicate].sort()).toEqual([false, true]);
    expect(first.callbackId).toBe(second.callbackId);
  });

  it('allows only one completion and one automatic history replacement', async () => {
    const complete = jest.fn().mockResolvedValue(undefined);
    const callbackId = 'safe-callback-fingerprint';

    await expect(
      Promise.all([
        completeAuthCallbackOnce(callbackId, complete),
        completeAuthCallbackOnce(callbackId, complete),
      ])
    ).resolves.toEqual([true, false]);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(claimAuthCallbackNavigation(callbackId)).toBe(true);
    expect(claimAuthCallbackNavigation(callbackId)).toBe(false);
  });
});
