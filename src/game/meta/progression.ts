import { chapters, defaultChapterId } from "../content/chapters";
import {
  conquestCities,
  conquestCityById,
  entryCityIds,
  finalCityId,
  type ConquestCityDef
} from "../content/conquest";
import { heroes } from "../content/heroes";
import type { ChapterId, ConquestCityId, FactionId, HeroId, RunStatus } from "../types";

export type MetaResourceKey = "merit" | "provisions" | "renown";
export type FacilityId = "trainingGround" | "arsenal" | "granary";
export type TalentId =
  | "attackDrill"
  | "battleFocus"
  | "armorFit"
  | "fieldMedicine"
  | "forageTeams"
  | "trophyLedgers"
  | "quickDraw"
  | "veteranPath"
  | "bossHunter"
  | "swiftMarch"
  | "treasureSense"
  | "openingTechnique";
export type EquipmentSlot = "weapon" | "armor" | "ring" | "charm" | "mount" | "book";
export type EquipmentRarity = "common" | "rare" | "epic" | "legendary";
export type DailyMissionId = "completeChapter" | "killCount" | "upgradeFacility" | "useFaction" | "openChest";

export interface MetaResources {
  merit: number;
  provisions: number;
  renown: number;
}

export interface FacilityDef {
  id: FacilityId;
  name: string;
  description: string;
  maxLevel: number;
}

export interface TalentDef {
  id: TalentId;
  name: string;
  category: "attack" | "survival" | "resource" | "opening";
  maxLevel: number;
  description: string;
  effect: {
    stat: "damageScale" | "cooldownScale" | "maxHpScale" | "idleRate" | "xpScale" | "bossDamage" | "moveSpeed";
    amount: number;
  };
}

export interface EquipmentDef {
  id: string;
  slot: EquipmentSlot;
  name: string;
  passive: string;
  effect: {
    stat: "damageScale" | "cooldownScale" | "maxHpScale" | "armor" | "pickupRadius" | "xpScale" | "bossDamage" | "moveSpeed";
    amount: number;
  };
}

export interface EquipmentInventoryEntry {
  defId: string;
  rarity: EquipmentRarity;
  quantity: number;
}

export interface HeroMasteryEntry {
  level: number;
  xp: number;
}

export interface ChapterProgressEntry {
  unlocked: boolean;
  bestRoom: number;
  clears: number;
  firstClearClaimed: boolean;
}

export interface ConquestCityProgressEntry {
  unlocked: boolean;
  conquered: boolean;
  attempts: number;
  bestRoom: number;
  conqueredAt?: string;
}

export interface ConquestProgressState {
  cities: Record<ConquestCityId, ConquestCityProgressEntry>;
  unifiedAt?: string;
}

export interface DailyMissionEntry {
  id: DailyMissionId;
  label: string;
  progress: number;
  goal: number;
  claimed: boolean;
}

export interface MetaProgressionState {
  resources: MetaResources;
  facilities: Record<FacilityId, number>;
  heroMastery: Record<HeroId, HeroMasteryEntry>;
  talents: Record<TalentId, number>;
  equipment: {
    equipped: Partial<Record<EquipmentSlot, string>>;
    inventory: Record<string, EquipmentInventoryEntry>;
  };
  chapterProgress: Record<ChapterId, ChapterProgressEntry>;
  conquest: ConquestProgressState;
  dailyMissions: {
    date: string;
    missions: Record<DailyMissionId, DailyMissionEntry>;
  };
  chapterChests: {
    keys: number;
    opened: number;
    fragments: Record<string, number>;
  };
  idle: {
    lastClaimedAt: string;
    unclaimed: MetaResources;
  };
  stats: {
    runsPlayed: number;
    wins: number;
    bestKills: number;
    bossDefeats: number;
  };
}

export interface MetaRunBonuses {
  damageScale: number;
  cooldownScale: number;
  maxHpScale: number;
  idleRate: number;
  heroLevel: number;
  moveSpeed: number;
  armor: number;
  pickupRadius: number;
  xpScale: number;
  bossDamage: number;
}

export interface MetaRunSettlementInput {
  heroId: HeroId;
  factionId?: FactionId;
  status: Extract<RunStatus, "won" | "lost">;
  kills: number;
  score: number;
  playerLevel: number;
  bossDefeated?: boolean;
  chapterId?: ChapterId;
  conquestCityId?: ConquestCityId;
  roomIndex?: number;
  roomCount?: number;
  chapterCleared?: boolean;
}

export interface MetaRunSettlement {
  resources: MetaResources;
  heroXp: number;
  heroLevelBefore: number;
  heroLevelAfter: number;
  won: boolean;
  bossDefeated: boolean;
  chapterId: ChapterId;
  chapterName: string;
  roomReached: number;
  chapterCleared: boolean;
  firstChapterClear: boolean;
  chestKeys: number;
  missionsCompleted: DailyMissionId[];
  equipmentFragments: Array<{ defId: string; name: string; amount: number }>;
  conqueredCityId?: ConquestCityId;
  conqueredCityName?: string;
  recruitedHeroId?: HeroId;
  recruitedHeroName?: string;
  unlockedCityIds: ConquestCityId[];
  unlockedCityNames: string[];
  unified: boolean;
}

export interface UpgradeFacilityResult {
  state: MetaProgressionState;
  upgraded: boolean;
  cost: MetaResources;
}

export interface ClaimIdleResult {
  state: MetaProgressionState;
  rewards: MetaResources;
}

export interface UpgradeTalentResult {
  state: MetaProgressionState;
  upgraded: boolean;
  cost: MetaResources;
}

export interface MergeEquipmentResult {
  state: MetaProgressionState;
  merged: boolean;
  consumedKey?: string;
  createdKey?: string;
}

export interface OpenChapterChestResult {
  state: MetaProgressionState;
  opened: boolean;
  rewards: MetaResources;
  equipment?: EquipmentInventoryEntry;
}

export const metaProgressionStorageKey = "luanshi-survivors.meta.v1";
export const maxHeroMasteryLevel = 20;
export const idleCapMs = 8 * 60 * 60 * 1000;

export const facilityDefs: FacilityDef[] = [
  {
    id: "trainingGround",
    name: "演武場",
    description: "每級 +2% 初始傷害",
    maxLevel: 10
  },
  {
    id: "arsenal",
    name: "軍械庫",
    description: "每級 -1.5% 初始冷卻",
    maxLevel: 10
  },
  {
    id: "granary",
    name: "糧倉",
    description: "每級 +15% 離線軍糧產量",
    maxLevel: 10
  }
];

export const talentDefs: TalentDef[] = [
  talent("attackDrill", "攻擊操典", "attack", "提高初始傷害", "damageScale", 0.012, 10),
  talent("battleFocus", "整軍節奏", "attack", "降低初始冷卻", "cooldownScale", -0.006, 10),
  talent("quickDraw", "先手快攻", "attack", "提高初始移速", "moveSpeed", 3, 8),
  talent("bossHunter", "破將心得", "attack", "提高 Boss 傷害", "bossDamage", 0.015, 8),
  talent("armorFit", "甲冑調整", "survival", "提高最大生命", "maxHpScale", 0.012, 10),
  talent("fieldMedicine", "行軍醫包", "survival", "提高最大生命", "maxHpScale", 0.01, 10),
  talent("swiftMarch", "疾行軍", "survival", "提高初始移速", "moveSpeed", 2, 8),
  talent("forageTeams", "屯糧隊", "resource", "提高離線收益", "idleRate", 0.035, 10),
  talent("trophyLedgers", "戰利簿", "resource", "提高戰鬥經驗", "xpScale", 0.01, 10),
  talent("treasureSense", "尋寶令", "resource", "提高離線收益", "idleRate", 0.025, 10),
  talent("veteranPath", "老兵傳承", "opening", "提高戰鬥經驗", "xpScale", 0.012, 8),
  talent("openingTechnique", "開局技法", "opening", "提高初始傷害", "damageScale", 0.01, 8)
];

export const equipmentDefs: EquipmentDef[] = [
  equipment("bronze_sword", "weapon", "青銅劍", "穩定提高傷害", "damageScale", 0.035),
  equipment("halberd_head", "weapon", "裂陣戟", "提高 Boss 傷害", "bossDamage", 0.045),
  equipment("crossbow_frame", "weapon", "連弩機括", "降低冷卻", "cooldownScale", -0.018),
  equipment("fire_spear", "weapon", "火尖槍", "提高傷害", "damageScale", 0.045),
  equipment("cloth_armor", "armor", "札甲", "提高生命", "maxHpScale", 0.04),
  equipment("iron_armor", "armor", "鐵葉甲", "提高護甲", "armor", 2),
  equipment("scale_armor", "armor", "魚鱗甲", "提高生命", "maxHpScale", 0.05),
  equipment("general_mail", "armor", "將軍鎧", "提高護甲", "armor", 3),
  equipment("wolf_ring", "ring", "狼紋戒", "提高傷害", "damageScale", 0.03),
  equipment("tiger_ring", "ring", "虎符戒", "提高 Boss 傷害", "bossDamage", 0.04),
  equipment("crane_ring", "ring", "鶴羽戒", "提高經驗", "xpScale", 0.025),
  equipment("jade_ring", "ring", "玉衡戒", "提高生命", "maxHpScale", 0.035),
  equipment("safe_charm", "charm", "平安符", "提高拾取範圍", "pickupRadius", 18),
  equipment("wind_charm", "charm", "疾風符", "提高移速", "moveSpeed", 9),
  equipment("war_charm", "charm", "戰意符", "提高傷害", "damageScale", 0.028),
  equipment("grain_charm", "charm", "豐糧符", "提高經驗", "xpScale", 0.02),
  equipment("brown_horse", "mount", "良馬", "提高移速", "moveSpeed", 12),
  equipment("red_horse", "mount", "赤影駒", "降低冷卻", "cooldownScale", -0.015),
  equipment("iron_horse", "mount", "鐵甲馬", "提高生命", "maxHpScale", 0.04),
  equipment("river_boat", "mount", "走舸", "提高拾取範圍", "pickupRadius", 22),
  equipment("basic_scroll", "book", "兵法殘卷", "提高經驗", "xpScale", 0.025),
  equipment("fire_scroll", "book", "火攻篇", "提高傷害", "damageScale", 0.03),
  equipment("guard_scroll", "book", "守勢篇", "提高生命", "maxHpScale", 0.035),
  equipment("boss_scroll", "book", "破陣篇", "提高 Boss 傷害", "bossDamage", 0.045)
];

export const facilityById = Object.fromEntries(facilityDefs.map((facility) => [facility.id, facility])) as Record<
  FacilityId,
  FacilityDef
>;
export const talentById = Object.fromEntries(talentDefs.map((talentDef) => [talentDef.id, talentDef])) as Record<
  TalentId,
  TalentDef
>;
export const equipmentById = Object.fromEntries(equipmentDefs.map((equipmentDef) => [equipmentDef.id, equipmentDef])) as Record<
  string,
  EquipmentDef
>;

type MetaStorage = Pick<Storage, "getItem" | "setItem">;
type MetaEquipmentInput = {
  equipped?: Partial<Record<EquipmentSlot, string>>;
  inventory?: Record<string, Partial<EquipmentInventoryEntry>>;
};
type MetaDailyMissionsInput = {
  date?: string;
  missions?: Partial<Record<DailyMissionId, Partial<DailyMissionEntry>>>;
};
type MetaProgressionInput = {
  resources?: Partial<MetaResources>;
  facilities?: Partial<Record<FacilityId, number>>;
  heroMastery?: Partial<Record<HeroId, Partial<HeroMasteryEntry>>>;
  talents?: Partial<Record<TalentId, number>>;
  equipment?: MetaEquipmentInput;
  chapterProgress?: Partial<Record<ChapterId, Partial<ChapterProgressEntry>>>;
  conquest?: {
    cities?: Partial<Record<ConquestCityId, Partial<ConquestCityProgressEntry>>>;
    unifiedAt?: string;
  };
  dailyMissions?: MetaDailyMissionsInput;
  chapterChests?: {
    keys?: number;
    opened?: number;
    fragments?: Record<string, number>;
  };
  idle?: {
    lastClaimedAt?: string;
    unclaimed?: Partial<MetaResources>;
  };
  stats?: Partial<MetaProgressionState["stats"]>;
};

const defaultResources: MetaResources = {
  merit: 0,
  provisions: 0,
  renown: 0
};
const equipmentRarityOrder: EquipmentRarity[] = ["common", "rare", "epic", "legendary"];

export function createDefaultMetaProgressionState(now = Date.now()): MetaProgressionState {
  const date = dateKey(now);
  return {
    resources: { ...defaultResources },
    facilities: {
      trainingGround: 0,
      arsenal: 0,
      granary: 0
    },
    heroMastery: Object.fromEntries(
      heroes.map((hero) => [
        hero.id,
        {
          level: 1,
          xp: 0
        }
      ])
    ) as Record<HeroId, HeroMasteryEntry>,
    talents: Object.fromEntries(talentDefs.map((talentDef) => [talentDef.id, 0])) as Record<TalentId, number>,
    equipment: {
      equipped: {},
      inventory: createStarterInventory()
    },
    chapterProgress: Object.fromEntries(
      chapters.map((chapter, index) => [
        chapter.id,
        {
          unlocked: index === 0,
          bestRoom: 0,
          clears: 0,
          firstClearClaimed: false
        }
      ])
    ) as Record<ChapterId, ChapterProgressEntry>,
    conquest: createDefaultConquestProgress(),
    dailyMissions: createDailyMissions(date),
    chapterChests: {
      keys: 0,
      opened: 0,
      fragments: {}
    },
    idle: {
      lastClaimedAt: new Date(now).toISOString(),
      unclaimed: { ...defaultResources }
    },
    stats: {
      runsPlayed: 0,
      wins: 0,
      bestKills: 0,
      bossDefeats: 0
    }
  };
}

export function normalizeMetaProgressionState(
  value: MetaProgressionInput | null | undefined,
  now = Date.now()
): MetaProgressionState {
  const defaults = createDefaultMetaProgressionState(now);
  const today = dateKey(now);
  const lastClaimedAt = normalizeIsoDate(value?.idle?.lastClaimedAt, defaults.idle.lastClaimedAt);
  return {
    resources: normalizeResources(value?.resources),
    facilities: {
      trainingGround: normalizeLevel(value?.facilities?.trainingGround, facilityById.trainingGround.maxLevel),
      arsenal: normalizeLevel(value?.facilities?.arsenal, facilityById.arsenal.maxLevel),
      granary: normalizeLevel(value?.facilities?.granary, facilityById.granary.maxLevel)
    },
    heroMastery: normalizeHeroMastery(value?.heroMastery),
    talents: normalizeTalents(value?.talents),
    equipment: normalizeEquipment(value?.equipment),
    chapterProgress: normalizeChapterProgress(value?.chapterProgress),
    conquest: normalizeConquestProgress(value?.conquest),
    dailyMissions:
      value?.dailyMissions?.date === today ? normalizeDailyMissions(value.dailyMissions, today) : createDailyMissions(today),
    chapterChests: {
      keys: normalizeCount(value?.chapterChests?.keys),
      opened: normalizeCount(value?.chapterChests?.opened),
      fragments: normalizeFragmentMap(value?.chapterChests?.fragments)
    },
    idle: {
      lastClaimedAt,
      unclaimed: normalizeResources(value?.idle?.unclaimed)
    },
    stats: {
      runsPlayed: normalizeCount(value?.stats?.runsPlayed),
      wins: normalizeCount(value?.stats?.wins),
      bestKills: normalizeCount(value?.stats?.bestKills),
      bossDefeats: normalizeCount(value?.stats?.bossDefeats)
    }
  };
}

export function loadMetaProgression(storage = getMetaStorage(), now = Date.now()): MetaProgressionState {
  if (!storage) {
    return createDefaultMetaProgressionState(now);
  }
  try {
    const raw = storage.getItem(metaProgressionStorageKey);
    if (!raw) {
      return createDefaultMetaProgressionState(now);
    }
    return normalizeMetaProgressionState(JSON.parse(raw) as MetaProgressionInput, now);
  } catch {
    return createDefaultMetaProgressionState(now);
  }
}

export function saveMetaProgression(
  state: MetaProgressionState,
  storage = getMetaStorage(),
  now = Date.now()
): MetaProgressionState {
  const normalized = normalizeMetaProgressionState(state, now);
  if (!storage) {
    return normalized;
  }
  try {
    storage.setItem(metaProgressionStorageKey, JSON.stringify(normalized));
  } catch {
    // Progression stays session-local when browser storage is unavailable.
  }
  return normalized;
}

export function getMetaRunBonuses(state: MetaProgressionState, heroId: HeroId): MetaRunBonuses {
  const normalized = normalizeMetaProgressionState(state);
  const mastery = normalized.heroMastery[heroId] ?? { level: 1, xp: 0 };
  const bonus: MetaRunBonuses = {
    damageScale: 1 + normalized.facilities.trainingGround * 0.02 + mastery.level * 0.01,
    cooldownScale: Math.max(0.75, 1 - normalized.facilities.arsenal * 0.015),
    maxHpScale: 1 + mastery.level * 0.01,
    idleRate: 1 + normalized.facilities.granary * 0.15,
    heroLevel: mastery.level,
    moveSpeed: 0,
    armor: 0,
    pickupRadius: 0,
    xpScale: 0,
    bossDamage: 0
  };

  for (const talentDef of talentDefs) {
    applyBonus(bonus, talentDef.effect.stat, talentDef.effect.amount * normalized.talents[talentDef.id]);
  }
  for (const itemKey of Object.values(normalized.equipment.equipped)) {
    if (!itemKey) {
      continue;
    }
    const item = normalized.equipment.inventory[itemKey];
    const def = item ? equipmentById[item.defId] : undefined;
    if (!item || !def) {
      continue;
    }
    applyBonus(bonus, def.effect.stat, def.effect.amount * rarityMultiplier(item.rarity));
  }
  bonus.cooldownScale = Math.max(0.55, bonus.cooldownScale);
  return bonus;
}

export function getFacilityUpgradeCost(facilityId: FacilityId, currentLevel: number): MetaResources {
  const level = normalizeLevel(currentLevel, facilityById[facilityId].maxLevel);
  if (level >= facilityById[facilityId].maxLevel) {
    return { ...defaultResources };
  }
  const base = facilityId === "granary" ? 34 : facilityId === "arsenal" ? 42 : 46;
  return {
    merit: base + level * 24,
    provisions: Math.max(12, Math.floor(base * 0.45) + level * 14),
    renown: level >= 5 ? 1 : 0
  };
}

export function getTalentUpgradeCost(talentId: TalentId, currentLevel: number): MetaResources {
  const talentDef = talentById[talentId];
  const level = normalizeLevel(currentLevel, talentDef.maxLevel);
  if (level >= talentDef.maxLevel) {
    return { ...defaultResources };
  }
  return {
    merit: 55 + level * 38,
    provisions: talentDef.category === "resource" ? 28 + level * 18 : 16 + level * 12,
    renown: level >= 4 ? 1 : 0
  };
}

export function canAfford(resources: MetaResources, cost: MetaResources): boolean {
  return resources.merit >= cost.merit && resources.provisions >= cost.provisions && resources.renown >= cost.renown;
}

export function upgradeFacility(state: MetaProgressionState, facilityId: FacilityId): UpgradeFacilityResult {
  const normalized = normalizeMetaProgressionState(state);
  const currentLevel = normalized.facilities[facilityId];
  const cost = getFacilityUpgradeCost(facilityId, currentLevel);
  if (currentLevel >= facilityById[facilityId].maxLevel || !canAfford(normalized.resources, cost)) {
    return { state: normalized, upgraded: false, cost };
  }
  const upgradedState: MetaProgressionState = {
    ...normalized,
    resources: subtractResources(normalized.resources, cost),
    facilities: {
      ...normalized.facilities,
      [facilityId]: currentLevel + 1
    }
  };
  return {
    state: updateDailyMissionProgress(upgradedState, "upgradeFacility", 1).state,
    upgraded: true,
    cost
  };
}

export function upgradeTalent(state: MetaProgressionState, talentId: TalentId): UpgradeTalentResult {
  const normalized = normalizeMetaProgressionState(state);
  const currentLevel = normalized.talents[talentId];
  const cost = getTalentUpgradeCost(talentId, currentLevel);
  if (currentLevel >= talentById[talentId].maxLevel || !canAfford(normalized.resources, cost)) {
    return { state: normalized, upgraded: false, cost };
  }
  return {
    state: {
      ...normalized,
      resources: subtractResources(normalized.resources, cost),
      talents: {
        ...normalized.talents,
        [talentId]: currentLevel + 1
      }
    },
    upgraded: true,
    cost
  };
}

export function mergeEquipment(state: MetaProgressionState, itemKey: string): MergeEquipmentResult {
  const normalized = normalizeMetaProgressionState(state);
  const item = normalized.equipment.inventory[itemKey];
  if (!item || item.quantity < 3 || item.rarity === "legendary") {
    return { state: normalized, merged: false };
  }
  const nextRarity = equipmentRarityOrder[equipmentRarityOrder.indexOf(item.rarity) + 1];
  const createdKey = equipmentKey(item.defId, nextRarity);
  const consumedQuantity = item.quantity - 3;
  const nextInventory = { ...normalized.equipment.inventory };
  if (consumedQuantity > 0) {
    nextInventory[itemKey] = { ...item, quantity: consumedQuantity };
  } else {
    delete nextInventory[itemKey];
  }
  nextInventory[createdKey] = {
    defId: item.defId,
    rarity: nextRarity,
    quantity: (nextInventory[createdKey]?.quantity ?? 0) + 1
  };
  return {
    state: {
      ...normalized,
      equipment: {
        ...normalized.equipment,
        inventory: nextInventory
      }
    },
    merged: true,
    consumedKey: itemKey,
    createdKey
  };
}

export function equipItem(state: MetaProgressionState, itemKey: string): MetaProgressionState {
  const normalized = normalizeMetaProgressionState(state);
  const item = normalized.equipment.inventory[itemKey];
  const def = item ? equipmentById[item.defId] : undefined;
  if (!item || !def || item.quantity <= 0) {
    return normalized;
  }
  return {
    ...normalized,
    equipment: {
      ...normalized.equipment,
      equipped: {
        ...normalized.equipment.equipped,
        [def.slot]: itemKey
      }
    }
  };
}

export function accrueIdleRewards(state: MetaProgressionState, now = Date.now()): MetaProgressionState {
  const normalized = normalizeMetaProgressionState(state, now);
  const elapsedMs = Math.max(0, Math.min(idleCapMs, now - new Date(normalized.idle.lastClaimedAt).getTime()));
  if (elapsedMs <= 0) {
    return normalized;
  }
  const hours = elapsedMs / (60 * 60 * 1000);
  const idleRate = getMetaRunBonuses(normalized, heroes[0].id).idleRate;
  const rewards: MetaResources = {
    merit: Math.floor(hours * 4),
    provisions: Math.floor(hours * 18 * idleRate),
    renown: 0
  };
  return {
    ...normalized,
    idle: {
      lastClaimedAt: new Date(now).toISOString(),
      unclaimed: addResources(normalized.idle.unclaimed, rewards)
    }
  };
}

export function claimIdleRewards(state: MetaProgressionState, now = Date.now()): ClaimIdleResult {
  const accrued = accrueIdleRewards(state, now);
  const rewards = accrued.idle.unclaimed;
  return {
    rewards,
    state: {
      ...accrued,
      resources: addResources(accrued.resources, rewards),
      idle: {
        ...accrued.idle,
        unclaimed: { ...defaultResources }
      }
    }
  };
}

export function applyRunSettlement(
  state: MetaProgressionState,
  input: MetaRunSettlementInput
): { state: MetaProgressionState; settlement: MetaRunSettlement } {
  const normalized = normalizeMetaProgressionState(state);
  const won = input.status === "won";
  const chapterId = input.chapterId ?? defaultChapterId;
  const chapter = chapters.find((item) => item.id === chapterId) ?? chapters[0];
  const chapterIndex = chapters.findIndex((item) => item.id === chapter.id);
  const roomCount = Math.max(1, input.roomCount ?? chapter.rooms.length);
  const roomReached = Math.max(1, Math.min(roomCount, (input.roomIndex ?? 0) + 1));
  const chapterCleared = Boolean(input.chapterCleared || won);
  const nextChapterId = chapterCleared ? chapters[chapterIndex + 1]?.id : undefined;
  const previousProgress = normalized.chapterProgress[chapter.id];
  const firstChapterClear = chapterCleared && !previousProgress.firstClearClaimed;
  const progressScale = chapterCleared ? 1 : Math.max(0.35, roomReached / roomCount);
  const resourceScale = won ? 1 : 0.7;
  const baseMerit = Math.max(0, Math.floor(input.kills) + Math.floor(input.score / 100));
  const baseProvisions = Math.max(0, Math.floor(input.kills / 2) + Math.floor(input.playerLevel) * 3);
  const baseResources: MetaResources = {
    merit: Math.floor(baseMerit * resourceScale + roomReached * 8 * progressScale),
    provisions: Math.floor(baseProvisions * resourceScale + roomReached * 5 * progressScale),
    renown: (won ? 1 : 0) + (firstChapterClear ? 1 : 0)
  };
  const conquestOutcome = settleConquestProgress(
    normalized.conquest,
    input.conquestCityId ? conquestCityById[input.conquestCityId] : undefined,
    chapterCleared,
    roomReached
  );
  const resources = addResources(baseResources, conquestOutcome.rewards);
  const chestKeys = (chapterCleared ? 2 : roomReached >= 4 ? 1 : 0) + conquestOutcome.chestKeys;
  const equipmentFragments = chapterCleared ? chapterEquipmentReward(chapter.id) : [];
  const heroXp = Math.max(0, Math.floor(input.kills / 8) + Math.floor(input.playerLevel) * 2);
  const before = normalized.heroMastery[input.heroId] ?? { level: 1, xp: 0 };
  const after = addHeroMasteryXp(before, heroXp);
  const bossDefeated = Boolean(input.bossDefeated || chapterCleared);
  const chapterProgress: Record<ChapterId, ChapterProgressEntry> = {
    ...normalized.chapterProgress,
    [chapter.id]: {
      ...previousProgress,
      bestRoom: Math.max(previousProgress.bestRoom, roomReached),
      clears: previousProgress.clears + (chapterCleared ? 1 : 0),
      firstClearClaimed: previousProgress.firstClearClaimed || chapterCleared
    }
  };
  if (nextChapterId) {
    chapterProgress[nextChapterId] = {
      ...chapterProgress[nextChapterId],
      unlocked: true
    };
  }
  const nextStateBase: MetaProgressionState = {
    ...normalized,
    resources: addResources(normalized.resources, resources),
    heroMastery: {
      ...normalized.heroMastery,
      [input.heroId]: after
    },
    chapterProgress,
    conquest: conquestOutcome.conquest,
    chapterChests: {
      keys: normalized.chapterChests.keys + chestKeys,
      opened: normalized.chapterChests.opened,
      fragments: addFragments(normalized.chapterChests.fragments, equipmentFragments)
    },
    equipment: grantEquipment(normalized.equipment, equipmentFragments),
    stats: {
      runsPlayed: normalized.stats.runsPlayed + 1,
      wins: normalized.stats.wins + (won ? 1 : 0),
      bestKills: Math.max(normalized.stats.bestKills, Math.floor(input.kills)),
      bossDefeats: normalized.stats.bossDefeats + (bossDefeated ? 1 : 0)
    }
  };
  let missionState = updateDailyMissionProgress(nextStateBase, "killCount", Math.floor(input.kills)).state;
  if (chapterCleared) {
    missionState = updateDailyMissionProgress(missionState, "completeChapter", 1).state;
  }
  if (input.factionId) {
    missionState = updateDailyMissionProgress(missionState, "useFaction", 1).state;
  }
  const missionsCompleted = newlyCompletedMissionIds(normalized, missionState);
  return {
    state: missionState,
    settlement: {
      resources,
      heroXp,
      heroLevelBefore: before.level,
      heroLevelAfter: after.level,
      won,
      bossDefeated,
      chapterId: chapter.id,
      chapterName: chapter.name,
      roomReached,
      chapterCleared,
      firstChapterClear,
      chestKeys,
      missionsCompleted,
      equipmentFragments,
      conqueredCityId: conquestOutcome.conqueredCityId,
      conqueredCityName: conquestOutcome.conqueredCityName,
      recruitedHeroId: conquestOutcome.recruitedHeroId,
      recruitedHeroName: conquestOutcome.recruitedHeroName,
      unlockedCityIds: conquestOutcome.unlockedCityIds,
      unlockedCityNames: conquestOutcome.unlockedCityNames,
      unified: conquestOutcome.unified
    }
  };
}

interface ConquestSettlementOutcome {
  conquest: ConquestProgressState;
  rewards: MetaResources;
  chestKeys: number;
  conqueredCityId?: ConquestCityId;
  conqueredCityName?: string;
  recruitedHeroId?: HeroId;
  recruitedHeroName?: string;
  unlockedCityIds: ConquestCityId[];
  unlockedCityNames: string[];
  unified: boolean;
}

function settleConquestProgress(
  current: ConquestProgressState,
  cityDef: ConquestCityDef | undefined,
  chapterCleared: boolean,
  roomReached: number
): ConquestSettlementOutcome {
  if (!cityDef) {
    return {
      conquest: current,
      rewards: { ...defaultResources },
      chestKeys: 0,
      unlockedCityIds: [],
      unlockedCityNames: [],
      unified: false
    };
  }

  const before = recalculateConquestUnlocks(current);
  const beforeUnlocked = new Set(
    conquestCities.filter((city) => before.cities[city.id].unlocked).map((city) => city.id)
  );
  const entry = before.cities[cityDef.id];
  const firstConquest = chapterCleared && entry.unlocked && !entry.conquered;
  const nextCities: Record<ConquestCityId, ConquestCityProgressEntry> = {
    ...before.cities,
    [cityDef.id]: {
      ...entry,
      attempts: entry.attempts + 1,
      bestRoom: Math.max(entry.bestRoom, roomReached),
      conquered: entry.conquered || firstConquest,
      conqueredAt: firstConquest ? new Date().toISOString() : entry.conqueredAt
    }
  };
  const after = recalculateConquestUnlocks({
    cities: nextCities,
    unifiedAt:
      firstConquest && cityDef.id === finalCityId
        ? (before.unifiedAt ?? new Date().toISOString())
        : before.unifiedAt
  });
  const unlockedCityIds = conquestCities
    .filter((city) => after.cities[city.id].unlocked && !beforeUnlocked.has(city.id))
    .map((city) => city.id);
  const rewards = firstConquest
    ? {
        merit: cityDef.firstClearRewards.merit,
        provisions: cityDef.firstClearRewards.provisions,
        renown: cityDef.firstClearRewards.renown
      }
    : { ...defaultResources };
  const recruitedHero = firstConquest ? heroes.find((hero) => hero.id === cityDef.gatekeeperHeroId) : undefined;

  return {
    conquest: after,
    rewards,
    chestKeys: firstConquest ? cityDef.firstClearRewards.chestKeys : 0,
    conqueredCityId: firstConquest ? cityDef.id : undefined,
    conqueredCityName: firstConquest ? cityDef.name : undefined,
    recruitedHeroId: recruitedHero?.id,
    recruitedHeroName: recruitedHero?.name,
    unlockedCityIds,
    unlockedCityNames: unlockedCityIds.map((cityId) => conquestCityById[cityId].name),
    unified: Boolean(firstConquest && cityDef.id === finalCityId)
  };
}

export function updateDailyMissionProgress(
  state: MetaProgressionState,
  missionId: DailyMissionId,
  amount: number
): { state: MetaProgressionState; completedNow: boolean } {
  const normalized = normalizeMetaProgressionState(state);
  const mission = normalized.dailyMissions.missions[missionId];
  const wasComplete = mission.progress >= mission.goal;
  const nextMission = {
    ...mission,
    progress: Math.min(mission.goal, mission.progress + Math.max(0, Math.floor(amount)))
  };
  const completedNow = !wasComplete && nextMission.progress >= nextMission.goal;
  return {
    completedNow,
    state: {
      ...normalized,
      dailyMissions: {
        ...normalized.dailyMissions,
        missions: {
          ...normalized.dailyMissions.missions,
          [missionId]: nextMission
        }
      }
    }
  };
}

export function claimDailyMission(state: MetaProgressionState, missionId: DailyMissionId): MetaProgressionState {
  const normalized = normalizeMetaProgressionState(state);
  const mission = normalized.dailyMissions.missions[missionId];
  if (mission.claimed || mission.progress < mission.goal) {
    return normalized;
  }
  return {
    ...normalized,
    resources: addResources(normalized.resources, { merit: 24, provisions: 12, renown: 0 }),
    chapterChests: {
      ...normalized.chapterChests,
      keys: normalized.chapterChests.keys + 1
    },
    dailyMissions: {
      ...normalized.dailyMissions,
      missions: {
        ...normalized.dailyMissions.missions,
        [missionId]: {
          ...mission,
          claimed: true
        }
      }
    }
  };
}

export function openChapterChest(state: MetaProgressionState): OpenChapterChestResult {
  const normalized = normalizeMetaProgressionState(state);
  if (normalized.chapterChests.keys <= 0) {
    return { state: normalized, opened: false, rewards: { ...defaultResources } };
  }
  const equipmentDef = equipmentDefs[normalized.chapterChests.opened % equipmentDefs.length];
  const rarity: EquipmentRarity = normalized.chapterChests.opened % 9 === 8 ? "rare" : "common";
  const equipmentEntry: EquipmentInventoryEntry = { defId: equipmentDef.id, rarity, quantity: 1 };
  const rewards: MetaResources = {
    merit: 36 + normalized.chapterChests.opened * 2,
    provisions: 24,
    renown: normalized.chapterChests.opened % 5 === 4 ? 1 : 0
  };
  const openedState: MetaProgressionState = {
    ...normalized,
    resources: addResources(normalized.resources, rewards),
    equipment: grantEquipment(normalized.equipment, [{ defId: equipmentEntry.defId, name: equipmentDef.name, amount: 1 }], rarity),
    chapterChests: {
      ...normalized.chapterChests,
      keys: normalized.chapterChests.keys - 1,
      opened: normalized.chapterChests.opened + 1,
      fragments: addFragments(normalized.chapterChests.fragments, [
        { defId: equipmentEntry.defId, name: equipmentDef.name, amount: 1 }
      ])
    }
  };
  return {
    state: updateDailyMissionProgress(openedState, "openChest", 1).state,
    opened: true,
    rewards,
    equipment: equipmentEntry
  };
}

export function heroXpToNext(level: number): number {
  if (level >= maxHeroMasteryLevel) {
    return 0;
  }
  return 22 + (level - 1) * 8;
}

export function addHeroMasteryXp(entry: HeroMasteryEntry, amount: number): HeroMasteryEntry {
  let level = normalizeLevel(entry.level, maxHeroMasteryLevel, 1);
  let xp = Math.max(0, Math.floor(entry.xp) + Math.max(0, Math.floor(amount)));
  while (level < maxHeroMasteryLevel) {
    const needed = heroXpToNext(level);
    if (xp < needed) {
      break;
    }
    xp -= needed;
    level += 1;
  }
  return {
    level,
    xp: level >= maxHeroMasteryLevel ? 0 : xp
  };
}

export function equipmentKey(defId: string, rarity: EquipmentRarity): string {
  return `${defId}:${rarity}`;
}

function normalizeHeroMastery(
  value: Partial<Record<HeroId, Partial<HeroMasteryEntry>>> | undefined
): Record<HeroId, HeroMasteryEntry> {
  return Object.fromEntries(
    heroes.map((hero) => {
      const incoming = value?.[hero.id];
      return [
        hero.id,
        addHeroMasteryXp(
          {
            level: normalizeLevel(incoming?.level, maxHeroMasteryLevel, 1),
            xp: normalizeCount(incoming?.xp)
          },
          0
        )
      ];
    })
  ) as Record<HeroId, HeroMasteryEntry>;
}

function normalizeTalents(value: Partial<Record<TalentId, number>> | undefined): Record<TalentId, number> {
  return Object.fromEntries(
    talentDefs.map((talentDef) => [talentDef.id, normalizeLevel(value?.[talentDef.id], talentDef.maxLevel)])
  ) as Record<TalentId, number>;
}

function normalizeEquipment(value: MetaEquipmentInput | undefined): MetaProgressionState["equipment"] {
  const inventory: Record<string, EquipmentInventoryEntry> = {};
  for (const item of Object.values(value?.inventory ?? {})) {
    const def = typeof item?.defId === "string" ? equipmentById[item.defId] : undefined;
    const rarity = normalizeEquipmentRarity(item?.rarity);
    const quantity = normalizeCount(item?.quantity);
    if (!def || quantity <= 0) {
      continue;
    }
    inventory[equipmentKey(def.id, rarity)] = { defId: def.id, rarity, quantity };
  }
  const starter = createStarterInventory();
  for (const [key, item] of Object.entries(starter)) {
    inventory[key] = inventory[key] ?? item;
  }
  const equipped: Partial<Record<EquipmentSlot, string>> = {};
  for (const [slot, itemKey] of Object.entries(value?.equipped ?? {}) as Array<[EquipmentSlot, string]>) {
    const item = inventory[itemKey];
    if (item && equipmentById[item.defId]?.slot === slot) {
      equipped[slot] = itemKey;
    }
  }
  return { equipped, inventory };
}

function normalizeChapterProgress(
  value: Partial<Record<ChapterId, Partial<ChapterProgressEntry>>> | undefined
): Record<ChapterId, ChapterProgressEntry> {
  return Object.fromEntries(
    chapters.map((chapter, index) => {
      const incoming = value?.[chapter.id];
      return [
        chapter.id,
        {
          unlocked: Boolean(incoming?.unlocked ?? index === 0),
          bestRoom: normalizeLevel(incoming?.bestRoom, chapter.rooms.length),
          clears: normalizeCount(incoming?.clears),
          firstClearClaimed: Boolean(incoming?.firstClearClaimed)
        }
      ];
    })
  ) as Record<ChapterId, ChapterProgressEntry>;
}

function createDefaultConquestProgress(): ConquestProgressState {
  return {
    cities: Object.fromEntries(
      conquestCities.map((cityDef) => [
        cityDef.id,
        {
          unlocked: (entryCityIds as readonly ConquestCityId[]).includes(cityDef.id),
          conquered: false,
          attempts: 0,
          bestRoom: 0
        }
      ])
    ) as Record<ConquestCityId, ConquestCityProgressEntry>
  };
}

function normalizeConquestProgress(value: MetaProgressionInput["conquest"] | undefined): ConquestProgressState {
  const defaults = createDefaultConquestProgress();
  const cities = Object.fromEntries(
    conquestCities.map((cityDef) => {
      const incoming = value?.cities?.[cityDef.id];
      const conquered = Boolean(incoming?.conquered);
      return [
        cityDef.id,
        {
          unlocked: Boolean(incoming?.unlocked ?? defaults.cities[cityDef.id].unlocked),
          conquered,
          attempts: normalizeCount(incoming?.attempts),
          bestRoom: normalizeLevel(incoming?.bestRoom, 8),
          conqueredAt: conquered ? normalizeOptionalIsoDate(incoming?.conqueredAt) : undefined
        }
      ];
    })
  ) as Record<ConquestCityId, ConquestCityProgressEntry>;

  let normalized: ConquestProgressState = {
    cities,
    unifiedAt: normalizeOptionalIsoDate(value?.unifiedAt)
  };
  normalized = recalculateConquestUnlocks(normalized);
  if (!normalized.cities[finalCityId].conquered) {
    delete normalized.unifiedAt;
  }
  return normalized;
}

function normalizeDailyMissions(
  value: MetaDailyMissionsInput | undefined,
  date: string
): MetaProgressionState["dailyMissions"] {
  const defaults = createDailyMissions(date);
  return {
    date,
    missions: Object.fromEntries(
      Object.values(defaults.missions).map((mission) => {
        const incoming = value?.missions?.[mission.id];
        return [
          mission.id,
          {
            ...mission,
            progress: Math.min(mission.goal, normalizeCount(incoming?.progress)),
            claimed: Boolean(incoming?.claimed)
          }
        ];
      })
    ) as Record<DailyMissionId, DailyMissionEntry>
  };
}

function normalizeResources(value: Partial<MetaResources> | undefined): MetaResources {
  return {
    merit: normalizeCount(value?.merit),
    provisions: normalizeCount(value?.provisions),
    renown: normalizeCount(value?.renown)
  };
}

function recalculateConquestUnlocks(state: ConquestProgressState): ConquestProgressState {
  const cities = { ...state.cities };
  for (const cityDef of conquestCities) {
    const entry = cities[cityDef.id];
    const unlocked =
      entry.unlocked ||
      entry.conquered ||
      (entryCityIds as readonly ConquestCityId[]).includes(cityDef.id) ||
      cityDef.prerequisiteCityIds.every((cityId) => cities[cityId]?.conquered);
    cities[cityDef.id] = {
      ...entry,
      unlocked
    };
  }
  return {
    ...state,
    cities
  };
}

function normalizeFragmentMap(value: Record<string, number> | undefined): Record<string, number> {
  const fragments: Record<string, number> = {};
  for (const [defId, amount] of Object.entries(value ?? {})) {
    if (equipmentById[defId]) {
      fragments[defId] = normalizeCount(amount);
    }
  }
  return fragments;
}

function addResources(left: MetaResources, right: MetaResources): MetaResources {
  return {
    merit: left.merit + right.merit,
    provisions: left.provisions + right.provisions,
    renown: left.renown + right.renown
  };
}

function subtractResources(left: MetaResources, right: MetaResources): MetaResources {
  return {
    merit: Math.max(0, left.merit - right.merit),
    provisions: Math.max(0, left.provisions - right.provisions),
    renown: Math.max(0, left.renown - right.renown)
  };
}

function addFragments(
  current: Record<string, number>,
  rewards: Array<{ defId: string; amount: number; name?: string }>
): Record<string, number> {
  const next = { ...current };
  for (const reward of rewards) {
    next[reward.defId] = (next[reward.defId] ?? 0) + reward.amount;
  }
  return next;
}

function grantEquipment(
  equipmentState: MetaProgressionState["equipment"],
  rewards: Array<{ defId: string; amount: number; name?: string }>,
  rarity: EquipmentRarity = "common"
): MetaProgressionState["equipment"] {
  const inventory = { ...equipmentState.inventory };
  for (const reward of rewards) {
    const key = equipmentKey(reward.defId, rarity);
    const current = inventory[key];
    inventory[key] = {
      defId: reward.defId,
      rarity,
      quantity: (current?.quantity ?? 0) + reward.amount
    };
  }
  return {
    ...equipmentState,
    inventory
  };
}

function chapterEquipmentReward(chapterId: ChapterId): Array<{ defId: string; name: string; amount: number }> {
  const defId =
    chapterId === "yellow_turbans" ? "bronze_sword" : chapterId === "hulao_outer" ? "halberd_head" : "fire_scroll";
  return [{ defId, name: equipmentById[defId].name, amount: 1 }];
}

function newlyCompletedMissionIds(before: MetaProgressionState, after: MetaProgressionState): DailyMissionId[] {
  return Object.values(after.dailyMissions.missions)
    .filter((mission) => {
      const previous = before.dailyMissions.missions[mission.id];
      return mission.progress >= mission.goal && (previous?.progress ?? 0) < mission.goal;
    })
    .map((mission) => mission.id);
}

function applyBonus(bonus: MetaRunBonuses, stat: TalentDef["effect"]["stat"] | EquipmentDef["effect"]["stat"], amount: number): void {
  if (stat === "damageScale") {
    bonus.damageScale += amount;
  } else if (stat === "cooldownScale") {
    bonus.cooldownScale += amount;
  } else if (stat === "maxHpScale") {
    bonus.maxHpScale += amount;
  } else if (stat === "idleRate") {
    bonus.idleRate += amount;
  } else if (stat === "moveSpeed") {
    bonus.moveSpeed += amount;
  } else if (stat === "armor") {
    bonus.armor += amount;
  } else if (stat === "pickupRadius") {
    bonus.pickupRadius += amount;
  } else if (stat === "xpScale") {
    bonus.xpScale += amount;
  } else if (stat === "bossDamage") {
    bonus.bossDamage += amount;
  }
}

function rarityMultiplier(rarity: EquipmentRarity): number {
  return rarity === "legendary" ? 3.4 : rarity === "epic" ? 2.2 : rarity === "rare" ? 1.55 : 1;
}

function createStarterInventory(): Record<string, EquipmentInventoryEntry> {
  const starter = equipmentDefs.slice(0, 2);
  return Object.fromEntries(starter.map((item) => [equipmentKey(item.id, "common"), { defId: item.id, rarity: "common", quantity: 1 }]));
}

function createDailyMissions(date: string): MetaProgressionState["dailyMissions"] {
  return {
    date,
    missions: {
      completeChapter: mission("completeChapter", "完成任一章節", 1),
      killCount: mission("killCount", "累積擊殺 300", 300),
      upgradeFacility: mission("upgradeFacility", "升級任一設施", 1),
      useFaction: mission("useFaction", "使用指定陣營出戰", 1),
      openChest: mission("openChest", "開啟章節寶箱", 1)
    }
  };
}

function mission(id: DailyMissionId, label: string, goal: number): DailyMissionEntry {
  return {
    id,
    label,
    progress: 0,
    goal,
    claimed: false
  };
}

function talent(
  id: TalentId,
  name: string,
  category: TalentDef["category"],
  description: string,
  stat: TalentDef["effect"]["stat"],
  amount: number,
  maxLevel: number
): TalentDef {
  return {
    id,
    name,
    category,
    maxLevel,
    description,
    effect: { stat, amount }
  };
}

function equipment(
  id: string,
  slot: EquipmentSlot,
  name: string,
  passive: string,
  stat: EquipmentDef["effect"]["stat"],
  amount: number
): EquipmentDef {
  return {
    id,
    slot,
    name,
    passive,
    effect: { stat, amount }
  };
}

function normalizeEquipmentRarity(value: unknown): EquipmentRarity {
  return value === "rare" || value === "epic" || value === "legendary" ? value : "common";
}

function normalizeLevel(value: unknown, max: number, min = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function normalizeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return fallback;
  }
  return new Date(timestamp).toISOString();
}

function normalizeOptionalIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }
  return new Date(timestamp).toISOString();
}

function dateKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function getMetaStorage(): MetaStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
