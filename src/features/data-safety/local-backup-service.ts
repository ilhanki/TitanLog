import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import {
  BackupArchiveError,
  createBackupArchive,
} from '@/features/data-safety/backup-repository';
import {
  deserializeBackup,
  serializeBackup,
} from '@/features/data-safety/backup-serialization';
import {
  MAX_BACKUP_BYTES,
  type TitanLogBackup,
} from '@/features/data-safety/backup-types';
import { createDatasetOwnershipRepository } from '@/features/data-safety/dataset-ownership-repository';

export type LocalBackupExportStage =
  | 'snapshot_read'
  | 'archive_build'
  | 'archive_validation'
  | 'serialization'
  | 'temporary_file_create'
  | 'temporary_file_write'
  | 'temporary_file_verify'
  | 'temporary_cleanup'
  | 'sharing_unavailable'
  | 'sharing';

type SafeExportDiagnostic = {
  fileExists?: boolean;
  fileSize?: number | null;
  nativeErrorCode?: string;
  nativeErrorName?: string;
  platform: string;
  stage: LocalBackupExportStage;
  uriScheme?: string;
};

export class LocalBackupExportError extends Error {
  constructor(
    readonly stage: LocalBackupExportStage,
    readonly diagnostic: SafeExportDiagnostic,
    options?: ErrorOptions
  ) {
    super(stage, options);
    this.name = 'LocalBackupExportError';
  }
}

function nativeErrorDetails(error: unknown) {
  if (typeof error !== 'object' || error === null) return {};
  const candidate = error as { code?: unknown; name?: unknown };
  return {
    nativeErrorCode:
      typeof candidate.code === 'string' ? candidate.code : undefined,
    nativeErrorName:
      typeof candidate.name === 'string' ? candidate.name : undefined,
  };
}

function exportError(
  stage: LocalBackupExportStage,
  cause?: unknown,
  details: Partial<SafeExportDiagnostic> = {}
): LocalBackupExportError {
  return new LocalBackupExportError(
    stage,
    {
      platform: Platform.OS,
      stage,
      ...nativeErrorDetails(cause),
      ...details,
    },
    { cause }
  );
}

function reportDiagnostic(error: LocalBackupExportError): void {
  if (__DEV__) {
    console.warn('TitanLog local backup export failed', error.diagnostic);
  }
}

function randomSuffix(): string {
  return Math.floor(Math.random() * 0x100000)
    .toString(36)
    .padStart(4, '0')
    .slice(-4);
}

export function createBackupFileName(
  createdAt: string,
  suffix = randomSuffix()
): string {
  const timestamp = createdAt.replace(/\D/g, '').slice(0, 14).padEnd(14, '0');
  const safeSuffix = suffix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  return `titanlog-backup-${timestamp}-${safeSuffix || randomSuffix()}.titanlog`;
}

export function localBackupErrorMessage(error: unknown): string {
  if (!(error instanceof LocalBackupExportError)) {
    return 'Yedek hazırlanamadı. Yerel verilerin değişmeden korundu.';
  }
  if (error.stage === 'sharing_unavailable') {
    return 'Bu cihazda dosya paylaşımı kullanılamıyor. Yerel verilerin değişmeden korundu.';
  }
  if (error.stage === 'sharing') {
    return 'Android paylaşım ekranı açılamadı. Yerel verilerin değişmeden korundu.';
  }
  if (error.stage.startsWith('temporary_file_')) {
    return 'Geçici yedek dosyası oluşturulamadı. Yerel verilerin değişmeden korundu.';
  }
  return 'Yedek hazırlanamadı. Yerel verilerin değişmeden korundu.';
}

let activeExport: Promise<TitanLogBackup> | null = null;

async function performLocalBackupExport(
  database: SQLiteDatabase
): Promise<TitanLogBackup> {
  let archive: TitanLogBackup;
  try {
    archive = await createBackupArchive(database);
  } catch (error) {
    const stage =
      error instanceof BackupArchiveError ? error.stage : 'archive_build';
    const wrapped = exportError(stage, error);
    reportDiagnostic(wrapped);
    throw wrapped;
  }
  let serialized: string;
  try {
    serialized = serializeBackup(archive);
    if (serialized.length === 0) throw new Error('empty_serialization');
  } catch (error) {
    const wrapped = exportError('serialization', error);
    reportDiagnostic(wrapped);
    throw wrapped;
  }
  let file: File;
  try {
    file = new File(Paths.cache, createBackupFileName(archive.createdAt));
  } catch (error) {
    const wrapped = exportError('temporary_file_create', error);
    reportDiagnostic(wrapped);
    throw wrapped;
  }
  try {
    try {
      file.create({ overwrite: false });
    } catch (error) {
      throw exportError('temporary_file_create', error, {
        uriScheme: file.uri.split(':', 1)[0],
      });
    }
    try {
      file.write(serialized);
    } catch (error) {
      throw exportError('temporary_file_write', error, {
        fileExists: file.exists,
        uriScheme: file.uri.split(':', 1)[0],
      });
    }
    const uriScheme = file.uri.split(':', 1)[0];
    if (!file.exists || !file.size || file.size <= 0 || uriScheme !== 'file') {
      throw exportError('temporary_file_verify', undefined, {
        fileExists: file.exists,
        fileSize: file.size,
        uriScheme,
      });
    }
    let sharingAvailable: boolean;
    try {
      sharingAvailable = await isAvailableAsync();
    } catch (error) {
      throw exportError('sharing_unavailable', error, {
        fileExists: file.exists,
        fileSize: file.size,
        uriScheme,
      });
    }
    if (!sharingAvailable) {
      throw exportError('sharing_unavailable', undefined, {
        fileExists: file.exists,
        fileSize: file.size,
        uriScheme,
      });
    }
    try {
      await shareAsync(file.uri, {
        dialogTitle: 'TitanLog Yerel Yedeği',
        mimeType: 'application/octet-stream',
        UTI: 'public.data',
      });
    } catch (error) {
      throw exportError('sharing', error, {
        fileExists: file.exists,
        fileSize: file.size,
        uriScheme,
      });
    }
    try {
      await createDatasetOwnershipRepository(database).markBackup(
        'local',
        archive.createdAt
      );
    } catch (error) {
      if (__DEV__) {
        console.warn('TitanLog local backup metadata update failed', {
          ...nativeErrorDetails(error),
          platform: Platform.OS,
        });
      }
    }
    return archive;
  } catch (error) {
    const wrapped =
      error instanceof LocalBackupExportError
        ? error
        : exportError('sharing', error);
    reportDiagnostic(wrapped);
    throw wrapped;
  } finally {
    if (file.exists) {
      try {
        file.delete();
      } catch (error) {
        if (__DEV__) {
          console.warn(
            'TitanLog local backup cleanup failed',
            exportError('temporary_cleanup', error, {
              fileExists: file.exists,
              fileSize: file.size,
              uriScheme: file.uri.split(':', 1)[0],
            }).diagnostic
          );
        }
      }
    }
  }
}

export function shareLocalBackup(
  database: SQLiteDatabase
): Promise<TitanLogBackup> {
  if (activeExport) return activeExport;
  const operation = performLocalBackupExport(database);
  activeExport = operation;
  const release = () => {
    if (activeExport === operation) activeExport = null;
  };
  void operation.then(release, release);
  return operation;
}

export async function pickLocalBackup(): Promise<TitanLogBackup | null> {
  const result = await getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ['application/json', 'application/octet-stream', 'text/plain'],
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || !asset.name.toLowerCase().endsWith('.titanlog')) {
    throw new Error('invalid_extension');
  }
  const file = new File(asset.uri);
  if (file.size > MAX_BACKUP_BYTES) throw new Error('oversized');
  return deserializeBackup(await file.text());
}
