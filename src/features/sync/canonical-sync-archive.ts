import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
} from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createBackupArchive } from '@/features/data-safety/backup-repository';
import { serializeBackup } from '@/features/data-safety/backup-serialization';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';
import { validateBackup } from '@/features/data-safety/backup-validator';
import type { HashedSyncArchive } from '@/features/sync/sync-types';

const CANONICAL_SYNC_CREATED_AT = '1970-01-01T00:00:00.000Z';
const CANONICAL_SYNC_APP_VERSION = 'sync-canonical-v1';
const CANONICAL_SYNC_DEVICE_ID = 'titanlog-sync';

export function createCanonicalSyncArchive(
  source: TitanLogBackup
): TitanLogBackup {
  const validated = validateBackup(source);
  return validateBackup({
    ...validated,
    appVersion: CANONICAL_SYNC_APP_VERSION,
    createdAt: CANONICAL_SYNC_CREATED_AT,
    deviceId: CANONICAL_SYNC_DEVICE_ID,
  });
}

export async function hashCanonicalArchive(
  serialized: string
): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, serialized, {
    encoding: CryptoEncoding.HEX,
  });
}

export async function createHashedSyncArchive(
  database: SQLiteDatabase
): Promise<HashedSyncArchive> {
  const archive = createCanonicalSyncArchive(
    await createBackupArchive(database)
  );
  const serialized = serializeBackup(archive);
  return {
    archive,
    byteSize: new TextEncoder().encode(serialized).byteLength,
    contentHash: await hashCanonicalArchive(serialized),
    serialized,
  };
}
