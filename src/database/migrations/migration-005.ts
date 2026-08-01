import type { DatabaseMigration } from '@/database/types';

export const migration005: DatabaseMigration = {
  version: 5,
  sql: `
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_remote_revision INTEGER CHECK (
        last_remote_revision IS NULL OR last_remote_revision >= 0
      ),
      last_remote_content_hash TEXT CHECK (
        last_remote_content_hash IS NULL OR length(last_remote_content_hash) = 64
      ),
      last_local_content_hash TEXT CHECK (
        last_local_content_hash IS NULL OR length(last_local_content_hash) = 64
      ),
      last_successful_sync_at TEXT,
      last_result_code TEXT,
      pending_operation_id TEXT,
      updated_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO sync_state (
      id, last_remote_revision, last_remote_content_hash,
      last_local_content_hash, last_successful_sync_at, last_result_code,
      pending_operation_id, updated_at
    ) VALUES (
      1, NULL, NULL, NULL, NULL, NULL, NULL, datetime('now')
    );
  `,
};
