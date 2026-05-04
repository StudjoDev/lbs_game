import { describe, expect, it } from "vitest";
import { characterArts } from "../content/characterArt";
import { collectionStorageKey, createDefaultCollectionState, loadCollection, revealBossDefeat } from "./collectionStore";

function createMemoryStorage(initial?: string): Pick<Storage, "getItem" | "setItem"> {
  const store = new Map<string, string>();
  if (initial !== undefined) {
    store.set(collectionStorageKey, initial);
  }
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    }
  };
}

describe("collection store", () => {
  it("owns playable heroes by default and keeps Lu Bu locked", () => {
    const state = createDefaultCollectionState();
    const playableIds = characterArts.filter((art) => art.playable).map((art) => art.id);

    expect(playableIds.length).toBeGreaterThan(0);
    for (const id of playableIds) {
      expect(state[id].owned).toBe(true);
      expect(state[id].revealed).toBe(true);
    }
    expect(state.lubu.owned).toBe(false);
    expect(state.lubu.revealed).toBe(false);
  });

  it("reveals and persists Lu Bu after a boss defeat", () => {
    const storage = createMemoryStorage();

    const unlocked = revealBossDefeat("lubu", storage);
    const reloaded = loadCollection(storage);

    expect(unlocked.lubu.owned).toBe(true);
    expect(unlocked.lubu.revealed).toBe(true);
    expect(unlocked.lubu.defeatedAt).toBeTruthy();
    expect(reloaded.lubu.owned).toBe(true);
    expect(reloaded.lubu.revealed).toBe(true);
  });

  it("recovers defaults from invalid storage JSON", () => {
    const storage = createMemoryStorage("{not-json");

    const state = loadCollection(storage);

    expect(state.guanyu.owned).toBe(true);
    expect(state.lubu.revealed).toBe(false);
  });
});
