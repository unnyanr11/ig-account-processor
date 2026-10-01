import type { BackupData, BackupRow } from '../types/backup';
import { withDb } from './database';

const BACKUP_TABLES = [
  'lists','accounts','status_history','import_batches','import_batch_accounts',
  'account_images','list_accounts','app_imports','app_import_accounts',
  'account_username_history','settings',
] as const;

const DELETE_ORDER = [
  'app_import_accounts','account_username_history','app_imports','import_batch_accounts',
  'status_history','account_images','list_accounts','accounts','import_batches','lists','settings',
] as const;

export function dumpAll(): Promise<BackupData> {
  return withDb('Failed to read data for backup', async (db) => {
    const out = {
      lists: [], accounts: [], status_history: [], import_batches: [], import_batch_accounts: [],
      account_images: [], list_accounts: [], app_imports: [], app_import_accounts: [],
      account_username_history: [], settings: [],
    } as BackupData;
    await db.withTransactionAsync(async () => {
      for (const table of BACKUP_TABLES) out[table] = await db.getAllAsync<BackupRow>(`SELECT * FROM ${table}`);
    });
    return out;
  });
}

export function replaceAll(data: BackupData): Promise<void> {
  return withDb('Failed to restore data', async (db) => db.withExclusiveTransactionAsync(async (txn) => {
    const columns = new Map<string,Set<string>>();
    for (const table of BACKUP_TABLES) {
      const rows = await txn.getAllAsync<{name:string}>(`PRAGMA table_info(${table})`);
      columns.set(table,new Set(rows.map(r=>r.name)));
    }

    for (const table of DELETE_ORDER) await txn.runAsync(`DELETE FROM ${table}`);

    for (const table of BACKUP_TABLES) {
      const allowed=columns.get(table)!;
      const rows=data[table];
      if(!Array.isArray(rows)) continue;
      for(const row of rows){
        const keys=Object.keys(row).filter(k=>allowed.has(k));
        if(!keys.length) continue;
        const placeholders=keys.map(()=>'?').join(',');
        const sql=`INSERT INTO ${table}(${keys.join(',')}) VALUES(${placeholders})`;
        const values=keys.map(key=>row[key] as string|number|null|Uint8Array);
        await txn.runAsync(sql,values);
      }
    }
  }));
}
