import { accountRepository, historyRepository, type NewAccountInput } from '../database';
import { buildInstagramUrl } from '../utils/normalization';
import type { ExtractedEntry } from './usernameExtractor';

export interface ImportSummary {
  source: string;
  totalDetected: number;
  newCount: number;
  alreadyInDbCount: number;
  duplicatesInFileCount: number;
  invalidCount: number;
  /** First few new usernames for the preview list. */
  sample: string[];
}

export interface ImportPlan {
  summary: ImportSummary;
  newUsernames: string[];
  existingUsernames: string[];
}

const SAMPLE_SIZE = 20;

/** Classifies every detected entry without writing anything to the database. */
export async function buildImportPlan(source: string, entries: ExtractedEntry[]): Promise<ImportPlan> {
  const seen = new Set<string>();
  const unique: string[] = [];
  let invalidCount = 0;
  let duplicatesInFileCount = 0;

  for (const entry of entries) {
    if (!entry.valid) {
      invalidCount++;
    } else if (seen.has(entry.username)) {
      duplicatesInFileCount++;
    } else {
      seen.add(entry.username);
      unique.push(entry.username);
    }
  }

  const existing = await accountRepository.findExistingUsernames(unique);
  const newUsernames: string[] = [];
  const existingUsernames: string[] = [];
  for (const username of unique) {
    (existing.has(username) ? existingUsernames : newUsernames).push(username);
  }

  return {
    summary: {
      source,
      totalDetected: entries.length,
      newCount: newUsernames.length,
      alreadyInDbCount: existingUsernames.length,
      duplicatesInFileCount,
      invalidCount,
      sample: newUsernames.slice(0, SAMPLE_SIZE),
    },
    newUsernames,
    existingUsernames,
  };
}

export interface CommitOptions {
  listId?: number | null;
  onProgress?: (done: number, total: number) => void;
}

export interface CommitResult {
  insertedCount: number;
  batchId: number;
}

/**
 * Inserts the new accounts, then records the import and links every account found in the
 * file (new and already-existing) to it, so "which accounts came from this file?" works.
 * Existing accounts keep their original source and status.
 */
export async function commitImport(plan: ImportPlan, options: CommitOptions = {}): Promise<CommitResult> {
  const inputs: NewAccountInput[] = plan.newUsernames.map((username) => ({
    username,
    instagram_url: buildInstagramUrl(username),
    source: plan.summary.source,
    list_id: options.listId ?? null,
  }));

  const inserted = await accountRepository.insertMany(inputs, options.onProgress);
  const existingIds = await accountRepository.getIdsByUsernames(plan.existingUsernames);

  const batchId = await historyRepository.createImportBatch(plan.summary.source, {
    total: plan.summary.totalDetected,
    newRecords: inserted.size,
    duplicates: plan.summary.duplicatesInFileCount + plan.summary.alreadyInDbCount,
    invalid: plan.summary.invalidCount,
  });
  await historyRepository.linkAccountsToBatch(batchId, [...inserted.values(), ...existingIds]);

  return { insertedCount: inserted.size, batchId };
}
