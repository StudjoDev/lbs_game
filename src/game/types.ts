export type FactionId = "shu" | "wei" | "wu" | "qun";
export type HeroId =
  | "liubei"
  | "guanyu"
  | "zhangfei"
  | "zhaoyun"
  | "machao"
  | "zhugeliang"
  | "caocao"
  | "xiahoudun"
  | "xuchu"
  | "zhangliao"
  | "simayi"
  | "sunquan"
  | "zhouyu"
  | "sunshangxiang"
  | "ganning"
  | "taishici"
  | "diaochan"
  | "zhangjiao"
  | "yuanshao"
  | "dongzhuo"
  | "huatuo";
export type CharacterId = HeroId | "lubu";
export type EnemyId = "infantry" | "archer" | "shield" | "cavalry" | "captain" | "lubu";
export type AbilityTrigger = "auto" | "manual" | "ultimate";
export type DamageTag = "blade" | "pierce" | "fire" | "command" | "shock" | "arrow" | "charm";
export type RunStatus = "playing" | "levelUp" | "paused" | "won" | "lost";
export type UpgradeRarity = "common" | "build" | "technique" | "faction" | "hero" | "evolution" | "relic";
export type ChapterId = "yellow_turbans" | "hulao_outer" | "red_cliff_line";
export type ChapterRoomType = "normal" | "elite" | "treasure" | "rest" | "boss";
export type ChapterRoomStatus = "fighting" | "cleared";
export type ObjectiveEvent = "kill" | "eliteKill" | "moraleBurst" | "survive" | "bossKill" | "treasure" | "rest";
export type CombatEventType =
  | "hit"
  | "crit"
  | "kill"
  | "levelUp"
  | "manual"
  | "ultimate"
  | "evolution"
  | "morale"
  | "boss"
  | "playerHit";

export interface Vector2 {
  x: number;
  y: number;
}

export interface FactionDef {
  id: FactionId;
  name: string;
  subtitle: string;
  passiveName: string;
  passiveText: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface AbilityDef {
  id: string;
  ownerHeroId?: HeroId;
  name: string;
  description: string;
  trigger: AbilityTrigger;
  cooldown: number;
  range: number;
  radius: number;
  damage: number;
  damageTags: DamageTag[];
  vfxKey: string;
  effectId: string;
}

export interface HeroDef {
  id: HeroId;
  artId: CharacterId;
  factionId: FactionId;
  name: string;
  title: string;
  role: string;
  passiveName: string;
  passiveText: string;
  baseStats: {
    maxHp: number;
    moveSpeed: number;
    armor: number;
    pickupRadius: number;
  };
  autoAbility: AbilityDef;
  manualAbility: AbilityDef;
  portraitKey: string;
  spriteKey: string;
}

export interface BondDef {
  id: string;
  name: string;
  description: string;
  characterIds: CharacterId[];
}

export interface CharacterArtDef {
  id: CharacterId;
  factionId?: FactionId;
  name: string;
  title: string;
  rarityLabel: string;
  stars: number;
  role: string;
  quote: string;
  biography: string;
  bondIds: string[];
  cardImage: string;
  battleImage: string;
  attackStrip: string;
  attackFrames: string[];
  textureKey: string;
  attackFrameKeys: string[];
  animations?: Partial<Record<CharacterAnimationId, CharacterAnimationDef>>;
  battleScale?: number;
  anchor: {
    x: number;
    y: number;
  };
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  playable: boolean;
}

export type CharacterAnimationId = "idle" | "run" | "attack" | "ultimate";

export interface CharacterAnimationDef {
  framePaths: string[];
  frameKeys: string[];
  frameRate: number;
  repeat: number;
}

export interface CollectionEntry {
  characterId: CharacterId;
  owned: boolean;
  revealed: boolean;
  stars: number;
  bondIds: string[];
  defeatedAt?: string;
}

export type CollectionState = Record<CharacterId, CollectionEntry>;

export interface EnemyDef {
  id: EnemyId;
  name: string;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  xp: number;
  score: number;
  attackRange: number;
  attackCooldown: number;
  spriteKey: string;
  tags: string[];
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  rarity: UpgradeRarity;
  maxStacks: number;
  factionId?: FactionId;
  heroId?: HeroId;
  requires?: {
    level?: number;
    upgradeId?: string;
    stacks?: number;
  };
  unlockId?: string;
  apply: UpgradeEffect[];
}

export interface UpgradeEffect {
  stat:
    | "damageScale"
    | "cooldownScale"
    | "areaScale"
    | "moveSpeed"
    | "maxHp"
    | "armor"
    | "pickupRadius"
    | "regen"
    | "critChance"
    | "critDamage"
    | "xpScale"
    | "companionDamage"
    | "evolvedPower"
    | "ultimateDuration"
    | "ultimatePower"
    | "bossDamage"
    | "frontShot"
    | "rearShot"
    | "extraVolley"
    | "projectilePierce"
    | "ricochet"
    | "orbitGuard"
    | "killHeal"
    | "lowHpPower"
    | "companionCount";
  amount: number;
}

export interface PlayerState {
  id: "player";
  heroId: HeroId;
  factionId: FactionId;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  armor: number;
  pickupRadius: number;
  damageScale: number;
  cooldownScale: number;
  areaScale: number;
  burnScale: number;
  comboScale: number;
  guardChance: number;
  critChance: number;
  critDamage: number;
  xpScale: number;
  companionDamage: number;
  companionCount: number;
  evolvedPower: number;
  bossDamage: number;
  frontShot: number;
  rearShot: number;
  extraVolley: number;
  projectilePierce: number;
  ricochet: number;
  orbitGuard: number;
  orbitCooldown: number;
  killHeal: number;
  lowHpPower: number;
  regen: number;
  morale: number;
  maxMorale: number;
  level: number;
  xp: number;
  nextXp: number;
  autoCooldown: number;
  manualCooldown: number;
  companionCooldown: number;
  berserkTimer: number;
  ultimateTimer: number;
  ultimatePulseCooldown: number;
  ultimatePulseCount: number;
  ultimateFinisherTriggered: boolean;
  ultimateDurationBonus: number;
  ultimatePower: number;
}

export interface EnemyState {
  uid: number;
  defId: EnemyId;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  burnTimer: number;
  burnDps: number;
  stunTimer: number;
  flashTimer: number;
  phase: number;
}

export interface ProjectileState {
  uid: number;
  source: "player" | "enemy";
  target: "enemy" | "player";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  ttl: number;
  pierce: number;
  hitIds: number[];
  tags: DamageTag[];
  vfxKey: string;
}

export interface AreaState {
  uid: number;
  source: "player" | "enemy";
  target: "enemy" | "player";
  x: number;
  y: number;
  radius: number;
  damagePerSecond: number;
  ttl: number;
  tickTimer: number;
  tickEvery: number;
  tags: DamageTag[];
  vfxKey: string;
}

export interface FloatingTextState {
  uid: number;
  x: number;
  y: number;
  text: string;
  ttl: number;
  tone: "damage" | "heal" | "xp" | "alert";
}

export interface XpOrbState {
  uid: number;
  x: number;
  y: number;
  value: number;
  radius: number;
}

export interface CombatEventState {
  uid: number;
  type: CombatEventType;
  x: number;
  y: number;
  ttl: number;
  intensity: number;
  vfxKey: string;
  text?: string;
}

export interface BattlefieldObjectiveState {
  id: string;
  event: ObjectiveEvent;
  title: string;
  description: string;
  progress: number;
  goal: number;
  rewardXp: number;
  rewardMorale: number;
}

export interface InputState {
  move: Vector2;
  manualPressed: boolean;
  pausePressed: boolean;
}

export interface RunState {
  status: RunStatus;
  hero: HeroDef;
  faction: FactionDef;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  areas: AreaState[];
  floatingTexts: FloatingTextState[];
  combatEvents: CombatEventState[];
  xpOrbs: XpOrbState[];
  objective: BattlefieldObjectiveState;
  objectiveIndex: number;
  chapterId: ChapterId;
  chapterName: string;
  roomIndex: number;
  roomCount: number;
  roomType: ChapterRoomType;
  roomTitle: string;
  roomObjective: BattlefieldObjectiveState;
  roomStatus: ChapterRoomStatus;
  doorOpen: boolean;
  roomElapsed: number;
  roomClearTimer: number;
  chapterCleared: boolean;
  upgrades: Record<string, number>;
  unlocks: Record<string, boolean>;
  techniqueCooldowns: Record<string, number>;
  pendingUpgradeIds: string[];
  elapsed: number;
  duration: number;
  bossSpawnTime: number;
  bossSpawned: boolean;
  kills: number;
  score: number;
  world: {
    width: number;
    height: number;
  };
  spawnTimer: number;
  nextUid: number;
  rngSeed: number;
  lastFacing: Vector2;
}
