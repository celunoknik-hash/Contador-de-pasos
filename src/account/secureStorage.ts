import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
// Publish the pointer last: an interrupted write cannot expose a partial session.
interface Pointer { generation: string; count: number }
async function pointer(key: string): Promise<Pointer | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  const value = JSON.parse(raw) as Pointer;
  if (!Number.isInteger(value.count) || value.count < 1 || value.count > 32 || !/^[a-f0-9-]+$/i.test(value.generation)) throw new Error('Sesión guardada no válida.');
  return value;
}
async function clean(key: string, value: Pointer | null) {
  if (value) await Promise.all(Array.from({ length: value.count }, (_,i) => SecureStore.deleteItemAsync(`${key}.${value.generation}.${i}`).catch(() => undefined)));
}
export const secureStorage = {
  async getItem(key: string) {
    const p = await pointer(key); if (!p) return null;
    const chunks = await Promise.all(Array.from({ length: p.count }, (_,i) => SecureStore.getItemAsync(`${key}.${p.generation}.${i}`)));
    if (chunks.some(value => value === null)) throw new Error('No se pudo recuperar la sesión completa.');
    return chunks.join('');
  },
  async setItem(key: string, value: string) {
    const old = await pointer(key);
    const next = { generation: randomUUID(), count: Math.max(1, Math.ceil(value.length / 1500)) };
    if (next.count > 32) throw new Error('Sesión demasiado grande.');
    try {
      for (let i=0; i<next.count; i++) await SecureStore.setItemAsync(`${key}.${next.generation}.${i}`, value.slice(i*1500,(i+1)*1500));
      await SecureStore.setItemAsync(key, JSON.stringify(next));
    } catch (error) { await clean(key,next); throw error; }
    await clean(key,old);
  },
  async removeItem(key: string) { const old = await pointer(key); await SecureStore.deleteItemAsync(key); await clean(key,old); },
};
