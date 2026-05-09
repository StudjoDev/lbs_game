import type { ChapterId, ConquestCityId } from "../types";

export type BattlefieldThemeId = "hulao" | "red_cliff" | "conquest";

export interface BattlefieldThemeDef {
  id: BattlefieldThemeId;
  hazeColor: number;
  hazeAlpha: number;
  lineColor: number;
  lineAlpha: number;
  emberColor: number;
  propAlpha: number;
  propSet: readonly string[];
}

export const battlefieldThemes: Record<BattlefieldThemeId, BattlefieldThemeDef> = {
  hulao: {
    id: "hulao",
    hazeColor: 0x090608,
    hazeAlpha: 0.24,
    lineColor: 0xffd98a,
    lineAlpha: 0.12,
    emberColor: 0xffd98a,
    propAlpha: 0.28,
    propSet: ["battle_spear_prop", "battle_stone_prop", "battle_cloth_red"]
  },
  red_cliff: {
    id: "red_cliff",
    hazeColor: 0x120706,
    hazeAlpha: 0.28,
    lineColor: 0xff7a45,
    lineAlpha: 0.16,
    emberColor: 0xff8a4f,
    propAlpha: 0.32,
    propSet: ["battle_cloth_red", "battle_spear_prop", "battle_stone_prop"]
  },
  conquest: {
    id: "conquest",
    hazeColor: 0x070a0b,
    hazeAlpha: 0.2,
    lineColor: 0x7debd3,
    lineAlpha: 0.1,
    emberColor: 0xdffade,
    propAlpha: 0.24,
    propSet: ["battle_cloth_jade", "battle_spear_prop", "battle_stone_prop"]
  }
};

export function battlefieldThemeForRun(chapterId: ChapterId, conquestCityId?: ConquestCityId): BattlefieldThemeDef {
  if (conquestCityId) {
    return battlefieldThemes.conquest;
  }
  if (chapterId === "hulao_outer") {
    return battlefieldThemes.hulao;
  }
  if (chapterId === "red_cliff_line") {
    return battlefieldThemes.red_cliff;
  }
  return battlefieldThemes.conquest;
}
