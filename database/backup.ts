import type { BackupData, BackupRow } from '../types/backup';
import { withDb } from './database';

const BACKUP_TABLES = [
  'lists',
  'accounts',
  'status_history',
  'import_batches',
  'import_batch_accounts',
  'account_images',
  'list_accounts',
  'app_imports',
  'app_import_accounts',
  'account_username_history',
  'settings',
] as const;

export function dumpAll(): Promise<BackupData> {
  return withDb('Failed to read data for backup', async (db) => {
    const out: BackupData = {
      lists: [],
      accounts: [],
      status_history: [],
      import_batches: [],
      import_batch_accounts: [],
      account_images: [],
      list_accounts: [],
      app_imports: [],
      app_import_accounts: [],
      account_username_history: [],
      settings: [],
    };

    await db.withTransactionAsync(async () => {
      for (const table of BACKUP_TABLES) {
        out[table] = await db.getAllAsync<BackupRow>(`SELECT * FROM ${table}`);
      }
    });

    return out;
  });
}

export function replaceAll(data: BackupData): Promise<void> {
  return withDb('Failed to restore data', async (db) => db.withTransactionAsync(async () => {
    // Delete in dependency order so foreign-key enforcement remains enabled.
    for (const table of [
      'app_import_accounts',
      'account_username_history',
      'app_imports',
      'import_batch_accounts',
      'status_history',
      'account_images',
      'list_accounts',
      'accounts',
      'import_batches',
      'lists',
      'settings',
    ]) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    // Only restore known application tables. Never execute arbitrary table names
    // supplied by a backup file.
    for (const table of BACKUP_TABLES) {
      const rows = data[table];
      if (!Array.isArray(rows)) continue;

      for (const row of rows) {
        const keys = Object.keys(row);
        if (!keys.length) continue;
        const placeholders = keys.map(() => '?').join(',');
        const sql = `INSERT INTO ${table}(${keys.join(',')}) VALUES(${placeholders})`;
        await db.runAsync(sql, keys.map((key) => row[key]));
      }
    }
  }));
}
