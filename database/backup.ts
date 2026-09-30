import type {
  BackupAccount,
  BackupBatch,
  BackupData,
  BackupHistory,
  BackupLink,
  BackupList,
} from '../types/backup';
import { withDb } from './database';

/** Reads every table inside one transaction so the backup is a consistent snapshot. */
export function dumpAll(): Promise<BackupData> {
  return withDb('Failed to read data for backup', async (db) => {
    const result: { data: BackupData | null } = { data: null };

    await db.withTransactionAsync(async () => {
      result.data = {
        lists: await db.getAllAsync<BackupList>('SELECT * FROM lists ORDER BY id'),
        accounts: await db.getAllAsync<BackupAccount>('SELECT * FROM accounts ORDER BY id'),
        status_history: await db.getAllAsync<BackupHistory>(
          'SELECT * FROM status_history ORDER BY id'
        ),
        import_batches: await db.getAllAsync<BackupBatch>(
          'SELECT * FROM import_batches ORDER BY id'
        ),
        import_batch_accounts: await db.getAllAsync<BackupLink>(
          'SELECT import_batch_id, account_id FROM import_batch_accounts'
        ),
      };
    });

    return result.data as BackupData;
  });
}

/**
 * Replaces all data in a single transaction. If any statement fails, the transaction is
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

      for (const list of data.lists) {
        await db.runAsync(
          'INSERT INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
          [list.id, list.name, list.created_at, list.updated_at]
        );
      }

      for (const account of data.accounts) {
        await db.runAsync(
          'INSERT INTO accounts (id, username, instagram_url, status, list_id, source, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            account.id,
            account.username,
            account.instagram_url,
            account.status,
            account.list_id,
            account.source,
            account.notes,
            account.created_at,
            account.updated_at,
          ]
        );
      }

      for (const history of data.status_history) {
        await db.runAsync(
          'INSERT INTO status_history (id, account_id, old_status, new_status, created_at) VALUES (?, ?, ?, ?, ?)',
          [
            history.id,
            history.account_id,
            history.old_status,
            history.new_status,
            history.created_at,
          ]
        );
      }

      for (const batch of data.import_batches) {
        await db.runAsync(
          'INSERT INTO import_batches (id, file_name, total_records, new_records, duplicate_records, invalid_records, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            batch.id,
            batch.file_name,
            batch.total_records,
            batch.new_records,
            batch.duplicate_records,
            batch.invalid_records,
            batch.created_at,
          ]
        );
      }

      for (const link of data.import_batch_accounts) {
        await db.runAsync(
          'INSERT INTO import_batch_accounts (import_batch_id, account_id) VALUES (?, ?)',
          [link.import_batch_id, link.account_id]
        );
      }
    });
  });
}