import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const memoryStorage = new Map<string, string>();

function isWeb(): boolean {
  return process.env.EXPO_OS === 'web';
}

async function removeNativeValue(key: string): Promise<void> {
  const count = Number(await getItemAsync(`${key}.chunks`)) || 0;
  await Promise.all([
    deleteItemAsync(`${key}.chunks`),
    ...Array.from({ length: count }, (_, index) =>
      deleteItemAsync(`${key}.${index}`)
    ),
  ]);
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb()) return memoryStorage.get(key) ?? null;
    const count = Number(await getItemAsync(`${key}.chunks`)) || 0;
    if (count === 0) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        getItemAsync(`${key}.${index}`)
      )
    );
    return chunks.every((chunk) => chunk !== null) ? chunks.join('') : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb()) {
      memoryStorage.set(key, value);
      return;
    }
    await removeNativeValue(key);
    const chunks = Array.from(
      { length: Math.ceil(value.length / CHUNK_SIZE) },
      (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
    );
    await Promise.all(
      chunks.map((chunk, index) => setItemAsync(`${key}.${index}`, chunk))
    );
    await setItemAsync(`${key}.chunks`, String(chunks.length));
  },
  async removeItem(key: string): Promise<void> {
    if (isWeb()) {
      memoryStorage.delete(key);
      return;
    }
    await removeNativeValue(key);
  },
};
