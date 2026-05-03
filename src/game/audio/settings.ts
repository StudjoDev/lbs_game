export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export interface AudioSettingsStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const defaultAudioSettings: AudioSettings = {
  musicVolume: 0.55,
  sfxVolume: 0.8,
  muted: false
};

export const audioSettingsStorageKey = "luanshi-survivors.audio";

export function normalizeAudioSettings(value: Partial<AudioSettings> | null | undefined): AudioSettings {
  return {
    musicVolume: clampVolume(value?.musicVolume, defaultAudioSettings.musicVolume),
    sfxVolume: clampVolume(value?.sfxVolume, defaultAudioSettings.sfxVolume),
    muted: typeof value?.muted === "boolean" ? value.muted : defaultAudioSettings.muted
  };
}

export function loadAudioSettings(storage = getBrowserStorage()): AudioSettings {
  if (!storage) {
    return { ...defaultAudioSettings };
  }
  try {
    const raw = storage.getItem(audioSettingsStorageKey);
    if (!raw) {
      return { ...defaultAudioSettings };
    }
    return normalizeAudioSettings(JSON.parse(raw) as Partial<AudioSettings>);
  } catch {
    return { ...defaultAudioSettings };
  }
}

export function saveAudioSettings(settings: AudioSettings, storage = getBrowserStorage()): AudioSettings {
  const normalized = normalizeAudioSettings(settings);
  if (!storage) {
    return normalized;
  }
  try {
    storage.setItem(audioSettingsStorageKey, JSON.stringify(normalized));
  } catch {
    // Browsers can deny storage in private or embedded contexts; audio should still work for the session.
  }
  return normalized;
}

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

function getBrowserStorage(): AudioSettingsStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
