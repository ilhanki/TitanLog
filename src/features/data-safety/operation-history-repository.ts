import type { SQLiteDatabase } from 'expo-sqlite';

export type DataOperationType =
  | 'local_export'
  | 'local_restore'
  | 'cloud_upload'
  | 'cloud_restore'
  | 'device_sync'
  | 'conflict_cancelled'
  | 'recovery_created';

export type DataOperationResult = 'completed' | 'cancelled' | 'failed';

export type DataOperationHistoryItem = {
  id: number;
  occurredAt: string;
  operationType: DataOperationType;
  result: DataOperationResult;
};

type OperationRow = {
  id: number;
  occurred_at: string;
  operation_type: DataOperationType;
  result: DataOperationResult;
};

const HISTORY_LIMIT = 20;

export function createOperationHistoryRepository(database: SQLiteDatabase) {
  return {
    async add(
      operationType: DataOperationType,
      result: DataOperationResult
    ): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync(
          `INSERT INTO data_operation_history
            (operation_type, result, occurred_at) VALUES (?, ?, ?)`,
          operationType,
          result,
          new Date().toISOString()
        );
        await transaction.runAsync(
          `DELETE FROM data_operation_history
           WHERE id NOT IN (
             SELECT id FROM data_operation_history
             ORDER BY occurred_at DESC, id DESC LIMIT ?
           )`,
          HISTORY_LIMIT
        );
      });
    },

    async list(): Promise<DataOperationHistoryItem[]> {
      const rows = await database.getAllAsync<OperationRow>(
        `SELECT id, operation_type, result, occurred_at
         FROM data_operation_history
         ORDER BY occurred_at DESC, id DESC LIMIT ?`,
        HISTORY_LIMIT
      );
      return rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurred_at,
        operationType: row.operation_type,
        result: row.result,
      }));
    },

    async clear(): Promise<void> {
      await database.runAsync('DELETE FROM data_operation_history');
    },
  };
}
