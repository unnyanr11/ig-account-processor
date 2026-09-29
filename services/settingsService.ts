import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountStatus } from '../types/account';
import { STORAGE_KEYS } from '../utils/constants';

export type ThemePreference = 'system' | 'light' | 'dark';
export type QueueMode = 'UNPROCESSED' | 'ALL' | 'STATUS';

export interface AppSettings {
  theme: ThemePreference;
  autoNext: boolean;
  confirmStatusChanges: boolean;
  defaultFilter: 'ALL' | AccountStatus;
  preferInstagramApp: boolean;
  browserFallback: boolean;
  queueMode: QueueMode;
  queueStatus: AccountStatus;
  onboardingComplete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  autoNext: true,
  confirmStatusChanges: false,
  defaultFilter: 'ALL',
  preferInstagramApp: true,
  browserFallback: true,
  queueMode: 'UNPROCESSED',
  queueStatus: AccountStatus.SKIPPED,
  onboardingComplete: false,
};

let current: AppSettings = DEFAULT_SETTINGS;
let loaded = false;
let loading: Promise<AppSettings> | null = null;
const listeners = new Set<(settings: AppSettings) => void>();

function emit(): void {
  listeners.forEach((listener) => listener(current));
}

export function getSettingsSnapshot(): AppSettings {
  return current;
}

export function isSettingsLoaded(): boolean {
  return loaded;
}

export function subscribeSettings(listener: (settings: AppSettings) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reads persisted settings once; falls back to defaults if storage is missing or corrupt. */
export function loadSettings(): Promise<AppSettings> {
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (raw) current = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
      } catch {
        current = DEFAULT_SETTINGS;
      }
      loaded = true;
      emit();
      return current;
    })();
  }
  return loading;
}

export async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  await loadSettings();
  current = { ...current, [key]: value };
  emit();
  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(current));
}
