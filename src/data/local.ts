import * as SQLite from 'expo-sqlite';
import { createRepository } from './repository';
export type { ActivityRepository } from './repository';
export function openRepository() { return createRepository(SQLite.openDatabaseSync('walkworld.db')); }
