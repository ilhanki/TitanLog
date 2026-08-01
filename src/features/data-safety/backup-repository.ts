import type { SQLiteDatabase } from 'expo-sqlite';

import packageJson from '../../../package.json';
import {
  backupTableColumns,
  normalizePersistedBackupRow,
} from '@/features/data-safety/backup-contract';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupData,
  type BackupRow,
  type BackupTableName,
  type TitanLogBackup,
} from '@/features/data-safety/backup-types';
import {
  BackupValidationError,
  type BackupValidationIssue,
  createBackupSummary,
  validateBackup,
} from '@/features/data-safety/backup-validator';

const INSERT_ORDER: BackupTableName[] = [
  'workout_plans',
  'workout_days',
  'exercises',
  'workout_day_schedules',
  'workout_day_exercises',
  'workout_sessions',
  'workout_session_exercises',
  'workout_sets',
  'body_profiles',
  'body_measurements',
];
const DELETE_ORDER = [...INSERT_ORDER].reverse();

export type BackupArchiveStage =
  'snapshot_read' | 'archive_build' | 'archive_validation';

export class BackupArchiveError extends Error {
  constructor(
    readonly stage: BackupArchiveStage,
    readonly validationIssue?: BackupValidationIssue,
    options?: ErrorOptions
  ) {
    super(stage, options);
    this.name = 'BackupArchiveError';
  }
}

export async function createBackupArchive(
  database: SQLiteDatabase
): Promise<TitanLogBackup> {
  let snapshot: { data: BackupData; installationId: string } | null = null;
  try {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      const metadata = await transaction.getFirstAsync<{
        installation_id: string;
      }>('SELECT installation_id FROM dataset_metadata WHERE id = 1');
      if (!metadata) {
        throw new BackupArchiveError('archive_build');
      }
      const entries: [BackupTableName, BackupRow[]][] = [];
      for (const table of BACKUP_TABLES) {
        const columns = backupTableColumns(table);
        const rows = await transaction.getAllAsync<Record<string, unknown>>(
          `SELECT ${columns.join(', ')} FROM ${table} ORDER BY id`
        );
        entries.push([
          table,
          rows.map((row) => normalizePersistedBackupRow(table, row)),
        ]);
      }
      snapshot = {
        data: Object.fromEntries(entries) as BackupData,
        installationId: metadata.installation_id,
      };
    });
  } catch (error) {
    if (error instanceof BackupArchiveError) throw error;
    throw new BackupArchiveError('snapshot_read', undefined, { cause: error });
  }
  if (!snapshot) throw new BackupArchiveError('archive_build');
  const { data, installationId } = snapshot as {
    data: BackupData;
    installationId: string;
  };
  try {
    return validateBackup({
      appVersion: packageJson.version,
      createdAt: new Date().toISOString(),
      data,
      deviceId: installationId,
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      summary: createBackupSummary(data),
    });
  } catch (error) {
    throw new BackupArchiveError(
      'archive_validation',
      error instanceof BackupValidationError ? error.issue : undefined,
      { cause: error }
    );
  }
}

export async function restoreBackupArchive(
  database: SQLiteDatabase,
  archive: TitanLogBackup
): Promise<void> {
  const validated = validateBackup(archive);
  await database.withExclusiveTransactionAsync(async (transaction) => {
    for (const table of DELETE_ORDER)
      await transaction.runAsync(`DELETE FROM ${table}`);
    for (const table of INSERT_ORDER) {
      for (const row of validated.data[table]) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(', ');
        await transaction.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          ...columns.map((column) => row[column] as BackupRow[string])
        );
      }
    }
    const integrity = await transaction.getAllAsync<{ table: string }>(
      'PRAGMA foreign_key_check'
    );
    if (integrity.length > 0) throw new Error('restore_integrity_failed');
  });
}
