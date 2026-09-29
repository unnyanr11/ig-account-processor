import type { BackupAccount, BackupBatch, BackupData, BackupHistory, BackupLink, BackupList } from '../types/backup';
import { withDb } from './database';

/** Reads every table inside one transaction so the backup is a consistent snapshot. */
export function dumpAll(): Promise<BackupData> {
  return withDb('Failed to read data for backup', async (db) => {
    const result: { data: BackupData | null } = { data: null };
    await db.withTransactionAsync(async () => {
      result.data = {
        lists: await db.getAllAsync<BackupList>('SELECT * FROM lists ORDER BY id'),
        accounts: await db.getAllAsync<BackupAccount>('SELECT * FROM accounts ORDER BY id'),
        status_history: await db.getAllAsync<BackupHistory>('SELECT * FROM status_history ORDER BY id'),
        import_batches: await db.getAllAsync<BackupBatch>('SELECT * FROM import_batches ORDER BY id'),
        import_batch_accounts: await db.getAllAsync<BackupLink>('SELECT import_batch_id, account_id FROM import_batch_accounts'),
      };
    });
    return result.data as BackupData;
  });
}

/**
 * Replaces all data in a single transaction. If any statement fails the transaction is
 * rolled back and the existing data is left exactly as it was.
 */
export function replaceAll(data: BackupData): Promise<void> {
  return withDb('Failed to restore data', async (db) => {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM import_batch_accounts');
      await db.runAsync('DELETE FROM status_history');
      await db.runAsync('DELETE FROM accounts');
      await db.runAsync('DELETE FROM import_batches');
      await db.runAsync('DELETE FROM lists');

      for (const l of data.lists) {
        await db.runAsync('INSERT INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [l.id, l.name, l.created_at, l.updated_at]);
      }
      for (const a of data.accounts) {
        await db.runAsync(
          'INSERT INTO accounts (id, username, instagram_url, status, list_id, source, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [a.id, a.username, a.instagram_url, a.status, a.list_id, a.source, a.notes, a.created_at, a.updated_at]
        );
      }
      for (const h of data.status_history) {
        await db.runAsync(
          'INSERT INTO status_history (id, account_id, old_status, new_status, created_at) VALUES (?, ?, ?, ?, ?)',
          [h.id, h.account_id, h.old_status, h.new_status, h.created_at]
        );
      }
      for (const b of data.import_batches) {
        await db.runAsync(
          'INSERT INTO import_batches (id, file_name, total_records, new_records, duplicate_records, invalid_records, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [b.id, b.file_name, b.total_records, b.new_records, b.duplicate_records, b.invalid_records, b.created_at]
        );
      }
      for (const k of data.import_batch_accounts) {
        await db.runAsync('INSERT INTO import_batch_accounts (import_batch_id, account_id) VALUES (?, ?)', [k.import_batch_id, k.account_id]);
      }
    });
  });
