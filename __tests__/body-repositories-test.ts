import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createBodyMeasurementRepository,
  BodyMeasurementError,
} from '@/features/body/data/body-measurement-repository';
import {
  createBodyProfileRepository,
  BodyProfileError,
} from '@/features/body/data/body-profile-repository';

describe('body repositories', () => {
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
      runAsync: jest.fn(),
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
    expect(transaction.runAsync).not.toHaveBeenCalled();
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
      getFirstAsync: jest.fn().mockResolvedValue({ count: 2 }),
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
});
