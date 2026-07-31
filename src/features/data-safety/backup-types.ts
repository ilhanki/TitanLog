export const BACKUP_FORMAT = 'titanlog-backup' as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_SCHEMA_VERSION = 4 as const;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export const BACKUP_TABLES = [
  'workout_plans',
  'workout_days',
  'workout_day_schedules',
  'exercises',
  'workout_day_exercises',
  'workout_sessions',
  'workout_session_exercises',
  'workout_sets',
  'body_profiles',
  'body_measurements',
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];
export type BackupValue = number | string | null;
export type BackupRow = Record<string, BackupValue>;
export type BackupData = Record<BackupTableName, BackupRow[]>;

export type BackupSummary = {
  exercises: number;
  measurements: number;
  programs: number;
  sets: number;
  workouts: number;
};

export type TitanLogBackup = {
  appVersion: string;
  createdAt: string;
  data: BackupData;
  deviceId: string;
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  summary: BackupSummary;
};

export type BackupPreview = Pick<
  TitanLogBackup,
  'appVersion' | 'createdAt' | 'formatVersion' | 'schemaVersion' | 'summary'
>;
