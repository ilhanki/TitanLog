import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  MAX_BACKUP_BYTES,
  type BackupData,
  type BackupRow,
  type BackupTableName,
  type BackupValue,
  type TitanLogBackup,
} from '@/features/data-safety/backup-types';

type ColumnKind = 'number' | 'nullable-number' | 'string' | 'nullable-string';
type TableSchema = Record<string, ColumnKind>;

const TABLE_SCHEMAS: Record<BackupTableName, TableSchema> = {
  workout_plans: {
    id: 'number',
    name: 'string',
    description: 'string',
    is_active: 'number',
    created_at: 'string',
    updated_at: 'string',
  },
  workout_days: {
    id: 'number',
    plan_id: 'number',
    name: 'string',
    subtitle: 'string',
    sort_order: 'number',
    created_at: 'string',
    updated_at: 'string',
  },
  workout_day_schedules: {
    id: 'number',
    workout_day_id: 'number',
    iso_weekday: 'number',
  },
  exercises: {
    id: 'number',
    name: 'string',
    muscle_group: 'string',
    equipment: 'string',
    created_at: 'string',
    updated_at: 'string',
  },
  workout_day_exercises: {
    id: 'number',
    workout_day_id: 'number',
    exercise_id: 'number',
    sort_order: 'number',
    default_set_count: 'number',
    default_target_reps: 'number',
    default_weight_kg: 'number',
    weight_mode: 'string',
  },
  workout_sessions: {
    id: 'number',
    workout_day_id: 'number',
    workout_name_snapshot: 'string',
    status: 'string',
    started_at: 'string',
    completed_at: 'nullable-string',
    cancelled_at: 'nullable-string',
    created_at: 'string',
    updated_at: 'string',
  },
  workout_session_exercises: {
    id: 'number',
    session_id: 'number',
    exercise_id: 'number',
    exercise_name_snapshot: 'string',
    muscle_group_snapshot: 'string',
    weight_mode_snapshot: 'string',
    sort_order: 'number',
    created_at: 'string',
  },
  workout_sets: {
    id: 'number',
    session_exercise_id: 'number',
    set_number: 'number',
    target_reps: 'number',
    actual_reps: 'nullable-number',
    weight_kg: 'number',
    is_completed: 'number',
    completed_at: 'nullable-string',
    created_at: 'string',
    updated_at: 'string',
  },
  body_profiles: {
    id: 'number',
    starting_weight_kg: 'number',
    target_weight_kg: 'number',
    created_at: 'string',
    updated_at: 'string',
  },
  body_measurements: {
    id: 'number',
    measured_at: 'string',
    weight_kg: 'number',
    waist_cm: 'nullable-number',
    chest_cm: 'nullable-number',
    upper_arm_cm: 'nullable-number',
    hip_cm: 'nullable-number',
    thigh_cm: 'nullable-number',
    note: 'nullable-string',
    created_at: 'string',
    updated_at: 'string',
  },
};

export class BackupValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'BackupValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isValidValue(value: unknown, kind: ColumnKind): value is BackupValue {
  if (kind.startsWith('nullable-') && value === null) return true;
  if (kind.endsWith('number'))
    return typeof value === 'number' && Number.isFinite(value);
  return typeof value === 'string';
}

function validateRows(table: BackupTableName, value: unknown): BackupRow[] {
  if (!Array.isArray(value)) throw new BackupValidationError('invalid_table');
  const schema = TABLE_SCHEMAS[table];
  const ids = new Set<number>();
  return value.map((candidate) => {
    if (!isRecord(candidate) || !hasExactKeys(candidate, Object.keys(schema))) {
      throw new BackupValidationError('invalid_row');
    }
    for (const [column, kind] of Object.entries(schema)) {
      if (!isValidValue(candidate[column], kind)) {
        throw new BackupValidationError('invalid_value');
      }
    }
    const id = candidate.id;
    if (
      typeof id !== 'number' ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      ids.has(id)
    ) {
      throw new BackupValidationError('invalid_id');
    }
    ids.add(id);
    return candidate as BackupRow;
  });
}

function assertReferences(data: BackupData): void {
  const ids = (table: BackupTableName) =>
    new Set<BackupValue>(
      data[table]
        .map((row) => row.id)
        .filter((id): id is BackupValue => id !== undefined)
    );
  const planIds = ids('workout_plans');
  const dayIds = ids('workout_days');
  const exerciseIds = ids('exercises');
  const sessionIds = ids('workout_sessions');
  const sessionExerciseIds = ids('workout_session_exercises');
  const requireReference = (
    rows: BackupRow[],
    column: string,
    parents: Set<BackupValue>
  ) => {
    if (
      rows.some(
        (row) =>
          row[column] === undefined || !parents.has(row[column] as BackupValue)
      )
    ) {
      throw new BackupValidationError('missing_relationship');
    }
  };
  requireReference(data.workout_days, 'plan_id', planIds);
  requireReference(data.workout_day_schedules, 'workout_day_id', dayIds);
  requireReference(data.workout_day_exercises, 'workout_day_id', dayIds);
  requireReference(data.workout_day_exercises, 'exercise_id', exerciseIds);
  requireReference(data.workout_sessions, 'workout_day_id', dayIds);
  requireReference(data.workout_session_exercises, 'session_id', sessionIds);
  requireReference(data.workout_session_exercises, 'exercise_id', exerciseIds);
  requireReference(
    data.workout_sets,
    'session_exercise_id',
    sessionExerciseIds
  );
}

function assertDomainRules(data: BackupData): void {
  const integerColumns = new Set([
    'id',
    'plan_id',
    'workout_day_id',
    'exercise_id',
    'session_id',
    'session_exercise_id',
    'sort_order',
    'default_set_count',
    'default_target_reps',
    'iso_weekday',
    'set_number',
    'target_reps',
    'actual_reps',
    'is_active',
    'is_completed',
  ]);
  for (const table of BACKUP_TABLES) {
    for (const row of data[table]) {
      for (const [column, value] of Object.entries(row)) {
        if (
          value !== null &&
          integerColumns.has(column) &&
          !Number.isSafeInteger(value)
        ) {
          throw new BackupValidationError('invalid_integer');
        }
        if (
          column.endsWith('_at') &&
          value !== null &&
          (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
        ) {
          throw new BackupValidationError('invalid_date');
        }
      }
    }
  }
  if (
    data.workout_plans.filter((row) => row.is_active === 1).length > 1 ||
    data.workout_plans.some((row) => row.is_active !== 0 && row.is_active !== 1)
  ) {
    throw new BackupValidationError('invalid_active_plan');
  }
  const weekdays = new Set<number>();
  for (const row of data.workout_day_schedules) {
    const weekday = row.iso_weekday;
    if (
      typeof weekday !== 'number' ||
      weekday < 1 ||
      weekday > 7 ||
      weekdays.has(weekday)
    ) {
      throw new BackupValidationError('invalid_schedule');
    }
    weekdays.add(weekday);
  }
  const scheduledDayIds = new Set(
    data.workout_day_schedules.map((row) => row.workout_day_id)
  );
  if (data.workout_days.some((row) => !scheduledDayIds.has(row.id))) {
    throw new BackupValidationError('missing_schedule');
  }
  if (
    data.workout_day_exercises.some(
      (row) =>
        !['total', 'per_hand'].includes(String(row.weight_mode)) ||
        Number(row.default_set_count) <= 0 ||
        Number(row.default_target_reps) <= 0 ||
        Number(row.default_weight_kg) < 0
    )
  )
    throw new BackupValidationError('invalid_workout_default');
  if (
    data.workout_session_exercises.some(
      (row) => !['total', 'per_hand'].includes(String(row.weight_mode_snapshot))
    )
  )
    throw new BackupValidationError('invalid_weight_mode');
  if (
    data.workout_sessions.filter((row) => row.status === 'active').length > 1
  ) {
    throw new BackupValidationError('multiple_active_sessions');
  }
  for (const row of data.workout_sessions) {
    if (
      !['active', 'completed', 'cancelled'].includes(String(row.status)) ||
      (row.status === 'completed' && row.completed_at === null) ||
      (row.status === 'cancelled' && row.cancelled_at === null) ||
      (row.status === 'active' &&
        (row.completed_at !== null || row.cancelled_at !== null))
    ) {
      throw new BackupValidationError('invalid_session_status');
    }
  }
  if (
    data.workout_sets.some(
      (row) =>
        (row.is_completed !== 0 && row.is_completed !== 1) ||
        Number(row.set_number) <= 0 ||
        Number(row.target_reps) <= 0 ||
        Number(row.weight_kg) < 0 ||
        (row.actual_reps !== null && Number(row.actual_reps) < 0) ||
        (row.is_completed === 1 && row.completed_at === null)
    )
  )
    throw new BackupValidationError('invalid_set');
  if (
    data.body_profiles.some(
      (row) =>
        row.id !== 1 ||
        Number(row.starting_weight_kg) <= 0 ||
        Number(row.target_weight_kg) <= 0 ||
        row.starting_weight_kg === row.target_weight_kg
    )
  )
    throw new BackupValidationError('invalid_body_profile');
  if (data.body_measurements.some((row) => Number(row.weight_kg) <= 0)) {
    throw new BackupValidationError('invalid_measurement');
  }
  if (
    data.body_measurements.some((row) =>
      ['waist_cm', 'chest_cm', 'upper_arm_cm', 'hip_cm', 'thigh_cm'].some(
        (column) => row[column] !== null && Number(row[column]) <= 0
      )
    ) ||
    data.body_measurements.some(
      (row) => typeof row.note === 'string' && row.note.length > 250
    )
  ) {
    throw new BackupValidationError('invalid_measurement');
  }
}

export function createBackupSummary(data: BackupData) {
  return {
    exercises: data.exercises.length,
    measurements: data.body_measurements.length,
    programs: data.workout_plans.length,
    sets: data.workout_sets.filter((row) => row.is_completed === 1).length,
    workouts: data.workout_sessions.length,
  };
}

export function validateBackup(value: unknown): TitanLogBackup {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'format',
      'formatVersion',
      'createdAt',
      'appVersion',
      'schemaVersion',
      'deviceId',
      'summary',
      'data',
    ])
  )
    throw new BackupValidationError('invalid_envelope');
  if (value.format !== BACKUP_FORMAT)
    throw new BackupValidationError('unknown_format');
  if (value.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupValidationError(
      typeof value.formatVersion === 'number' &&
        value.formatVersion > BACKUP_FORMAT_VERSION
        ? 'newer_format'
        : 'unsupported_format'
    );
  }
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION)
    throw new BackupValidationError('unsupported_schema');
  if (
    typeof value.createdAt !== 'string' ||
    Number.isNaN(Date.parse(value.createdAt))
  )
    throw new BackupValidationError('invalid_date');
  if (
    typeof value.appVersion !== 'string' ||
    typeof value.deviceId !== 'string' ||
    value.deviceId.length < 8
  )
    throw new BackupValidationError('invalid_metadata');
  if (!isRecord(value.data) || !hasExactKeys(value.data, [...BACKUP_TABLES]))
    throw new BackupValidationError('invalid_data');
  const rawData = value.data;
  const data = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, validateRows(table, rawData[table])])
  ) as BackupData;
  assertReferences(data);
  assertDomainRules(data);
  const summary = createBackupSummary(data);
  if (
    !isRecord(value.summary) ||
    JSON.stringify(value.summary) !== JSON.stringify(summary)
  )
    throw new BackupValidationError('invalid_summary');
  return { ...value, data, summary } as TitanLogBackup;
}

export function parseBackupJson(serialized: string): TitanLogBackup {
  if (new TextEncoder().encode(serialized).byteLength > MAX_BACKUP_BYTES)
    throw new BackupValidationError('oversized');
  if (
    /"(?:access_token|refresh_token|service_role|authorization)"\s*:/i.test(
      serialized
    )
  )
    throw new BackupValidationError('contains_secret');
  try {
    return validateBackup(JSON.parse(serialized));
  } catch (error) {
    if (error instanceof BackupValidationError) throw error;
    throw new BackupValidationError('malformed_json');
  }
}
