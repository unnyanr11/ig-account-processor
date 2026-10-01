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
  if (term) { const like = `%${escapeLike(term)}%`; clauses.push(`(a.username LIKE ? ESCAPE '!' OR a.display_name LIKE ? ESCAPE '!' OR a.full_name LIKE ? ESCAPE '!' OR a.x_username LIKE ? ESCAPE '!' OR a.x_url LIKE ? ESCAPE '!' OR a.tiktok_username LIKE ? ESCAPE '!' OR a.tiktok_url LIKE ? ESCAPE '!' OR a.notes LIKE ? ESCAPE '!' OR a.source LIKE ? ESCAPE '!')`); params.push(like, like, like, like, like, like, like, like, like); }
  if (filters.importedToday) { const [start, end] = todayRange(); clauses.push('a.created_at >= ? AND a.created_at < ?'); params.push(start, end); }
  if (filters.updatedToday) { const [start, end] = todayRange(); clauses.push('a.updated_at >= ? AND a.updated_at < ?'); params.push(start, end); }
  if (filters.neverProcessed) clauses.push('a.last_processed_at IS NULL');
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export function getById(id: number): Promise<AccountWithList | null> { return withDb('Failed to load account', async (db) => (await db.getFirstAsync<AccountWithList>(`${SELECT_WITH_LIST} WHERE a.id = ?`, [id])) ?? null); }
export function getPage(filters: AccountFilters, limit: number, offset: number): Promise<AccountWithList[]> { return withDb('Failed to load accounts', async (db) => { const { where, params } = buildWhere(filters); return db.getAllAsync<AccountWithList>(`${SELECT_WITH_LIST} ${where} ORDER BY a.id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]); }); }
export function count(filters: AccountFilters): Promise<number> { return withDb('Failed to count accounts', async (db) => { const { where, params } = buildWhere(filters); const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM accounts a ${where}`, params); return row?.n ?? 0; }); }
export function findExistingUsernames(usernames: string[]): Promise<Set<string>> { return withDb('Failed to check existing accounts', async (db) => { const found = new Set<string>(); if (!usernames.length) return found; for (let i = 0; i < usernames.length; i += CHUNK) { const chunk = usernames.slice(i, i + CHUNK); const marks = chunk.map(() => '?').join(','); const rows = await db.getAllAsync<{ username: string }>(`SELECT username FROM accounts WHERE username IN (${marks})`, chunk); rows.forEach((r) => found.add(r.username)); } return found; }); }
export function getIdsByUsernames(usernames: string[]): Promise<number[]> { return withDb('Failed to look up accounts', async (db) => { const ids: number[] = []; if (!usernames.length) return ids; for (let i = 0; i < usernames.length; i += CHUNK) { const chunk = usernames.slice(i, i + CHUNK); const marks = chunk.map(() => '?').join(','); const rows = await db.getAllAsync<{ id: number }>(`SELECT id FROM accounts WHERE username IN (${marks})`, chunk); rows.forEach((r) => ids.push(r.id)); } return ids; }); }export function findUsernameChanges(candidates: import('./interfaces').UsernameChangeCandidate[]): Promise<import('./interfaces').UsernameChangeMatch[]> {
  return withDb('Failed to detect username changes', async (db) => {
    const matches: import('./interfaces').UsernameChangeMatch[] = [];
    const seenAccounts = new Set<number>();
    const pending = candidates.filter(c => c.username);

    const unique = (values: string[]) => Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));
    const chunked = <T,>(values:T[], size:number):T[][] => { const out:T[][]=[]; for(let i=0;i<values.length;i+=size) out.push(values.slice(i,i+size)); return out; };

    const exactNames = unique(pending.map(c => c.username));
    const existing = new Set<string>();
    for (const chunk of chunked(exactNames, CHUNK)) {
      const marks=chunk.map(()=>'?').join(',');
      const rows=await db.getAllAsync<{username:string}>(`SELECT username FROM accounts WHERE username IN (${marks})`,chunk);
      rows.forEach(r=>existing.add(r.username));
    }

    const sourceMap=new Map<string,{id:number;username:string}[]>();
    const imageMap=new Map<string,{id:number;username:string}[]>();
    const nameMap=new Map<string,{id:number;username:string}[]>(); const nameOnlyMap=new Map<string,{id:number;username:string}[]>();
    const sourceKeys=unique(pending.map(c=>c.source_url||''));
    const imageKeys=unique(pending.map(c=>c.profile_image_url||''));
    const nameKeys=unique(pending.map(c=>`${(c.model_name||'').trim().toLowerCase()}|${(c.letter||'').trim().toLowerCase()}`));

    for(const chunk of chunked(sourceKeys,CHUNK)){
      if(!chunk.length) continue;
      const marks=chunk.map(()=>'?').join(',');
      const rows=await db.getAllAsync<{id:number;username:string;source_url:string|null}>(`SELECT id,username,source_url FROM accounts WHERE source_url IS NOT NULL AND lower(trim(source_url)) IN (${marks})`,chunk.map(x=>x.toLowerCase()));
      rows.forEach(r=>{const k=(r.source_url||'').trim().toLowerCase();const a=sourceMap.get(k)||[];a.push(r);sourceMap.set(k,a);});
    }
    for(const chunk of chunked(imageKeys,CHUNK)){
      if(!chunk.length) continue;
      const marks=chunk.map(()=>'?').join(',');
      const rows=await db.getAllAsync<{id:number;username:string;profile_image_url:string|null;image_url:string|null}>(`SELECT id,username,profile_image_url,image_url FROM accounts WHERE lower(trim(profile_image_url)) IN (${marks}) OR lower(trim(image_url)) IN (${marks})`,[...chunk.map(x=>x.toLowerCase()),...chunk.map(x=>x.toLowerCase())]);
      rows.forEach(r=>{for(const v of [r.profile_image_url,r.image_url]){const k=(v||'').trim().toLowerCase();if(!k)continue;const a=imageMap.get(k)||[];if(!a.some(x=>x.id===r.id))a.push({id:r.id,username:r.username});imageMap.set(k,a);}});
    }
    const nameParts=unique(pending.filter(c=>c.model_name?.trim()).map(c=>(c.model_name||'').trim().toLowerCase()));
    for(const chunk of chunked(nameParts,CHUNK)){
      if(!chunk.length) continue;
      const marks=chunk.map(()=>'?').join(',');
      const rows=await db.getAllAsync<{id:number;username:string;model_name:string|null;letter:string|null}>(`SELECT id,username,model_name,letter FROM accounts WHERE lower(trim(model_name)) IN (${marks})`,chunk);
      rows.forEach(r=>{const n=(r.model_name||'').trim().toLowerCase();const k=`${n}|${(r.letter||'').trim().toLowerCase()}`;const a=nameMap.get(k)||[];a.push({id:r.id,username:r.username});nameMap.set(k,a);const b=nameOnlyMap.get(n)||[];b.push({id:r.id,username:r.username});nameOnlyMap.set(n,b);});
    }

    for(const c of pending){
      if(existing.has(c.username)) continue;
      let row:{id:number;username:string}|null=null;
      const source=(c.source_url||'').trim().toLowerCase();
      const image=(c.profile_image_url||'').trim().toLowerCase();
      const nameKey=`${(c.model_name||'').trim().toLowerCase()}|${(c.letter||'').trim().toLowerCase()}`;
      const sourceMatches=source?sourceMap.get(source)||[]:[];
      const imageMatches=image?imageMap.get(image)||[]:[];
      const nameMatches=c.model_name?.trim()?(c.letter?.trim()?(nameMap.get(nameKey)||[]):(nameOnlyMap.get((c.model_name||'').trim().toLowerCase())||[])):[];
      if(sourceMatches.length===1) row=sourceMatches[0];
      else if(imageMatches.length===1) row=imageMatches[0];
      else if(nameMatches.length===1) row=nameMatches[0];
      if(row&&row.username&&row.username!==c.username&&!seenAccounts.has(row.id)){matches.push({account_id:row.id,old_username:row.username,new_username:c.username});seenAccounts.add(row.id);}
    }
    return matches;
  });
}

export function applyUsernameChanges(changes: import('./interfaces').UsernameChangeMatch[], importId:number|null): Promise<void> {
  return withDb('Failed to update usernames', async (db) => db.withTransactionAsync(async () => {
    for (const c of changes) {
      const conflict = await db.getFirstAsync<{id:number}>('SELECT id FROM accounts WHERE username = ? AND id <> ?', [c.new_username, c.account_id]);
      if (conflict) continue;
      const current = await db.getFirstAsync<{username:string}>('SELECT username FROM accounts WHERE id = ?', [c.account_id]);
      if (!current || current.username === c.new_username) continue;
      const ts = nowIso();
      await db.runAsync('UPDATE accounts SET username = ?, instagram_url = ?, updated_at = ? WHERE id = ?', [c.new_username, `https://www.instagram.com/${encodeURIComponent(c.new_username)}/`, ts, c.account_id]);
      await db.runAsync('INSERT INTO account_username_history(account_id,old_username,new_username,import_id,changed_at) VALUES(?,?,?,?,?)',[c.account_id,current.username,c.new_username,importId,ts]);
    }
  }));
}


export function insertMany(
  inputs: NewAccountInput[],
  onProgress?: (done:number,total:number)=>void,
  importId?: number|null,
  usernameChanges: import('./interfaces').UsernameChangeMatch[] = [],
): Promise<Map<string,number>> {
  return withDb('Failed to save accounts', async (db) => {
    const saved = new Map<string,number>();
    const ts = nowIso();

    await db.withExclusiveTransactionAsync(async (txn) => {
      // Apply detected renames inside the same transaction as the import.
      const importSnapshots=new Map<number,string>();
      if(importId){
        for(const change of usernameChanges){
          const snapshot=await txn.getFirstAsync<Record<string,unknown>>('SELECT * FROM accounts WHERE id=?',[change.account_id]);
          if(snapshot) importSnapshots.set(change.account_id,JSON.stringify(snapshot));
        }
      }

      for (const change of usernameChanges) {
        const conflict = await txn.getFirstAsync<{id:number}>(
          'SELECT id FROM accounts WHERE username = ? AND id <> ?',
          [change.new_username, change.account_id],
        );
        if (conflict) throw new DatabaseError(`Instagram username already belongs to another account: @${change.new_username}`);
        const current = await txn.getFirstAsync<{username:string}>(
          'SELECT username FROM accounts WHERE id = ?',
          [change.account_id],
        );
        if (!current || current.username === change.new_username) continue;
        const changedAt = nowIso();
        await txn.runAsync(
          'UPDATE accounts SET username = ?, instagram_url = ?, updated_at = ? WHERE id = ?',
          [change.new_username, `https://www.instagram.com/${encodeURIComponent(change.new_username)}/`, changedAt, change.account_id],
        );
        await txn.runAsync(
          'INSERT INTO account_username_history(account_id,old_username,new_username,import_id,changed_at) VALUES(?,?,?,?,?)',
          [change.account_id,current.username,change.new_username,importId ?? null,changedAt],
        );
      }

      for (let i=0; i<inputs.length; i++) {
        const a=inputs[i];
        try {
          let accountId:number|null=null;
          let previousAccountJson:string|null=null;
          let createdByImport=0;

          if (a.identity_key) {
            const identityRow=await txn.getFirstAsync<{id:number}>(
              'SELECT id FROM accounts WHERE identity_key = ?',
              [a.identity_key],
            );
            if (identityRow) {
              previousAccountJson=importSnapshots.get(identityRow.id) ?? null;
              if(!previousAccountJson){const snapshot=await txn.getFirstAsync<Record<string,unknown>>('SELECT * FROM accounts WHERE id=?',[identityRow.id]);if(snapshot)previousAccountJson=JSON.stringify(snapshot);}
              if (a.username) {
                const conflict=await txn.getFirstAsync<{id:number}>(
                  'SELECT id FROM accounts WHERE username = ? AND id <> ?',
                  [a.username,identityRow.id],
                );
                if (conflict) throw new DatabaseError('Instagram username already belongs to another account');
              }
              await txn.runAsync(
                'UPDATE accounts SET username=?,instagram_url=?,x_username=?,x_url=?,tiktok_username=?,tiktok_url=?,model_name=?,letter=?,display_name=?,full_name=?,profile_image_url=?,image_url=?,profile_image_uri=COALESCE(?,profile_image_uri),local_image_path=COALESCE(?,local_image_path),source_url=?,source_file_name=?,source_file_type=?,source_mime_type=?,source_row=?,source_import_id=?,raw_data_json=?,updated_at=? WHERE id=?',
                [a.username,a.instagram_url,a.x_username??null,a.x_url??null,a.tiktok_username??null,a.tiktok_url??null,a.model_name??null,a.letter??null,a.display_name??null,a.full_name??null,a.profile_image_url??null,a.image_url??null,a.profile_image_uri??null,a.local_image_path??null,a.source_url??null,a.source_file_name??null,a.source_file_type??null,a.source_mime_type??null,a.source_row??null,a.source_import_id??null,a.raw_data_json??null,a.updated_at??ts,identityRow.id],
              );
              accountId=identityRow.id;
            }
          }

          if (accountId===null && a.username) {
            const existingByUsername=await txn.getFirstAsync<Record<string,unknown>>('SELECT * FROM accounts WHERE username=?',[a.username]);
            if(existingByUsername){const existingId=Number(existingByUsername.id);previousAccountJson=importSnapshots.get(existingId) ?? JSON.stringify(existingByUsername);}
            await txn.runAsync(
              'INSERT INTO accounts(username,instagram_url,x_username,x_url,tiktok_username,tiktok_url,identity_key,model_name,letter,display_name,full_name,profile_image_url,image_url,profile_image_uri,local_image_path,source_url,source_file_name,source_file_type,source_mime_type,source_row,source_import_id,raw_data_json,status,list_id,source,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET instagram_url=excluded.instagram_url,x_username=excluded.x_username,x_url=excluded.x_url,tiktok_username=excluded.tiktok_username,tiktok_url=excluded.tiktok_url,identity_key=COALESCE(excluded.identity_key,accounts.identity_key),model_name=excluded.model_name,letter=excluded.letter,display_name=excluded.display_name,full_name=excluded.full_name,profile_image_url=excluded.profile_image_url,image_url=excluded.image_url,profile_image_uri=COALESCE(excluded.profile_image_uri,accounts.profile_image_uri),local_image_path=COALESCE(excluded.local_image_path,accounts.local_image_path),source_url=excluded.source_url,source_file_name=excluded.source_file_name,source_file_type=excluded.source_file_type,source_mime_type=excluded.source_mime_type,source_row=excluded.source_row,source_import_id=excluded.source_import_id,raw_data_json=excluded.raw_data_json,source=COALESCE(excluded.source,accounts.source),notes=COALESCE(excluded.notes,accounts.notes),updated_at=excluded.updated_at',
              [a.username,a.instagram_url,a.x_username??null,a.x_url??null,a.tiktok_username??null,a.tiktok_url??null,a.identity_key??null,a.model_name??null,a.letter??null,a.display_name??null,a.full_name??null,a.profile_image_url??null,a.image_url??null,a.profile_image_uri??null,a.local_image_path??null,a.source_url??null,a.source_file_name??null,a.source_file_type??null,a.source_mime_type??null,a.source_row??null,a.source_import_id??null,a.raw_data_json??null,'NEW',a.list_id??null,a.source??null,a.notes??null,a.created_at??ts,a.updated_at??ts],
            );
            const row=await txn.getFirstAsync<{id:number}>('SELECT id FROM accounts WHERE username=?',[a.username]);
            accountId=row?.id??null;
            if(accountId!==null&&!existingByUsername)createdByImport=1;
          }

          if (accountId===null) {
            if (!a.identity_key) throw new DatabaseError('Imported record without Instagram needs a model/source identity');
            await txn.runAsync(
              'INSERT INTO accounts(username,instagram_url,x_username,x_url,tiktok_username,tiktok_url,identity_key,model_name,letter,display_name,full_name,profile_image_url,image_url,profile_image_uri,local_image_path,source_url,source_file_name,source_file_type,source_mime_type,source_row,source_import_id,raw_data_json,status,list_id,source,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(identity_key) DO UPDATE SET model_name=excluded.model_name,letter=excluded.letter,display_name=excluded.display_name,full_name=excluded.full_name,profile_image_url=excluded.profile_image_url,image_url=excluded.image_url,x_username=excluded.x_username,x_url=excluded.x_url,tiktok_username=excluded.tiktok_username,tiktok_url=excluded.tiktok_url,source_url=excluded.source_url,source_file_name=excluded.source_file_name,source_file_type=excluded.source_file_type,source_mime_type=excluded.source_mime_type,source_row=excluded.source_row,source_import_id=excluded.source_import_id,raw_data_json=excluded.raw_data_json,notes=COALESCE(excluded.notes,accounts.notes),updated_at=excluded.updated_at',
              [null,null,a.x_username??null,a.x_url??null,a.tiktok_username??null,a.tiktok_url??null,a.identity_key,a.model_name??null,a.letter??null,a.display_name??null,a.full_name??null,a.profile_image_url??null,a.image_url??null,a.profile_image_uri??null,a.local_image_path??null,a.source_url??null,a.source_file_name??null,a.source_file_type??null,a.source_mime_type??null,a.source_row??null,a.source_import_id??null,a.raw_data_json??null,'NEW',a.list_id??null,a.source??null,a.notes??null,a.created_at??ts,a.updated_at??ts],
            );
            const row=await txn.getFirstAsync<{id:number}>('SELECT id FROM accounts WHERE identity_key=?',[a.identity_key]);
            accountId=row?.id??null;
            if(accountId!==null&&!previousAccountJson)createdByImport=1;
          }

          if (accountId===null) throw new DatabaseError('Account was saved but could not be reloaded');
          if (a.username) saved.set(a.username,accountId);
          if (a.identity_key) saved.set(a.identity_key,accountId);
          if (importId) {
            await txn.runAsync('INSERT OR IGNORE INTO app_import_accounts(import_id,account_id,source_row,previous_account_json,created_by_import) VALUES(?,?,?,?,?)',[importId,accountId,a.source_row??null,previousAccountJson,createdByImport]);
            await txn.runAsync('UPDATE app_import_accounts SET source_row=? WHERE import_id=? AND account_id=?',[a.source_row??null,importId,accountId]);
          }
        } catch(error) {
          const detail=error instanceof Error?error.message:String(error);
          throw new DatabaseError('Failed to save account'+(a.username?' @'+a.username:'')+': '+detail,error);
        }
        onProgress?.(i+1,inputs.length);
      }
    });
    return saved;
  });
}
export function updateMetadata(id: number, metadata: AccountMetadataUpdate): Promise<void> { return withDb('Failed to update account metadata', async (db) => { const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM accounts WHERE id = ?', [id]); if (!row) throw new DatabaseError('Account not found'); const sets:string[]=[]; const params:(string|null|number)[]=[]; if ('display_name' in metadata){sets.push('display_name = ?');params.push(metadata.display_name??null);} if ('full_name' in metadata){sets.push('full_name = ?');params.push(metadata.full_name??null);} if ('profile_image_url' in metadata){sets.push('profile_image_url = ?');params.push(metadata.profile_image_url??null);} if ('image_url' in metadata){sets.push('image_url = ?');params.push(metadata.image_url??null);} if ('profile_image_uri' in metadata){sets.push('profile_image_uri = ?');params.push(metadata.profile_image_uri??null);} if ('x_username' in metadata){sets.push('x_username = ?');params.push(metadata.x_username??null);} if ('x_url' in metadata){sets.push('x_url = ?');params.push(metadata.x_url??null);} if ('tiktok_username' in metadata){sets.push('tiktok_username = ?');params.push(metadata.tiktok_username??null);} if ('tiktok_url' in metadata){sets.push('tiktok_url = ?');params.push(metadata.tiktok_url??null);} if(!sets.length)return; sets.push('updated_at = ?');params.push(nowIso());params.push(id); await db.runAsync(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`,params); }); }
export function setStatus(id: number, status: AccountStatus): Promise<AccountStatus> { return withDb('Failed to update status', async (db) => { const result: { previous: AccountStatus | null } = { previous: null }; await db.withTransactionAsync(async () => { const row = await db.getFirstAsync<{ status: AccountStatus }>('SELECT status FROM accounts WHERE id = ?', [id]); if (!row) throw new DatabaseError('Account not found'); result.previous = row.status; if (row.status === status) return; const ts = nowIso(); await db.runAsync('UPDATE accounts SET status = ?, last_processed_at = ?, updated_at = ? WHERE id = ?', [status, ts, ts, id]); await db.runAsync('INSERT INTO status_history (account_id, old_status, new_status, created_at) VALUES (?, ?, ?, ?)', [id, row.status, status, ts]); }); return result.previous as AccountStatus; }); }
export function setNotes(id: number, notes: string): Promise<void> { return withDb('Failed to save notes', async (db) => { await db.runAsync('UPDATE accounts SET notes = ?, updated_at = ? WHERE id = ?', [notes.trim() || null, nowIso(), id]); }); }
export function moveToList(id: number, listId: number | null): Promise<void> { return withDb('Failed to move account', async (db) => db.withTransactionAsync(async () => { const t = nowIso(); await db.runAsync('UPDATE accounts SET list_id = ?, updated_at = ? WHERE id = ?', [listId, t, id]); await db.runAsync('DELETE FROM list_accounts WHERE account_id = ?', [id]); if (listId !== null) await db.runAsync('INSERT OR IGNORE INTO list_accounts(list_id, account_id, created_at) VALUES(?, ?, ?)', [listId, id, t]); })); }
export function getStatusCounts(listId?: number | null): Promise<StatusCounts> { return withDb('Failed to load statistics', async (db) => { const { where, params } = buildWhere(listId === undefined ? {} : { listId }); const rows = await db.getAllAsync<{ status: AccountStatus; n: number }>(`SELECT a.status AS status, COUNT(*) AS n FROM accounts a ${where} GROUP BY a.status`, params); const byStatus = Object.fromEntries(ACCOUNT_STATUSES.map((s) => [s, 0])) as Record<AccountStatus, number>; let total = 0; for (const r of rows) { if (r.status in byStatus) byStatus[r.status] = r.n; total += r.n; } return { total, byStatus }; }); }
export function getFirstId(filters: AccountFilters): Promise<number | null> { return withDb('Failed to load queue', async (db) => { const { where, params } = buildWhere(filters); const row = await db.getFirstAsync<{ id: number }>(`SELECT a.id AS id FROM accounts a ${where} ORDER BY a.id ASC LIMIT 1`, params); return row?.id ?? null; }); }
export function getAdjacentId(filters: AccountFilters, currentId: number, direction: Direction): Promise<number | null> { return withDb('Failed to load queue', async (db) => { const { where, params } = buildWhere(filters); const cmp = direction === 'next' ? '>' : '<'; const order = direction === 'next' ? 'ASC' : 'DESC'; const condition = where ? `${where} AND a.id ${cmp} ?` : `WHERE a.id ${cmp} ?`; const row = await db.getFirstAsync<{ id: number }>(`SELECT a.id AS id FROM accounts a ${condition} ORDER BY a.id ${order} LIMIT 1`, [...params, currentId]); return row?.id ?? null; }); }
export function getPosition(filters: AccountFilters, id: number): Promise<number> { return withDb('Failed to load queue', async (db) => { const { where, params } = buildWhere(filters); const condition = where ? `${where} AND a.id <= ?` : 'WHERE a.id <= ?'; const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM accounts a ${condition}`, [...params, id]); return row?.n ?? 0; }); }
const _contract: AccountRepository = { getById, getPage, count, findExistingUsernames, findUsernameChanges, applyUsernameChanges, getIdsByUsernames, insertMany, updateMetadata, setStatus, setNotes, moveToList, getStatusCounts, getFirstId, getAdjacentId, getPosition };
void _contract;
