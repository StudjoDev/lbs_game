import { describe, expect, it } from "vitest";
import {
  defaultGameSettings,
  gameSettingsStorageKey,
  loadGameSettings,
  normalizeGameSettings,
  saveGameSettings
} from "./gameSettings";

function createMemoryStorage(initial?: string): Pick<Storage, "getItem" | "setItem"> {
  const store = new Map<string, string>();
  if (initial !== undefined) {
    store.set(gameSettingsStorageKey, initial);
  }
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    }
  };
}

describe("game settings", () => {
  it("uses defaults for missing or invalid values", () => {
    expect(normalizeGameSettings(null)).toEqual(defaultGameSettings);
    expect(normalizeGameSettings({ testMode: "true" as unknown as boolean })).toEqual(defaultGameSettings);
  });

  it("persists test mode", () => {
    const storage = createMemoryStorage();

    saveGameSettings({ testMode: true }, storage);

    expect(loadGameSettings(storage).testMode).toBe(true);
  });

  it("recovers defaults from invalid storage JSON", () => {
    const storage = createMemoryStorage("{not-json");

    expect(loadGameSettings(storage)).toEqual(defaultGameSettings);
  });
});
