import type { AbilityDef, HeroId } from "../types";

export interface UltimateProfile {
  heroId: HeroId;
  name: string;
  duration: number;
  pulseEvery: number;
  vfxKey: string;
  empoweredUnlockId: string;
  autoCooldownScale?: number;
  moveSpeedScale?: number;
  pulseAbility: AbilityDef;
  empoweredPulseAbility?: AbilityDef;
  alternatePulseAbility?: AbilityDef;
  bonusEvery?: number;
  bonusPulseAbility?: AbilityDef;
}

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

export const ultimateProfiles: UltimateProfile[] = [
  {
    heroId: "guanyu",
    name: "青龍無雙",
    duration: 7.5,
    pulseEvery: 1.45,
    vfxKey: "qinglong_arc",
    empoweredUnlockId: "ultimate_guanyu_mastery",
    pulseAbility: ultimateAbility("guanyu", "guanyu_ultimate_arc", "青龍連斬", 330, 88, 34, ["blade", "shock"], "qinglong_arc", "arc_sweep"),
    bonusEvery: 3,
    bonusPulseAbility: ultimateAbility(
      "guanyu",
      "guanyu_ultimate_dragon",
      "青龍偃月",
      640,
      48,
      76,
      ["blade", "shock"],
      "dragon_slash",
      "dragon_slash"
    )
  },
  {
    heroId: "zhaoyun",
    name: "龍膽無雙",
    duration: 6.8,
    pulseEvery: 0.95,
    vfxKey: "dragon_dash",
    empoweredUnlockId: "ultimate_zhaoyun_mastery",
    autoCooldownScale: 0.72,
    moveSpeedScale: 1.18,
    pulseAbility: ultimateAbility("zhaoyun", "zhaoyun_ultimate_spear", "龍影槍", 440, 28, 27, ["pierce", "shock"], "spear_flash", "spear_flurry"),
    empoweredPulseAbility: ultimateAbility(
      "zhaoyun",
      "zhaoyun_ultimate_dash",
      "七進七出",
      170,
      56,
      45,
      ["pierce", "shock"],
      "dragon_dash",
      "seven_dashes"
    )
  },
  {
    heroId: "caocao",
    name: "魏武無雙",
    duration: 8,
    pulseEvery: 1.6,
    vfxKey: "tiger_cavalry",
    empoweredUnlockId: "ultimate_caocao_mastery",
    pulseAbility: ultimateAbility(
      "caocao",
      "caocao_ultimate_cavalry",
      "虎豹奔襲",
      720,
      54,
      52,
      ["command", "shock"],
      "tiger_cavalry",
      "tiger_cavalry"
    ),
    alternatePulseAbility: ultimateAbility(
      "caocao",
      "caocao_ultimate_swords",
      "霸府劍衛",
      480,
      34,
      36,
      ["command", "blade"],
      "wei_swords",
      "guard_swords"
    )
  },
  {
    heroId: "xiahoudun",
    name: "剛烈無雙",
    duration: 8.5,
    pulseEvery: 1.9,
    vfxKey: "blood_rage",
    empoweredUnlockId: "ultimate_xiahoudun_mastery",
    pulseAbility: ultimateAbility(
      "xiahoudun",
      "xiahoudun_ultimate_cleave",
      "剛烈裂地",
      250,
      108,
      42,
      ["blade", "shock"],
      "iron_cleave",
      "heavy_cleave"
    ),
    alternatePulseAbility: ultimateAbility(
      "xiahoudun",
      "xiahoudun_ultimate_blood",
      "浴血狂斬",
      220,
      132,
      36,
      ["blade", "shock"],
      "blood_rage",
      "blood_rage"
    )
  },
  {
    heroId: "zhouyu",
    name: "赤壁無雙",
    duration: 9,
    pulseEvery: 1.65,
    vfxKey: "red_cliff_fire",
    empoweredUnlockId: "ultimate_zhouyu_mastery",
    pulseAbility: ultimateAbility(
      "zhouyu",
      "zhouyu_ultimate_fireline",
      "赤壁連營",
      450,
      118,
      28,
      ["fire", "command"],
      "red_cliff_fire",
      "red_cliff_fire"
    ),
    empoweredPulseAbility: ultimateAbility(
      "zhouyu",
      "zhouyu_ultimate_note",
      "火鳳琴音",
      520,
      42,
      33,
      ["fire", "command"],
      "fire_note",
      "fire_note"
    )
  },
  {
    heroId: "sunshangxiang",
    name: "弓腰無雙",
    duration: 7.2,
    pulseEvery: 1,
    vfxKey: "arrow_rain",
    empoweredUnlockId: "ultimate_sunshangxiang_mastery",
    autoCooldownScale: 0.7,
    pulseAbility: ultimateAbility(
      "sunshangxiang",
      "sunshangxiang_ultimate_fan",
      "連弩扇射",
      560,
      22,
      22,
      ["arrow", "pierce"],
      "crossbow_fan",
      "fan_bolts"
    ),
    alternatePulseAbility: ultimateAbility(
      "sunshangxiang",
      "sunshangxiang_ultimate_rain",
      "火箭天雨",
      470,
      96,
      34,
      ["arrow", "fire"],
      "arrow_rain",
      "arrow_rain"
    )
  },
  {
    heroId: "diaochan",
    name: "傾城無雙",
    duration: 8.2,
    pulseEvery: 1.25,
    vfxKey: "allure_dance",
    empoweredUnlockId: "ultimate_diaochan_mastery",
    moveSpeedScale: 1.1,
    pulseAbility: ultimateAbility(
      "diaochan",
      "diaochan_ultimate_petal",
      "花影旋舞",
      300,
      116,
      27,
      ["blade", "charm"],
      "petal_waltz",
      "petal_waltz"
    ),
    empoweredPulseAbility: ultimateAbility(
      "diaochan",
      "diaochan_ultimate_allure",
      "傾城連舞",
      320,
      150,
      34,
      ["blade", "charm", "shock"],
      "allure_dance",
      "allure_dance"
    )
  }
];

export const ultimateByHeroId = Object.fromEntries(ultimateProfiles.map((profile) => [profile.heroId, profile])) as Record<
  HeroId,
  UltimateProfile
>;
