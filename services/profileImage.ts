import type { ParsedRow } from './fileParser';
import * as FileSystem from 'expo-file-system/legacy';

const NAME_KEYS = ['name', 'fullName', 'full_name', 'displayName', 'display_name'];
const USERNAME_KEYS = ['username', 'userName', 'user_name', 'handle', 'screen_name', 'instagram', 'profile', 'url', 'link'];
const IMAGE_KEYS = ['profilePictureUrl', 'profileImageUrl', 'imageUrl', 'profile_pic_url', 'profile_image_url', 'avatar', 'picture', 'image', 'photo'];

export interface ProfileMetadata {
  displayName: string | null;
  fullName: string | null;
  imageUrl: string | null;
  profileImageUri: string | null;
}

const cache = new Map<string, ProfileMetadata>();

function firstString(row: ParsedRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function getAccountName(row: ParsedRow): string {
  return firstString(row, NAME_KEYS);
}

export function getAccountUsername(row: ParsedRow): string {
  const raw = firstString(row, USERNAME_KEYS);
  if (!raw) return '';
  const fromUrl = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const candidate = (fromUrl ? fromUrl[1] : raw).replace(/^@/, '').replace(/\/$/, '').trim();
  return /^[A-Za-z0-9._]{1,30}$/.test(candidate) ? candidate : '';
}

export function getEmbeddedImageUrl(row: ParsedRow): string {
  const value = firstString(row, IMAGE_KEYS);
  return /^https?:\/\//i.test(value) ? value : '';
}

function decodeHtml(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'");
}

function parseMetaTag(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byPropertyFirst = html.match(new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'));
  const byContentFirst = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, 'i'));
  const value = byPropertyFirst?.[1] ?? byContentFirst?.[1];
  return value ? decodeHtml(value) : null;
}

function parseDisplayName(ogTitle: string | null, username: string): string | null {
  if (!ogTitle) return null;
  const trimmed = ogTitle.trim();
  const marker = `(@${username.toLowerCase()})`;
  const lower = trimmed.toLowerCase();
  const markerIndex = lower.indexOf(marker);
  if (markerIndex <= 0) return null;
  const name = trimmed.slice(0, markerIndex).trim().replace(/\s+•\s*$/u, '');
  return name || null;
}

function parseFullName(html: string): string | null {
  const match = html.match(/"full_name"\s*:\s*"((?:\\.|[^"])*)"/i);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return null;
  }
}

function cachePathForUsername(username: string): string | null {
  const root = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!root) return null;
  const safe = username.replace(/[^a-z0-9._-]/gi, '_');
  return `${root}profile-images/${safe}.jpg`;
}

async function ensureLocalImage(username: string, imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  const target = cachePathForUsername(username);
  if (!target) return null;
  try {
    const dir = target.slice(0, target.lastIndexOf('/') + 1);
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const info = await FileSystem.getInfoAsync(target);
    if (info.exists) return target;
    const result = await FileSystem.downloadAsync(imageUrl, target);
    return result.uri || null;
  } catch {
    return null;
  }
}

export async function fetchProfileMetadata(row: ParsedRow): Promise<ProfileMetadata> {
  const embeddedImage = getEmbeddedImageUrl(row);
  const username = getAccountUsername(row);
  const initialName = getAccountName(row) || null;
  if (!username) return { displayName: initialName, fullName: initialName, imageUrl: embeddedImage || null, profileImageUri: null };
  if (cache.has(username)) return cache.get(username) as ProfileMetadata;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' },
    });
    if (!response.ok) {
      const fallback = { displayName: initialName, fullName: initialName, imageUrl: embeddedImage || null, profileImageUri: await ensureLocalImage(username, embeddedImage || null) };
      cache.set(username, fallback);
      return fallback;
    }
    const html = await response.text();
    const fetchedImage = parseMetaTag(html, 'og:image');
    const imageUrl = fetchedImage || embeddedImage || null;
    const displayName = parseDisplayName(parseMetaTag(html, 'og:title'), username) || initialName;
    const fullName = parseFullName(html) || displayName;
    const profileImageUri = await ensureLocalImage(username, imageUrl);
    const metadata = { displayName, fullName, imageUrl, profileImageUri };
    cache.set(username, metadata);
    return metadata;
  } catch {
    const fallback = { displayName: initialName, fullName: initialName, imageUrl: embeddedImage || null, profileImageUri: await ensureLocalImage(username, embeddedImage || null) };
    cache.set(username, fallback);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchProfileImage(row: ParsedRow): Promise<string | null> {
  return (await fetchProfileMetadata(row)).imageUrl;
}
