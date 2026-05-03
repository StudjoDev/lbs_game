export interface DisplaySettings {
  viewScale: number;
  uiScale: number;
  effectsIntensity: number;
  screenShake: number;
  showDamageNumbers: boolean;
}

export interface DisplaySettingsStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const defaultDisplaySettings: DisplaySettings = {
  viewScale: 1,
  uiScale: 1,
  effectsIntensity: 1,
  screenShake: 1,
  showDamageNumbers: true
};

export const displaySettingsStorageKey = "luanshi-survivors.display";

export function normalizeDisplaySettings(value: Partial<DisplaySettings> | null | undefined): DisplaySettings {
  return {
    viewScale: clampRange(value?.viewScale, defaultDisplaySettings.viewScale, 1, 1.6),
    uiScale: clampRange(value?.uiScale, defaultDisplaySettings.uiScale, 0.85, 1.15),
    effectsIntensity: clampRange(value?.effectsIntensity, defaultDisplaySettings.effectsIntensity, 0.5, 1.25),
    screenShake: clampRange(value?.screenShake, defaultDisplaySettings.screenShake, 0, 1.25),
    showDamageNumbers:
      typeof value?.showDamageNumbers === "boolean" ? value.showDamageNumbers : defaultDisplaySettings.showDamageNumbers
  };
}

export function loadDisplaySettings(storage = getBrowserStorage()): DisplaySettings {
  if (!storage) {
    return { ...defaultDisplaySettings };
  }
  try {
    const raw = storage.getItem(displaySettingsStorageKey);
    if (!raw) {
      return { ...defaultDisplaySettings };
    }
    return normalizeDisplaySettings(JSON.parse(raw) as Partial<DisplaySettings>);
  } catch {
    return { ...defaultDisplaySettings };
  }
}

export function saveDisplaySettings(settings: DisplaySettings, storage = getBrowserStorage()): DisplaySettings {
  const normalized = normalizeDisplaySettings(settings);
  if (!storage) {
    return normalized;
  }
  try {
    storage.setItem(displaySettingsStorageKey, JSON.stringify(normalized));
  } catch {
    // Display settings should remain session-local when storage is unavailable.
  }
  return normalized;
}

function clampRange(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function getBrowserStorage(): DisplaySettingsStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
