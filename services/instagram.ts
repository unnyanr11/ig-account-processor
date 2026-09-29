import * as Linking from 'expo-linking';
import { buildInstagramUrl } from '../utils/normalization';

/**
 * The only Instagram interaction in the app: opening a profile link.
 * No login, no scraping, no automated actions. The user acts manually inside Instagram.
 */

export interface OpenProfileOptions {
  preferApp: boolean;
  browserFallback: boolean;
}

export type OpenOutcome = { ok: true; via: 'app' | 'browser' } | { ok: false; message: string };

function buildAppUrl(username: string): string {
  return `instagram://user?username=${encodeURIComponent(username)}`;
}

/**
 * 1. If the app is preferred, try the instagram:// deep link. Android rejects the call when
 *    no installed app handles the scheme, so no package-visibility manifest entry is needed.
 * 2. Otherwise (or on failure, if allowed) open https://www.instagram.com/{username}/.
 *    Android routes that link to the Instagram app when it handles the link, else the browser.
 */
export async function openProfile(username: string, options: OpenProfileOptions): Promise<OpenOutcome> {
  if (options.preferApp) {
    try {
      await Linking.openURL(buildAppUrl(username));
      return { ok: true, via: 'app' };
    } catch {
      if (!options.browserFallback) {
        return { ok: false, message: 'The Instagram app could not be opened. Make sure it is installed, or turn on browser fallback in Settings.' };
      }
    }
  }

  try {
    await Linking.openURL(buildInstagramUrl(username));
    return { ok: true, via: 'browser' };
  } catch {
    return { ok: false, message: 'Neither the Instagram app nor a web browser could be opened on this device.' };
  }
}
