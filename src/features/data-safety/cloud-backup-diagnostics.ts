export type CloudBackupDownloadStage =
  | 'session'
  | 'ownership'
  | 'metadata_query'
  | 'metadata_validation'
  | 'storage_download'
  | 'blob_conversion'
  | 'size_validation'
  | 'hash_validation'
  | 'archive_parse'
  | 'archive_validation'
  | 'canonical_validation'
  | 'preview_generation';

export type CloudBackupDownloadErrorCode =
  | 'not_configured'
  | 'not_authenticated'
  | 'ownership_mismatch'
  | 'ownership_required'
  | 'metadata_not_found'
  | 'metadata_query_failed'
  | 'metadata_invalid'
  | 'storage_download_failed'
  | 'blob_conversion_failed'
  | 'size_mismatch'
  | 'hash_calculation_failed'
  | 'hash_mismatch'
  | 'archive_parse_failed'
  | 'archive_validation_failed'
  | 'canonical_validation_failed'
  | 'preview_generation_failed'
  | 'unknown_failure';

export type CloudBackupDownloadDiagnostic = {
  actualByteSize?: number;
  archiveFitnessSchemaVersion?: number;
  archiveFormatVersion?: number;
  code: CloudBackupDownloadErrorCode;
  expectedByteSize?: number;
  hashMatched?: boolean;
  hashMetadataExists?: boolean;
  httpStatusCategory?: '2xx' | '4xx' | '5xx';
  metadataExists?: boolean;
  sizeMatched?: boolean;
  stage: CloudBackupDownloadStage;
  storageObjectExists?: boolean;
};

export class CloudBackupDownloadError extends Error {
  constructor(readonly diagnostic: CloudBackupDownloadDiagnostic) {
    super(diagnostic.code);
    this.name = 'CloudBackupDownloadError';
  }
}

export function httpStatusCategory(
  error: unknown
): CloudBackupDownloadDiagnostic['httpStatusCategory'] {
  const status = Number((error as { status?: unknown } | null)?.status);
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return undefined;
}

export function createCloudBackupDownloadError(
  diagnostic: CloudBackupDownloadDiagnostic
): CloudBackupDownloadError {
  return new CloudBackupDownloadError(diagnostic);
}

export function logCloudBackupDownloadFailure(
  error: CloudBackupDownloadError,
  development = __DEV__
): void {
  if (!development) return;
  console.warn('TitanLog manual cloud backup download failed', {
    ...error.diagnostic,
  });
}
