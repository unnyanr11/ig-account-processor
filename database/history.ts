import { ImportBatch, StatusHistoryEntry } from '../types/history';
import { nowIso } from '../utils/normalization';
import { withDb } from './database';
import type { HistoryRepository } from './interfaces';

const CHUNK = 500;

export function getForAccount(accountId: number): Promise<StatusHistoryEntry[]> {
  return withDb('Failed to load history', (db) =>
    db.getAllAsync<StatusHistoryEntry>('SELECT * FROM status_history WHERE account_id = ? ORDER BY id DESC', [accountId])
  );
}

export function createImportBatch(
  fileName: string,
  totals: { total: number; newRecords: number; duplicates: number; invalid: number }
): Promise<number> {
  return withDb('Failed to record import', async (db) => {
    const result = await db.runAsync(
      `INSERT INTO import_batches (file_name, total_records, new_records, duplicate_records, invalid_records, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fileName, totals.total, totals.newRecords, totals.duplicates, totals.invalid, nowIso()]
    );
    return result.lastInsertRowId;
  });
}

/** Links accounts (new and already-existing) to the file they appeared in. */
export function linkAccountsToBatch(batchId: number, accountIds: number[]): Promise<void> {
  return withDb('Failed to record import', async (db) => {
    for (let i = 0; i < accountIds.length; i += CHUNK) {
      const chunk = accountIds.slice(i, i + CHUNK);
      await db.withTransactionAsync(async () => {
        for (const accountId of chunk) {
          await db.runAsync('INSERT OR IGNORE INTO import_batch_accounts (import_batch_id, account_id) VALUES (?, ?)', [batchId, accountId]);
        }
      });
    }
  });
}

export function getImportBatches(): Promise<ImportBatch[]> {
  return withDb('Failed to load import history', (db) =>
    db.getAllAsync<ImportBatch>('SELECT * FROM import_batches ORDER BY id DESC')
  );
}

export function getImportBatch(id: number): Promise<ImportBatch | null> {
  return withDb('Failed to load import', async (db) =>
    (await db.getFirstAsync<ImportBatch>('SELECT * FROM import_batches WHERE id = ?', [id])) ?? null
  );
}

const _contract: HistoryRepository = { getForAccount, createImportBatch, linkAccountsToBatch, getImportBatches, getImportBatch };
void _contract;
