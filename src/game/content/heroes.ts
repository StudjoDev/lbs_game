import type { AbilityDef, FactionId, HeroDef, HeroId } from "../types";

type HeroAbilityInput = Omit<AbilityDef, "id" | "ownerHeroId" | "trigger">;

interface HeroInput {
  id: HeroId;
  factionId: FactionId;
  name: string;
  title: string;
  role: string;
  passiveName: string;
  passiveText: string;
  baseStats: HeroDef["baseStats"];
  autoAbility: HeroAbilityInput;
  manualAbility: HeroAbilityInput;
}

function createAbility(ownerHeroId: HeroId, trigger: "auto" | "manual", input: HeroAbilityInput): AbilityDef {
  return {
    id: `${ownerHeroId}_${trigger}`,
    ownerHeroId,
    trigger,
    ...input
  };
}

function createHero(input: HeroInput): HeroDef {
  return {
    id: input.id,
    artId: input.id,
    factionId: input.factionId,
    name: input.name,
    title: input.title,
    role: input.role,
    passiveName: input.passiveName,
    passiveText: input.passiveText,
    baseStats: input.baseStats,
    autoAbility: createAbility(input.id, "auto", input.autoAbility),
    manualAbility: createAbility(input.id, "manual", input.manualAbility),
    portraitKey: `portrait_${input.id}`,
    spriteKey: `hero_${input.id}`
  };
}

export const heroes: HeroDef[] = [
  createHero({
    id: "liubei",
    factionId: "shu",
    name: "劉備",
    title: "昭烈仁君",
    role: "均衡支援",
    passiveName: "仁德聚義",
    passiveText: "拾取經驗後短暫提高同陣營支援傷害，適合穩定開局。",
    baseStats: { maxHp: 138, moveSpeed: 232, armor: 3, pickupRadius: 112 },
    autoAbility: {
      name: "仁德劍光",
      description: "揮出數道劍令，穿透前方敵軍。",
      cooldown: 1.02,
      range: 430,
      radius: 30,
      damage: 23,
      damageTags: ["command", "blade"],
      vfxKey: "wei_swords",
      effectId: "guard_swords"
    },
    manualAbility: {
      name: "昭烈號令",
      description: "在身前擂鼓振軍，造成範圍衝擊。",
      cooldown: 8.2,
      range: 300,
      radius: 116,
      damage: 52,
      damageTags: ["command", "shock"],
      vfxKey: "siege_drums",
      effectId: "siege_drums"
    }
  }),
  createHero({
    id: "guanyu",
    factionId: "shu",
    name: "關羽",
    title: "青龍武聖",
    role: "前排斬擊",
    passiveName: "義薄雲天",
    passiveText: "近戰斬擊更容易形成連段，適合貼近敵群清場。",
    baseStats: { maxHp: 150, moveSpeed: 220, armor: 4, pickupRadius: 96 },
    autoAbility: {
      name: "青龍偃月",
      description: "向前方連斬青龍刀弧。",
      cooldown: 1.05,
      range: 270,
      radius: 76,
      damage: 28,
      damageTags: ["blade"],
      vfxKey: "qinglong_arc",
      effectId: "arc_sweep"
    },
    manualAbility: {
      name: "青龍破陣",
      description: "斬出長距離龍形刀氣，貫穿整列敵軍。",
      cooldown: 7.5,
      range: 620,
      radius: 44,
      damage: 88,
      damageTags: ["blade", "shock"],
      vfxKey: "dragon_slash",
      effectId: "dragon_slash"
    }
  }),
  createHero({
    id: "zhangfei",
    factionId: "shu",
    name: "張飛",
    title: "燕人猛吼",
    role: "爆發坦克",
    passiveName: "怒目當陽",
    passiveText: "血量越低越能承受壓力，手動技適合突破包圍。",
    baseStats: { maxHp: 176, moveSpeed: 206, armor: 6, pickupRadius: 88 },
    autoAbility: {
      name: "丈八橫掃",
      description: "以蛇矛橫掃近身敵人。",
      cooldown: 1.16,
      range: 245,
      radius: 96,
      damage: 31,
      damageTags: ["blade", "shock"],
      vfxKey: "iron_cleave",
      effectId: "heavy_cleave"
    },
    manualAbility: {
      name: "長坂怒吼",
      description: "怒吼震退敵陣並進入短暫狂戰節奏。",
      cooldown: 9,
      range: 230,
      radius: 144,
      damage: 56,
      damageTags: ["shock", "blade"],
      vfxKey: "blood_rage",
      effectId: "blood_rage"
    }
  }),
  createHero({
    id: "zhaoyun",
    factionId: "shu",
    name: "趙雲",
    title: "常山龍膽",
    role: "高速突刺",
    passiveName: "龍膽身法",
    passiveText: "移動速度較高，能在敵群縫隙中穿梭收割。",
    baseStats: { maxHp: 126, moveSpeed: 260, armor: 2, pickupRadius: 104 },
    autoAbility: {
      name: "銀槍連刺",
      description: "快速刺出穿透槍芒。",
      cooldown: 0.72,
      range: 420,
      radius: 24,
      damage: 20,
      damageTags: ["pierce"],
      vfxKey: "spear_flash",
      effectId: "spear_flurry"
    },
    manualAbility: {
      name: "七進七出",
      description: "向前突進並在路徑上造成傷害。",
      cooldown: 6.3,
      range: 360,
      radius: 58,
      damage: 62,
      damageTags: ["pierce", "shock"],
      vfxKey: "dragon_dash",
      effectId: "seven_dashes"
    }
  }),
  createHero({
    id: "machao",
    factionId: "shu",
    name: "馬超",
    title: "西涼錦將",
    role: "撕裂突進",
    passiveName: "鐵騎錦槍",
    passiveText: "技能節奏緊湊，能以連刺與突進撕裂狹長敵線。",
    baseStats: { maxHp: 132, moveSpeed: 248, armor: 3, pickupRadius: 100 },
    autoAbility: {
      name: "錦槍連閃",
      description: "連刺穿透槍芒，對狹長路徑特別有效。",
      cooldown: 0.74,
      range: 410,
      radius: 26,
      damage: 21,
      damageTags: ["pierce"],
      vfxKey: "spear_flash",
      effectId: "spear_flurry"
    },
    manualAbility: {
      name: "潼關突騎",
      description: "向前疾突並橫掃路徑上的敵人。",
      cooldown: 6.5,
      range: 340,
      radius: 60,
      damage: 64,
      damageTags: ["pierce", "shock"],
      vfxKey: "dragon_dash",
      effectId: "seven_dashes"
    }
  }),
  createHero({
    id: "zhugeliang",
    factionId: "shu",
    name: "諸葛亮",
    title: "臥龍軍師",
    role: "控場法師",
    passiveName: "八陣奇謀",
    passiveText: "技能範圍較大，能以牽制和落雷壓住密集敵群。",
    baseStats: { maxHp: 112, moveSpeed: 228, armor: 1, pickupRadius: 126 },
    autoAbility: {
      name: "八卦冰蓮",
      description: "在最近敵人腳下展開冰蓮牽制。",
      cooldown: 1.08,
      range: 520,
      radius: 70,
      damage: 21,
      damageTags: ["command", "shock"],
      vfxKey: "frost_lotus",
      effectId: "frost_lotus"
    },
    manualAbility: {
      name: "借東風雷符",
      description: "召下多道雷符打擊精英與密集敵人。",
      cooldown: 8.4,
      range: 620,
      radius: 74,
      damage: 50,
      damageTags: ["command", "shock"],
      vfxKey: "thunder_charm",
      effectId: "thunder_charm"
    }
  }),
  createHero({
    id: "caocao",
    factionId: "wei",
    name: "曹操",
    title: "魏武帝星",
    role: "軍令統帥",
    passiveName: "魏武劍令",
    passiveText: "軍令類傷害穩定，適合中距離控線。",
    baseStats: { maxHp: 136, moveSpeed: 220, armor: 5, pickupRadius: 100 },
    autoAbility: {
      name: "魏武劍令",
      description: "下令劍光護衛向前方穿刺。",
      cooldown: 1.1,
      range: 430,
      radius: 26,
      damage: 24,
      damageTags: ["command", "blade"],
      vfxKey: "wei_swords",
      effectId: "guard_swords"
    },
    manualAbility: {
      name: "虎豹騎令",
      description: "下令虎豹騎沿直線衝鋒。",
      cooldown: 8,
      range: 720,
      radius: 56,
      damage: 76,
      damageTags: ["command", "shock"],
      vfxKey: "tiger_cavalry",
      effectId: "tiger_cavalry"
    }
  }),
  createHero({
    id: "xiahoudun",
    factionId: "wei",
    name: "夏侯惇",
    title: "獨眼鐵壁",
    role: "重甲血戰",
    passiveName: "剛烈護身",
    passiveText: "護甲較高，適合承受前線壓力。",
    baseStats: { maxHp: 172, moveSpeed: 205, armor: 6, pickupRadius: 88 },
    autoAbility: {
      name: "鐵壁重劈",
      description: "以重刃劈開近身敵人。",
      cooldown: 1.18,
      range: 250,
      radius: 90,
      damage: 30,
      damageTags: ["blade", "shock"],
      vfxKey: "iron_cleave",
      effectId: "heavy_cleave"
    },
    manualAbility: {
      name: "剛烈血戰",
      description: "短暫進入狂戰，震開周圍敵軍。",
      cooldown: 9,
      range: 210,
      radius: 140,
      damage: 54,
      damageTags: ["blade", "shock"],
      vfxKey: "blood_rage",
      effectId: "blood_rage"
    }
  }),
  createHero({
    id: "xuchu",
    factionId: "wei",
    name: "許褚",
    title: "虎癡護衛",
    role: "護主猛將",
    passiveName: "虎衛壓陣",
    passiveText: "高生命與高護甲，清近身怪群表現穩定。",
    baseStats: { maxHp: 184, moveSpeed: 198, armor: 7, pickupRadius: 86 },
    autoAbility: {
      name: "虎癡砸擊",
      description: "以巨力砸出近身衝擊。",
      cooldown: 1.24,
      range: 230,
      radius: 104,
      damage: 33,
      damageTags: ["shock", "blade"],
      vfxKey: "iron_cleave",
      effectId: "heavy_cleave"
    },
    manualAbility: {
      name: "虎衛怒守",
      description: "怒守原地，對周圍敵人造成爆發傷害。",
      cooldown: 9.3,
      range: 220,
      radius: 154,
      damage: 58,
      damageTags: ["shock", "blade"],
      vfxKey: "blood_rage",
      effectId: "blood_rage"
    }
  }),
  createHero({
    id: "zhangliao",
    factionId: "wei",
    name: "張遼",
    title: "逍遙突騎",
    role: "突進斬將",
    passiveName: "威震逍遙",
    passiveText: "手動突進冷卻較短，擅長穿過敵線擊殺精英。",
    baseStats: { maxHp: 132, moveSpeed: 250, armor: 3, pickupRadius: 100 },
    autoAbility: {
      name: "突騎槍影",
      description: "向目標方向連續突刺。",
      cooldown: 0.82,
      range: 430,
      radius: 26,
      damage: 21,
      damageTags: ["pierce", "command"],
      vfxKey: "spear_flash",
      effectId: "spear_flurry"
    },
    manualAbility: {
      name: "合肥破陣",
      description: "高速衝入敵陣並撕開缺口。",
      cooldown: 6.8,
      range: 380,
      radius: 62,
      damage: 66,
      damageTags: ["pierce", "shock"],
      vfxKey: "dragon_dash",
      effectId: "seven_dashes"
    }
  }),
  createHero({
    id: "simayi",
    factionId: "wei",
    name: "司馬懿",
    title: "狼顧謀主",
    role: "雷符控場",
    passiveName: "深謀反制",
    passiveText: "偏向遠距離控場，能優先處理危險目標。",
    baseStats: { maxHp: 118, moveSpeed: 224, armor: 2, pickupRadius: 120 },
    autoAbility: {
      name: "狼顧雷符",
      description: "鎖定數名敵人落下雷符。",
      cooldown: 1.12,
      range: 600,
      radius: 58,
      damage: 20,
      damageTags: ["command", "shock"],
      vfxKey: "thunder_charm",
      effectId: "thunder_charm"
    },
    manualAbility: {
      name: "冢虎冰陣",
      description: "在敵群核心展開冰陣持續牽制。",
      cooldown: 8.6,
      range: 560,
      radius: 94,
      damage: 48,
      damageTags: ["command", "shock"],
      vfxKey: "frost_lotus",
      effectId: "frost_lotus"
    }
  }),
  createHero({
    id: "sunquan",
    factionId: "wu",
    name: "孫權",
    title: "江東少主",
    role: "火令指揮",
    passiveName: "碧眼坐鎮",
    passiveText: "提高火攻節奏，能在中距離穩定鋪場。",
    baseStats: { maxHp: 134, moveSpeed: 226, armor: 3, pickupRadius: 108 },
    autoAbility: {
      name: "江東火令",
      description: "向前方發出火令劍光。",
      cooldown: 1,
      range: 450,
      radius: 30,
      damage: 22,
      damageTags: ["fire", "command"],
      vfxKey: "fire_note",
      effectId: "fire_note"
    },
    manualAbility: {
      name: "坐斷東南",
      description: "號令江東軍勢震開敵群。",
      cooldown: 8.1,
      range: 340,
      radius: 118,
      damage: 54,
      damageTags: ["command", "shock"],
      vfxKey: "siege_drums",
      effectId: "siege_drums"
    }
  }),
  createHero({
    id: "zhouyu",
    factionId: "wu",
    name: "周瑜",
    title: "赤壁雅將",
    role: "火攻法師",
    passiveName: "赤壁火勢",
    passiveText: "火焰傷害能持續削弱敵群。",
    baseStats: { maxHp: 118, moveSpeed: 230, armor: 2, pickupRadius: 112 },
    autoAbility: {
      name: "琴音火符",
      description: "彈出火焰音符並留下灼燒區。",
      cooldown: 0.9,
      range: 460,
      radius: 30,
      damage: 18,
      damageTags: ["fire"],
      vfxKey: "fire_note",
      effectId: "fire_note"
    },
    manualAbility: {
      name: "赤壁連環火",
      description: "沿前方鋪開連環火線。",
      cooldown: 8.5,
      range: 380,
      radius: 168,
      damage: 36,
      damageTags: ["fire", "command"],
      vfxKey: "red_cliff_fire",
      effectId: "red_cliff_fire"
    }
  }),
  createHero({
    id: "sunshangxiang",
    factionId: "wu",
    name: "孫尚香",
    title: "弓腰姬",
    role: "遠程箭雨",
    passiveName: "雙弩連珠",
    passiveText: "遠程攻擊頻率高，適合邊走邊清理包圍。",
    baseStats: { maxHp: 116, moveSpeed: 248, armor: 2, pickupRadius: 120 },
    autoAbility: {
      name: "雙弩扇射",
      description: "以雙弩扇形連射。",
      cooldown: 0.78,
      range: 500,
      radius: 18,
      damage: 15,
      damageTags: ["arrow", "pierce"],
      vfxKey: "crossbow_fan",
      effectId: "fan_bolts"
    },
    manualAbility: {
      name: "火箭箭雨",
      description: "呼叫火箭雨落在周圍敵群。",
      cooldown: 7.2,
      range: 420,
      radius: 112,
      damage: 46,
      damageTags: ["arrow", "fire"],
      vfxKey: "arrow_rain",
      effectId: "arrow_rain"
    }
  }),
  createHero({
    id: "ganning",
    factionId: "wu",
    name: "甘寧",
    title: "錦帆夜襲",
    role: "高速奇襲",
    passiveName: "鈴聲夜渡",
    passiveText: "攻擊節奏快，擅長用分身斬線清出移動空間。",
    baseStats: { maxHp: 128, moveSpeed: 258, armor: 2, pickupRadius: 104 },
    autoAbility: {
      name: "錦帆快斬",
      description: "放出多道快速斬影。",
      cooldown: 0.86,
      range: 440,
      radius: 28,
      damage: 20,
      damageTags: ["blade", "pierce"],
      vfxKey: "shadow_clones",
      effectId: "shadow_clones"
    },
    manualAbility: {
      name: "百騎劫營",
      description: "突入敵陣留下高傷害路徑。",
      cooldown: 6.7,
      range: 380,
      radius: 58,
      damage: 64,
      damageTags: ["blade", "shock"],
      vfxKey: "dragon_dash",
      effectId: "seven_dashes"
    }
  }),
  createHero({
    id: "taishici",
    factionId: "wu",
    name: "太史慈",
    title: "神亭神射",
    role: "穿刺射手",
    passiveName: "信義連射",
    passiveText: "箭矢穿透力高，面對長列敵人特別有效。",
    baseStats: { maxHp: 124, moveSpeed: 238, armor: 3, pickupRadius: 110 },
    autoAbility: {
      name: "神亭穿箭",
      description: "射出穿透箭矢擊穿前方敵軍。",
      cooldown: 0.84,
      range: 520,
      radius: 20,
      damage: 18,
      damageTags: ["arrow", "pierce"],
      vfxKey: "crossbow_fan",
      effectId: "fan_bolts"
    },
    manualAbility: {
      name: "鳳羽齊射",
      description: "展開大角度火羽齊射。",
      cooldown: 7.4,
      range: 560,
      radius: 34,
      damage: 48,
      damageTags: ["arrow", "fire"],
      vfxKey: "phoenix_feathers",
      effectId: "phoenix_feathers"
    }
  }),
  createHero({
    id: "diaochan",
    factionId: "qun",
    name: "貂蟬",
    title: "閉月舞姬",
    role: "近戰魅惑",
    passiveName: "連環花舞",
    passiveText: "魅惑與花刃能短暫牽制敵群。",
    baseStats: { maxHp: 124, moveSpeed: 252, armor: 2, pickupRadius: 116 },
    autoAbility: {
      name: "花刃旋舞",
      description: "旋身揮出花瓣刀光。",
      cooldown: 0.86,
      range: 230,
      radius: 104,
      damage: 23,
      damageTags: ["blade", "charm"],
      vfxKey: "petal_waltz",
      effectId: "petal_waltz"
    },
    manualAbility: {
      name: "閉月傾城",
      description: "以大範圍舞步魅惑並震散敵人。",
      cooldown: 7.8,
      range: 280,
      radius: 158,
      damage: 48,
      damageTags: ["blade", "charm", "shock"],
      vfxKey: "allure_dance",
      effectId: "allure_dance"
    }
  }),
  createHero({
    id: "zhangjiao",
    factionId: "qun",
    name: "張角",
    title: "太平妖道",
    role: "雷法控場",
    passiveName: "黃天雷籙",
    passiveText: "雷符能優先打擊多個近距離威脅。",
    baseStats: { maxHp: 116, moveSpeed: 226, armor: 1, pickupRadius: 124 },
    autoAbility: {
      name: "太平雷符",
      description: "召雷打擊最近數名敵人。",
      cooldown: 1.04,
      range: 590,
      radius: 58,
      damage: 21,
      damageTags: ["shock", "command"],
      vfxKey: "thunder_charm",
      effectId: "thunder_charm"
    },
    manualAbility: {
      name: "黃天冰蓮",
      description: "在敵群腳下開出大範圍法陣。",
      cooldown: 8.2,
      range: 560,
      radius: 98,
      damage: 50,
      damageTags: ["shock", "command"],
      vfxKey: "frost_lotus",
      effectId: "frost_lotus"
    }
  }),
  createHero({
    id: "yuanshao",
    factionId: "qun",
    name: "袁紹",
    title: "河北盟主",
    role: "軍勢壓制",
    passiveName: "四世三公",
    passiveText: "範圍與軍令兼備，適合用大量投射壓線。",
    baseStats: { maxHp: 142, moveSpeed: 214, armor: 4, pickupRadius: 108 },
    autoAbility: {
      name: "盟主旗令",
      description: "以旗令打出多道軍勢衝擊。",
      cooldown: 1.08,
      range: 480,
      radius: 34,
      damage: 23,
      damageTags: ["command", "shock"],
      vfxKey: "siege_drums",
      effectId: "siege_drums"
    },
    manualAbility: {
      name: "河北萬騎",
      description: "號令大軍直線衝鋒，貫穿敵群。",
      cooldown: 8.4,
      range: 720,
      radius: 58,
      damage: 72,
      damageTags: ["command", "shock"],
      vfxKey: "tiger_cavalry",
      effectId: "tiger_cavalry"
    }
  }),
  createHero({
    id: "dongzhuo",
    factionId: "qun",
    name: "董卓",
    title: "西涼暴君",
    role: "重壓近戰",
    passiveName: "暴虐酒池",
    passiveText: "高生命值與大範圍震擊，適合粗暴撞開包圍。",
    baseStats: { maxHp: 190, moveSpeed: 190, armor: 7, pickupRadius: 86 },
    autoAbility: {
      name: "西涼重槌",
      description: "以巨力重砸近身敵軍。",
      cooldown: 1.28,
      range: 235,
      radius: 108,
      damage: 34,
      damageTags: ["shock", "blade"],
      vfxKey: "iron_cleave",
      effectId: "heavy_cleave"
    },
    manualAbility: {
      name: "暴虐血宴",
      description: "爆發狂怒，震開周圍敵人。",
      cooldown: 9.5,
      range: 220,
      radius: 160,
      damage: 60,
      damageTags: ["shock", "blade"],
      vfxKey: "blood_rage",
      effectId: "blood_rage"
    }
  }),
  createHero({
    id: "huatuo",
    factionId: "qun",
    name: "華佗",
    title: "青囊神醫",
    role: "靈巧支援",
    passiveName: "青囊護息",
    passiveText: "拾取範圍較大，能以法陣控場維持安全距離。",
    baseStats: { maxHp: 120, moveSpeed: 236, armor: 1, pickupRadius: 132 },
    autoAbility: {
      name: "青囊冰蓮",
      description: "以藥香法陣牽制最近敵人。",
      cooldown: 1,
      range: 500,
      radius: 72,
      damage: 19,
      damageTags: ["charm", "shock"],
      vfxKey: "frost_lotus",
      effectId: "frost_lotus"
    },
    manualAbility: {
      name: "麻沸花舞",
      description: "展開花舞法陣，短暫壓制周遭敵群。",
      cooldown: 7.7,
      range: 300,
      radius: 146,
      damage: 44,
      damageTags: ["charm", "shock"],
      vfxKey: "allure_dance",
      effectId: "allure_dance"
    }
  })
];

export const heroById = Object.fromEntries(heroes.map((hero) => [hero.id, hero])) as Record<HeroDef["id"], HeroDef>;
