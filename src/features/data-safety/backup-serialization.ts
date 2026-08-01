import type { TitanLogBackup } from './backup-types';
import { parseBackupJson, validateBackup } from './backup-validator';

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)])
  );
}

export function serializeBackup(archive: TitanLogBackup): string {
  return JSON.stringify(sortValue(validateBackup(archive)), null, 2);
}

export function deserializeBackup(serialized: string): TitanLogBackup {
  return parseBackupJson(serialized);
}
