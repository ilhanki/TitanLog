import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createBodyMeasurementRepository,
  BodyMeasurementError,
} from '@/features/body/data/body-measurement-repository';
import {
  createBodyProfileRepository,
  BodyProfileError,
} from '@/features/body/data/body-profile-repository';

class NativeProfileDatabaseDouble {
  readonly database: SQLiteDatabase;
  readonly transactionRunAsync = jest.fn(
    async (source: string, ...params: unknown[]) => this.execute(source, params)
  );
  readonly workoutHistory = ['existing-workout'];
  failInitialMeasurement = false;
  measurements: Array<{ id: number; weightKg: number }> = [];
  profile: { startingWeightKg: number; targetWeightKg: number } | null = null;

  constructor() {
    this.database = {
      runAsync: jest.fn(() => {
        throw new Error('Outer database connection must not be used');
      }),
      withExclusiveTransactionAsync: jest.fn(async (operation) => {
        const profileSnapshot = this.profile;
        const measurementsSnapshot = [...this.measurements];
        const transaction = {
          runAsync: this.transactionRunAsync,
        } as unknown as SQLiteDatabase;
        try {
          await operation(transaction);
        } catch (error) {
          this.profile = profileSnapshot;
          this.measurements = measurementsSnapshot;
          throw error;
        }
      }),
    } as unknown as SQLiteDatabase;
  }

  private execute(source: string, params: unknown[]) {
    if (source.includes('INSERT INTO body_profiles')) {
      if (this.profile) return { changes: 0, lastInsertRowId: 1 };
      this.profile = {
        startingWeightKg: params[0] as number,
        targetWeightKg: params[1] as number,
      };
      return { changes: 1, lastInsertRowId: 1 };
    }
    if (source.includes('INSERT INTO body_measurements')) {
      if (this.failInitialMeasurement) {
        throw Object.assign(new Error('controlled native insert failure'), {
          code: 'SQLITE_CONSTRAINT',
        });
      }
      const id = this.measurements.length + 1;
      this.measurements.push({ id, weightKg: params[1] as number });
      return { changes: 1, lastInsertRowId: id };
    }
    throw new Error('Unexpected SQL in native profile database double');
  }
}

describe('body repositories', () => {
  it.each([
    { starting: 119.6, target: 99.9 },
    { starting: 110, target: 120 },
  ])(
    'creates loss and gain profiles on the exclusive transaction connection',
    async ({ starting, target }) => {
      const testDatabase = new NativeProfileDatabaseDouble();

      const result = await createBodyProfileRepository(
        testDatabase.database
      ).createProfileWithInitialMeasurement(starting, target);

      expect(result.profile).toMatchObject({
        startingWeightKg: starting,
        targetWeightKg: target,
      });
      expect(result.measurement.weightKg).toBe(starting);
      expect(testDatabase.transactionRunAsync).toHaveBeenCalledTimes(2);
      expect(testDatabase.database.runAsync).not.toHaveBeenCalled();
      expect(testDatabase.workoutHistory).toEqual(['existing-workout']);
    }
  );

  it('rolls back the profile when the native initial-measurement insert fails', async () => {
    const testDatabase = new NativeProfileDatabaseDouble();
    testDatabase.failInitialMeasurement = true;

    await expect(
      createBodyProfileRepository(
        testDatabase.database
      ).createProfileWithInitialMeasurement(119.6, 99.9)
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: 'SQLITE_CONSTRAINT' }),
      code: 'setup_failed',
    });

    expect(testDatabase.profile).toBeNull();
    expect(testDatabase.measurements).toHaveLength(0);
    expect(testDatabase.workoutHistory).toEqual(['existing-workout']);
  });

  it('returns a controlled singleton result without duplicate measurements', async () => {
    const testDatabase = new NativeProfileDatabaseDouble();
    const repository = createBodyProfileRepository(testDatabase.database);

    await repository.createProfileWithInitialMeasurement(119.6, 99.9);
    await expect(
      repository.createProfileWithInitialMeasurement(119.6, 99.9)
    ).rejects.toEqual(new BodyProfileError('profile_exists'));

    expect(testDatabase.measurements).toHaveLength(1);
    expect(testDatabase.transactionRunAsync).toHaveBeenCalledTimes(3);
  });

  it('creates a singleton profile and its initial measurement transactionally', async () => {
    const transaction = {
      getFirstAsync: jest.fn().mockResolvedValue(null),
      runAsync: jest
        .fn()
        .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 1 })
        .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 7 }),
    };
    const database = {
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase;

    const result = await createBodyProfileRepository(
      database
    ).createProfileWithInitialMeasurement(100, 80);

    expect(result.profile).toMatchObject({
      id: 1,
      startingWeightKg: 100,
      targetWeightKg: 80,
    });
    expect(result.measurement).toMatchObject({ id: 7, weightKg: 100 });
    expect(transaction.runAsync).toHaveBeenCalledTimes(2);
  });

  it('prevents duplicate profile setup and equal goals', async () => {
    const transaction = {
      getFirstAsync: jest.fn().mockResolvedValue({ id: 1 }),
      runAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 1 }),
    };
    const database = {
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase;
    const repository = createBodyProfileRepository(database);

    await expect(
      repository.createProfileWithInitialMeasurement(100, 80)
    ).rejects.toEqual(new BodyProfileError('profile_exists'));
    await expect(
      repository.createProfileWithInitialMeasurement(80, 80)
    ).rejects.toEqual(new BodyProfileError('invalid_goal'));
    expect(transaction.runAsync).toHaveBeenCalledTimes(1);
  });

  it('propagates transaction failure without completing profile setup', async () => {
    const transaction = {
      getFirstAsync: jest.fn().mockResolvedValue(null),
      runAsync: jest
        .fn()
        .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 1 })
        .mockRejectedValueOnce(new Error('controlled transaction failure')),
    };
    const database = {
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase;

    await expect(
      createBodyProfileRepository(database).createProfileWithInitialMeasurement(
        100,
        80
      )
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: 'controlled transaction failure',
      }),
      code: 'setup_failed',
    });
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('returns nullable measurement fields and newest-first query results', async () => {
    const row = {
      chest_cm: null,
      created_at: '2026-08-01T10:00:00.000Z',
      hip_cm: null,
      id: 2,
      measured_at: '2026-08-01T10:00:00.000Z',
      note: null,
      thigh_cm: null,
      upper_arm_cm: null,
      updated_at: '2026-08-01T10:00:00.000Z',
      waist_cm: null,
      weight_kg: 90,
    };
    const getAllAsync = jest.fn().mockResolvedValue([row]);
    const database = { getAllAsync } as unknown as SQLiteDatabase;

    const result =
      await createBodyMeasurementRepository(database).listMeasurements();

    expect(result[0]).toMatchObject({
      note: null,
      waistCm: null,
      weightKg: 90,
    });
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY measured_at DESC, id DESC')
    );
  });

  it('prevents deleting the only measurement', async () => {
    const transaction = {
      getFirstAsync: jest.fn().mockResolvedValue({ count: 1 }),
      runAsync: jest.fn(),
    };
    const database = {
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase;

    await expect(
      createBodyMeasurementRepository(database).deleteMeasurement(1)
    ).rejects.toEqual(new BodyMeasurementError('only_measurement'));
    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it('deletes an eligible measurement and lets the previous row become latest', async () => {
    const transaction = {
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ id: 1 }),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };
    const previousRow = {
      chest_cm: null,
      created_at: '2026-07-01T10:00:00.000Z',
      hip_cm: null,
      id: 1,
      measured_at: '2026-07-01T10:00:00.000Z',
      note: null,
      thigh_cm: null,
      upper_arm_cm: null,
      updated_at: '2026-07-01T10:00:00.000Z',
      waist_cm: null,
      weight_kg: 95,
    };
    const getFirstAsync = jest.fn().mockResolvedValue(previousRow);
    const database = {
      getFirstAsync,
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase;
    const repository = createBodyMeasurementRepository(database);

    await repository.deleteMeasurement(2);
    const latest = await repository.getLatestMeasurement();

    expect(latest?.weightKg).toBe(95);
    expect(transaction.runAsync).toHaveBeenCalledWith(
      'DELETE FROM body_measurements WHERE id = ?',
      2
    );
  });

  it('protects the initial chronological measurement', async () => {
    const transaction = {
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ id: 1 }),
      runAsync: jest.fn(),
    };
    const database = {
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase;

    await expect(
      createBodyMeasurementRepository(database).deleteMeasurement(1)
    ).rejects.toEqual(new BodyMeasurementError('initial_measurement'));
    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it('creates and updates measurements with nullable optional values', async () => {
    const row = {
      chest_cm: null,
      created_at: '2026-08-01T10:00:00.000Z',
      hip_cm: null,
      id: 3,
      measured_at: '2026-08-01T10:00:00.000Z',
      note: null,
      thigh_cm: null,
      upper_arm_cm: null,
      updated_at: '2026-08-01T10:00:00.000Z',
      waist_cm: null,
      weight_kg: 90,
    };
    const runAsync = jest
      .fn()
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 3 })
      .mockResolvedValueOnce({ changes: 1 });
    const database = {
      getFirstAsync: jest.fn().mockResolvedValue(row),
      runAsync,
    } as unknown as SQLiteDatabase;
    const repository = createBodyMeasurementRepository(database);
    const input = {
      chestCm: null,
      hipCm: null,
      note: null,
      thighCm: null,
      upperArmCm: null,
      waistCm: null,
      weightKg: 90,
    };

    await expect(repository.createMeasurement(input)).resolves.toMatchObject({
      id: 3,
      waistCm: null,
      weightKg: 90,
    });
    await expect(
      repository.updateMeasurement(3, input)
    ).resolves.toBeUndefined();
    expect(runAsync).toHaveBeenCalledTimes(2);
  });
});
