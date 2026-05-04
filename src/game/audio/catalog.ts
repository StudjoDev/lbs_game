export const musicKeys = ["music_menu", "music_battle", "music_boss"] as const;

export const sfxKeys = [
  "sfx_hit",
  "sfx_crit",
  "sfx_kill",
  "sfx_level_up",
  "sfx_manual",
  "sfx_evolution",
  "sfx_morale",
  "sfx_boss",
  "sfx_player_hit",
  "sfx_victory",
  "sfx_defeat",
  "sfx_ui_select",
  "sfx_ui_confirm"
] as const;

export type MusicKey = (typeof musicKeys)[number];
export type SfxKey = (typeof sfxKeys)[number];
export type AudioKey = MusicKey | SfxKey;
export type SfxVariantKey = `${SfxKey}_${number}`;
export type AudioAssetKey = MusicKey | SfxKey | SfxVariantKey;

export interface AudioAssetEntry {
  key: AudioAssetKey;
  path: string;
  logicalKey: AudioKey;
}

export interface SfxVariantAsset {
  key: SfxVariantKey;
  path: string;
}

export interface SfxVariantProfile {
  variants: readonly SfxVariantAsset[];
  detuneRange: readonly [number, number];
  volumeJitter: readonly [number, number];
}

export const audioKeys = {
  music: musicKeys,
  sfx: sfxKeys
} as const;

/** Must respect Vite `base` (e.g. GitHub Pages project site under /<repo>/) */
const audioBasePath = `${import.meta.env.BASE_URL}assets/audio`;
const bgmBasePath = `${audioBasePath}/bgm`;
const sfxBasePath = `${audioBasePath}/sfx`;

export const musicPaths: Record<MusicKey, string> = {
  music_menu: `${bgmBasePath}/menu/lotus-pond-loop.wav`,
  music_battle: `${bgmBasePath}/battle/dragon-dance-loop.wav`,
  music_boss: `${bgmBasePath}/boss/battle-theme-a.mp3`
};

function defineSfxVariants(
  key: SfxKey,
  paths: readonly string[],
  options: Pick<SfxVariantProfile, "detuneRange" | "volumeJitter">
): SfxVariantProfile {
  return {
    variants: paths.map((path, index) => ({
      key: `${key}_${index + 1}` as SfxVariantKey,
      path
    })),
    detuneRange: options.detuneRange,
    volumeJitter: options.volumeJitter
  };
}

export const sfxVariantCatalog: Record<SfxKey, SfxVariantProfile> = {
  sfx_hit: defineSfxVariants(
    "sfx_hit",
    [
      `${sfxBasePath}/hit/hit-impact-1.ogg`,
      `${sfxBasePath}/hit/hit-impact-2.ogg`,
      `${sfxBasePath}/hit/hit-impact-3.ogg`
    ],
    { detuneRange: [-55, 55], volumeJitter: [0.86, 1.02] }
  ),
  sfx_crit: defineSfxVariants(
    "sfx_crit",
    [
      `${sfxBasePath}/hit/crit-clash-1.ogg`,
      `${sfxBasePath}/hit/crit-clash-2.ogg`,
      `${sfxBasePath}/hit/crit-clash-3.ogg`,
      `${sfxBasePath}/hit/crit-metal-4.ogg`
    ],
    { detuneRange: [-40, 70], volumeJitter: [0.92, 1.08] }
  ),
  sfx_kill: defineSfxVariants(
    "sfx_kill",
    [
      `${sfxBasePath}/weapon/kill-sword-1.ogg`,
      `${sfxBasePath}/weapon/kill-sword-2.ogg`,
      `${sfxBasePath}/weapon/kill-swish-3.wav`
    ],
    { detuneRange: [-70, 50], volumeJitter: [0.82, 1.04] }
  ),
  sfx_level_up: defineSfxVariants(
    "sfx_level_up",
    [`${sfxBasePath}/magic/level-up-magic-1.wav`, `${sfxBasePath}/magic/level-up-coin-2.wav`],
    { detuneRange: [-20, 80], volumeJitter: [0.9, 1.05] }
  ),
  sfx_manual: defineSfxVariants(
    "sfx_manual",
    [
      `${sfxBasePath}/weapon/manual-swish-1.wav`,
      `${sfxBasePath}/weapon/manual-swish-2.wav`,
      `${sfxBasePath}/weapon/manual-swish-3.wav`,
      `${sfxBasePath}/weapon/manual-sword-1.ogg`,
      `${sfxBasePath}/weapon/manual-sword-2.ogg`,
      `${sfxBasePath}/weapon/manual-swing-3.wav`
    ],
    { detuneRange: [-90, 70], volumeJitter: [0.78, 1.04] }
  ),
  sfx_evolution: defineSfxVariants(
    "sfx_evolution",
    [`${sfxBasePath}/magic/evolution-spell-1.wav`, `${sfxBasePath}/magic/evolution-bubble-2.wav`],
    { detuneRange: [-30, 60], volumeJitter: [0.94, 1.08] }
  ),
  sfx_morale: defineSfxVariants(
    "sfx_morale",
    [`${sfxBasePath}/magic/morale-magic-1.wav`, `${sfxBasePath}/magic/morale-spell-2.wav`],
    { detuneRange: [-40, 70], volumeJitter: [0.88, 1.06] }
  ),
  sfx_boss: defineSfxVariants(
    "sfx_boss",
    [`${sfxBasePath}/enemy/boss-giant-1.wav`, `${sfxBasePath}/enemy/boss-giant-2.wav`, `${sfxBasePath}/enemy/boss-beast-3.wav`],
    { detuneRange: [-80, 20], volumeJitter: [0.78, 0.96] }
  ),
  sfx_player_hit: defineSfxVariants(
    "sfx_player_hit",
    [
      `${sfxBasePath}/hit/player-hit-1.ogg`,
      `${sfxBasePath}/hit/player-hit-2.ogg`,
      `${sfxBasePath}/hit/player-hit-3.ogg`
    ],
    { detuneRange: [-45, 45], volumeJitter: [0.82, 1] }
  ),
  sfx_victory: defineSfxVariants(
    "sfx_victory",
    [`${sfxBasePath}/ui/victory-ui-1.wav`, `${sfxBasePath}/ui/victory-coin-2.wav`],
    { detuneRange: [-15, 45], volumeJitter: [0.92, 1.04] }
  ),
  sfx_defeat: defineSfxVariants(
    "sfx_defeat",
    [`${sfxBasePath}/enemy/defeat-shade-1.wav`, `${sfxBasePath}/enemy/defeat-shade-2.wav`],
    { detuneRange: [-55, 15], volumeJitter: [0.86, 1] }
  ),
  sfx_ui_select: defineSfxVariants(
    "sfx_ui_select",
    [`${sfxBasePath}/ui/select-1.wav`, `${sfxBasePath}/ui/select-2.wav`],
    { detuneRange: [-20, 30], volumeJitter: [0.74, 0.92] }
  ),
  sfx_ui_confirm: defineSfxVariants(
    "sfx_ui_confirm",
    [`${sfxBasePath}/ui/confirm-1.wav`, `${sfxBasePath}/ui/confirm-2.wav`],
    { detuneRange: [-15, 35], volumeJitter: [0.82, 1] }
  )
};

export const audioPaths: Record<AudioKey, string> = {
  ...musicPaths,
  ...Object.fromEntries(sfxKeys.map((key) => [key, sfxVariantCatalog[key].variants[0]?.path ?? `${audioBasePath}/${key}.wav`]))
} as Record<AudioKey, string>;

const musicAssetEntries = musicKeys.map((key) => ({
  key,
  path: musicPaths[key],
  logicalKey: key
})) satisfies readonly AudioAssetEntry[];

const sfxLogicalAliasEntries = sfxKeys.map((key) => ({
  key,
  path: audioPaths[key],
  logicalKey: key
})) satisfies readonly AudioAssetEntry[];

const sfxVariantAssetEntries = sfxKeys.flatMap((logicalKey) =>
  sfxVariantCatalog[logicalKey].variants.map((asset) => ({
    ...asset,
    logicalKey
  }))
) satisfies readonly AudioAssetEntry[];

export const audioAssetEntries = [...musicAssetEntries, ...sfxLogicalAliasEntries, ...sfxVariantAssetEntries] as const;
