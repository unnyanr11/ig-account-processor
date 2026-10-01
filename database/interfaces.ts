import type { Account, AccountStatus, AccountWithList } from '../types/account';
import type { ImportBatch, StatusHistoryEntry } from '../types/history';
import type { List, ListWithStats } from '../types/list';

export interface AccountFilters { status?: AccountStatus; listId?: number | null; importBatchId?: number; importId?: number; search?: string; importedToday?: boolean; updatedToday?: boolean; neverProcessed?: boolean; }
export interface UsernameChangeCandidate { username:string; model_name?:string|null; letter?:string|null; source_url?:string|null; profile_image_url?:string|null; }
export interface UsernameChangeMatch { account_id:number; old_username:string; new_username:string; }
export interface NewAccountInput {
  username: string | null;
  instagram_url: string | null;
  x_username?: string | null;
  x_url?: string | null;
  identity_key?: string | null;
  model_name?: string | null;
  letter?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  profile_image_url?: string | null;
  image_url?: string | null;
  profile_image_uri?: string | null;
  local_image_path?: string | null;
  source_url?: string | null;
  source_file_name?: string | null;
  source_file_type?: string | null;
  source_mime_type?: string | null;
  source_row?: number | null;
  source_import_id?: number | null;
  source?: string | null;
  list_id?: number | null;
  notes?: string | null;
  raw_data_json?: string | null;
  created_at?: string;
  updated_at?: string;
}
export interface AccountMetadataUpdate { x_username?: string | null; x_url?: string | null; display_name?: string | null; full_name?: string | null; profile_image_url?: string | null; image_url?: string | null; profile_image_uri?: string | null; }
export interface StatusCounts { total: number; byStatus: Record<AccountStatus, number>; }
export type Direction = 'next' | 'prev';
export interface AccountRepository {
  getById(id:number):Promise<AccountWithList|null>;
  getPage(f:AccountFilters,l:number,o:number):Promise<AccountWithList[]>;
  count(f:AccountFilters):Promise<number>;
  findExistingUsernames(u:string[]):Promise<Set<string>>;
  findUsernameChanges(candidates:UsernameChangeCandidate[]):Promise<UsernameChangeMatch[]>;
  applyUsernameChanges(changes:UsernameChangeMatch[],importId:number|null):Promise<void>;
  getIdsByUsernames(u:string[]):Promise<number[]>;
  insertMany(i:NewAccountInput[],p?:(n:number,t:number)=>void,importId?:number|null,usernameChanges?:UsernameChangeMatch[]):Promise<Map<string,number>>;
  updateMetadata(id:number,m:AccountMetadataUpdate):Promise<void>;
  setStatus(id:number,s:AccountStatus):Promise<AccountStatus>;
  setNotes(id:number,n:string):Promise<void>;
  moveToList(id:number,listId:number|null):Promise<void>;
  getStatusCounts(listId?:number|null):Promise<StatusCounts>;
  getFirstId(f:AccountFilters):Promise<number|null>;
  getAdjacentId(f:AccountFilters,id:number,d:Direction):Promise<number|null>;
  getPosition(f:AccountFilters,id:number):Promise<number>;
}
export interface ListRepository { create(n:string):Promise<number>; rename(id:number,n:string):Promise<void>; remove(id:number,deleteAccounts:boolean):Promise<void>; getAll():Promise<List[]>; getById(id:number):Promise<List|null>; getAllWithStats():Promise<ListWithStats[]>; }
export interface HistoryRepository { getForAccount(id:number):Promise<StatusHistoryEntry[]>; getUsernameHistory(id:number):Promise<Array<{id:number;account_id:number;old_username:string;new_username:string;import_id:number|null;changed_at:string}>>; createImportBatch(fileName:string,totals:any):Promise<number>; linkAccountsToBatch(batchId:number,ids:number[]):Promise<void>; getImportBatches():Promise<ImportBatch[]>; getImportBatch(id:number):Promise<ImportBatch|null>; }
