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

export const audioKeys = {
  music: musicKeys,
  sfx: sfxKeys
} as const;

/** Must respect Vite `base` (e.g. GitHub Pages project site under /<repo>/) */
const audioBasePath = `${import.meta.env.BASE_URL}assets/audio`;

export const audioPaths: Record<AudioKey, string> = {
  music_menu: `${audioBasePath}/music-menu.wav`,
  music_battle: `${audioBasePath}/music-battle.wav`,
  music_boss: `${audioBasePath}/music-boss.wav`,
  sfx_hit: `${audioBasePath}/sfx-hit.wav`,
  sfx_crit: `${audioBasePath}/sfx-crit.wav`,
  sfx_kill: `${audioBasePath}/sfx-kill.wav`,
  sfx_level_up: `${audioBasePath}/sfx-level-up.wav`,
  sfx_manual: `${audioBasePath}/sfx-manual.wav`,
  sfx_evolution: `${audioBasePath}/sfx-evolution.wav`,
  sfx_morale: `${audioBasePath}/sfx-morale.wav`,
  sfx_boss: `${audioBasePath}/sfx-boss.wav`,
  sfx_player_hit: `${audioBasePath}/sfx-player-hit.wav`,
  sfx_victory: `${audioBasePath}/sfx-victory.wav`,
  sfx_defeat: `${audioBasePath}/sfx-defeat.wav`,
  sfx_ui_select: `${audioBasePath}/sfx-ui-select.wav`,
  sfx_ui_confirm: `${audioBasePath}/sfx-ui-confirm.wav`
};

export const audioAssetEntries = Object.entries(audioPaths).map(([key, path]) => ({
  key: key as AudioKey,
  path
}));
