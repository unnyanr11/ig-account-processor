import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { dumpAll, replaceAll } from '../database/backup';
import { AccountStatus, ACCOUNT_STATUSES } from '../types/account';
import type { BackupData, BackupFile } from '../types/backup';
import { buildInstagramUrl } from '../utils/normalization';
import { isValidUsername } from '../utils/validation';
import { AppError } from './errors';

export class BackupError extends AppError {}

const APP_ID = 'ig-account-processor';
const FORMAT = 1;
const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

export interface BackupSummary {
  accounts: number;
  lists: number;
  imports: number;
  exportedAt: string;
}

export interface LoadedBackup {
  fileName: string;
  data: BackupData;
  summary: BackupSummary;
}

const INVALID_MESSAGE = 'This file is not a valid backup, or it is damaged. Your current data has not been changed.';
const invalid = () => new BackupError('Invalid backup', INVALID_MESSAGE);

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid();
  return value as Rec;
}
function arr(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw invalid();
  return value;
}
function int(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw invalid();
  return value;
}
function id(value: unknown): number {
  const n = int(value);
  if (n === 0) throw invalid();
  return n;
}
function text(value: unknown, max = 5000): string {
  if (typeof value !== 'string' || value.length > max) throw invalid();
  return value;
}
function textOrNull(value: unknown, max = 5000): string | null {
  return value === null || value === undefined ? null : text(value, max);
}

/**
 * Validates the whole file before anything touches the database: structure, types, allowed
 * statuses, username format, uniqueness and every cross-reference between tables.
 */
export function parseBackup(raw: string): { data: BackupData; exportedAt: string } {
  let root: Rec;
  try {
    root = rec(JSON.parse(raw));
  } catch {
    throw invalid();
  }
  if (root.app !== APP_ID || root.format !== FORMAT) {
    throw new BackupError('Unsupported backup', 'This backup was made by a different or newer version of the app and cannot be restored.');
  }
  const source = rec(root.data);

  const listIds = new Set<number>();
  const lists = arr(source.lists).map((item) => {
    const r = rec(item);
    const listId = id(r.id);
    if (listIds.has(listId)) throw invalid();
    listIds.add(listId);
    return { id: listId, name: text(r.name, 200), created_at: text(r.created_at, 40), updated_at: text(r.updated_at, 40) };
  });

  const accountIds = new Set<number>();
  const usernames = new Set<string>();
  const accounts = arr(source.accounts).map((item) => {
    const r = rec(item);
    const accountId = id(r.id);
    const username = text(r.username, 30);
    const status = text(r.status, 40);
    const listId = r.list_id === null || r.list_id === undefined ? null : id(r.list_id);
    if (accountIds.has(accountId) || usernames.has(username)) throw invalid();
    if (username !== username.toLowerCase() || !isValidUsername(username).valid) throw invalid();
    if (!ACCOUNT_STATUSES.includes(status as AccountStatus)) throw invalid();
    if (listId !== null && !listIds.has(listId)) throw invalid();
    accountIds.add(accountId);
    usernames.add(username);
    return {
      id: accountId,
      username,
      instagram_url: buildInstagramUrl(username),
      status,
      list_id: listId,
      source: textOrNull(r.source, 500),
      notes: textOrNull(r.notes, 20000),
      created_at: text(r.created_at, 40),
      updated_at: text(r.updated_at, 40),
    };
  });

  const historyIds = new Set<number>();
  const status_history = arr(source.status_history).map((item) => {
    const r = rec(item);
    const historyId = id(r.id);
    const accountId = id(r.account_id);
    if (historyIds.has(historyId) || !accountIds.has(accountId)) throw invalid();
    historyIds.add(historyId);
    return { id: historyId, account_id: accountId, old_status: textOrNull(r.old_status, 40), new_status: text(r.new_status, 40), created_at: text(r.created_at, 40) };
  });

  const batchIds = new Set<number>();
  const import_batches = arr(source.import_batches).map((item) => {
    const r = rec(item);
    const batchId = id(r.id);
    if (batchIds.has(batchId)) throw invalid();
    batchIds.add(batchId);
    return {
      id: batchId,
      file_name: text(r.file_name, 500),
      total_records: int(r.total_records),
      new_records: int(r.new_records),
      duplicate_records: int(r.duplicate_records),
      invalid_records: int(r.invalid_records),
      created_at: text(r.created_at, 40),
    };
  });

  const linkKeys = new Set<string>();
  const import_batch_accounts = arr(source.import_batch_accounts).map((item) => {
    const r = rec(item);
    const batchId = id(r.import_batch_id);
    const accountId = id(r.account_id);
    const key = `${batchId}:${accountId}`;
    if (linkKeys.has(key) || !batchIds.has(batchId) || !accountIds.has(accountId)) throw invalid();
    linkKeys.add(key);
    return { import_batch_id: batchId, account_id: accountId };
  });

  return {
    data: { lists, accounts, status_history, import_batches, import_batch_accounts },
    exportedAt: typeof root.exported_at === 'string' ? root.exported_at : '',
  };
}

export async function createBackup(): Promise<BackupSummary> {
  try {
    const data = await dumpAll();
    const exportedAt = new Date().toISOString();
    const file: BackupFile = { app: APP_ID, format: FORMAT, exported_at: exportedAt, data };

    const directory = FileSystem.cacheDirectory;
    if (!directory) throw new BackupError('No cache directory', 'The backup could not be saved on this device.');
    const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
    const uri = `${directory}ig-processor-backup-${stamp}.json`;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(file));

    if (!(await Sharing.isAvailableAsync())) {
      throw new BackupError('Sharing unavailable', 'Sharing is not available on this device, so the backup could not be saved.');
    }
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save backup' });
    return { accounts: data.accounts.length, lists: data.lists.length, imports: data.import_batches.length, exportedAt };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new BackupError(String(error), 'The backup could not be created. Please try again.');
  }
}

/** Lets the user choose a backup file and validates it fully. Returns null if they cancel. */
export async function pickBackup(): Promise<LoadedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  try {
    const info = await FileSystem.getInfoAsync(asset.uri);
    if (!info.exists || info.size === 0) throw new BackupError('Empty backup', 'This backup file is empty. Your current data has not been changed.');
    if (info.size > MAX_BACKUP_BYTES) throw new BackupError('Backup too large', 'This file is too large to be a backup from this app.');
    const parsed = parseBackup(await FileSystem.readAsStringAsync(asset.uri));
    return {
      fileName: asset.name,
      data: parsed.data,
      summary: {
        accounts: parsed.data.accounts.length,
        lists: parsed.data.lists.length,
        imports: parsed.data.import_batches.length,
        exportedAt: parsed.exportedAt,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new BackupError(String(error), 'This file could not be read. Your current data has not been changed.');
  }
}

export async function restoreBackup(backup: LoadedBackup): Promise<void> {
  try {
    await replaceAll(backup.data);
  } catch (error) {
    throw new BackupError(String(error), 'The backup could not be restored. Your current data has not been changed.');
  }
}
