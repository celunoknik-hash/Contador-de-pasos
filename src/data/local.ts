import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { createRepository } from './repository';
export type { ActivityRepository } from './repository';
const databases = new Map<string, SQLite.SQLiteDatabase>();
function filename(id?: string) {
  if (!id) return 'walkworld.db';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Identidad no válida.');
  return `walkworld-${id}.db`;
}
export function openRepository(id?: string) {
  const name=filename(id);
  let db=databases.get(name);
  if(!db) { db=SQLite.openDatabaseSync(name); databases.set(name,db); }
  const repo=createRepository(db); repo.deviceId(Crypto.randomUUID); return repo;
}
export function deleteAccountDatabase(id: string) {
  const name=filename(id); databases.get(name)?.closeSync(); databases.delete(name); SQLite.deleteDatabaseSync(name);
}

const pendingDeletion=new Set<string>();
export function queueAccountDeletion(id:string) { filename(id);pendingDeletion.add(id); }
export function finishAccountDeletion(id:string) { if(pendingDeletion.delete(id)) deleteAccountDatabase(id); }
