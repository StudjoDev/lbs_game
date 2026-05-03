import { describe, expect, it } from "vitest";
import {
  audioSettingsStorageKey,
  defaultAudioSettings,
  loadAudioSettings,
  normalizeAudioSettings,
  saveAudioSettings,
  type AudioSettingsStorage
} from "./settings";

class MemoryStorage implements AudioSettingsStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("audio settings", () => {
  it("uses stable defaults without browser storage", () => {
    expect(loadAudioSettings(undefined)).toEqual(defaultAudioSettings);
  });

  it("clamps volume values and preserves mute state", () => {
    expect(normalizeAudioSettings({ musicVolume: 2, sfxVolume: -1, muted: true })).toEqual({
      musicVolume: 1,
      sfxVolume: 0,
      muted: true
    });
  });

  it("falls back when stored settings are invalid", () => {
    const storage = new MemoryStorage();
    storage.setItem(audioSettingsStorageKey, "not json");

    expect(loadAudioSettings(storage)).toEqual(defaultAudioSettings);
  });

  it("saves normalized settings for later loads", () => {
    const storage = new MemoryStorage();

    const saved = saveAudioSettings({ musicVolume: 0.25, sfxVolume: 3, muted: false }, storage);

    expect(saved).toEqual({ musicVolume: 0.25, sfxVolume: 1, muted: false });
    expect(loadAudioSettings(storage)).toEqual(saved);
  });
});
