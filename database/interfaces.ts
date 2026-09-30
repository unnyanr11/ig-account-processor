import { Account, AccountStatus, AccountWithList } from '../types/account';
import { ImportBatch, StatusHistoryEntry } from '../types/history';
import { List, ListWithStats } from '../types/list';

export interface AccountFilters {
  status?: AccountStatus;
  listId?: number | null;
  importBatchId?: number;
  search?: string;
  importedToday?: boolean;
  updatedToday?: boolean;
}

export interface NewAccountInput {
  username: string;
  instagram_url: string;
  display_name?: string | null;
  full_name?: string | null;
  image_url?: string | null;
  profile_image_uri?: string | null;
  source: string | null;
  list_id: number | null;
}

export interface AccountMetadataUpdate {
  display_name?: string | null;
  full_name?: string | null;
  image_url?: string | null;
  profile_image_uri?: string | null;
}

export interface StatusCounts {
  total: number;
  byStatus: Record<AccountStatus, number>;
}

export type Direction = 'next' | 'prev';

export interface AccountRepository {
  getById(id: number): Promise<AccountWithList | null>;
  getPage(filters: AccountFilters, limit: number, offset: number): Promise<AccountWithList[]>;
  count(filters: AccountFilters): Promise<number>;
  findExistingUsernames(usernames: string[]): Promise<Set<string>>;
  getIdsByUsernames(usernames: string[]): Promise<number[]>;
  insertMany(inputs: NewAccountInput[], onProgress?: (done: number, total: number) => void): Promise<Map<string, number>>;
  updateMetadata(id: number, metadata: AccountMetadataUpdate): Promise<void>;
  setStatus(id: number, status: AccountStatus): Promise<AccountStatus>;
  setNotes(id: number, notes: string): Promise<void>;
  moveToList(id: number, listId: number | null): Promise<void>;
  getStatusCounts(listId?: number | null): Promise<StatusCounts>;
  getFirstId(filters: AccountFilters): Promise<number | null>;
  getAdjacentId(filters: AccountFilters, currentId: number, direction: Direction): Promise<number | null>;
  getPosition(filters: AccountFilters, id: number): Promise<number>;
}

export interface ListRepository {
  create(name: string): Promise<number>;
  rename(id: number, name: string): Promise<void>;
  remove(id: number, deleteAccounts: boolean): Promise<void>;
  getAll(): Promise<List[]>;
  getById(id: number): Promise<List | null>;
  getAllWithStats(): Promise<ListWithStats[]>;
}

export interface HistoryRepository {
  getForAccount(accountId: number): Promise<StatusHistoryEntry[]>;
  createImportBatch(fileName: string, totals: { total: number; newRecords: number; duplicates: number; invalid: number }): Promise<number>;
  linkAccountsToBatch(batchId: number, accountIds: number[]): Promise<void>;
  getImportBatches(): Promise<ImportBatch[]>;
  getImportBatch(id: number): Promise<ImportBatch | null>;
}

export type { Account };
