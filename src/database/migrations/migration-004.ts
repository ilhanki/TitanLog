import type { DatabaseMigration } from '@/database/types';

export const migration004: DatabaseMigration = {
  version: 4,
  sql: `
    CREATE TABLE IF NOT EXISTS dataset_metadata (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      installation_id TEXT NOT NULL UNIQUE,
      owner_account_id TEXT,
      backup_format_version INTEGER NOT NULL DEFAULT 1 CHECK (backup_format_version > 0),
      last_local_backup_at TEXT,
      last_cloud_backup_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO dataset_metadata (
      id, installation_id, owner_account_id, backup_format_version,
      last_local_backup_at, last_cloud_backup_at, created_at, updated_at
    ) VALUES (
      1,
      lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
        substr(hex(randomblob(2)), 2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
      NULL, 1, NULL, NULL, datetime('now'), datetime('now')
    );
  `,
};
