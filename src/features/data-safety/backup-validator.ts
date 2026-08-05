import {
  BACKUP_TABLE_SCHEMAS,
  expectedBackupType,
  isValidBackupValue,
  structuralType,
} from './backup-contract.ts';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
  LEGACY_BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  MAX_BACKUP_BYTES,
  type BackupData,
  type BackupRow,
  type BackupTableName,
  type BackupValue,
  type TitanLogBackup,
} from './backup-types.ts';

export type BackupValidationIssue = {
  actual?: string;
  code: string;
  expected?: string;
  path?: string;
  recordIndex?: number;
  relationshipCategory?: string;
  section?: string;
  summaryCategory?: string;
  table?: BackupTableName;
};

export class BackupValidationError extends Error {
  readonly code: string;
  readonly issue: BackupValidationIssue;

  constructor(issue: BackupValidationIssue | string) {
    const normalized = typeof issue === 'string' ? { code: issue } : issue;
    super(normalized.code);
    this.name = 'BackupValidationError';
    this.code = normalized.code;
    this.issue = normalized;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function upgradeLegacySchema(value: unknown): unknown {
  if (
    !isRecord(value) ||
    value.schemaVersion !== LEGACY_BACKUP_SCHEMA_VERSION ||
    !isRecord(value.data)
  )
    return value;
  const data = value.data;
  const rows = (table: string) =>
    Array.isArray(data[table])
      ? (data[table] as Record<string, unknown>[])
      : [];
  return {
    ...value,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    data: {
      ...data,
      workout_day_exercises: rows('workout_day_exercises').map((row) => ({
        ...row,
        default_rest_seconds: 90,
        superset_group_id: null,
        superset_order: null,
      })),
      workout_sessions: rows('workout_sessions').map((row) => ({
        ...row,
        rest_timer_deadline: null,
        rest_timer_duration_seconds: null,
        rest_timer_exercise_id: null,
        rest_timer_alerted_at: null,
        rest_timer_notification_id: null,
        selected_session_exercise_id: null,
        notes: '',
      })),
      workout_session_exercises: rows('workout_session_exercises').map(
        (row) => ({
          ...row,
          rest_duration_seconds: 90,
          superset_group_id: null,
          superset_order: null,
          is_skipped: 0,
        })
      ),
      workout_sets: rows('workout_sets').map((row) => ({
        ...row,
        set_type: 'working',
        effort_mode: null,
        effort_value: null,
      })),
    },
  };
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function validateRows(table: BackupTableName, value: unknown): BackupRow[] {
  if (!Array.isArray(value)) {
    throw new BackupValidationError({
      actual: structuralType(value),
      code: 'invalid_table',
      expected: 'array',
      path: `data.${table}`,
      section: 'data',
      table,
    });
  }
  const schema = BACKUP_TABLE_SCHEMAS[table];
  const ids = new Set<number>();
  return value.map((candidate, recordIndex) => {
    if (!isRecord(candidate)) {
      throw new BackupValidationError({
        actual: structuralType(candidate),
        code: 'invalid_row',
        expected: 'object',
        path: `data.${table}[${recordIndex}]`,
        recordIndex,
        section: 'data',
        table,
      });
    }
    const expectedColumns = Object.keys(schema);
    if (!hasExactKeys(candidate, expectedColumns)) {
      const missing = expectedColumns.find(
        (column) => !Object.hasOwn(candidate, column)
      );
      const unexpected = Object.keys(candidate).find(
        (column) => !Object.hasOwn(schema, column)
      );
      const column = missing ?? unexpected;
      throw new BackupValidationError({
        actual: missing ? 'undefined' : 'unexpected_field',
        code: missing ? 'missing_field' : 'unexpected_field',
        expected: missing ? expectedBackupType(schema[missing]!) : 'absent',
        path: `data.${table}[${recordIndex}]${column ? `.${column}` : ''}`,
        recordIndex,
        section: 'data',
        table,
      });
    }
    for (const [column, kind] of Object.entries(schema)) {
      if (!isValidBackupValue(candidate[column], kind)) {
        throw new BackupValidationError({
          actual: structuralType(candidate[column]),
          code: 'invalid_value',
          expected: expectedBackupType(kind),
          path: `data.${table}[${recordIndex}].${column}`,
          recordIndex,
          section: 'data',
          table,
        });
      }
    }
    const id = candidate.id;
    if (
      typeof id !== 'number' ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      ids.has(id)
    ) {
      throw new BackupValidationError({
        actual: structuralType(id),
        code: 'invalid_id',
        expected: 'unique positive safe integer',
        path: `data.${table}[${recordIndex}].id`,
        recordIndex,
        section: 'data',
        table,
      });
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
    table: BackupTableName,
    rows: BackupRow[],
    column: string,
    parents: Set<BackupValue>
  ) => {
    const recordIndex = rows.findIndex(
      (row) =>
        row[column] === undefined || !parents.has(row[column] as BackupValue)
    );
    if (recordIndex >= 0) {
      throw new BackupValidationError({
        actual: 'relationship_missing',
        code: 'missing_relationship',
        expected: 'existing parent record',
        path: `data.${table}[${recordIndex}].${column}`,
        recordIndex,
        relationshipCategory: 'missing_parent',
        section: 'data',
        table,
      });
    }
  };
  requireReference('workout_days', data.workout_days, 'plan_id', planIds);
  requireReference(
    'workout_day_schedules',
    data.workout_day_schedules,
    'workout_day_id',
    dayIds
  );
  requireReference(
    'workout_day_exercises',
    data.workout_day_exercises,
    'workout_day_id',
    dayIds
  );
  requireReference(
    'workout_day_exercises',
    data.workout_day_exercises,
    'exercise_id',
    exerciseIds
  );
  requireReference(
    'workout_sessions',
    data.workout_sessions,
    'workout_day_id',
    dayIds
  );
  requireReference(
    'workout_session_exercises',
    data.workout_session_exercises,
    'session_id',
    sessionIds
  );
  requireReference(
    'workout_session_exercises',
    data.workout_session_exercises,
    'exercise_id',
    exerciseIds
  );
  requireReference(
    'workout_sets',
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
    'default_rest_seconds',
    'rest_timer_duration_seconds',
    'rest_timer_exercise_id',
    'selected_session_exercise_id',
    'rest_duration_seconds',
    'superset_order',
    'is_skipped',
  ]);
  for (const table of BACKUP_TABLES) {
    for (const [recordIndex, row] of data[table].entries()) {
      for (const [column, value] of Object.entries(row)) {
        if (
          value !== null &&
          integerColumns.has(column) &&
          !Number.isSafeInteger(value)
        ) {
          throw new BackupValidationError({
            actual: structuralType(value),
            code: 'invalid_integer',
            expected: 'safe integer',
            path: `data.${table}[${recordIndex}].${column}`,
            recordIndex,
            section: 'data',
            table,
          });
        }
        if (
          column.endsWith('_at') &&
          value !== null &&
          (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
        ) {
          throw new BackupValidationError({
            actual: structuralType(value),
            code: 'invalid_date',
            expected: 'parseable date string|null',
            path: `data.${table}[${recordIndex}].${column}`,
            recordIndex,
            section: 'data',
            table,
          });
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
  // Legacy schema 4 permits workout days without schedule rows. New writes
  // prevent this state, while backups must preserve existing valid datasets.
  if (
    data.workout_day_exercises.some(
      (row) =>
        !['total', 'per_hand'].includes(String(row.weight_mode)) ||
        Number(row.default_set_count) <= 0 ||
        Number(row.default_target_reps) <= 0 ||
        Number(row.default_weight_kg) < 0 ||
        Number(row.default_rest_seconds) < 15 ||
        Number(row.default_rest_seconds) > 1800
    )
  )
    throw new BackupValidationError('invalid_workout_default');
  if (
    data.workout_session_exercises.some(
      (row) =>
        !['total', 'per_hand'].includes(String(row.weight_mode_snapshot)) ||
        ![0, 1].includes(Number(row.is_skipped)) ||
        Number(row.rest_duration_seconds) < 15 ||
        Number(row.rest_duration_seconds) > 1800
    )
  )
    throw new BackupValidationError('invalid_weight_mode');
  for (const rows of [
    data.workout_day_exercises,
    data.workout_session_exercises,
  ]) {
    const groups = new Map<string, Set<number>>();
    for (const row of rows) {
      const groupId = row.superset_group_id;
      const order = row.superset_order;
      if ((groupId === null) !== (order === null))
        throw new BackupValidationError('invalid_superset');
      if (groupId === null || order === null) continue;
      if (typeof groupId !== 'string' || groupId.length === 0)
        throw new BackupValidationError('invalid_superset');
      const parentId = row.workout_day_id ?? row.session_id;
      const groupKey = `${parentId}:${groupId}`;
      const orders = groups.get(groupKey) ?? new Set<number>();
      if (
        !Number.isSafeInteger(order) ||
        Number(order) < 0 ||
        orders.has(Number(order))
      )
        throw new BackupValidationError('invalid_superset');
      orders.add(Number(order));
      groups.set(groupKey, orders);
    }
    if ([...groups.values()].some((orders) => orders.size < 2))
      throw new BackupValidationError('invalid_superset');
  }
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
    if (
      (row.rest_timer_deadline === null) !==
        (row.rest_timer_duration_seconds === null) ||
      (row.rest_timer_duration_seconds !== null &&
        (Number(row.rest_timer_duration_seconds) < 1 ||
          Number(row.rest_timer_duration_seconds) > 1800))
    )
      throw new BackupValidationError('invalid_rest_timer');
  }
  if (
    data.workout_sets.some(
      (row) =>
        (row.is_completed !== 0 && row.is_completed !== 1) ||
        Number(row.set_number) <= 0 ||
        Number(row.target_reps) <= 0 ||
        Number(row.weight_kg) < 0 ||
        (row.actual_reps !== null && Number(row.actual_reps) < 0) ||
        (row.is_completed === 1 && row.completed_at === null) ||
        !['warm_up', 'working', 'drop', 'amrap', 'failure'].includes(
          String(row.set_type)
        ) ||
        (row.effort_mode !== null &&
          !['rpe', 'rir'].includes(String(row.effort_mode))) ||
        (row.effort_mode === 'rpe' &&
          (Number(row.effort_value) < 1 ||
            Number(row.effort_value) > 10 ||
            (Number(row.effort_value) * 2) % 1 !== 0)) ||
        (row.effort_mode === 'rir' &&
          (!Number.isSafeInteger(row.effort_value) ||
            Number(row.effort_value) < 0 ||
            Number(row.effort_value) > 10)) ||
        (row.effort_mode === null && row.effort_value !== null)
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
  value = upgradeLegacySchema(value);
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
  ) {
    throw new BackupValidationError({
      actual: structuralType(value),
      code: 'invalid_envelope',
      expected: 'canonical archive object',
      path: 'archive',
      section: 'envelope',
    });
  }
  if (value.format !== BACKUP_FORMAT) {
    throw new BackupValidationError({
      actual: structuralType(value.format),
      code: 'unknown_format',
      expected: 'supported format string',
      path: 'format',
      section: 'envelope',
    });
  }
  if (value.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupValidationError({
      actual: structuralType(value.formatVersion),
      code:
        typeof value.formatVersion === 'number' &&
        value.formatVersion > BACKUP_FORMAT_VERSION
          ? 'newer_format'
          : 'unsupported_format',
      expected: 'supported format version number',
      path: 'formatVersion',
      section: 'envelope',
    });
  }
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupValidationError({
      actual: structuralType(value.schemaVersion),
      code: 'unsupported_schema',
      expected: 'supported schema version number',
      path: 'schemaVersion',
      section: 'envelope',
    });
  }
  if (
    typeof value.createdAt !== 'string' ||
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    throw new BackupValidationError({
      actual: structuralType(value.createdAt),
      code: 'invalid_date',
      expected: 'parseable date string',
      path: 'createdAt',
      section: 'envelope',
    });
  }
  if (
    typeof value.appVersion !== 'string' ||
    typeof value.deviceId !== 'string' ||
    value.deviceId.length < 8
  ) {
    throw new BackupValidationError({
      actual: 'invalid_structural_type',
      code: 'invalid_metadata',
      expected: 'non-empty app version and opaque device identifier strings',
      path: 'metadata',
      section: 'envelope',
    });
  }
  if (!isRecord(value.data) || !hasExactKeys(value.data, [...BACKUP_TABLES])) {
    throw new BackupValidationError({
      actual: structuralType(value.data),
      code: 'invalid_data',
      expected: 'canonical backup table object',
      path: 'data',
      section: 'data',
    });
  }
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
  ) {
    throw new BackupValidationError({
      actual: structuralType(value.summary),
      code: 'invalid_summary',
      expected: 'counts derived from canonical archive rows',
      path: 'summary',
      section: 'summary',
      summaryCategory: 'row_count_mismatch',
    });
  }
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
