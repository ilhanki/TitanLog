import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  BodyMeasurement,
  BodyProfile,
} from '@/features/body/domain/models';

type ProfileRow = {
  created_at: string;
  id: number;
  starting_weight_kg: number;
  target_weight_kg: number;
  updated_at: string;
};

type InitialMeasurementRow = {
  chest_cm: null;
  created_at: string;
  hip_cm: null;
  id: number;
  measured_at: string;
  note: null;
  thigh_cm: null;
  upper_arm_cm: null;
  updated_at: string;
  waist_cm: null;
  weight_kg: number;
};

export class BodyProfileError extends Error {
  constructor(
    readonly code:
      'invalid_goal' | 'profile_exists' | 'profile_not_found' | 'setup_failed',
    readonly cause?: unknown
  ) {
    super(code);
    this.name = 'BodyProfileError';
  }
}

function mapProfile(row: ProfileRow): BodyProfile {
  return {
    createdAt: row.created_at,
    id: row.id,
    startingWeightKg: row.starting_weight_kg,
    targetWeightKg: row.target_weight_kg,
    updatedAt: row.updated_at,
  };
}

function mapInitialMeasurement(row: InitialMeasurementRow): BodyMeasurement {
  return {
    chestCm: null,
    createdAt: row.created_at,
    hipCm: null,
    id: row.id,
    measuredAt: row.measured_at,
    note: null,
    thighCm: null,
    upperArmCm: null,
    updatedAt: row.updated_at,
    waistCm: null,
    weightKg: row.weight_kg,
  };
}

export function createBodyProfileRepository(database: SQLiteDatabase) {
  return {
    async getProfile(): Promise<BodyProfile | null> {
      const row = await database.getFirstAsync<ProfileRow>(
        `SELECT id, starting_weight_kg, target_weight_kg, created_at, updated_at
         FROM body_profiles WHERE id = 1`
      );
      return row ? mapProfile(row) : null;
    },

    async createProfileWithInitialMeasurement(
      startingWeightKg: number,
      targetWeightKg: number
    ): Promise<{ measurement: BodyMeasurement; profile: BodyProfile }> {
      if (startingWeightKg === targetWeightKg) {
        throw new BodyProfileError('invalid_goal');
      }
      let result: {
        measurement: BodyMeasurement;
        profile: BodyProfile;
      } | null = null;
      try {
        await database.withExclusiveTransactionAsync(async (transaction) => {
          const timestamp = new Date().toISOString();
          const profileResult = await transaction.runAsync(
            `INSERT INTO body_profiles
              (id, starting_weight_kg, target_weight_kg, created_at, updated_at)
             VALUES (1, ?, ?, ?, ?)
             ON CONFLICT(id) DO NOTHING`,
            startingWeightKg,
            targetWeightKg,
            timestamp,
            timestamp
          );
          if (profileResult.changes === 0) {
            throw new BodyProfileError('profile_exists');
          }
          if (profileResult.changes !== 1) {
            throw new BodyProfileError('setup_failed');
          }

          const measurementResult = await transaction.runAsync(
            `INSERT INTO body_measurements
              (measured_at, weight_kg, created_at, updated_at)
             VALUES (?, ?, ?, ?)`,
            timestamp,
            startingWeightKg,
            timestamp,
            timestamp
          );
          result = {
            measurement: mapInitialMeasurement({
              chest_cm: null,
              created_at: timestamp,
              hip_cm: null,
              id: measurementResult.lastInsertRowId,
              measured_at: timestamp,
              note: null,
              thigh_cm: null,
              upper_arm_cm: null,
              updated_at: timestamp,
              waist_cm: null,
              weight_kg: startingWeightKg,
            }),
            profile: mapProfile({
              created_at: timestamp,
              id: 1,
              starting_weight_kg: startingWeightKg,
              target_weight_kg: targetWeightKg,
              updated_at: timestamp,
            }),
          };
        });
      } catch (error) {
        if (error instanceof BodyProfileError) throw error;
        throw new BodyProfileError('setup_failed', error);
      }
      if (!result) throw new BodyProfileError('invalid_goal');
      return result;
    },

    async updateGoal(
      startingWeightKg: number,
      targetWeightKg: number
    ): Promise<void> {
      if (startingWeightKg === targetWeightKg) {
        throw new BodyProfileError('invalid_goal');
      }
      const result = await database.runAsync(
        `UPDATE body_profiles
         SET starting_weight_kg = ?, target_weight_kg = ?, updated_at = ?
         WHERE id = 1`,
        startingWeightKg,
        targetWeightKg,
        new Date().toISOString()
      );
      if (result.changes !== 1) {
        throw new BodyProfileError('profile_not_found');
      }
    },
  };
}
