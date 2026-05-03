import type { BondDef, CharacterArtDef, CharacterId } from "../types";

export const bonds: BondDef[] = [
  {
    id: "taoyuan",
    name: "桃園",
    description: "蜀陣營武將同場時，象徵義氣連擊與機動支援。",
    characterIds: ["guanyu", "zhaoyun"]
  },
  {
    id: "weiwu",
    name: "魏武",
    description: "魏陣營武將同場時，象徵軍令、護甲與親衛支援。",
    characterIds: ["caocao", "xiahoudun"]
  },
  {
    id: "jiangdong",
    name: "江東",
    description: "吳陣營武將同場時，象徵火攻、箭雨與範圍控制。",
    characterIds: ["zhouyu", "sunshangxiang"]
  },
  {
    id: "qunfang",
    name: "群芳",
    description: "群雄角色羈絆，偏向靈巧、控制與華麗近戰節奏。",
    characterIds: ["diaochan"]
  },
  {
    id: "feijiang",
    name: "飛將",
    description: "呂布專屬羈絆，擊敗虎牢 Boss 後揭示完整收藏卡。",
    characterIds: ["lubu"]
  }
];

export const bondById = Object.fromEntries(bonds.map((bond) => [bond.id, bond])) as Record<string, BondDef>;

const basePath = `${import.meta.env.BASE_URL}assets/characters`;

function artPath(id: CharacterId, file: string): string {
  return `${basePath}/${id}/${file}`;
}

function attackFrames(id: CharacterId): string[] {
  return [0, 1, 2, 3].map((frame) => artPath(id, `attack-${frame}.png`));
}

function attackFrameKeys(textureKey: string): string[] {
  return [0, 1, 2, 3].map((frame) => `${textureKey}_attack_${frame}`);
}

export const characterArts: CharacterArtDef[] = [
  {
    id: "guanyu",
    factionId: "shu",
    name: "關羽",
    title: "青龍武聖",
    rarityLabel: "SSR",
    stars: 5,
    role: "近戰掃蕩",
    quote: "義在刀前，青龍所向皆開路。",
    biography: "以青龍偃月刀鎮住虎牢戰線的蜀將。新版卡面以 Q 版大眼、綠金盔飾與巨型刀影，保留沉穩可靠的前排核心感。",
    bondIds: ["taoyuan"],
    cardImage: artPath("guanyu", "card.png"),
    battleImage: artPath("guanyu", "battle-idle.png"),
    attackStrip: artPath("guanyu", "attack-strip.png"),
    attackFrames: attackFrames("guanyu"),
    textureKey: "hero_guanyu",
    attackFrameKeys: attackFrameKeys("hero_guanyu"),
    anchor: { x: 0.5, y: 0.88 },
    palette: { primary: "#2dc77d", secondary: "#123626", accent: "#ffd36a" },
    playable: true
  },
  {
    id: "zhaoyun",
    factionId: "shu",
    name: "趙雲",
    title: "常山白龍",
    rarityLabel: "SSR",
    stars: 5,
    role: "突進穿刺",
    quote: "白龍入陣，槍影不回頭。",
    biography: "高速穿陣的蜀軍槍將。銀藍寶石、亮眼槍芒與清爽表情，讓他在收藏頁中帶有主角感與速度感。",
    bondIds: ["taoyuan"],
    cardImage: artPath("zhaoyun", "card.png"),
    battleImage: artPath("zhaoyun", "battle-idle.png"),
    attackStrip: artPath("zhaoyun", "attack-strip.png"),
    attackFrames: attackFrames("zhaoyun"),
    textureKey: "hero_zhaoyun",
    attackFrameKeys: attackFrameKeys("hero_zhaoyun"),
    anchor: { x: 0.5, y: 0.88 },
    palette: { primary: "#45c7df", secondary: "#113d49", accent: "#dffaff" },
    playable: true
  },
  {
    id: "caocao",
    factionId: "wei",
    name: "曹操",
    title: "魏武帝星",
    rarityLabel: "SSR",
    stars: 5,
    role: "軍令支援",
    quote: "天下未定，先聽我一令。",
    biography: "以劍令與親衛控場的魏軍統帥。藍銀皇權感、金冠與冷色光芒凸顯稀有度，智將氣質也能在戰場上清楚辨識。",
    bondIds: ["weiwu"],
    cardImage: artPath("caocao", "card.png"),
    battleImage: artPath("caocao", "battle-idle.png"),
    attackStrip: artPath("caocao", "attack-strip.png"),
    attackFrames: attackFrames("caocao"),
    textureKey: "hero_caocao",
    attackFrameKeys: attackFrameKeys("hero_caocao"),
    anchor: { x: 0.5, y: 0.88 },
    palette: { primary: "#6d8cff", secondary: "#171c3a", accent: "#e8edff" },
    playable: true
  },
  {
    id: "xiahoudun",
    factionId: "wei",
    name: "夏侯惇",
    title: "獨眼豪刃",
    rarityLabel: "SR",
    stars: 4,
    role: "重斬坦克",
    quote: "傷痕是旗，重刀是令。",
    biography: "扛住前線壓力的魏軍猛將。Q 版處理降低血腥感，改以獨眼頭盔、紅色刀芒與豪爽表情呈現壓迫力。",
    bondIds: ["weiwu"],
    cardImage: artPath("xiahoudun", "card.png"),
    battleImage: artPath("xiahoudun", "battle-idle.png"),
    attackStrip: artPath("xiahoudun", "attack-strip.png"),
    attackFrames: attackFrames("xiahoudun"),
    textureKey: "hero_xiahoudun",
    attackFrameKeys: attackFrameKeys("hero_xiahoudun"),
    anchor: { x: 0.5, y: 0.88 },
    palette: { primary: "#526ab7", secondary: "#17182a", accent: "#ff6963" },
    playable: true
  },
  {
    id: "zhouyu",
    factionId: "wu",
    name: "周瑜",
    title: "赤壁雅火",
    rarityLabel: "SSR",
    stars: 5,
    role: "火場控場",
    quote: "一曲東風，萬炬同明。",
    biography: "以琴音與火陣壓制戰場的吳國雅將。紅金卡面、羽扇與火焰符號，讓他在圖鑑中有華麗法師感。",
    bondIds: ["jiangdong"],
    cardImage: artPath("zhouyu", "card.png"),
    battleImage: artPath("zhouyu", "battle-idle.png"),
    attackStrip: artPath("zhouyu", "attack-strip.png"),
    attackFrames: attackFrames("zhouyu"),
    textureKey: "hero_zhouyu",
    attackFrameKeys: attackFrameKeys("hero_zhouyu"),
    anchor: { x: 0.5, y: 0.88 },
    palette: { primary: "#ff6f67", secondary: "#451915", accent: "#ffc15f" },
    playable: true
  },
  {
    id: "sunshangxiang",
    factionId: "wu",
    name: "孫尚香",
    title: "弓腰姬",
    rarityLabel: "SR",
    stars: 4,
    role: "遠程箭幕",
    quote: "箭雨開場，我先一步。",
    biography: "以雙弩與箭雨清場的吳國女將。亮眼寶石、紅金輕甲和俏皮表情，讓她成為高機動遠程代表。",
    bondIds: ["jiangdong"],
    cardImage: artPath("sunshangxiang", "card.png"),
    battleImage: artPath("sunshangxiang", "battle-idle.png"),
    attackStrip: artPath("sunshangxiang", "attack-strip.png"),
    attackFrames: attackFrames("sunshangxiang"),
    textureKey: "hero_sunshangxiang",
    attackFrameKeys: attackFrameKeys("hero_sunshangxiang"),
    anchor: { x: 0.5, y: 0.88 },
    palette: { primary: "#ff7b8d", secondary: "#431726", accent: "#ffd37f" },
    playable: true
  },
  {
    id: "diaochan",
    factionId: "qun",
    name: "貂蟬",
    title: "傾城舞姬",
    rarityLabel: "UR",
    stars: 6,
    role: "近戰舞者",
    quote: "一舞傾城，花影為刃。",
    biography: "群雄陣營的高人氣支援型舞姬，這輪作為可玩近戰舞者加入。粉金寶石、花飾與甜美表情是新版美術的品質基準。",
    bondIds: ["qunfang"],
    cardImage: artPath("diaochan", "card.png"),
    battleImage: artPath("diaochan", "battle-idle.png"),
    attackStrip: artPath("diaochan", "attack-strip.png"),
    attackFrames: attackFrames("diaochan"),
    textureKey: "hero_diaochan",
    attackFrameKeys: attackFrameKeys("hero_diaochan"),
    battleScale: 0.72,
    anchor: { x: 0.5, y: 0.88 },
    palette: { primary: "#ff78b7", secondary: "#4c1834", accent: "#ffd98a" },
    playable: true
  },
  {
    id: "lubu",
    name: "呂布",
    title: "飛將",
    rarityLabel: "UR",
    stars: 6,
    role: "虎牢關 Boss",
    quote: "人中飛將，萬軍皆退。",
    biography: "虎牢關壓軸登場的強敵。未擊敗前在圖鑑中保持遮蔽，通關後揭示完整紫紅魔甲 Q 版卡面。",
    bondIds: ["feijiang"],
    cardImage: artPath("lubu", "card.png"),
    battleImage: artPath("lubu", "battle-idle.png"),
    attackStrip: artPath("lubu", "attack-strip.png"),
    attackFrames: attackFrames("lubu"),
    textureKey: "enemy_lubu",
    attackFrameKeys: attackFrameKeys("enemy_lubu"),
    anchor: { x: 0.5, y: 0.9 },
    palette: { primary: "#7f45b7", secondary: "#1b1022", accent: "#ff4e74" },
    playable: false
  }
];

export const characterArtById = Object.fromEntries(characterArts.map((art) => [art.id, art])) as Record<
  CharacterId,
  CharacterArtDef
>;

export const playableCharacterArts = characterArts.filter((art) => art.playable);
