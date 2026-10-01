import * as FileSystem from 'expo-file-system/legacy';
import { withDb } from '../database/database';
import { isPlaceholderImage, nowIso } from '../utils/normalization';
import { IMAGE_DOWNLOAD_CONCURRENCY } from '../utils/constants';

export interface ImageProgress {
  done: number;
  total: number;
  successful: number;
  failed: number;
  skipped: number;
}

function safeUrl(u: string | null) {
  return !!u && /^https?:\/\//i.test(u) && !isPlaceholderImage(u);
}

function fileName(id: number, url: string) {
  const ext = (url.match(/\.(jpe?g|png|webp|gif)(?:[?#]|$)/i)?.[1] || 'jpg').toLowerCase();
  return `account_${id}_${Math.abs(hash(url))}.${ext}`;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function isPlaceholder(url: string | null) {
  return isPlaceholderImage(url);
}

export async function downloadImage(accountId: number, url: string | null): Promise<string | null> {
  if (!safeUrl(url)) return null;
  const root = FileSystem.documentDirectory;
  if (!root) return null;
  const dir = `${root}images/accounts/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const target = dir + fileName(accountId, url!);

  try {
    const info = await FileSystem.getInfoAsync(target);
    const uri = info.exists ? target : (await FileSystem.downloadAsync(url!, target)).uri || null;
    if (!uri) return null;

    await withDb('Failed to save downloaded image', async (db) => {
      const ts = nowIso();
      await db.runAsync(
        'UPDATE accounts SET local_image_path = ?, profile_image_uri = ?, updated_at = ? WHERE id = ?',
        [uri, uri, ts, accountId],
      );
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM account_images WHERE account_id = ? AND remote_url = ? LIMIT 1',
        [accountId, url!],
      );
      if (existing) {
        await db.runAsync(
          'UPDATE account_images SET local_path = ?, download_status = ?, downloaded_at = ?, updated_at = ? WHERE id = ?',
          [uri, 'DOWNLOADED', ts, ts, existing.id],
        );
      } else {
        await db.runAsync(
          'INSERT INTO account_images(account_id,remote_url,local_path,is_primary,image_type,download_status,downloaded_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
          [accountId, url!, uri, 1, 'profile', 'DOWNLOADED', ts, ts, ts],
        );
      }
    });

    return uri;
  } catch {
    return null;
  }
}

export async function queueImageDownloads(
  items: { accountId: number; url: string | null }[],
  onProgress?: (p: ImageProgress) => void,
) {
  const p: ImageProgress = { done: 0, total: items.length, successful: 0, failed: 0, skipped: 0 };
  let next = 0;

  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      const item = items[i];

      if (!safeUrl(item.url)) {
        p.skipped++;
        p.done++;
        onProgress?.({ ...p });
        continue;
      }

      const uri = await downloadImage(item.accountId, item.url);
      if (uri) p.successful++;
      else p.failed++;
      p.done++;
      onProgress?.({ ...p });
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(IMAGE_DOWNLOAD_CONCURRENCY, Math.max(1, items.length)) },
      worker,
    ),
  );

  return p;
}


export async function saveImageToDeviceStorage(
  accountId: number,
  remoteUrl: string | null,
  existingLocalPath?: string | null,
): Promise<string | null> {
  const source = existingLocalPath || (remoteUrl ? await downloadImage(accountId, remoteUrl) : null);
  if (!source) return null;

  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
    FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download'),
  );
  if (!permissions.granted) return null;

  const ext = (remoteUrl?.match(/\.(jpe?g|png|webp|gif)(?:[?#]|$)/i)?.[1] || 'jpg').toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
  const fileName = `Instagram_${accountId}_${Date.now()}.${ext}`;
  const target = await FileSystem.StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    fileName,
    mime,
  );
  const base64 = await FileSystem.readAsStringAsync(source, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.writeAsStringAsync(target, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return target;
}

export async function saveImageRecord(accountId: number, remoteUrl: string | null, localPath: string | null) {
  if (!remoteUrl && !localPath) return;

  await withDb('Failed to save image', async (db) => {
    const t = nowIso();
    await db.runAsync(
      'INSERT INTO account_images(account_id,remote_url,local_path,is_primary,image_type,download_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
      [accountId, remoteUrl, localPath, 1, 'profile', localPath ? 'DOWNLOADED' : 'NOT_DOWNLOADED', t, t],
    );
  });
}

export async function deleteLocalImage(localPath: string | null) {
  if (!localPath) return;
  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) await FileSystem.deleteAsync(localPath, { idempotent: true });
  } catch {}
}
