import * as accountsSqlite from './accounts';
import * as historySqlite from './history';
import * as listsSqlite from './lists';
import type { AccountRepository, HistoryRepository, ListRepository } from './interfaces';

/**
 * The only place implementations are chosen. To add Supabase sync later, wrap these
 * objects (SQLite first, then queue remote writes) without touching any screen.
 */
export const accountRepository: AccountRepository = accountsSqlite;
export const listRepository: ListRepository = listsSqlite;
export const historyRepository: HistoryRepository = historySqlite;

export { DatabaseError, getDb, closeDb } from './database';
export type { AccountFilters, NewAccountInput, StatusCounts, Direction } from './interfaces';
