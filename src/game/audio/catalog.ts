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

export const audioPaths: Record<AudioKey, string> = {
  music_menu: "/assets/audio/music-menu.wav",
  music_battle: "/assets/audio/music-battle.wav",
  music_boss: "/assets/audio/music-boss.wav",
  sfx_hit: "/assets/audio/sfx-hit.wav",
  sfx_crit: "/assets/audio/sfx-crit.wav",
  sfx_kill: "/assets/audio/sfx-kill.wav",
  sfx_level_up: "/assets/audio/sfx-level-up.wav",
  sfx_manual: "/assets/audio/sfx-manual.wav",
  sfx_evolution: "/assets/audio/sfx-evolution.wav",
  sfx_morale: "/assets/audio/sfx-morale.wav",
  sfx_boss: "/assets/audio/sfx-boss.wav",
  sfx_player_hit: "/assets/audio/sfx-player-hit.wav",
  sfx_victory: "/assets/audio/sfx-victory.wav",
  sfx_defeat: "/assets/audio/sfx-defeat.wav",
  sfx_ui_select: "/assets/audio/sfx-ui-select.wav",
  sfx_ui_confirm: "/assets/audio/sfx-ui-confirm.wav"
};

export const audioAssetEntries = Object.entries(audioPaths).map(([key, path]) => ({
  key: key as AudioKey,
  path
}));
