import * as SQLite from 'expo-sqlite';
import { DB_NAME } from '../utils/constants';
import { MIGRATIONS } from './schema';

export class DatabaseError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'DatabaseError';
  }
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      for (const statement of MIGRATIONS[version]) {
        await db.execAsync(statement);
      }
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Single shared connection; the only place the database is opened. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = open().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) {
    const db = await pending.catch(() => null);
    await db?.closeAsync();
  }
}

/** Runs a query with the shared connection and wraps failures in a DatabaseError. */
export async function withDb<T>(
  message: string,
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  try {
    return await fn(await getDb());
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(message, error);
  }
}
