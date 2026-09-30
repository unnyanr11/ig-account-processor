import type { ParsedRow } from './fileParser';

const NAME_KEYS = ['name', 'fullName', 'full_name', 'displayName', 'display_name'];
const USERNAME_KEYS = ['username', 'userName', 'user_name', 'handle', 'screen_name', 'instagram', 'profile', 'url', 'link'];
const IMAGE_KEYS = ['profilePictureUrl', 'profileImageUrl', 'imageUrl', 'profile_pic_url', 'profile_image_url', 'avatar', 'picture', 'image', 'photo'];

const cache = new Map<string, string | null>();

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

export async function fetchProfileImage(row: ParsedRow): Promise<string | null> {
  const embedded = getEmbeddedImageUrl(row);
  if (embedded) return embedded;

  const username = getAccountUsername(row);
  if (!username) return null;
  if (cache.has(username)) return cache.get(username) ?? null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' },
    });
    if (!response.ok) {
      cache.set(username, null);
      return null;
    }
    const html = await response.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const imageUrl = match ? decodeHtml(match[1]) : null;
    cache.set(username, imageUrl);
    return imageUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
