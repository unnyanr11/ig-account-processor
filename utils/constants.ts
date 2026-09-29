export const DB_NAME = 'ig_processor.db';
export const APP_VERSION = '1.0.0';
export const DEFAULT_PAGE_SIZE = 50;

// Instagram path segments that are never profiles.
export const IGNORED_IG_PATH_SEGMENTS = [
  'explore', 'accounts', 'reels', 'reel', 'p', 'stories', 'direct', 'tv',
  'about', 'legal', 'developer', 'web', 'api', 'graphql', 'embed',
  'privacy', 'terms', 'session', 'challenge', 'lite',
];

export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_REGEX = /^[a-z0-9._]{1,30}$/;

export const SUPPORTED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.txt'];

export const STORAGE_KEYS = {
  SETTINGS: 'app_settings',
};
