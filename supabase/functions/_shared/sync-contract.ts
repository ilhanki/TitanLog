import {
  deserializeBackup,
  serializeBackup,
} from '../../../src/features/data-safety/backup-serialization.ts';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_BYTES,
  type TitanLogBackup,
} from '../../../src/features/data-safety/backup-types.ts';

export { BACKUP_FORMAT_VERSION, BACKUP_SCHEMA_VERSION, MAX_BACKUP_BYTES };

const SECRET_KEY_PATTERN =
  /^(access_?token|refresh_?token|session_?token|authorization|password|service_?role)$/i;

function containsSecretShapedKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSecretShapedKey);
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).some(
    ([key, child]) =>
      SECRET_KEY_PATTERN.test(key) || containsSecretShapedKey(child)
  );
}

export function validateCanonicalSyncArchive(
  serialized: string
): TitanLogBackup {
  const parsed: unknown = JSON.parse(serialized);
  if (containsSecretShapedKey(parsed)) throw new Error('secret_field');
  const archive = deserializeBackup(serialized);
  if (serializeBackup(archive) !== serialized) throw new Error('non_canonical');
  return archive;
}

export async function sha256(serialized: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serialized)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}
