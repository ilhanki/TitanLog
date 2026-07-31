import type { SQLiteDatabase } from 'expo-sqlite';

export type DatasetOwnership = {
  installationId: string;
  lastCloudBackupAt: string | null;
  lastLocalBackupAt: string | null;
  ownerAccountId: string | null;
};

type MetadataRow = {
  installation_id: string;
  last_cloud_backup_at: string | null;
  last_local_backup_at: string | null;
  owner_account_id: string | null;
};

export class DatasetOwnershipError extends Error {
  constructor(
    readonly code:
      'owner_mismatch' | 'already_claimed' | 'metadata_missing' | 'unclaimed'
  ) {
    super(code);
  }
}

export function createDatasetOwnershipRepository(database: SQLiteDatabase) {
  const getOwnership = async (): Promise<DatasetOwnership> => {
    const row = await database.getFirstAsync<MetadataRow>(
      `SELECT installation_id, owner_account_id, last_local_backup_at,
              last_cloud_backup_at FROM dataset_metadata WHERE id = 1`
    );
    if (!row) throw new DatasetOwnershipError('metadata_missing');
    return {
      installationId: row.installation_id,
      lastCloudBackupAt: row.last_cloud_backup_at,
      lastLocalBackupAt: row.last_local_backup_at,
      ownerAccountId: row.owner_account_id,
    };
  };
  return {
    getOwnership,
    async claimDataset(accountId: string): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const row = await transaction.getFirstAsync<{
          owner_account_id: string | null;
        }>('SELECT owner_account_id FROM dataset_metadata WHERE id = 1');
        if (!row) throw new DatasetOwnershipError('metadata_missing');
        if (row.owner_account_id === accountId) return;
        if (row.owner_account_id)
          throw new DatasetOwnershipError('already_claimed');
        const result = await transaction.runAsync(
          `UPDATE dataset_metadata SET owner_account_id = ?, updated_at = ?
           WHERE id = 1 AND owner_account_id IS NULL`,
          accountId,
          new Date().toISOString()
        );
        if (result.changes !== 1)
          throw new DatasetOwnershipError('already_claimed');
      });
    },
    async assertAccountAccess(accountId: string): Promise<void> {
      const ownership = await getOwnership();
      if (ownership.ownerAccountId && ownership.ownerAccountId !== accountId) {
        throw new DatasetOwnershipError('owner_mismatch');
      }
    },
    async assertCloudAccess(accountId: string): Promise<void> {
      const ownership = await getOwnership();
      if (!ownership.ownerAccountId) {
        throw new DatasetOwnershipError('unclaimed');
      }
      if (ownership.ownerAccountId !== accountId) {
        throw new DatasetOwnershipError('owner_mismatch');
      }
    },
    async markBackup(kind: 'local' | 'cloud', at: string): Promise<void> {
      const column =
        kind === 'local' ? 'last_local_backup_at' : 'last_cloud_backup_at';
      await database.runAsync(
        `UPDATE dataset_metadata SET ${column} = ?, updated_at = ? WHERE id = 1`,
        at,
        at
      );
    },
  };
}
