import { useCallback, useEffect, useState } from 'react';
import {
  AppSettings,
  getSettingsSnapshot,
  isSettingsLoaded,
  loadSettings,
  subscribeSettings,
  updateSetting,
} from '../services/settingsService';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(getSettingsSnapshot());
  const [loaded, setLoaded] = useState<boolean>(isSettingsLoaded());

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeSettings((next) => {
      if (active) setSettings(next);
    });
    loadSettings().then((next) => {
      if (!active) return;
      setSettings(next);
      setLoaded(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => updateSetting(key, value), []);

  return { settings, loaded, update };
}
