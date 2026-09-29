import { Account, AccountStatus, AccountWithList } from '../types/account';
import { ImportBatch, StatusHistoryEntry } from '../types/history';
import { List, ListWithStats } from '../types/list';

/**
 * Repository contracts. Screens and services depend on these, never on SQL.
 * A future sync layer can implement the same interfaces (SQLite + Supabase).
 */

export interface AccountFilters {
  status?: AccountStatus;
  /** number = that list, null = accounts without a list, undefined = any */
  listId?: number | null;
  importBatchId?: number;
  search?: string;
  importedToday?: boolean;
  updatedToday?: boolean;
}

export interface NewAccountInput {
  username: string;
  instagram_url: string;
  source: string | null;
  list_id: number | null;
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
  /** Updates status and writes a history row atomically. Returns the previous status. */
  setStatus(id: number, status: AccountStatus): Promise<AccountStatus>;
  setNotes(id: number, notes: string): Promise<void>;
  moveToList(id: number, listId: number | null): Promise<void>;
  getStatusCounts(listId?: number | null): Promise<StatusCounts>;
  getFirstId(filters: AccountFilters): Promise<number | null>;
  getAdjacentId(filters: AccountFilters, currentId: number, direction: Direction): Promise<number | null>;
  /** 1-based position of the account within the filtered set. */
  getPosition(filters: AccountFilters, id: number): Promise<number>;
}

export interface ListRepository {
  create(name: string): Promise<number>;
  rename(id: number, name: string): Promise<void>;
  /** Accounts are kept (unassigned) unless deleteAccounts is true. */
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
