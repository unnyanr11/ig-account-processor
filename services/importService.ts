import { parseFile, type ParsedRow } from './fileParser.ts';

export type ImportRecord = {
  username: string;
  displayName: string | null;
  imageUrl: string | null;
  instagramUrl: string;
  raw: ParsedRow;
};

export type ImportAnalysis = {
  records: ImportRecord[];
  validRecords: ImportRecord[];
  total: number;
  newRecords: number;
  existingRecords: number;
  duplicates: number;
  invalid: number;
};

// Backward-compatible summary type used by the existing ImportPreview component.
export type ImportSummary = {
  names: string[];
  total: number;
};

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value).trim() : '';
const first = (row: ParsedRow, keys: string[]): string => { for (const key of keys) { const value = text(row[key]); if (value) return value; } return ''; };
const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;
const USERNAME_KEYS = ['username', 'usernames', 'handle', 'screenname', 'user', 'instagram', 'url', 'link', 'profile', 'profileurl', 'instagramurl'];

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeUsername(candidate: string): string {
  let value = candidate.trim();
  if (!value) return '';
  const instagramMatch = value.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  if (instagramMatch?.[1]) value = instagramMatch[1];
  value = value.replace(/^@+/, '').replace(/[/?#].*$/, '').replace(/\/+$/, '').trim();
  return value.toLowerCase();
}

function usernamesFromText(value: string): string[] {
  const content = value.trim();
  if (!content) return [];
  const instagramMatches = [...content.matchAll(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/gi)].map((match) => normalizeUsername(match[1]));
  if (instagramMatches.length) return instagramMatches.filter(Boolean);

  const atMatches = [...content.matchAll(/@([A-Za-z0-9._]{1,30})/g)].map((match) => normalizeUsername(match[1]));
  if (atMatches.length) return atMatches.filter(Boolean);

  return content
    .split(/[,\n;\t]+/)
    .map((item) => normalizeUsername(item))
    .filter(Boolean);
}

function usernamesFromValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => usernamesFromValue(item));
  const raw = text(value);
  return raw ? usernamesFromText(raw) : [];
}

function usernameCandidatesFromRow(row: ParsedRow): string[] {
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) normalized.set(normalizeKey(key), value);

  const candidates = USERNAME_KEYS.flatMap((key) => usernamesFromValue(normalized.get(key)));
  if (candidates.length) return Array.from(new Set(candidates));

  const fallback = Object.values(row).flatMap((value) => usernamesFromValue(value));
  return fallback.length ? fallback : [''];
}

export function parseImportFile(content: string, fileName: string): ParsedRow[] { return parseFile(content, fileName); }

export async function analyzeImport(content: string, fileName: string, findExisting: (usernames: string[]) => Promise<Set<string>>): Promise<ImportAnalysis> {
  const rows = parseImportFile(content, fileName);
  const records: ImportRecord[] = rows.flatMap((row) => {
    const displayName = first(row, ['name', 'fullName', 'full_name', 'displayName', 'display_name']) || null;
    const imageUrl = first(row, ['profilePictureUrl', 'profileImageUrl', 'imageUrl', 'profile_pic_url', 'profile_image_url', 'avatar', 'picture', 'image', 'photo']) || null;
    return usernameCandidatesFromRow(row).map((username) => ({ username, displayName, imageUrl, instagramUrl: username ? `https://instagram.com/${username}` : '', raw: row }));
  });
  const validRecords = records.filter((record) => USERNAME_PATTERN.test(record.username));
  const invalid = records.length - validRecords.length;
  const seen = new Set<string>();
  let duplicates = 0;
  const unique: ImportRecord[] = [];
  for (const record of validRecords) {
    if (seen.has(record.username)) duplicates += 1;
    else {
      seen.add(record.username);
      unique.push(record);
    }
  }
  const existing = await findExisting(unique.map((record) => record.username));
  return { records, validRecords: unique, total: records.length, newRecords: unique.filter((record) => !existing.has(record.username)).length, existingRecords: existing.size, duplicates, invalid };
}
