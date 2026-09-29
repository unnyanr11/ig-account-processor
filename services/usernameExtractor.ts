import { IGNORED_IG_PATH_SEGMENTS } from '../utils/constants';
import { normalizeUsername } from '../utils/normalization';
import { isValidUsername } from '../utils/validation';

export interface ExtractedEntry {
  raw: string;
  /** Normalized (lowercase) username; may be invalid, see `valid`. */
  username: string;
  valid: boolean;
  reason?: string;
}

const IGNORED = new Set(IGNORED_IG_PATH_SEGMENTS);

// Column headers that must not be imported as usernames.
const HEADER_WORDS = new Set([
  'username', 'usernames', 'user', 'handle', 'instagram', 'insta', 'ig',
  'profile', 'link', 'url', 'account', 'name',
]);

// instagram.com/<segment>, with optional scheme, www./m. and the /_u/ deep-link form.
const IG_URL = /(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/(?:_u\/)?([^\s\/?#&"'<>()]+)\S*/gi;
const OTHER_URL = /(?:https?:\/\/|www\.)\S+/gi;
// @name not preceded by a word character, so emails like a@b.com are ignored.
const MENTION = /(^|[^A-Za-z0-9._@])@([^\s@,;|()<>"'!?/]+)/g;
const BARE = /^[A-Za-z0-9._]+$/;
const DELIMITERS = /[,;\t|]/;

function makeEntry(raw: string): ExtractedEntry {
  const username = normalizeUsername(raw.replace(/\.+$/, ''));
  const result = isValidUsername(username);
  return { raw, username, valid: result.valid, reason: result.reason };
}

/**
 * Extracts usernames from one line or spreadsheet cell.
 * Priority: Instagram profile URLs, then @mentions, then (only if neither is present)
 * bare tokens. Free text around a URL or @mention is never treated as a username.
 */
export function extractFromLine(line: string): ExtractedEntry[] {
  const text = line.trim();
  if (!text) return [];

  const found: ExtractedEntry[] = [];
  let sawInstagramUrl = false;

  for (const match of text.matchAll(IG_URL)) {
    sawInstagramUrl = true;
    const segment = match[1];
    if (IGNORED.has(segment.toLowerCase())) continue;
    found.push(makeEntry(segment));
  }

  const rest = text.replace(IG_URL, ' ').replace(OTHER_URL, ' ');
  for (const match of rest.matchAll(MENTION)) {
    found.push(makeEntry(match[2]));
  }
  if (found.length > 0 || sawInstagramUrl) return found;

  for (const part of text.split(DELIMITERS)) {
    const token = part.trim().replace(/^["']+|["']+$/g, '');
    if (!BARE.test(token)) continue;
    // Needs a letter (skips counts like 1200) and must not be a header or a bare domain.
    if (!/[A-Za-z]/.test(token) || HEADER_WORDS.has(token.toLowerCase()) || /instagram\.com/i.test(token)) continue;
    found.push(makeEntry(token));
  }
  return found;
}

export function extractFromText(text: string): ExtractedEntry[] {
  const entries: ExtractedEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    entries.push(...extractFromLine(line));
  }
  return entries;
}
