import type { UpgradeDef } from "../types";
import { heroes } from "./heroes";

const authoredUpgrades: UpgradeDef[] = [
  {
    id: "tempered_blade",
    name: "精鍛兵刃",
    description: "所有傷害 +15%。",
    rarity: "common",
    maxStacks: 6,
    apply: [{ stat: "damageScale", amount: 0.15 }]
  },
  {
    id: "war_drum",
    name: "戰鼓催陣",
    description: "攻擊冷卻 -9%。",
    rarity: "common",
    maxStacks: 5,
    apply: [{ stat: "cooldownScale", amount: -0.09 }]
  },
  {
    id: "wide_formation",
    name: "廣域陣式",
    description: "技能範圍 +12%。",
    rarity: "common",
    maxStacks: 5,
    apply: [{ stat: "areaScale", amount: 0.12 }]
  },
  {
    id: "swift_horse",
    name: "疾行戰靴",
    description: "移動速度 +18。",
    rarity: "common",
    maxStacks: 5,
    apply: [{ stat: "moveSpeed", amount: 18 }]
  },
  {
    id: "military_armor",
    name: "將軍護甲",
    description: "最大兵力 +18，護甲 +1。",
    rarity: "common",
    maxStacks: 5,
    apply: [{ stat: "maxHp", amount: 18 }]
  },
  {
    id: "iron_guard",
    name: "鐵壁護心",
    description: "護甲 +2。",
    rarity: "common",
    maxStacks: 4,
    apply: [{ stat: "armor", amount: 2 }]
  },
  {
    id: "jade_talisman",
    name: "玉珮引光",
    description: "拾取範圍 +24。",
    rarity: "common",
    maxStacks: 4,
    apply: [{ stat: "pickupRadius", amount: 24 }]
  },
  {
    id: "field_medicine",
    name: "行軍秘藥",
    description: "每秒回復 0.8 兵力。",
    rarity: "common",
    maxStacks: 4,
    apply: [{ stat: "regen", amount: 0.8 }]
  },
  {
    id: "crimson_edge",
    name: "赤鋒寶刃",
    description: "暴擊率 +6%，暴擊傷害 +12%。",
    rarity: "relic",
    maxStacks: 4,
    requires: { level: 2 },
    apply: [
      { stat: "critChance", amount: 0.06 },
      { stat: "critDamage", amount: 0.12 }
    ]
  },
  {
    id: "sunzi_scroll",
    name: "兵法殘卷",
    description: "經驗獲得 +10%，Boss 傷害 +8%。",
    rarity: "relic",
    maxStacks: 3,
    requires: { level: 3 },
    apply: [
      { stat: "xpScale", amount: 0.1 },
      { stat: "bossDamage", amount: 0.08 }
    ]
  },
  {
    id: "red_hare",
    name: "赤兔殘影",
    description: "移動速度 +22，攻擊冷卻 -6%。",
    rarity: "relic",
    maxStacks: 3,
    requires: { level: 3 },
    apply: [
      { stat: "moveSpeed", amount: 22 },
      { stat: "cooldownScale", amount: -0.06 }
    ]
  },
  {
    id: "tech_moon_blades",
    name: "月牙飛刃",
    description: "解鎖自動招式：週期性向四周放出旋轉月牙刃。",
    rarity: "technique",
    maxStacks: 1,
    requires: { level: 2 },
    unlockId: "tech_moon_blades",
    apply: [{ stat: "damageScale", amount: 0.04 }]
  },
  {
    id: "tech_frost_lotus",
    name: "冰蓮結界",
    description: "解鎖自動招式：在敵群腳下展開冰蓮並短暫牽制。",
    rarity: "technique",
    maxStacks: 1,
    requires: { level: 2 },
    unlockId: "tech_frost_lotus",
    apply: [{ stat: "areaScale", amount: 0.06 }]
  },
  {
    id: "tech_phoenix_feathers",
    name: "鳳羽連射",
    description: "解鎖自動招式：朝前方扇形射出燃燒羽箭。",
    rarity: "technique",
    maxStacks: 1,
    requires: { level: 3 },
    unlockId: "tech_phoenix_feathers",
    apply: [{ stat: "cooldownScale", amount: -0.03 }]
  },
  {
    id: "tech_thunder_charm",
    name: "雷符天降",
    description: "解鎖自動招式：鎖定多名敵人落下雷符。",
    rarity: "technique",
    maxStacks: 1,
    requires: { level: 3 },
    unlockId: "tech_thunder_charm",
    apply: [{ stat: "critChance", amount: 0.04 }]
  },
  {
    id: "tech_shadow_clones",
    name: "影分身斬",
    description: "解鎖自動招式：三道分身刀光穿透敵陣。",
    rarity: "technique",
    maxStacks: 1,
    requires: { level: 4 },
    unlockId: "tech_shadow_clones",
    apply: [{ stat: "critDamage", amount: 0.1 }]
  },
  {
    id: "tech_siege_drums",
    name: "破陣戰鼓",
    description: "解鎖自動招式：震出衝擊波，推開周身包圍。",
    rarity: "technique",
    maxStacks: 1,
    requires: { level: 4 },
    unlockId: "tech_siege_drums",
    apply: [{ stat: "armor", amount: 1 }]
  },
  {
    id: "shu_oath",
    name: "桃園誓約",
    description: "蜀陣營暴擊率 +8%，並解鎖義氣支援。",
    rarity: "faction",
    factionId: "shu",
    maxStacks: 1,
    requires: { level: 2 },
    unlockId: "shu_oath",
    apply: [
      { stat: "critChance", amount: 0.08 },
      { stat: "evolvedPower", amount: 0.08 }
    ]
  },
  {
    id: "shu_dragon_step",
    name: "白龍踏陣",
    description: "蜀陣營移動速度 +16，近戰傷害 +10%。",
    rarity: "faction",
    factionId: "shu",
    maxStacks: 3,
    requires: { level: 2 },
    apply: [
      { stat: "moveSpeed", amount: 16 },
      { stat: "damageScale", amount: 0.1 }
    ]
  },
  {
    id: "wei_tiger_guard",
    name: "虎豹親衛",
    description: "魏陣營解鎖親衛支援，軍令傷害提高。",
    rarity: "faction",
    factionId: "wei",
    maxStacks: 1,
    requires: { level: 2 },
    unlockId: "wei_tiger_guard",
    apply: [
      { stat: "companionDamage", amount: 0.25 },
      { stat: "damageScale", amount: 0.06 }
    ]
  },
  {
    id: "wei_iron_wall",
    name: "魏武鐵壁",
    description: "魏陣營護甲 +3，暴擊率 +2%。",
    rarity: "faction",
    factionId: "wei",
    maxStacks: 3,
    requires: { level: 2 },
    apply: [
      { stat: "armor", amount: 3 },
      { stat: "critChance", amount: 0.02 }
    ]
  },
  {
    id: "wu_chain_fire",
    name: "連環火計",
    description: "吳陣營燃燒傷害提高，解鎖火箭支援。",
    rarity: "faction",
    factionId: "wu",
    maxStacks: 1,
    requires: { level: 2 },
    unlockId: "wu_chain_fire",
    apply: [
      { stat: "damageScale", amount: 0.04 },
      { stat: "evolvedPower", amount: 0.1 }
    ]
  },
  {
    id: "wu_archer_boats",
    name: "江東箭船",
    description: "吳陣營範圍 +12%，支援傷害 +12%。",
    rarity: "faction",
    factionId: "wu",
    maxStacks: 3,
    requires: { level: 2 },
    apply: [
      { stat: "areaScale", amount: 0.12 },
      { stat: "companionDamage", amount: 0.12 }
    ]
  },
  {
    id: "qun_flower_step",
    name: "花影迷步",
    description: "群雄陣營移動速度 +14，技能範圍 +8%。",
    rarity: "faction",
    factionId: "qun",
    maxStacks: 3,
    requires: { level: 2 },
    apply: [
      { stat: "moveSpeed", amount: 14 },
      { stat: "areaScale", amount: 0.08 }
    ]
  },
  {
    id: "qun_charm_ring",
    name: "傾城鈴音",
    description: "群雄陣營冷卻 -8%，暴擊率 +5%。",
    rarity: "faction",
    factionId: "qun",
    maxStacks: 3,
    requires: { level: 2 },
    apply: [
      { stat: "cooldownScale", amount: -0.08 },
      { stat: "critChance", amount: 0.05 }
    ]
  },
  {
    id: "qun_dance_guard",
    name: "群芳護舞",
    description: "解鎖花瓣支援，並提高支援傷害。",
    rarity: "faction",
    factionId: "qun",
    maxStacks: 1,
    requires: { level: 2 },
    unlockId: "qun_flower_guard",
    apply: [
      { stat: "companionDamage", amount: 0.18 },
      { stat: "evolvedPower", amount: 0.08 }
    ]
  },
  {
    id: "hero_guanyu_musou",
    name: "青龍無雙",
    description: "關羽無雙延長 1.5 秒，無雙威力提升，並每第三次脈衝追加青龍斬。",
    rarity: "hero",
    heroId: "guanyu",
    maxStacks: 1,
    requires: { level: 5, upgradeId: "evo_guanyu", stacks: 1 },
    unlockId: "ultimate_guanyu_mastery",
    apply: [
      { stat: "ultimateDuration", amount: 1.5 },
      { stat: "ultimatePower", amount: 0.12 }
    ]
  },
  {
    id: "hero_zhaoyun_musou",
    name: "龍膽無雙",
    description: "趙雲無雙延長 1.5 秒，無雙威力提升，脈衝改為短距七進七出。",
    rarity: "hero",
    heroId: "zhaoyun",
    maxStacks: 1,
    requires: { level: 5, upgradeId: "evo_zhaoyun", stacks: 1 },
    unlockId: "ultimate_zhaoyun_mastery",
    apply: [
      { stat: "ultimateDuration", amount: 1.5 },
      { stat: "ultimatePower", amount: 0.12 }
    ]
  },
  {
    id: "hero_machao_musou",
    name: "錦馬無雙",
    description: "馬超無雙延長 1.5 秒，無雙威力提升，脈衝改為錦翼連掠掃線。",
    rarity: "hero",
    heroId: "machao",
    maxStacks: 1,
    requires: { level: 5, upgradeId: "evo_machao", stacks: 1 },
    unlockId: "ultimate_machao_mastery",
    apply: [
      { stat: "ultimateDuration", amount: 1.5 },
      { stat: "ultimatePower", amount: 0.12 }
    ]
  },
  {
    id: "hero_caocao_musou",
    name: "魏武無雙",
    description: "曹操無雙延長 1.5 秒，無雙威力提升，虎豹騎脈衝會穿插霸府劍衛。",
    rarity: "hero",
    heroId: "caocao",
    maxStacks: 1,
    requires: { level: 5, upgradeId: "evo_caocao", stacks: 1 },
    unlockId: "ultimate_caocao_mastery",
    apply: [
      { stat: "ultimateDuration", amount: 1.5 },
      { stat: "ultimatePower", amount: 0.12 }
    ]
  },
  {
    id: "hero_xiahoudun_musou",
    name: "剛烈無雙",
    description: "夏侯惇無雙延長 1.5 秒，無雙威力提升，剛烈脈衝穿插浴血狂斬。",
    rarity: "hero",
    heroId: "xiahoudun",
    maxStacks: 1,
    requires: { level: 5, upgradeId: "evo_xiahoudun", stacks: 1 },
    unlockId: "ultimate_xiahoudun_mastery",
    apply: [
      { stat: "ultimateDuration", amount: 1.5 },
      { stat: "ultimatePower", amount: 0.12 }
    ]
  },
  {
    id: "hero_zhouyu_musou",
    name: "赤壁無雙",
    description: "周瑜無雙延長 1.5 秒，無雙威力提升，火場脈衝改為赤壁與琴音交疊。",
    rarity: "hero",
    heroId: "zhouyu",
    maxStacks: 1,
    requires: { level: 5, upgradeId: "evo_zhouyu", stacks: 1 },
    unlockId: "ultimate_zhouyu_mastery",
    apply: [
      { stat: "ultimateDuration", amount: 1.5 },
      { stat: "ultimatePower", amount: 0.12 }
    ]
  },
  {
    id: "hero_sunshangxiang_musou",
    name: "弓腰無雙",
    description: "孫尚香無雙延長 1.5 秒，無雙威力提升，連弩脈衝穿插火箭天雨。",
    rarity: "hero",
    heroId: "sunshangxiang",
    maxStacks: 1,
    requires: { level: 5, upgradeId: "evo_sunshangxiang", stacks: 1 },
    unlockId: "ultimate_sunshangxiang_mastery",
    apply: [
      { stat: "ultimateDuration", amount: 1.5 },
      { stat: "ultimatePower", amount: 0.12 }
    ]
  },
  {
    id: "hero_diaochan_musou",
    name: "傾城無雙",
    description: "貂蟬無雙延長 1.5 秒，無雙威力提升，花舞脈衝改為傾城魅惑場。",
    rarity: "hero",
    heroId: "diaochan",
    maxStacks: 1,
    requires: { level: 5, upgradeId: "evo_diaochan", stacks: 1 },
    unlockId: "ultimate_diaochan_mastery",
    apply: [
      { stat: "ultimateDuration", amount: 1.5 },
      { stat: "ultimatePower", amount: 0.12 }
    ]
  },
  {
    id: "evo_guanyu",
    name: "武聖覺醒",
    description: "關羽刀光增加段數，青龍斬範圍提高。",
    rarity: "evolution",
    heroId: "guanyu",
    maxStacks: 1,
    requires: { level: 4, upgradeId: "wide_formation", stacks: 1 },
    unlockId: "evolution_guanyu",
    apply: [{ stat: "evolvedPower", amount: 0.22 }]
  },
  {
    id: "evo_zhaoyun",
    name: "白龍覺醒",
    description: "趙雲槍影分裂，突進落點追加白龍爆發。",
    rarity: "evolution",
    heroId: "zhaoyun",
    maxStacks: 1,
    requires: { level: 4, upgradeId: "war_drum", stacks: 1 },
    unlockId: "evolution_zhaoyun",
    apply: [{ stat: "evolvedPower", amount: 0.22 }]
  },
  {
    id: "evo_machao",
    name: "錦馬覺醒",
    description: "馬超槍勢更長，突進尾焰追加錦翼撕裂。",
    rarity: "evolution",
    heroId: "machao",
    maxStacks: 1,
    requires: { level: 4, upgradeId: "war_drum", stacks: 1 },
    unlockId: "evolution_machao",
    apply: [{ stat: "evolvedPower", amount: 0.22 }]
  },
  {
    id: "evo_caocao",
    name: "魏武覺醒",
    description: "曹操劍令數量增加，親衛軍令附帶範圍斬擊。",
    rarity: "evolution",
    heroId: "caocao",
    maxStacks: 1,
    requires: { level: 4, upgradeId: "tempered_blade", stacks: 1 },
    unlockId: "evolution_caocao",
    apply: [{ stat: "evolvedPower", amount: 0.22 }]
  },
  {
    id: "evo_xiahoudun",
    name: "豪刃覺醒",
    description: "夏侯惇血戰時間更長，吸血與重斬範圍提高。",
    rarity: "evolution",
    heroId: "xiahoudun",
    maxStacks: 1,
    requires: { level: 4, upgradeId: "field_medicine", stacks: 1 },
    unlockId: "evolution_xiahoudun",
    apply: [{ stat: "evolvedPower", amount: 0.22 }]
  },
  {
    id: "evo_zhouyu",
    name: "赤壁覺醒",
    description: "周瑜火場持續更久，火彈落點追加延燒。",
    rarity: "evolution",
    heroId: "zhouyu",
    maxStacks: 1,
    requires: { level: 4, upgradeId: "wide_formation", stacks: 1 },
    unlockId: "evolution_zhouyu",
    apply: [{ stat: "evolvedPower", amount: 0.22 }]
  },
  {
    id: "evo_sunshangxiang",
    name: "弓腰覺醒",
    description: "孫尚香箭幕密度提高，雙弩扇形角度擴大。",
    rarity: "evolution",
    heroId: "sunshangxiang",
    maxStacks: 1,
    requires: { level: 4, upgradeId: "war_drum", stacks: 1 },
    unlockId: "evolution_sunshangxiang",
    apply: [{ stat: "evolvedPower", amount: 0.22 }]
  },
  {
    id: "evo_diaochan",
    name: "傾城覺醒",
    description: "貂蟬旋舞圈數增加，舞陣花瓣範圍與控制時間提高。",
    rarity: "evolution",
    heroId: "diaochan",
    maxStacks: 1,
    requires: { level: 4, upgradeId: "wide_formation", stacks: 1 },
    unlockId: "evolution_diaochan",
    apply: [{ stat: "evolvedPower", amount: 0.26 }]
  }
];

const authoredUpgradeIds = new Set(authoredUpgrades.map((upgrade) => upgrade.id));

const generatedHeroProgression: UpgradeDef[] = heroes
  .flatMap((hero): UpgradeDef[] => [
    {
      id: `evo_${hero.id}`,
      name: `${hero.name}覺醒`,
      description: `${hero.name}的核心招式進化，提升專屬技能威力並改變清場節奏。`,
      rarity: "evolution",
      heroId: hero.id,
      maxStacks: 1,
      requires: { level: 4, upgradeId: evolutionPrerequisite(hero), stacks: 1 },
      unlockId: `evolution_${hero.id}`,
      apply: [{ stat: "evolvedPower", amount: hero.factionId === "qun" ? 0.26 : 0.22 }]
    },
    {
      id: `hero_${hero.id}_musou`,
      name: `${hero.name}名將魂`,
      description: `${hero.name}的無雙窗口延長，覺醒脈衝追加第二層攻勢。`,
      rarity: "hero",
      heroId: hero.id,
      maxStacks: 1,
      requires: { level: 5, upgradeId: `evo_${hero.id}`, stacks: 1 },
      unlockId: `ultimate_${hero.id}_mastery`,
      apply: [
        { stat: "ultimateDuration", amount: 1.5 },
        { stat: "ultimatePower", amount: 0.12 }
      ]
    }
  ])
  .filter((upgrade) => !authoredUpgradeIds.has(upgrade.id));

const buildUpgrades: UpgradeDef[] = [
  {
    id: "build_front_arrow",
    name: "正面增彈",
    description: "主武技額外射出斜向彈幕，單發傷害較低。",
    rarity: "build",
    maxStacks: 2,
    apply: [{ stat: "frontShot", amount: 1 }]
  },
  {
    id: "build_rear_arrow",
    name: "背後增彈",
    description: "主武技向背後補射一發，適合被包圍時突圍。",
    rarity: "build",
    maxStacks: 1,
    apply: [{ stat: "rearShot", amount: 1 }]
  },
  {
    id: "build_ricochet",
    name: "反彈箭",
    description: "投射物命中後可折返尋找附近敵軍。",
    rarity: "build",
    maxStacks: 2,
    apply: [{ stat: "ricochet", amount: 1 }]
  },
  {
    id: "build_pierce",
    name: "穿透箭",
    description: "投射物可額外穿透一名敵軍。",
    rarity: "build",
    maxStacks: 3,
    apply: [{ stat: "projectilePierce", amount: 1 }]
  },
  {
    id: "build_multishot",
    name: "連射",
    description: "主武技追加一段較弱的二連射。",
    rarity: "build",
    maxStacks: 1,
    apply: [
      { stat: "extraVolley", amount: 1 },
      { stat: "cooldownScale", amount: 0.05 }
    ]
  },
  {
    id: "build_orbit_guard",
    name: "環繞護衛",
    description: "定期在身邊展開刀陣，清理貼身敵軍。",
    rarity: "build",
    maxStacks: 3,
    apply: [{ stat: "orbitGuard", amount: 1 }]
  },
  {
    id: "build_deputy",
    name: "召喚副將",
    description: "副將定期支援射擊，與陣營支援可疊加。",
    rarity: "build",
    maxStacks: 3,
    apply: [
      { stat: "companionCount", amount: 1 },
      { stat: "companionDamage", amount: 0.08 }
    ]
  },
  {
    id: "build_kill_heal",
    name: "擊殺回血",
    description: "每次斬敵恢復少量生命。",
    rarity: "build",
    maxStacks: 4,
    apply: [{ stat: "killHeal", amount: 1.8 }]
  },
  {
    id: "build_last_stand",
    name: "低血爆發",
    description: "生命低於 35% 時大幅提高造成傷害。",
    rarity: "build",
    maxStacks: 3,
    apply: [{ stat: "lowHpPower", amount: 0.16 }]
  }
];

export const upgrades: UpgradeDef[] = [...buildUpgrades, ...authoredUpgrades, ...generatedHeroProgression];

function evolutionPrerequisite(hero: (typeof heroes)[number]): string {
  if (hero.manualAbility.effectId === "blood_rage" || hero.baseStats.armor >= 6) {
    return "field_medicine";
  }
  if (hero.autoAbility.damageTags.includes("command")) {
    return "war_drum";
  }
  if (hero.autoAbility.damageTags.includes("fire") || hero.autoAbility.damageTags.includes("charm")) {
    return "wide_formation";
  }
  return "tempered_blade";
}

export const upgradeById = Object.fromEntries(upgrades.map((upgrade) => [upgrade.id, upgrade])) as Record<
  UpgradeDef["id"],
  UpgradeDef
>;
