export { audioAssetEntries, audioKeys, audioPaths } from "../audio/catalog";
import type { EnemyId } from "../types";

const heroTextureIds = [
  "liubei",
  "guanyu",
  "zhangfei",
  "zhaoyun",
  "zhugeliang",
  "caocao",
  "xiahoudun",
  "xuchu",
  "zhangliao",
  "simayi",
  "sunquan",
  "zhouyu",
  "sunshangxiang",
  "ganning",
  "taishici",
  "diaochan",
  "zhangjiao",
  "yuanshao",
  "dongzhuo",
  "huatuo"
] as const;

export const textureKeys = {
  heroes: heroTextureIds.map((id) => `hero_${id}`),
  heroAttackFrames: heroTextureIds.flatMap((id) => [0, 1, 2, 3].map((frame) => `hero_${id}_attack_${frame}`)),
  portraits: heroTextureIds.map((id) => `portrait_${id}`),
  enemies: ["enemy_infantry", "enemy_archer", "enemy_shield", "enemy_cavalry", "enemy_captain", "enemy_lubu"],
  enemyAttackFrames: ["enemy_lubu_attack_0", "enemy_lubu_attack_1", "enemy_lubu_attack_2", "enemy_lubu_attack_3"],
  fx: ["slash", "spear", "fire", "arrow", "command", "shock", "xp_orb", "shadow"]
} as const;

const visualBasePath = `${import.meta.env.BASE_URL}assets/vfx`;
const enemyAssetBasePath = `${import.meta.env.BASE_URL}assets/enemies`;

export interface VisualAssetEntry {
  key: string;
  path: string;
}

export interface VisualSpritesheetEntry extends VisualAssetEntry {
  frameWidth: number;
  frameHeight: number;
  endFrame: number;
}

export type VisualAnimationEntry =
  | {
      key: string;
      frameRate: number;
      repeat: number;
      frames: readonly VisualAssetEntry[];
    }
  | {
      key: string;
      frameRate: number;
      repeat: number;
      spritesheet: VisualSpritesheetEntry;
      startFrame?: number;
    };

export interface VfxProfile {
  textureKey: string;
  color: number;
  blendMode: "add" | "normal";
  scale: number;
  lifetime: number;
  particleKey?: string;
  animationKey?: string;
  animationKeys?: readonly string[];
  nativeColor?: boolean;
  telegraphShape?: "circle" | "slash" | "storm" | "rain" | "burst";
  presentationKind?: "meleeArc" | "rangedProjectile" | "areaField" | "rain" | "dash" | "aura";
  originMode?: "playerAnchored" | "projectile" | "targetArea" | "screenPulse";
  motionStyle?: "slashLunge" | "thrust" | "spin" | "cast" | "idle";
  arcDegrees?: number;
  followPlayer?: boolean;
}

export interface EnemyVisualProfile {
  spriteKey: string;
  shadowScale: number;
  hitTint: number;
  deathFxKey: string;
  baseScale: number;
  animationScale?: number;
  eliteFrame?: number;
  outlineColor?: number;
}

export type EnemyAnimationId = "walk" | "hit" | "death";

export interface EnemyAnimationDef {
  framePaths: string[];
  frameKeys: string[];
  frameRate: number;
  repeat: number;
}

export const visualParticleAssets = [
  { key: "particle_smoke", path: `${visualBasePath}/particles/kenney-smoke.png` },
  { key: "particle_spark", path: `${visualBasePath}/particles/kenney-spark.png` },
  { key: "particle_magic", path: `${visualBasePath}/particles/kenney-magic.png` },
  { key: "particle_circle", path: `${visualBasePath}/particles/kenney-circle.png` },
  { key: "particle_dirt", path: `${visualBasePath}/particles/kenney-dirt.png` },
  { key: "particle_brackeys_fire", path: `${visualBasePath}/particles/brackeys-fire.png` },
  { key: "particle_brackeys_flare", path: `${visualBasePath}/particles/brackeys-flare.png` },
  { key: "particle_brackeys_light", path: `${visualBasePath}/particles/brackeys-light.png` },
  { key: "particle_brackeys_magic", path: `${visualBasePath}/particles/brackeys-magic.png` },
  { key: "particle_brackeys_slash", path: `${visualBasePath}/particles/brackeys-slash.png` },
  { key: "particle_brackeys_smoke", path: `${visualBasePath}/particles/brackeys-smoke.png` },
  { key: "particle_brackeys_spark", path: `${visualBasePath}/particles/brackeys-spark.png` }
] as const satisfies readonly VisualAssetEntry[];

export const slashAnimationKey = "fx_slash_arc";
export const hitSparkAnimationKey = "fx_hit_spark";
export const hitRadialAnimationKey = "fx_hit_radial";
export const brackeysBigHitAnimationKey = "fx_brackeys_big_hit";
export const brackeysElectricRingAnimationKey = "fx_brackeys_electric_ring";
export const brackeysFireRingAnimationKey = "fx_brackeys_fire_ring";
export const brackeysLightstreaksAnimationKey = "fx_brackeys_lightstreaks";

export const slashAnimationFrames = [1, 2, 3, 4, 5, 6].map((frame) => ({
  key: `fx_slash_${frame.toString().padStart(2, "0")}`,
  path: `${visualBasePath}/fx/slash/classic-${frame.toString().padStart(2, "0")}.png`
})) as readonly VisualAssetEntry[];

export const hitSparkSpritesheet = {
  key: "fx_hit_spark_sheet",
  path: `${visualBasePath}/fx/hit/oga-spark-strip9.png`,
  frameWidth: 32,
  frameHeight: 32,
  endFrame: 8
} as const satisfies VisualSpritesheetEntry;

export const hitRadialSpritesheet = {
  key: "fx_hit_radial_sheet",
  path: `${visualBasePath}/fx/hit/oga-radial-lightning.png`,
  frameWidth: 256,
  frameHeight: 256,
  endFrame: 7
} as const satisfies VisualSpritesheetEntry;

export const brackeysBigHitSpritesheet = {
  key: "fx_brackeys_big_hit_sheet",
  path: `${visualBasePath}/fx/brackeys/big-hit-6x5.png`,
  frameWidth: 557,
  frameHeight: 553,
  endFrame: 29
} as const satisfies VisualSpritesheetEntry;

export const brackeysElectricRingSpritesheet = {
  key: "fx_brackeys_electric_ring_sheet",
  path: `${visualBasePath}/fx/brackeys/electric-ring-6x5.png`,
  frameWidth: 265,
  frameHeight: 265,
  endFrame: 29
} as const satisfies VisualSpritesheetEntry;

export const brackeysFireRingSpritesheet = {
  key: "fx_brackeys_fire_ring_sheet",
  path: `${visualBasePath}/fx/brackeys/fire-ring-6x5.png`,
  frameWidth: 421,
  frameHeight: 425,
  endFrame: 29
} as const satisfies VisualSpritesheetEntry;

export const brackeysLightstreaksSpritesheet = {
  key: "fx_brackeys_lightstreaks_sheet",
  path: `${visualBasePath}/fx/brackeys/lightstreaks-6x5.png`,
  frameWidth: 517,
  frameHeight: 515,
  endFrame: 29
} as const satisfies VisualSpritesheetEntry;

export const visualAssetEntries = [...visualParticleAssets, ...slashAnimationFrames] as const;
export const visualSpritesheetEntries = [
  hitSparkSpritesheet,
  hitRadialSpritesheet,
  brackeysBigHitSpritesheet,
  brackeysElectricRingSpritesheet,
  brackeysFireRingSpritesheet,
  brackeysLightstreaksSpritesheet
] as const;

export const visualAnimationEntries = [
  {
    key: slashAnimationKey,
    frames: slashAnimationFrames,
    frameRate: 28,
    repeat: 0
  },
  {
    key: hitSparkAnimationKey,
    spritesheet: hitSparkSpritesheet,
    frameRate: 32,
    repeat: 0
  },
  {
    key: hitRadialAnimationKey,
    spritesheet: hitRadialSpritesheet,
    frameRate: 24,
    repeat: 0
  },
  {
    key: brackeysBigHitAnimationKey,
    spritesheet: brackeysBigHitSpritesheet,
    frameRate: 36,
    repeat: 0
  },
  {
    key: brackeysElectricRingAnimationKey,
    spritesheet: brackeysElectricRingSpritesheet,
    frameRate: 34,
    repeat: 0
  },
  {
    key: brackeysFireRingAnimationKey,
    spritesheet: brackeysFireRingSpritesheet,
    frameRate: 32,
    repeat: 0
  },
  {
    key: brackeysLightstreaksAnimationKey,
    spritesheet: brackeysLightstreaksSpritesheet,
    frameRate: 34,
    repeat: 0
  }
] as const satisfies readonly VisualAnimationEntry[];

export const visualAnimationTextureKeys = Object.fromEntries(
  visualAnimationEntries.map((entry) => [entry.key, "frames" in entry ? entry.frames[0]?.key : entry.spritesheet.key])
) as Record<string, string | undefined>;

const animatedEnemyIds = ["infantry", "archer", "shield", "cavalry", "captain", "lubu"] as const satisfies readonly EnemyId[];
const enemyAnimationIds = ["walk", "hit", "death"] as const satisfies readonly EnemyAnimationId[];
const enemyAnimationFrameCounts: Record<EnemyAnimationId, number> = {
  walk: 4,
  hit: 3,
  death: 5
};
const enemyAnimationFrameRates: Record<EnemyAnimationId, number> = {
  walk: 8,
  hit: 14,
  death: 12
};
const enemyAnimationRepeats: Record<EnemyAnimationId, number> = {
  walk: -1,
  hit: 0,
  death: 0
};

export function enemyAnimationKey(enemyId: EnemyId, animationId: EnemyAnimationId): string {
  return `enemy_${enemyId}_${animationId}`;
}

function enemyAnimationFrameKey(enemyId: EnemyId, animationId: EnemyAnimationId, frame: number): string {
  return `${enemyAnimationKey(enemyId, animationId)}_${frame.toString().padStart(2, "0")}`;
}

function createEnemyAnimationDef(enemyId: EnemyId, animationId: EnemyAnimationId): EnemyAnimationDef {
  const frameCount = enemyAnimationFrameCounts[animationId];
  const framePaths = Array.from({ length: frameCount }, (_, index) => {
    const frame = (index + 1).toString().padStart(2, "0");
    return `${enemyAssetBasePath}/${enemyId}/${animationId}/${frame}.png`;
  });
  return {
    framePaths,
    frameKeys: Array.from({ length: frameCount }, (_, index) => enemyAnimationFrameKey(enemyId, animationId, index + 1)),
    frameRate: enemyAnimationFrameRates[animationId],
    repeat: enemyAnimationRepeats[animationId]
  };
}

export const enemyAnimationsById = Object.fromEntries(
  animatedEnemyIds.map((enemyId) => [
    enemyId,
    Object.fromEntries(enemyAnimationIds.map((animationId) => [animationId, createEnemyAnimationDef(enemyId, animationId)]))
  ])
) as Record<EnemyId, Record<EnemyAnimationId, EnemyAnimationDef>>;

export const enemyAnimationAssetEntries = animatedEnemyIds.flatMap((enemyId) =>
  enemyAnimationIds.flatMap((animationId) =>
    enemyAnimationsById[enemyId][animationId].frameKeys.map((key, index) => ({
      key,
      path: enemyAnimationsById[enemyId][animationId].framePaths[index]
    }))
  )
) satisfies readonly VisualAssetEntry[];

export const enemyBaseAssetEntries = animatedEnemyIds.map((enemyId) => ({
  key: `enemy_${enemyId}`,
  path: `${enemyAssetBasePath}/${enemyId}/walk/01.png`
})) satisfies readonly VisualAssetEntry[];

export const defaultVfxProfile: VfxProfile = {
  textureKey: "command",
  color: 0xaec5ff,
  blendMode: "add",
  scale: 1,
  lifetime: 0.42,
  particleKey: "particle_magic",
  telegraphShape: "circle",
  presentationKind: "areaField",
  originMode: "targetArea",
  motionStyle: "cast"
};

export const vfxProfiles: Record<string, VfxProfile> = {
  qinglong_arc: {
    textureKey: "melee_arc",
    color: 0x75f0aa,
    blendMode: "add",
    scale: 0.62,
    lifetime: 0.34,
    particleKey: "particle_spark",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "slashLunge",
    arcDegrees: 150,
    followPlayer: true
  },
  dragon_slash: {
    textureKey: "melee_arc",
    color: 0x75f0aa,
    blendMode: "add",
    scale: 0.9,
    lifetime: 0.38,
    particleKey: "particle_spark",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "slashLunge",
    arcDegrees: 190,
    followPlayer: true
  },
  spear_flash: {
    textureKey: "spear_thrust",
    color: 0xdffcff,
    blendMode: "add",
    scale: 0.88,
    lifetime: 0.24,
    particleKey: "particle_spark",
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "thrust",
    arcDegrees: 44,
    followPlayer: true
  },
  dragon_dash: {
    textureKey: "spear_thrust",
    color: 0x9bf3ff,
    blendMode: "add",
    scale: 0.9,
    lifetime: 0.28,
    particleKey: "particle_magic",
    telegraphShape: "slash",
    presentationKind: "dash",
    originMode: "playerAnchored",
    motionStyle: "thrust",
    arcDegrees: 62,
    followPlayer: true
  },
  wei_swords: {
    textureKey: "melee_arc",
    color: 0xd6ddff,
    blendMode: "add",
    scale: 0.58,
    lifetime: 0.3,
    particleKey: "particle_spark",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "slashLunge",
    arcDegrees: 125,
    followPlayer: true
  },
  tiger_cavalry: {
    textureKey: "tiger_cavalry",
    color: 0x9db8ff,
    blendMode: "add",
    scale: 1.08,
    lifetime: 0.42,
    particleKey: "particle_dirt",
    telegraphShape: "storm",
    presentationKind: "rangedProjectile",
    originMode: "projectile",
    motionStyle: "cast"
  },
  iron_cleave: {
    textureKey: "heavy_cleave_wave",
    color: 0xffa15f,
    blendMode: "add",
    scale: 0.68,
    lifetime: 0.34,
    particleKey: "particle_dirt",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "slashLunge",
    arcDegrees: 178,
    followPlayer: true
  },
  blood_rage: {
    textureKey: "blood_rage",
    color: 0xff3f47,
    blendMode: "add",
    scale: 1.02,
    lifetime: 0.5,
    particleKey: "particle_smoke",
    telegraphShape: "burst",
    presentationKind: "aura",
    originMode: "playerAnchored",
    motionStyle: "spin",
    arcDegrees: 360,
    followPlayer: true
  },
  fire_note: {
    textureKey: "fire_note",
    color: 0xff8a4f,
    blendMode: "add",
    scale: 0.92,
    lifetime: 0.48,
    particleKey: "particle_brackeys_fire",
    nativeColor: true,
    telegraphShape: "storm",
    presentationKind: "rangedProjectile",
    originMode: "projectile",
    motionStyle: "cast"
  },
  red_cliff_fire: {
    textureKey: "red_cliff_fire",
    color: 0xff6d32,
    blendMode: "add",
    scale: 1.12,
    lifetime: 0.72,
    particleKey: "particle_brackeys_fire",
    animationKeys: [brackeysFireRingAnimationKey],
    nativeColor: true,
    telegraphShape: "storm",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  crossbow_fan: {
    textureKey: "crossbow_fan",
    color: 0xffcc5a,
    blendMode: "add",
    scale: 0.72,
    lifetime: 0.22,
    particleKey: "particle_spark",
    telegraphShape: "rain",
    presentationKind: "rangedProjectile",
    originMode: "projectile",
    motionStyle: "cast"
  },
  arrow_rain: {
    textureKey: "arrow_rain",
    color: 0xffcc5a,
    blendMode: "add",
    scale: 0.9,
    lifetime: 0.42,
    particleKey: "particle_spark",
    telegraphShape: "rain",
    presentationKind: "rain",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  petal_waltz: {
    textureKey: "petal_blade",
    color: 0xff9acb,
    blendMode: "add",
    scale: 0.82,
    lifetime: 0.64,
    particleKey: "particle_magic",
    telegraphShape: "storm",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "spin",
    arcDegrees: 280,
    followPlayer: true
  },
  allure_dance: {
    textureKey: "petal_blade",
    color: 0xff9acb,
    blendMode: "add",
    scale: 1.1,
    lifetime: 0.72,
    particleKey: "particle_magic",
    telegraphShape: "storm",
    presentationKind: "aura",
    originMode: "playerAnchored",
    motionStyle: "spin",
    arcDegrees: 360,
    followPlayer: true
  },
  moon_blades: {
    textureKey: "melee_arc",
    color: 0xffd98a,
    blendMode: "add",
    scale: 0.64,
    lifetime: 0.32,
    particleKey: "particle_spark",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "spin",
    arcDegrees: 250,
    followPlayer: true
  },
  frost_lotus: {
    textureKey: "frost_lotus",
    color: 0x9eefff,
    blendMode: "add",
    scale: 1,
    lifetime: 0.58,
    particleKey: "particle_magic",
    telegraphShape: "burst",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  phoenix_feathers: {
    textureKey: "phoenix_feathers",
    color: 0xff8a4f,
    blendMode: "add",
    scale: 0.82,
    lifetime: 0.36,
    particleKey: "particle_spark",
    telegraphShape: "rain",
    presentationKind: "rangedProjectile",
    originMode: "projectile",
    motionStyle: "cast"
  },
  thunder_charm: {
    textureKey: "thunder_charm",
    color: 0xc9a8ff,
    blendMode: "add",
    scale: 1.1,
    lifetime: 0.38,
    particleKey: "particle_brackeys_spark",
    animationKeys: [brackeysElectricRingAnimationKey],
    nativeColor: true,
    telegraphShape: "burst",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  shadow_clones: {
    textureKey: "melee_arc",
    color: 0xc7d2ff,
    blendMode: "add",
    scale: 0.74,
    lifetime: 0.3,
    particleKey: "particle_magic",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "slashLunge",
    arcDegrees: 160,
    followPlayer: true
  },
  siege_drums: {
    textureKey: "siege_drums",
    color: 0xffd98a,
    blendMode: "add",
    scale: 1.18,
    lifetime: 0.62,
    particleKey: "particle_dirt",
    telegraphShape: "burst",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  morale_fire: {
    textureKey: "red_cliff_fire",
    color: 0xff6d32,
    blendMode: "add",
    scale: 1.18,
    lifetime: 0.7,
    particleKey: "particle_brackeys_fire",
    animationKeys: [brackeysFireRingAnimationKey],
    nativeColor: true,
    telegraphShape: "storm",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  morale_dragon: {
    textureKey: "melee_arc",
    color: 0x77f0ae,
    blendMode: "add",
    scale: 1.18,
    lifetime: 0.56,
    particleKey: "particle_spark",
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "spin",
    arcDegrees: 360,
    followPlayer: true
  },
  morale_banner: {
    textureKey: "tiger_cavalry",
    color: 0x9db8ff,
    blendMode: "add",
    scale: 1.08,
    lifetime: 0.58,
    particleKey: "particle_magic",
    telegraphShape: "burst",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  enemy_arrow: {
    textureKey: "enemy_arrow",
    color: 0xe7c27b,
    blendMode: "add",
    scale: 0.66,
    lifetime: 0.18,
    particleKey: "particle_spark",
    telegraphShape: "rain",
    presentationKind: "rangedProjectile",
    originMode: "projectile",
    motionStyle: "cast"
  },
  lubu_shock: {
    textureKey: "shock",
    color: 0xb15cff,
    blendMode: "add",
    scale: 1.25,
    lifetime: 0.5,
    particleKey: "particle_brackeys_light",
    animationKeys: [brackeysElectricRingAnimationKey],
    nativeColor: true,
    telegraphShape: "burst",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  hit_spark: {
    textureKey: "particle_spark",
    color: 0xfff1cf,
    blendMode: "add",
    scale: 0.55,
    lifetime: 0.16,
    particleKey: "particle_spark",
    animationKeys: [hitSparkAnimationKey],
    telegraphShape: "burst"
  },
  crit_spark: {
    textureKey: "particle_spark",
    color: 0xffdd7a,
    blendMode: "add",
    scale: 0.78,
    lifetime: 0.22,
    particleKey: "particle_brackeys_spark",
    animationKeys: [hitRadialAnimationKey],
    telegraphShape: "burst"
  },
  level_ring: {
    textureKey: "particle_magic",
    color: 0xffdd7a,
    blendMode: "add",
    scale: 1.14,
    lifetime: 0.55,
    particleKey: "particle_magic",
    telegraphShape: "burst"
  },
  evolution_burst: {
    textureKey: "particle_circle",
    color: 0xffdd7a,
    blendMode: "add",
    scale: 1.28,
    lifetime: 0.8,
    particleKey: "particle_magic",
    telegraphShape: "burst"
  },
  guard_flash: {
    textureKey: "particle_circle",
    color: 0xfff1cf,
    blendMode: "add",
    scale: 0.95,
    lifetime: 0.24,
    particleKey: "particle_spark",
    telegraphShape: "burst"
  }
};

export const enemyVisualProfiles: Record<EnemyId, EnemyVisualProfile> = {
  infantry: {
    spriteKey: "enemy_infantry",
    shadowScale: 0.8,
    hitTint: 0xfff1cf,
    deathFxKey: "particle_dirt",
    baseScale: 1,
    animationScale: 0.72,
    outlineColor: 0xded0b0
  },
  archer: {
    spriteKey: "enemy_archer",
    shadowScale: 0.76,
    hitTint: 0xffdf91,
    deathFxKey: "particle_dirt",
    baseScale: 0.96,
    animationScale: 0.7,
    outlineColor: 0xd6c17a
  },
  shield: {
    spriteKey: "enemy_shield",
    shadowScale: 0.94,
    hitTint: 0xdfe8ff,
    deathFxKey: "particle_dirt",
    baseScale: 1.04,
    animationScale: 0.76,
    outlineColor: 0xc5cbd6
  },
  cavalry: {
    spriteKey: "enemy_cavalry",
    shadowScale: 1.1,
    hitTint: 0xffcf86,
    deathFxKey: "particle_dirt",
    baseScale: 1.06,
    animationScale: 0.74,
    outlineColor: 0xe0b16b
  },
  captain: {
    spriteKey: "enemy_captain",
    shadowScale: 1.22,
    hitTint: 0xffdc86,
    deathFxKey: "particle_smoke",
    baseScale: 1.12,
    animationScale: 0.78,
    eliteFrame: 1,
    outlineColor: 0xe2b55f
  },
  lubu: {
    spriteKey: "enemy_lubu",
    shadowScale: 1.72,
    hitTint: 0xff7bb4,
    deathFxKey: "particle_magic",
    baseScale: 1.14,
    animationScale: 0.82,
    eliteFrame: 2,
    outlineColor: 0xff4e74
  }
};
