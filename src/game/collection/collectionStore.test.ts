import { describe, expect, it } from "vitest";
import { characterArts } from "../content/characterArt";
import { starterHeroIds } from "../content/conquest";
import { collectionStorageKey, createDefaultCollectionState, loadCollection, recruitCharacter } from "./collectionStore";

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
  it("owns only starter heroes by default and keeps recruitable heroes revealed", () => {
    const state = createDefaultCollectionState();
    const playableIds = characterArts.filter((art) => art.playable).map((art) => art.id);

    expect(playableIds.length).toBeGreaterThan(0);
    for (const id of playableIds) {
      expect(state[id].revealed).toBe(true);
      expect(state[id].owned).toBe((starterHeroIds as readonly string[]).includes(id));
    }
    expect(state.lubu.owned).toBe(false);
    expect(state.lubu.revealed).toBe(true);
  });

  it("recruits and persists a conquered gatekeeper", () => {
    const storage = createMemoryStorage();

    const recruited = recruitCharacter("guanyu", storage);
    const reloaded = loadCollection(storage);

    expect(recruited.guanyu.owned).toBe(true);
    expect(reloaded.guanyu.owned).toBe(true);
    expect(reloaded.guanyu.revealed).toBe(true);
  });

  it("recruits and persists Lu Bu from Hu Lao Gate", () => {
    const storage = createMemoryStorage();

    const unlocked = recruitCharacter("lubu", storage);
    const reloaded = loadCollection(storage);

    expect(unlocked.lubu.owned).toBe(true);
    expect(unlocked.lubu.revealed).toBe(true);
    expect(unlocked.lubu.defeatedAt).toBeUndefined();
    expect(reloaded.lubu.owned).toBe(true);
    expect(reloaded.lubu.revealed).toBe(true);
  });

  it("recovers defaults from invalid storage JSON", () => {
    const storage = createMemoryStorage("{not-json");

    const state = loadCollection(storage);

    expect(state.liubei.owned).toBe(true);
    expect(state.guanyu.owned).toBe(false);
    expect(state.lubu.revealed).toBe(true);
  });
});
