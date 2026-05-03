import { characterArtById, characterArts } from "../content/characterArt";
import type { CharacterId, CollectionEntry, CollectionState } from "../types";

export const collectionStorageKey = "luanshi.collection.v1";

type CollectionStorage = Pick<Storage, "getItem" | "setItem">;

export function createDefaultCollectionState(): CollectionState {
  return Object.fromEntries(
    characterArts.map((art) => [
      art.id,
      {
        characterId: art.id,
        owned: art.playable,
        revealed: art.playable,
        stars: art.stars,
        bondIds: art.bondIds
      }
    ])
  ) as CollectionState;
}

export function loadCollection(storage = getCollectionStorage()): CollectionState {
  const defaults = createDefaultCollectionState();
  if (!storage) {
    return defaults;
  }

  try {
    const raw = storage.getItem(collectionStorageKey);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<Record<CharacterId, Partial<CollectionEntry>>>;
    return normalizeCollection(parsed, defaults);
  } catch {
    return defaults;
  }
}

export function saveCollection(state: CollectionState, storage = getCollectionStorage()): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(collectionStorageKey, JSON.stringify(normalizeCollection(state, createDefaultCollectionState())));
  } catch {
    // Browsers can reject storage in private modes; collection simply falls back to defaults.
  }
}

export function unlockCharacter(characterId: CharacterId, storage = getCollectionStorage()): CollectionState {
  const state = loadCollection(storage);
  state[characterId] = {
    ...state[characterId],
    owned: true,
    revealed: true,
    stars: characterArtById[characterId].stars,
    bondIds: characterArtById[characterId].bondIds
  };
  saveCollection(state, storage);
  return state;
}

export function revealBossDefeat(characterId: CharacterId, storage = getCollectionStorage()): CollectionState {
  const state = unlockCharacter(characterId, storage);
  state[characterId] = {
    ...state[characterId],
    defeatedAt: state[characterId].defeatedAt ?? new Date().toISOString()
  };
  saveCollection(state, storage);
  return state;
}

function normalizeCollection(
  entries: Partial<Record<CharacterId, Partial<CollectionEntry>>> | CollectionState,
  defaults: CollectionState
): CollectionState {
  const normalized = { ...defaults };
  for (const art of characterArts) {
    const incoming = entries[art.id];
    normalized[art.id] = {
      ...defaults[art.id],
      ...incoming,
      characterId: art.id,
      stars: art.stars,
      bondIds: art.bondIds
    };
  }
  return normalized;
}

function getCollectionStorage(): CollectionStorage | undefined {
  try {
    if (typeof localStorage === "undefined") {
      return undefined;
    }
    return localStorage;
  } catch {
    return undefined;
  }
}
