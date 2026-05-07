export interface GameSettings {
  testMode: boolean;
}

export interface GameSettingsStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const defaultGameSettings: GameSettings = {
  testMode: false
};

export const gameSettingsStorageKey = "luanshi-survivors.game";

export function normalizeGameSettings(value: Partial<GameSettings> | null | undefined): GameSettings {
  return {
    testMode: typeof value?.testMode === "boolean" ? value.testMode : defaultGameSettings.testMode
  };
}

export function loadGameSettings(storage = getBrowserStorage()): GameSettings {
  if (!storage) {
    return { ...defaultGameSettings };
  }
  try {
    const raw = storage.getItem(gameSettingsStorageKey);
    if (!raw) {
      return { ...defaultGameSettings };
    }
    return normalizeGameSettings(JSON.parse(raw) as Partial<GameSettings>);
  } catch {
    return { ...defaultGameSettings };
  }
}

export function saveGameSettings(settings: GameSettings, storage = getBrowserStorage()): GameSettings {
  const normalized = normalizeGameSettings(settings);
  if (!storage) {
    return normalized;
  }
  try {
    storage.setItem(gameSettingsStorageKey, JSON.stringify(normalized));
  } catch {
    // Game settings should remain session-local when storage is unavailable.
  }
  return normalized;
}

function getBrowserStorage(): GameSettingsStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
