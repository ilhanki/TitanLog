const values = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';

import { secureSessionStorage } from '@/features/auth/secure-session-storage';

const mockGetItemAsync = SecureStore.getItemAsync as jest.Mock;
const mockSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

describe('secure Supabase session storage', () => {
  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
    mockGetItemAsync.mockImplementation(
      async (key: string) => values.get(key) ?? null
    );
    mockSetItemAsync.mockImplementation(async (key: string, value: string) => {
      values.set(key, value);
    });
    mockDeleteItemAsync.mockImplementation(async (key: string) => {
      values.delete(key);
    });
  });

  it('chunks and restores a session without AsyncStorage or SQLite', async () => {
    const session = 's'.repeat(5000);
    await secureSessionStorage.setItem('session', session);
    await expect(secureSessionStorage.getItem('session')).resolves.toBe(
      session
    );
    expect(mockSetItemAsync).toHaveBeenCalledWith('session.chunks', '3');
  });

  it('removes every persisted chunk on sign-out cleanup', async () => {
    await secureSessionStorage.setItem('session', 'secret-session');
    await secureSessionStorage.removeItem('session');
    await expect(secureSessionStorage.getItem('session')).resolves.toBeNull();
  });
});
