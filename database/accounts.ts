import { AccountStatus, AccountWithList, ACCOUNT_STATUSES } from '../types/account';
import { nowIso } from '../utils/normalization';
import { DatabaseError, withDb } from './database';
import type { AccountFilters, AccountMetadataUpdate, AccountRepository, Direction, NewAccountInput, StatusCounts } from './interfaces';

const SELECT_WITH_LIST = `SELECT a.*, l.name AS list_name FROM accounts a LEFT JOIN lists l ON l.id = a.list_id`;
const CHUNK = 500;

function escapeLike(term: string): string { return term.replace(/[!%_]/g, (m) => `!${m}`); }
function todayRange(): [string, string] { const now = new Date(); return [new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()]; }
type Param = string | number;
function buildWhere(filters: AccountFilters): { where: string; params: Param[] } {
  const clauses: string[] = [];
  const params: Param[] = [];
  if (filters.status) { clauses.push('a.status = ?'); params.push(filters.status); }
  if (filters.listId === null) clauses.push('a.list_id IS NULL'); else if (filters.listId !== undefined) { clauses.push('a.list_id = ?'); params.push(filters.listId); }
  const importId = filters.importId ?? filters.importBatchId;
  if (importId !== undefined) { clauses.push('a.id IN (SELECT account_id FROM app_import_accounts WHERE import_id = ?)'); params.push(importId); }
  const term = filters.search?.trim();
  if (term) { const like = `%${escapeLike(term)}%`; clauses.push(`(a.username LIKE ? ESCAPE '!' OR a.display_name LIKE ? ESCAPE '!' OR a.full_name LIKE ? ESCAPE '!' OR a.notes LIKE ? ESCAPE '!' OR a.source LIKE ? ESCAPE '!')`); params.push(like, like, like, like, like); }
  if (filters.importedToday) { const [start, end] = todayRange(); clauses.push('a.created_at >= ? AND a.created_at < ?'); params.push(start, end); }
  if (filters.updatedToday) { const [start, end] = todayRange(); clauses.push('a.updated_at >= ? AND a.updated_at < ?'); params.push(start, end); }
  if (filters.neverProcessed) clauses.push('a.last_processed_at IS NULL');
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export function getById(id: number): Promise<AccountWithList | null> { return withDb('Failed to load account', async (db) => (await db.getFirstAsync<AccountWithList>(`${SELECT_WITH_LIST} WHERE a.id = ?`, [id])) ?? null); }
export function getPage(filters: AccountFilters, limit: number, offset: number): Promise<AccountWithList[]> { return withDb('Failed to load accounts', async (db) => { const { where, params } = buildWhere(filters); return db.getAllAsync<AccountWithList>(`${SELECT_WITH_LIST} ${where} ORDER BY a.id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]); }); }
export function count(filters: AccountFilters): Promise<number> { return withDb('Failed to count accounts', async (db) => { const { where, params } = buildWhere(filters); const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM accounts a ${where}`, params); return row?.n ?? 0; }); }
export function findExistingUsernames(usernames: string[]): Promise<Set<string>> { return withDb('Failed to check existing accounts', async (db) => { const found = new Set<string>(); if (!usernames.length) return found; for (let i = 0; i < usernames.length; i += CHUNK) { const chunk = usernames.slice(i, i + CHUNK); const marks = chunk.map(() => '?').join(','); const rows = await db.getAllAsync<{ username: string }>(`SELECT username FROM accounts WHERE username IN (${marks})`, chunk); rows.forEach((r) => found.add(r.username)); } return found; }); }
export function getIdsByUsernames(usernames: string[]): Promise<number[]> { return withDb('Failed to look up accounts', async (db) => { const ids: number[] = []; if (!usernames.length) return ids; for (let i = 0; i < usernames.length; i += CHUNK) { const chunk = usernames.slice(i, i + CHUNK); const marks = chunk.map(() => '?').join(','); const rows = await db.getAllAsync<{ id: number }>(`SELECT id FROM accounts WHERE username IN (${marks})`, chunk); rows.forEach((r) => ids.push(r.id)); } return ids; }); }
export function insertMany(inputs: NewAccountInput[], onProgress?: (done: number, total: number) => void): Promise<Map<string, number>> {
  return withDb('Failed to save accounts', async (db) => {
    const saved = new Map<string, number>();
    const ts = nowIso();
    for (let i = 0; i < inputs.length; i += CHUNK) {
      const chunk = inputs.slice(i, i + CHUNK);
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const a of chunk) {
          if (!a.username) continue;
          try {
            const result = await txn.runAsync(
              'INSERT INTO accounts (username, instagram_url, model_name, letter, display_name, full_name, profile_image_url, image_url, profile_image_uri, local_image_path, source_url, source_file_name, source_file_type, source_mime_type, source_row, source_import_id, raw_data_json, status, list_id, source, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET instagram_url=excluded.instagram_url, model_name=excluded.model_name, letter=excluded.letter, display_name=excluded.display_name, full_name=excluded.full_name, profile_image_url=excluded.profile_image_url, image_url=excluded.image_url, profile_image_uri=excluded.profile_image_uri, local_image_path=COALESCE(excluded.local_image_path, accounts.local_image_path), source_url=excluded.source_url, source_file_name=excluded.source_file_name, source_file_type=excluded.source_file_type, source_mime_type=excluded.source_mime_type, source_row=excluded.source_row, source_import_id=excluded.source_import_id, raw_data_json=excluded.raw_data_json, source=COALESCE(excluded.source, accounts.source), notes=COALESCE(excluded.notes, accounts.notes), updated_at=excluded.updated_at',
              [a.username, a.instagram_url, a.model_name ?? null, a.letter ?? null, a.display_name ?? null, a.full_name ?? null, a.profile_image_url ?? null, a.image_url ?? null, a.profile_image_uri ?? null, a.local_image_path ?? null, a.source_url ?? null, a.source_file_name ?? null, a.source_file_type ?? null, a.source_mime_type ?? null, a.source_row ?? null, a.source_import_id ?? null, a.raw_data_json ?? null, 'NEW', a.list_id ?? null, a.source ?? null, a.notes ?? null, a.created_at ?? ts, a.updated_at ?? ts]
            );
            const row = await txn.getFirstAsync<{ id: number }>('SELECT id FROM accounts WHERE username = ?', [a.username]);
            if (!row) throw new DatabaseError('Account was saved but could not be reloaded');
            saved.set(a.username, row.id);
            void result;
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new DatabaseError('Failed to save account @' + a.username + ': ' + detail, error);
          }
        }
      });
      onProgress?.(Math.min(i + CHUNK, inputs.length), inputs.length);
    }
    return saved;
  });
}
export function updateMetadata(id: number, metadata: AccountMetadataUpdate): Promise<void> { return withDb('Failed to update account metadata', async (db) => { const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM accounts WHERE id = ?', [id]); if (!row) throw new DatabaseError('Account not found'); const nextDisplay = metadata.display_name ?? null; const nextFull = metadata.full_name ?? null; const nextImage = metadata.image_url ?? null; const nextLocal = metadata.profile_image_uri ?? null; const nextProfile = metadata.profile_image_url ?? metadata.image_url ?? null; await db.runAsync('UPDATE accounts SET display_name = ?, full_name = ?, profile_image_url = ?, image_url = ?, profile_image_uri = ?, updated_at = ? WHERE id = ?', [nextDisplay, nextFull, nextProfile, nextImage, nextLocal, nowIso(), id]); }); }
export function setStatus(id: number, status: AccountStatus): Promise<AccountStatus> { return withDb('Failed to update status', async (db) => { const result: { previous: AccountStatus | null } = { previous: null }; await db.withTransactionAsync(async () => { const row = await db.getFirstAsync<{ status: AccountStatus }>('SELECT status FROM accounts WHERE id = ?', [id]); if (!row) throw new DatabaseError('Account not found'); result.previous = row.status; if (row.status === status) return; const ts = nowIso(); await db.runAsync('UPDATE accounts SET status = ?, last_processed_at = ?, updated_at = ? WHERE id = ?', [status, ts, ts, id]); await db.runAsync('INSERT INTO status_history (account_id, old_status, new_status, created_at) VALUES (?, ?, ?, ?)', [id, row.status, status, ts]); }); return result.previous as AccountStatus; }); }
export function setNotes(id: number, notes: string): Promise<void> { return withDb('Failed to save notes', async (db) => { await db.runAsync('UPDATE accounts SET notes = ?, updated_at = ? WHERE id = ?', [notes.trim() || null, nowIso(), id]); }); }
export function moveToList(id: number, listId: number | null): Promise<void> { return withDb('Failed to move account', async (db) => db.withTransactionAsync(async () => { const t = nowIso(); await db.runAsync('UPDATE accounts SET list_id = ?, updated_at = ? WHERE id = ?', [listId, t, id]); await db.runAsync('DELETE FROM list_accounts WHERE account_id = ?', [id]); if (listId !== null) await db.runAsync('INSERT OR IGNORE INTO list_accounts(list_id, account_id, created_at) VALUES(?, ?, ?)', [listId, id, t]); })); }
export function getStatusCounts(listId?: number | null): Promise<StatusCounts> { return withDb('Failed to load statistics', async (db) => { const { where, params } = buildWhere(listId === undefined ? {} : { listId }); const rows = await db.getAllAsync<{ status: AccountStatus; n: number }>(`SELECT a.status AS status, COUNT(*) AS n FROM accounts a ${where} GROUP BY a.status`, params); const byStatus = Object.fromEntries(ACCOUNT_STATUSES.map((s) => [s, 0])) as Record<AccountStatus, number>; let total = 0; for (const r of rows) { if (r.status in byStatus) byStatus[r.status] = r.n; total += r.n; } return { total, byStatus }; }); }
export function getFirstId(filters: AccountFilters): Promise<number | null> { return withDb('Failed to load queue', async (db) => { const { where, params } = buildWhere(filters); const row = await db.getFirstAsync<{ id: number }>(`SELECT a.id AS id FROM accounts a ${where} ORDER BY a.id ASC LIMIT 1`, params); return row?.id ?? null; }); }
export function getAdjacentId(filters: AccountFilters, currentId: number, direction: Direction): Promise<number | null> { return withDb('Failed to load queue', async (db) => { const { where, params } = buildWhere(filters); const cmp = direction === 'next' ? '>' : '<'; const order = direction === 'next' ? 'ASC' : 'DESC'; const condition = where ? `${where} AND a.id ${cmp} ?` : `WHERE a.id ${cmp} ?`; const row = await db.getFirstAsync<{ id: number }>(`SELECT a.id AS id FROM accounts a ${condition} ORDER BY a.id ${order} LIMIT 1`, [...params, currentId]); return row?.id ?? null; }); }
export function getPosition(filters: AccountFilters, id: number): Promise<number> { return withDb('Failed to load queue', async (db) => { const { where, params } = buildWhere(filters); const condition = where ? `${where} AND a.id <= ?` : 'WHERE a.id <= ?'; const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM accounts a ${condition}`, [...params, id]); return row?.n ?? 0; }); }
const _contract: AccountRepository = { getById, getPage, count, findExistingUsernames, getIdsByUsernames, insertMany, updateMetadata, setStatus, setNotes, moveToList, getStatusCounts, getFirstId, getAdjacentId, getPosition };
void _contract;
