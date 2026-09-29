import { List, ListWithStats } from '../types/list';
import { nowIso } from '../utils/normalization';
import { withDb } from './database';
import type { ListRepository } from './interfaces';

export function create(name: string): Promise<number> {
  return withDb('Failed to create list', async (db) => {
    const ts = nowIso();
    const result = await db.runAsync('INSERT INTO lists (name, created_at, updated_at) VALUES (?, ?, ?)', [name.trim(), ts, ts]);
    return result.lastInsertRowId;
  });
}

export function rename(id: number, name: string): Promise<void> {
  return withDb('Failed to rename list', async (db) => {
    await db.runAsync('UPDATE lists SET name = ?, updated_at = ? WHERE id = ?', [name.trim(), nowIso(), id]);
  });
}

export function remove(id: number, deleteAccounts: boolean): Promise<void> {
  return withDb('Failed to delete list', async (db) => {
    await db.withTransactionAsync(async () => {
      if (deleteAccounts) {
        await db.runAsync('DELETE FROM accounts WHERE list_id = ?', [id]);
      } else {
        await db.runAsync('UPDATE accounts SET list_id = NULL WHERE list_id = ?', [id]);
      }
      await db.runAsync('DELETE FROM lists WHERE id = ?', [id]);
    });
  });
}

export function getAll(): Promise<List[]> {
  return withDb('Failed to load lists', (db) => db.getAllAsync<List>('SELECT * FROM lists ORDER BY name COLLATE NOCASE ASC'));
}

export function getById(id: number): Promise<List | null> {
  return withDb('Failed to load list', async (db) => (await db.getFirstAsync<List>('SELECT * FROM lists WHERE id = ?', [id])) ?? null);
}

export function getAllWithStats(): Promise<ListWithStats[]> {
  return withDb('Failed to load list statistics', async (db) => {
    const rows = await db.getAllAsync<List & { total: number; processed: number | null }>(
      `SELECT l.*, COUNT(a.id) AS total,
              SUM(CASE WHEN a.status <> 'NEW' THEN 1 ELSE 0 END) AS processed
       FROM lists l LEFT JOIN accounts a ON a.list_id = l.id
       GROUP BY l.id ORDER BY l.name COLLATE NOCASE ASC`
    );
    return rows.map((r) => {
      const processed = r.processed ?? 0;
      return { id: r.id, name: r.name, created_at: r.created_at, updated_at: r.updated_at, total: r.total, processed, new_count: r.total - processed };
    });
  });
}

const _contract: ListRepository = { create, rename, remove, getAll, getById, getAllWithStats };
void _contract;
