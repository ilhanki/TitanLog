import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createProfilePreferencesRepository,
  normalizeDisplayName,
  PROFILE_FALLBACK_NAME,
  validateDisplayName,
} from '@/features/profile/profile-preferences';

describe('profile preferences', () => {
  it('normalizes Turkish display names and provides a safe fallback', () => {
    expect(normalizeDisplayName('  İlhan   Kılıç  ')).toBe('İlhan Kılıç');
    expect(PROFILE_FALLBACK_NAME).toBe('Titan Sporcusu');
  });

  it.each(['', '   ', 'A'])('rejects invalid display name %j', (value) => {
    expect(validateDisplayName(value)).toMatchObject({ valid: false });
  });

  it('rejects names above the maximum length', () => {
    expect(validateDisplayName('A'.repeat(41))).toEqual({
      code: 'too_long',
      valid: false,
    });
  });

  it('persists a normalized local guest name', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
    const database = { runAsync } as unknown as SQLiteDatabase;
    await createProfilePreferencesRepository(database).saveDisplayName(
      '  İpek   Öz  '
    );
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE profile_preferences'),
      'İpek Öz',
      expect.any(String)
    );
  });
});
