import type { AbilityDef } from "../types";

export interface TechniqueDef {
  id: string;
  unlockId: string;
  upgradeId: string;
  cooldown: number;
  ability: AbilityDef;
}

export const techniques: TechniqueDef[] = [
  {
    id: "moon_blades",
    unlockId: "tech_moon_blades",
    upgradeId: "tech_moon_blades",
    cooldown: 3.8,
    ability: {
      id: "tech_moon_blades",
      name: "月牙飛刃",
      description: "定期向四周放出旋轉月牙刃，補足近身清怪能力。",
      trigger: "auto",
      cooldown: 3.8,
      range: 520,
      radius: 32,
      damage: 34,
      damageTags: ["blade", "pierce"],
      vfxKey: "moon_blades",
      effectId: "moon_blades"
    }
  },
  {
    id: "frost_lotus",
    unlockId: "tech_frost_lotus",
    upgradeId: "tech_frost_lotus",
    cooldown: 5.6,
    ability: {
      id: "tech_frost_lotus",
      name: "冰蓮結界",
      description: "在敵群腳下開出冰蓮，造成範圍傷害並短暫牽制。",
      trigger: "auto",
      cooldown: 5.6,
      range: 620,
      radius: 82,
      damage: 54,
      damageTags: ["command", "shock"],
      vfxKey: "frost_lotus",
      effectId: "frost_lotus"
    }
  },
  {
    id: "phoenix_feathers",
    unlockId: "tech_phoenix_feathers",
    upgradeId: "tech_phoenix_feathers",
    cooldown: 4.9,
    ability: {
      id: "tech_phoenix_feathers",
      name: "鳳羽連射",
      description: "朝前方扇形射出燃燒羽箭，適合切開追擊路線。",
      trigger: "auto",
      cooldown: 4.9,
      range: 660,
      radius: 24,
      damage: 32,
      damageTags: ["arrow", "fire"],
      vfxKey: "phoenix_feathers",
      effectId: "phoenix_feathers"
    }
  },
  {
    id: "thunder_charm",
    unlockId: "tech_thunder_charm",
    upgradeId: "tech_thunder_charm",
    cooldown: 6.4,
    ability: {
      id: "tech_thunder_charm",
      name: "雷符天降",
      description: "鎖定數個敵人落下雷符，對精英與密集敵群特別有效。",
      trigger: "auto",
      cooldown: 6.4,
      range: 760,
      radius: 64,
      damage: 72,
      damageTags: ["command", "shock"],
      vfxKey: "thunder_charm",
      effectId: "thunder_charm"
    }
  },
  {
    id: "shadow_clones",
    unlockId: "tech_shadow_clones",
    upgradeId: "tech_shadow_clones",
    cooldown: 5.2,
    ability: {
      id: "tech_shadow_clones",
      name: "影分身斬",
      description: "召出三道分身刀光穿敵，讓遠距離清線更穩定。",
      trigger: "auto",
      cooldown: 5.2,
      range: 720,
      radius: 38,
      damage: 46,
      damageTags: ["blade", "pierce"],
      vfxKey: "shadow_clones",
      effectId: "shadow_clones"
    }
  },
  {
    id: "siege_drums",
    unlockId: "tech_siege_drums",
    upgradeId: "tech_siege_drums",
    cooldown: 7,
    ability: {
      id: "tech_siege_drums",
      name: "破陣戰鼓",
      description: "週期性震出戰鼓衝擊波，保護周身並推開包圍。",
      trigger: "auto",
      cooldown: 7,
      range: 360,
      radius: 132,
      damage: 66,
      damageTags: ["command", "shock"],
      vfxKey: "siege_drums",
      effectId: "siege_drums"
    }
  }
];

export const techniqueById = Object.fromEntries(techniques.map((technique) => [technique.id, technique])) as Record<
  string,
  TechniqueDef
>;
