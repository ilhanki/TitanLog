import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

export type AuthCallbackType = 'email_verification' | 'password_recovery';

export type AuthCallbackResult = {
  callbackId: string;
  duplicate: boolean;
};

const callbackProcesses = new Map<string, Promise<void>>();
const callbackCompletions = new Map<string, Promise<void>>();

async function fingerprintCallback(
  type: AuthCallbackType,
  callbackUrl: string
): Promise<string> {
  return digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    `${type}:${callbackUrl}`
  );
}

export async function processAuthCallbackOnce(
  type: AuthCallbackType,
  callbackUrl: string,
  process: () => Promise<void>
): Promise<AuthCallbackResult> {
  const callbackId = await fingerprintCallback(type, callbackUrl);
  const existing = callbackProcesses.get(callbackId);
  if (existing) {
    await existing;
    return { callbackId, duplicate: true };
  }
  const operation = process();
  callbackProcesses.set(callbackId, operation);
  await operation;
  return { callbackId, duplicate: false };
}

export async function completeAuthCallbackOnce(
  callbackId: string,
  complete: () => Promise<void>
): Promise<boolean> {
  const existing = callbackCompletions.get(callbackId);
  if (existing) {
    await existing;
    return false;
  }
  const operation = complete();
  callbackCompletions.set(callbackId, operation);
  try {
    await operation;
    return true;
  } catch (error) {
    if (callbackCompletions.get(callbackId) === operation)
      callbackCompletions.delete(callbackId);
    throw error;
  }
}

export function resetAuthCallbackCoordinatorForTests(): void {
  callbackProcesses.clear();
  callbackCompletions.clear();
}
