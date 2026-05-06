import type { AbilityDef, HeroId } from "../types";

export interface UltimateProfile {
  heroId: HeroId;
  name: string;
  duration: number;
  pulseEvery: number;
  vfxKey: string;
  empoweredUnlockId: string;
  presentation: UltimatePresentation;
  ultimateAnimationKey: string;
  autoCooldownScale?: number;
  moveSpeedScale?: number;
  pulseAbility: AbilityDef;
  empoweredPulseAbility?: AbilityDef;
  alternatePulseAbility?: AbilityDef;
  bonusEvery?: number;
  bonusPulseAbility?: AbilityDef;
  finisherAbility: AbilityDef;
  finisherVfxKey: string;
}

export interface UltimatePresentation {
  startVfxKey: string;
  pulseVfxKey: string;
  finisherVfxKey: string;
  shortLabel: string;
}

type UltimateBaseProfile = Omit<UltimateProfile, "presentation" | "ultimateAnimationKey" | "finisherAbility" | "finisherVfxKey">;

type UltimateEnhancement = Pick<UltimateProfile, "presentation" | "finisherAbility" | "finisherVfxKey">;

function ultimateAbility(
  ownerHeroId: HeroId,
  id: string,
  name: string,
  range: number,
  radius: number,
  damage: number,
  damageTags: AbilityDef["damageTags"],
  vfxKey: string,
  effectId: string
): AbilityDef {
  return {
    id,
    ownerHeroId,
    name,
    description: name,
    trigger: "ultimate",
    cooldown: 0,
    range,
    radius,
    damage,
    damageTags,
    vfxKey,
    effectId
  };
}

function masteryUnlockId(heroId: HeroId): string {
  return `ultimate_${heroId}_mastery`;
}

function ultimateAnimationKey(heroId: HeroId): string {
  return `hero_${heroId}_ultimate`;
}

function presentation(startVfxKey: string, finisherVfxKey: string, shortLabel: string): UltimatePresentation {
  return {
    startVfxKey,
    pulseVfxKey: startVfxKey,
    finisherVfxKey,
    shortLabel
  };
}

const ultimateBaseProfiles: UltimateBaseProfile[] = [
  {
    heroId: "liubei",
    name: "昭烈聚義",
    duration: 8,
    pulseEvery: 1.45,
    vfxKey: "siege_drums",
    empoweredUnlockId: masteryUnlockId("liubei"),
    pulseAbility: ultimateAbility("liubei", "liubei_ultimate_oath", "昭烈軍鼓", 360, 112, 34, ["command", "shock"], "siege_drums", "siege_drums"),
    alternatePulseAbility: ultimateAbility("liubei", "liubei_ultimate_swords", "仁德劍令", 500, 34, 30, ["command", "blade"], "wei_swords", "guard_swords")
  },
  {
    heroId: "guanyu",
    name: "青龍無雙",
    duration: 7.5,
    pulseEvery: 1.45,
    vfxKey: "qinglong_arc",
    empoweredUnlockId: masteryUnlockId("guanyu"),
    pulseAbility: ultimateAbility("guanyu", "guanyu_ultimate_arc", "青龍亂舞", 330, 88, 34, ["blade", "shock"], "qinglong_arc", "arc_sweep"),
    bonusEvery: 3,
    bonusPulseAbility: ultimateAbility("guanyu", "guanyu_ultimate_dragon", "青龍破軍", 640, 48, 76, ["blade", "shock"], "dragon_slash", "dragon_slash")
  },
  {
    heroId: "zhangfei",
    name: "長坂雷吼",
    duration: 8.4,
    pulseEvery: 1.75,
    vfxKey: "blood_rage",
    empoweredUnlockId: masteryUnlockId("zhangfei"),
    pulseAbility: ultimateAbility("zhangfei", "zhangfei_ultimate_roar", "長坂怒震", 250, 124, 42, ["shock", "blade"], "blood_rage", "blood_rage"),
    alternatePulseAbility: ultimateAbility("zhangfei", "zhangfei_ultimate_cleave", "丈八裂地", 260, 104, 45, ["blade", "shock"], "iron_cleave", "heavy_cleave")
  },
  {
    heroId: "zhaoyun",
    name: "龍膽無雙",
    duration: 6.8,
    pulseEvery: 0.95,
    vfxKey: "dragon_dash",
    empoweredUnlockId: masteryUnlockId("zhaoyun"),
    autoCooldownScale: 0.72,
    moveSpeedScale: 1.18,
    pulseAbility: ultimateAbility("zhaoyun", "zhaoyun_ultimate_spear", "龍膽銀槍", 440, 28, 27, ["pierce", "shock"], "spear_flash", "spear_flurry"),
    empoweredPulseAbility: ultimateAbility("zhaoyun", "zhaoyun_ultimate_dash", "七探盤蛇", 170, 56, 45, ["pierce", "shock"], "dragon_dash", "seven_dashes")
  },
  {
    heroId: "machao",
    name: "錦馬無雙",
    duration: 6.9,
    pulseEvery: 0.96,
    vfxKey: "dragon_dash",
    empoweredUnlockId: masteryUnlockId("machao"),
    autoCooldownScale: 0.73,
    moveSpeedScale: 1.17,
    pulseAbility: ultimateAbility("machao", "machao_ultimate_spear", "潼關掠影槍", 430, 30, 28, ["pierce", "shock"], "spear_flash", "spear_flurry"),
    empoweredPulseAbility: ultimateAbility("machao", "machao_ultimate_dash", "錦騎裂陣", 175, 58, 46, ["pierce", "shock"], "dragon_dash", "seven_dashes")
  },
  {
    heroId: "zhugeliang",
    name: "臥龍借風",
    duration: 8.8,
    pulseEvery: 1.55,
    vfxKey: "thunder_charm",
    empoweredUnlockId: masteryUnlockId("zhugeliang"),
    pulseAbility: ultimateAbility("zhugeliang", "zhugeliang_ultimate_thunder", "八陣雷符", 640, 76, 36, ["command", "shock"], "thunder_charm", "thunder_charm"),
    empoweredPulseAbility: ultimateAbility("zhugeliang", "zhugeliang_ultimate_lotus", "臥龍冰蓮", 600, 104, 40, ["command", "shock"], "frost_lotus", "frost_lotus")
  },
  {
    heroId: "caocao",
    name: "魏武無雙",
    duration: 8,
    pulseEvery: 1.6,
    vfxKey: "tiger_cavalry",
    empoweredUnlockId: masteryUnlockId("caocao"),
    pulseAbility: ultimateAbility("caocao", "caocao_ultimate_cavalry", "虎豹奔襲", 720, 54, 52, ["command", "shock"], "tiger_cavalry", "tiger_cavalry"),
    alternatePulseAbility: ultimateAbility("caocao", "caocao_ultimate_swords", "魏武劍陣", 480, 34, 36, ["command", "blade"], "wei_swords", "guard_swords")
  },
  {
    heroId: "xiahoudun",
    name: "剛烈無雙",
    duration: 8.5,
    pulseEvery: 1.9,
    vfxKey: "blood_rage",
    empoweredUnlockId: masteryUnlockId("xiahoudun"),
    pulseAbility: ultimateAbility("xiahoudun", "xiahoudun_ultimate_cleave", "剛烈斬浪", 250, 108, 42, ["blade", "shock"], "iron_cleave", "heavy_cleave"),
    alternatePulseAbility: ultimateAbility("xiahoudun", "xiahoudun_ultimate_blood", "血戰鐵壁", 220, 132, 36, ["blade", "shock"], "blood_rage", "blood_rage")
  },
  {
    heroId: "xuchu",
    name: "虎衛無雙",
    duration: 8.8,
    pulseEvery: 1.95,
    vfxKey: "blood_rage",
    empoweredUnlockId: masteryUnlockId("xuchu"),
    pulseAbility: ultimateAbility("xuchu", "xuchu_ultimate_guard", "虎癡護主", 240, 134, 44, ["shock", "blade"], "blood_rage", "blood_rage"),
    alternatePulseAbility: ultimateAbility("xuchu", "xuchu_ultimate_crush", "虎衛碎陣", 250, 112, 48, ["shock", "blade"], "iron_cleave", "heavy_cleave")
  },
  {
    heroId: "zhangliao",
    name: "合肥無雙",
    duration: 7,
    pulseEvery: 1.05,
    vfxKey: "dragon_dash",
    empoweredUnlockId: masteryUnlockId("zhangliao"),
    autoCooldownScale: 0.76,
    moveSpeedScale: 1.14,
    pulseAbility: ultimateAbility("zhangliao", "zhangliao_ultimate_spear", "逍遙突槍", 460, 30, 29, ["pierce", "command"], "spear_flash", "spear_flurry"),
    empoweredPulseAbility: ultimateAbility("zhangliao", "zhangliao_ultimate_dash", "合肥破膽", 190, 62, 48, ["pierce", "shock"], "dragon_dash", "seven_dashes")
  },
  {
    heroId: "simayi",
    name: "冢虎無雙",
    duration: 8.6,
    pulseEvery: 1.5,
    vfxKey: "thunder_charm",
    empoweredUnlockId: masteryUnlockId("simayi"),
    pulseAbility: ultimateAbility("simayi", "simayi_ultimate_thunder", "狼顧雷獄", 640, 72, 34, ["command", "shock"], "thunder_charm", "thunder_charm"),
    empoweredPulseAbility: ultimateAbility("simayi", "simayi_ultimate_lotus", "冢虎冰謀", 580, 100, 39, ["command", "shock"], "frost_lotus", "frost_lotus")
  },
  {
    heroId: "sunquan",
    name: "江東無雙",
    duration: 8.2,
    pulseEvery: 1.45,
    vfxKey: "siege_drums",
    empoweredUnlockId: masteryUnlockId("sunquan"),
    pulseAbility: ultimateAbility("sunquan", "sunquan_ultimate_banner", "江東坐鎮", 360, 118, 34, ["command", "shock"], "siege_drums", "siege_drums"),
    alternatePulseAbility: ultimateAbility("sunquan", "sunquan_ultimate_fire", "碧眼火令", 500, 42, 32, ["fire", "command"], "fire_note", "fire_note")
  },
  {
    heroId: "zhouyu",
    name: "赤壁無雙",
    duration: 9,
    pulseEvery: 1.65,
    vfxKey: "red_cliff_fire",
    empoweredUnlockId: masteryUnlockId("zhouyu"),
    pulseAbility: ultimateAbility("zhouyu", "zhouyu_ultimate_fireline", "赤壁火線", 450, 118, 28, ["fire", "command"], "red_cliff_fire", "red_cliff_fire"),
    empoweredPulseAbility: ultimateAbility("zhouyu", "zhouyu_ultimate_note", "東風火音", 520, 42, 33, ["fire", "command"], "fire_note", "fire_note")
  },
  {
    heroId: "sunshangxiang",
    name: "弓腰無雙",
    duration: 7.2,
    pulseEvery: 1,
    vfxKey: "arrow_rain",
    empoweredUnlockId: masteryUnlockId("sunshangxiang"),
    autoCooldownScale: 0.7,
    pulseAbility: ultimateAbility("sunshangxiang", "sunshangxiang_ultimate_fan", "雙弩連珠", 560, 22, 22, ["arrow", "pierce"], "crossbow_fan", "fan_bolts"),
    alternatePulseAbility: ultimateAbility("sunshangxiang", "sunshangxiang_ultimate_rain", "火箭天雨", 470, 96, 34, ["arrow", "fire"], "arrow_rain", "arrow_rain")
  },
  {
    heroId: "ganning",
    name: "錦帆無雙",
    duration: 7.4,
    pulseEvery: 1.05,
    vfxKey: "shadow_clones",
    empoweredUnlockId: masteryUnlockId("ganning"),
    autoCooldownScale: 0.76,
    moveSpeedScale: 1.12,
    pulseAbility: ultimateAbility("ganning", "ganning_ultimate_clones", "錦帆斬影", 520, 36, 30, ["blade", "pierce"], "shadow_clones", "shadow_clones"),
    empoweredPulseAbility: ultimateAbility("ganning", "ganning_ultimate_raid", "百騎夜襲", 210, 64, 48, ["blade", "shock"], "dragon_dash", "seven_dashes")
  },
  {
    heroId: "taishici",
    name: "神射無雙",
    duration: 7.6,
    pulseEvery: 1.05,
    vfxKey: "phoenix_feathers",
    empoweredUnlockId: masteryUnlockId("taishici"),
    autoCooldownScale: 0.78,
    pulseAbility: ultimateAbility("taishici", "taishici_ultimate_fan", "神亭連射", 580, 24, 24, ["arrow", "pierce"], "crossbow_fan", "fan_bolts"),
    alternatePulseAbility: ultimateAbility("taishici", "taishici_ultimate_feathers", "鳳羽穿營", 620, 36, 40, ["arrow", "fire"], "phoenix_feathers", "phoenix_feathers")
  },
  {
    heroId: "diaochan",
    name: "閉月無雙",
    duration: 8.2,
    pulseEvery: 1.25,
    vfxKey: "allure_dance",
    empoweredUnlockId: masteryUnlockId("diaochan"),
    moveSpeedScale: 1.1,
    pulseAbility: ultimateAbility("diaochan", "diaochan_ultimate_petal", "花刃旋舞", 300, 116, 27, ["blade", "charm"], "petal_waltz", "petal_waltz"),
    empoweredPulseAbility: ultimateAbility("diaochan", "diaochan_ultimate_allure", "閉月傾城", 320, 150, 34, ["blade", "charm", "shock"], "allure_dance", "allure_dance")
  },
  {
    heroId: "zhangjiao",
    name: "黃天無雙",
    duration: 8.4,
    pulseEvery: 1.45,
    vfxKey: "thunder_charm",
    empoweredUnlockId: masteryUnlockId("zhangjiao"),
    pulseAbility: ultimateAbility("zhangjiao", "zhangjiao_ultimate_thunder", "黃天雷籙", 640, 72, 34, ["shock", "command"], "thunder_charm", "thunder_charm"),
    empoweredPulseAbility: ultimateAbility("zhangjiao", "zhangjiao_ultimate_lotus", "太平法陣", 580, 102, 38, ["shock", "command"], "frost_lotus", "frost_lotus")
  },
  {
    heroId: "yuanshao",
    name: "河北無雙",
    duration: 8.2,
    pulseEvery: 1.55,
    vfxKey: "tiger_cavalry",
    empoweredUnlockId: masteryUnlockId("yuanshao"),
    pulseAbility: ultimateAbility("yuanshao", "yuanshao_ultimate_cavalry", "河北萬騎", 720, 58, 50, ["command", "shock"], "tiger_cavalry", "tiger_cavalry"),
    alternatePulseAbility: ultimateAbility("yuanshao", "yuanshao_ultimate_banner", "盟主旗陣", 360, 116, 34, ["command", "shock"], "siege_drums", "siege_drums")
  },
  {
    heroId: "dongzhuo",
    name: "暴君無雙",
    duration: 8.8,
    pulseEvery: 1.9,
    vfxKey: "blood_rage",
    empoweredUnlockId: masteryUnlockId("dongzhuo"),
    pulseAbility: ultimateAbility("dongzhuo", "dongzhuo_ultimate_blood", "暴虐血宴", 240, 150, 44, ["shock", "blade"], "blood_rage", "blood_rage"),
    alternatePulseAbility: ultimateAbility("dongzhuo", "dongzhuo_ultimate_crush", "西涼裂地", 250, 116, 50, ["shock", "blade"], "iron_cleave", "heavy_cleave")
  },
  {
    heroId: "huatuo",
    name: "青囊無雙",
    duration: 8,
    pulseEvery: 1.35,
    vfxKey: "frost_lotus",
    empoweredUnlockId: masteryUnlockId("huatuo"),
    moveSpeedScale: 1.08,
    pulseAbility: ultimateAbility("huatuo", "huatuo_ultimate_lotus", "青囊冰蓮", 540, 90, 30, ["charm", "shock"], "frost_lotus", "frost_lotus"),
    empoweredPulseAbility: ultimateAbility("huatuo", "huatuo_ultimate_allure", "麻沸花舞", 320, 142, 36, ["charm", "shock"], "allure_dance", "allure_dance")
  }
];

const ultimateEnhancements: Record<HeroId, UltimateEnhancement> = {
  liubei: {
    presentation: presentation("liubei_musou_oath", "liubei_musou_swords", "聚義成陣"),
    finisherVfxKey: "liubei_musou_swords",
    finisherAbility: ultimateAbility("liubei", "liubei_ultimate_finisher", "仁德劍陣", 560, 46, 46, ["command", "blade"], "liubei_musou_swords", "guard_swords")
  },
  guanyu: {
    presentation: presentation("guanyu_musou_dragon", "guanyu_musou_dragon", "青龍收刀"),
    finisherVfxKey: "guanyu_musou_dragon",
    finisherAbility: ultimateAbility("guanyu", "guanyu_ultimate_finisher", "青龍斷軍", 720, 54, 68, ["blade", "shock"], "guanyu_musou_dragon", "dragon_slash")
  },
  zhangfei: {
    presentation: presentation("zhangfei_musou_roar", "zhangfei_musou_roar", "雷吼裂地"),
    finisherVfxKey: "zhangfei_musou_roar",
    finisherAbility: ultimateAbility("zhangfei", "zhangfei_ultimate_finisher", "長坂雷吼", 270, 166, 34, ["shock", "blade"], "zhangfei_musou_roar", "blood_rage")
  },
  zhaoyun: {
    presentation: presentation("zhaoyun_musou_dashes", "zhaoyun_musou_dashes", "回身穿陣"),
    finisherVfxKey: "zhaoyun_musou_dashes",
    finisherAbility: ultimateAbility("zhaoyun", "zhaoyun_ultimate_finisher", "龍膽回槍", 420, 66, 39, ["pierce", "shock"], "zhaoyun_musou_dashes", "seven_dashes")
  },
  machao: {
    presentation: presentation("machao_musou_cavalry", "machao_musou_cavalry", "錦騎破線"),
    finisherVfxKey: "machao_musou_cavalry",
    finisherAbility: ultimateAbility("machao", "machao_ultimate_finisher", "西涼錦騎", 440, 68, 40, ["pierce", "shock"], "machao_musou_cavalry", "seven_dashes")
  },
  zhugeliang: {
    presentation: presentation("zhugeliang_musou_bagua", "zhugeliang_musou_bagua", "八陣歸位"),
    finisherVfxKey: "zhugeliang_musou_bagua",
    finisherAbility: ultimateAbility(
      "zhugeliang",
      "zhugeliang_ultimate_finisher",
      "八陣借風",
      660,
      112,
      40,
      ["command", "shock"],
      "zhugeliang_musou_bagua",
      "frost_lotus"
    )
  },
  caocao: {
    presentation: presentation("caocao_musou_weiwu", "caocao_musou_weiwu", "魏武總攻"),
    finisherVfxKey: "caocao_musou_weiwu",
    finisherAbility: ultimateAbility("caocao", "caocao_ultimate_finisher", "魏武總攻", 760, 64, 50, ["command", "shock"], "caocao_musou_weiwu", "tiger_cavalry")
  },
  xiahoudun: {
    presentation: presentation("xiahoudun_musou_bloodblade", "xiahoudun_musou_bloodblade", "血刃震地"),
    finisherVfxKey: "xiahoudun_musou_bloodblade",
    finisherAbility: ultimateAbility("xiahoudun", "xiahoudun_ultimate_finisher", "剛烈血刃", 270, 128, 38, ["blade", "shock"], "xiahoudun_musou_bloodblade", "heavy_cleave")
  },
  xuchu: {
    presentation: presentation("xuchu_musou_guard", "xuchu_musou_guard", "虎衛裂土"),
    finisherVfxKey: "xuchu_musou_guard",
    finisherAbility: ultimateAbility("xuchu", "xuchu_ultimate_finisher", "虎衛裂土", 260, 136, 40, ["shock", "blade"], "xuchu_musou_guard", "heavy_cleave")
  },
  zhangliao: {
    presentation: presentation("zhangliao_musou_hefei", "zhangliao_musou_hefei", "合肥破膽"),
    finisherVfxKey: "zhangliao_musou_hefei",
    finisherAbility: ultimateAbility("zhangliao", "zhangliao_ultimate_finisher", "逍遙穿心", 440, 66, 42, ["pierce", "command"], "zhangliao_musou_hefei", "seven_dashes")
  },
  simayi: {
    presentation: presentation("simayi_musou_thunder", "simayi_musou_thunder", "狼顧鎖殺"),
    finisherVfxKey: "simayi_musou_thunder",
    finisherAbility: ultimateAbility("simayi", "simayi_ultimate_finisher", "冢虎鎖雷", 680, 86, 39, ["command", "shock"], "simayi_musou_thunder", "thunder_charm")
  },
  sunquan: {
    presentation: presentation("sunquan_musou_banner", "sunquan_musou_banner", "江東坐鎮"),
    finisherVfxKey: "sunquan_musou_banner",
    finisherAbility: ultimateAbility("sunquan", "sunquan_ultimate_finisher", "江東總令", 420, 130, 44, ["command", "shock"], "sunquan_musou_banner", "siege_drums")
  },
  zhouyu: {
    presentation: presentation("zhouyu_musou_red_cliff", "zhouyu_musou_red_cliff", "東風火海"),
    finisherVfxKey: "zhouyu_musou_red_cliff",
    finisherAbility: ultimateAbility("zhouyu", "zhouyu_ultimate_finisher", "東風火海", 460, 154, 30, ["fire", "command"], "zhouyu_musou_red_cliff", "red_cliff_fire")
  },
  sunshangxiang: {
    presentation: presentation("sunshangxiang_musou_arrowstorm", "sunshangxiang_musou_arrowstorm", "火箭密雨"),
    finisherVfxKey: "sunshangxiang_musou_arrowstorm",
    finisherAbility: ultimateAbility(
      "sunshangxiang",
      "sunshangxiang_ultimate_finisher",
      "弓腰火雨",
      520,
      116,
      32,
      ["arrow", "fire"],
      "sunshangxiang_musou_arrowstorm",
      "arrow_rain"
    )
  },
  ganning: {
    presentation: presentation("ganning_musou_nightraid", "ganning_musou_nightraid", "百騎劫營"),
    finisherVfxKey: "ganning_musou_nightraid",
    finisherAbility: ultimateAbility("ganning", "ganning_ultimate_finisher", "錦帆劫營", 430, 70, 42, ["blade", "shock"], "ganning_musou_nightraid", "seven_dashes")
  },
  taishici: {
    presentation: presentation("taishici_musou_phoenix", "taishici_musou_phoenix", "鳳羽穿營"),
    finisherVfxKey: "taishici_musou_phoenix",
    finisherAbility: ultimateAbility("taishici", "taishici_ultimate_finisher", "神亭鳳羽", 660, 42, 38, ["arrow", "fire"], "taishici_musou_phoenix", "phoenix_feathers")
  },
  diaochan: {
    presentation: presentation("diaochan_musou_moon_dance", "diaochan_musou_moon_dance", "月下旋舞"),
    finisherVfxKey: "diaochan_musou_moon_dance",
    finisherAbility: ultimateAbility("diaochan", "diaochan_ultimate_finisher", "閉月圓舞", 340, 166, 34, ["blade", "charm", "shock"], "diaochan_musou_moon_dance", "allure_dance")
  },
  zhangjiao: {
    presentation: presentation("zhangjiao_musou_yellow_sky", "zhangjiao_musou_yellow_sky", "黃天雷暴"),
    finisherVfxKey: "zhangjiao_musou_yellow_sky",
    finisherAbility: ultimateAbility("zhangjiao", "zhangjiao_ultimate_finisher", "黃天雷暴", 680, 90, 39, ["shock", "command"], "zhangjiao_musou_yellow_sky", "thunder_charm")
  },
  yuanshao: {
    presentation: presentation("yuanshao_musou_alliance", "yuanshao_musou_alliance", "盟主總攻"),
    finisherVfxKey: "yuanshao_musou_alliance",
    finisherAbility: ultimateAbility("yuanshao", "yuanshao_ultimate_finisher", "盟主總攻", 780, 66, 50, ["command", "shock"], "yuanshao_musou_alliance", "tiger_cavalry")
  },
  dongzhuo: {
    presentation: presentation("dongzhuo_musou_tyrant", "dongzhuo_musou_tyrant", "暴君震地"),
    finisherVfxKey: "dongzhuo_musou_tyrant",
    finisherAbility: ultimateAbility("dongzhuo", "dongzhuo_ultimate_finisher", "暴君震地", 270, 176, 36, ["shock", "blade"], "dongzhuo_musou_tyrant", "blood_rage")
  },
  huatuo: {
    presentation: presentation("huatuo_musou_qingnang", "huatuo_musou_qingnang", "青囊花陣"),
    finisherVfxKey: "huatuo_musou_qingnang",
    finisherAbility: ultimateAbility("huatuo", "huatuo_ultimate_finisher", "青囊花陣", 560, 126, 32, ["charm", "shock"], "huatuo_musou_qingnang", "frost_lotus")
  }
};

export const ultimateProfiles: UltimateProfile[] = ultimateBaseProfiles.map((profile) => {
  const enhancement = ultimateEnhancements[profile.heroId];
  return {
    ...profile,
    ...enhancement,
    vfxKey: enhancement.presentation.startVfxKey,
    ultimateAnimationKey: ultimateAnimationKey(profile.heroId)
  };
});

export const ultimateByHeroId = Object.fromEntries(ultimateProfiles.map((profile) => [profile.heroId, profile])) as Record<
  HeroId,
  UltimateProfile
>;
