import { parseFile, type ParsedRow } from './fileParser';

export type ImportRecord = {
  username: string;
  displayName: string | null;
  fullName: string | null;
  imageUrl: string | null;
  profileImageUri: string | null;
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

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const first = (row: ParsedRow, keys: string[]): string => { for (const key of keys) { const value = text(row[key]); if (value) return value; } return ''; };

function usernameFromRow(row: ParsedRow): string {
  const value = first(row, ['username', 'userName', 'user_name', 'handle', 'screen_name', 'instagram', 'profile', 'url', 'link']);
  const match = value.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  return (match ? match[1] : value).replace(/^@/, '').replace(/\/$/, '').trim().toLowerCase();
}

export function parseImportFile(content: string, fileName: string): ParsedRow[] { return parseFile(content, fileName); }

export async function analyzeImport(content: string, fileName: string, findExisting: (usernames: string[]) => Promise<Set<string>>): Promise<ImportAnalysis> {
  const rows = parseImportFile(content, fileName);
  const records: ImportRecord[] = rows.map((row) => {
    const username = usernameFromRow(row);
    const displayName = first(row, ['displayName', 'display_name', 'name']) || null;
    const fullName = first(row, ['fullName', 'full_name']) || displayName;
    const imageUrl = first(row, ['profilePictureUrl', 'profileImageUrl', 'imageUrl', 'profile_pic_url', 'profile_image_url', 'avatar', 'picture', 'image', 'photo']) || null;
    const profileImageUri = first(row, ['profileImageUri', 'profile_image_uri']) || null;
    return { username, displayName, fullName, imageUrl, profileImageUri, instagramUrl: username ? `https://instagram.com/${username}` : '', raw: row };
  });
  const validRecords = records.filter((record) => /^[a-z0-9._]{1,30}$/.test(record.username));
  const invalid = records.length - validRecords.length;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const record of validRecords) { if (seen.has(record.username)) duplicates += 1; else seen.add(record.username); }
  const unique = validRecords.filter((record, index) => validRecords.findIndex((item) => item.username === record.username) === index);
  const existing = await findExisting(unique.map((record) => record.username));
  return { records, validRecords: unique, total: records.length, newRecords: unique.filter((record) => !existing.has(record.username)).length, existingRecords: existing.size, duplicates, invalid };
}
