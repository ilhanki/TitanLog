import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  BodyMeasurement,
  BodyMeasurementInput,
} from '@/features/body/domain/models';

type MeasurementRow = {
  chest_cm: number | null;
  created_at: string;
  hip_cm: number | null;
  id: number;
  measured_at: string;
  note: string | null;
  thigh_cm: number | null;
  upper_arm_cm: number | null;
  updated_at: string;
  waist_cm: number | null;
  weight_kg: number;
};

export class BodyMeasurementError extends Error {
  constructor(
    readonly code:
      'initial_measurement' | 'measurement_not_found' | 'only_measurement'
  ) {
    super(code);
  }
}

const selectFields = `id, measured_at, weight_kg, waist_cm, chest_cm,
  upper_arm_cm, hip_cm, thigh_cm, note, created_at, updated_at`;

function mapMeasurement(row: MeasurementRow): BodyMeasurement {
  return {
    chestCm: row.chest_cm,
    createdAt: row.created_at,
    hipCm: row.hip_cm,
    id: row.id,
    measuredAt: row.measured_at,
    note: row.note,
    thighCm: row.thigh_cm,
    upperArmCm: row.upper_arm_cm,
    updatedAt: row.updated_at,
    waistCm: row.waist_cm,
    weightKg: row.weight_kg,
  };
}

export function createBodyMeasurementRepository(database: SQLiteDatabase) {
  const getMeasurement = async (
    id: number
  ): Promise<BodyMeasurement | null> => {
    const row = await database.getFirstAsync<MeasurementRow>(
      `SELECT ${selectFields} FROM body_measurements WHERE id = ?`,
      id
    );
    return row ? mapMeasurement(row) : null;
  };

  return {
    async listMeasurements(): Promise<BodyMeasurement[]> {
      const rows = await database.getAllAsync<MeasurementRow>(
        `SELECT ${selectFields} FROM body_measurements
         ORDER BY measured_at DESC, id DESC`
      );
      return rows.map(mapMeasurement);
    },

    async getLatestMeasurement(): Promise<BodyMeasurement | null> {
      const row = await database.getFirstAsync<MeasurementRow>(
        `SELECT ${selectFields} FROM body_measurements
         ORDER BY measured_at DESC, id DESC LIMIT 1`
      );
      return row ? mapMeasurement(row) : null;
    },

    async getPreviousMeasurement(): Promise<BodyMeasurement | null> {
      const row = await database.getFirstAsync<MeasurementRow>(
        `SELECT ${selectFields} FROM body_measurements
         ORDER BY measured_at DESC, id DESC LIMIT 1 OFFSET 1`
      );
      return row ? mapMeasurement(row) : null;
    },

    getMeasurement,

    async createMeasurement(
      input: BodyMeasurementInput
    ): Promise<BodyMeasurement> {
      const timestamp = new Date().toISOString();
      const result = await database.runAsync(
        `INSERT INTO body_measurements
          (measured_at, weight_kg, waist_cm, chest_cm, upper_arm_cm,
           hip_cm, thigh_cm, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        timestamp,
        input.weightKg,
        input.waistCm,
        input.chestCm,
        input.upperArmCm,
        input.hipCm,
        input.thighCm,
        input.note,
        timestamp,
        timestamp
      );
      const measurement = await getMeasurement(result.lastInsertRowId);
      if (!measurement) throw new BodyMeasurementError('measurement_not_found');
      return measurement;
    },

    async updateMeasurement(
      id: number,
      input: BodyMeasurementInput
    ): Promise<void> {
      const result = await database.runAsync(
        `UPDATE body_measurements
         SET weight_kg = ?, waist_cm = ?, chest_cm = ?, upper_arm_cm = ?,
             hip_cm = ?, thigh_cm = ?, note = ?, updated_at = ?
         WHERE id = ?`,
        input.weightKg,
        input.waistCm,
        input.chestCm,
        input.upperArmCm,
        input.hipCm,
        input.thighCm,
        input.note,
        new Date().toISOString(),
        id
      );
      if (result.changes !== 1) {
        throw new BodyMeasurementError('measurement_not_found');
      }
    },

    async deleteMeasurement(id: number): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const count = await transaction.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM body_measurements'
        );
        if (!count || count.count <= 1) {
          throw new BodyMeasurementError('only_measurement');
        }
        const initial = await transaction.getFirstAsync<{ id: number }>(
          `SELECT id FROM body_measurements
           ORDER BY measured_at ASC, id ASC LIMIT 1`
        );
        if (initial?.id === id) {
          throw new BodyMeasurementError('initial_measurement');
        }
        const result = await transaction.runAsync(
          'DELETE FROM body_measurements WHERE id = ?',
          id
        );
        if (result.changes !== 1) {
          throw new BodyMeasurementError('measurement_not_found');
        }
      });
    },

    async countMeasurements(): Promise<number> {
      const row = await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM body_measurements'
      );
      return row?.count ?? 0;
    },
  };
}
