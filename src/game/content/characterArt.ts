import type { BondDef, CharacterAnimationId, CharacterArtDef, CharacterId, FactionId, HeroId } from "../types";

export const bonds: BondDef[] = [
  {
    id: "taoyuan",
    name: "蜀漢同心",
    description: "劉備、關羽、張飛、趙雲、諸葛亮同場象徵仁義、突進與軍略互補。",
    characterIds: ["liubei", "guanyu", "zhangfei", "zhaoyun", "zhugeliang"]
  },
  {
    id: "weiwu",
    name: "魏武霸業",
    description: "曹操、夏侯惇、許褚、張遼、司馬懿組成軍令、護衛與謀略核心。",
    characterIds: ["caocao", "xiahoudun", "xuchu", "zhangliao", "simayi"]
  },
  {
    id: "jiangdong",
    name: "江東烈焰",
    description: "孫權、周瑜、孫尚香、甘寧、太史慈以火攻、箭雨與奇襲建立江東節奏。",
    characterIds: ["sunquan", "zhouyu", "sunshangxiang", "ganning", "taishici"]
  },
  {
    id: "qunfang",
    name: "群雄異彩",
    description: "貂蟬、張角、袁紹、董卓、華佗各具奇術、軍勢、重壓與支援風格。",
    characterIds: ["diaochan", "zhangjiao", "yuanshao", "dongzhuo", "huatuo"]
  },
  {
    id: "feijiang",
    name: "飛將無雙",
    description: "呂布作為虎牢關 Boss 收藏角色，代表壓迫感與終局挑戰。",
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

const animationFrameCounts = {
  idle: 6,
  run: 6,
  attack: 8
} as const satisfies Record<CharacterAnimationId, number>;

const animationFrameRates = {
  idle: 8,
  run: 12,
  attack: 18
} as const satisfies Record<CharacterAnimationId, number>;

function animationFramePaths(id: CharacterId, animation: CharacterAnimationId): string[] {
  return Array.from({ length: animationFrameCounts[animation] }, (_, index) =>
    artPath(id, `anim/${animation}/${(index + 1).toString().padStart(2, "0")}.png`)
  );
}

function animationFrameKeys(textureKey: string, animation: CharacterAnimationId): string[] {
  return Array.from(
    { length: animationFrameCounts[animation] },
    (_, index) => `${textureKey}_${animation}_${(index + 1).toString().padStart(2, "0")}`
  );
}

function heroAnimations(id: CharacterId, textureKey: string): CharacterArtDef["animations"] {
  return {
    idle: {
      framePaths: animationFramePaths(id, "idle"),
      frameKeys: animationFrameKeys(textureKey, "idle"),
      frameRate: animationFrameRates.idle,
      repeat: -1
    },
    run: {
      framePaths: animationFramePaths(id, "run"),
      frameKeys: animationFrameKeys(textureKey, "run"),
      frameRate: animationFrameRates.run,
      repeat: -1
    },
    attack: {
      framePaths: animationFramePaths(id, "attack"),
      frameKeys: animationFrameKeys(textureKey, "attack"),
      frameRate: animationFrameRates.attack,
      repeat: 0
    }
  };
}

interface PlayableArtInput {
  id: HeroId;
  assetId: CharacterId;
  factionId: FactionId;
  name: string;
  title: string;
  rarityLabel: string;
  stars: number;
  role: string;
  quote: string;
  biography: string;
  bondIds: string[];
  palette: CharacterArtDef["palette"];
  battleScale?: number;
}

function createPlayableArt(input: PlayableArtInput): CharacterArtDef {
  const textureKey = `hero_${input.id}`;
  return {
    id: input.id,
    factionId: input.factionId,
    name: input.name,
    title: input.title,
    rarityLabel: input.rarityLabel,
    stars: input.stars,
    role: input.role,
    quote: input.quote,
    biography: input.biography,
    bondIds: input.bondIds,
    cardImage: artPath(input.assetId, "card.png"),
    battleImage: artPath(input.assetId, "battle-idle.png"),
    attackStrip: artPath(input.assetId, "attack-strip.png"),
    attackFrames: attackFrames(input.assetId),
    textureKey,
    attackFrameKeys: attackFrameKeys(textureKey),
    animations: heroAnimations(input.assetId, textureKey),
    battleScale: input.battleScale ?? 0.72,
    anchor: { x: 0.5, y: 0.88 },
    palette: input.palette,
    playable: true
  };
}

export const characterArts: CharacterArtDef[] = [
  createPlayableArt({
    id: "liubei",
    assetId: "liubei",
    factionId: "shu",
    name: "劉備",
    title: "昭烈仁君",
    rarityLabel: "SSR",
    stars: 5,
    role: "均衡支援",
    quote: "天下未定，先聚人心。",
    biography: "蜀陣營的核心君主型武將。此版本先複用蜀系既有戰鬥素材，保留仁德、聚義與穩定支援的玩法定位。",
    bondIds: ["taoyuan"],
    palette: { primary: "#41c878", secondary: "#153b26", accent: "#ffd36a" }
  }),
  createPlayableArt({
    id: "guanyu",
    assetId: "guanyu",
    factionId: "shu",
    name: "關羽",
    title: "青龍武聖",
    rarityLabel: "SSR",
    stars: 5,
    role: "前排斬擊",
    quote: "青龍在手，萬軍辟易。",
    biography: "以青龍偃月刀鎮住虎牢戰線的蜀將。沉穩可靠，適合作為前排核心。",
    bondIds: ["taoyuan"],
    palette: { primary: "#2dc77d", secondary: "#123626", accent: "#ffd36a" }
  }),
  createPlayableArt({
    id: "zhangfei",
    assetId: "zhangfei",
    factionId: "shu",
    name: "張飛",
    title: "燕人猛吼",
    rarityLabel: "SR",
    stars: 4,
    role: "爆發坦克",
    quote: "誰敢近前，先吃我一聲雷！",
    biography: "高血量與高護甲的蜀陣營猛將。技能偏近身震擊，用來突破包圍。",
    bondIds: ["taoyuan"],
    palette: { primary: "#2f9b5b", secondary: "#172f22", accent: "#ff9f5f" }
  }),
  createPlayableArt({
    id: "zhaoyun",
    assetId: "zhaoyun",
    factionId: "shu",
    name: "趙雲",
    title: "常山龍膽",
    rarityLabel: "SSR",
    stars: 5,
    role: "高速突刺",
    quote: "龍膽所至，敵陣自開。",
    biography: "高速穿陣的蜀軍槍將。移動與突進能力突出，適合主動切入。",
    bondIds: ["taoyuan"],
    palette: { primary: "#45c7df", secondary: "#113d49", accent: "#dffaff" }
  }),
  createPlayableArt({
    id: "zhugeliang",
    assetId: "zhugeliang",
    factionId: "shu",
    name: "諸葛亮",
    title: "臥龍軍師",
    rarityLabel: "SSR",
    stars: 5,
    role: "控場法師",
    quote: "風起八陣，勝負已定。",
    biography: "蜀陣營的遠距控場核心。以冰蓮與雷符牽制密集敵群。",
    bondIds: ["taoyuan"],
    palette: { primary: "#7bd6c4", secondary: "#143a36", accent: "#f7f0b6" }
  }),
  createPlayableArt({
    id: "caocao",
    assetId: "caocao",
    factionId: "wei",
    name: "曹操",
    title: "魏武帝星",
    rarityLabel: "SSR",
    stars: 5,
    role: "軍令統帥",
    quote: "令出如山，萬騎皆動。",
    biography: "以劍令與虎豹騎控場的魏軍統帥。冷色皇權感凸顯軍令風格。",
    bondIds: ["weiwu"],
    palette: { primary: "#6d8cff", secondary: "#171c3a", accent: "#e8edff" }
  }),
  createPlayableArt({
    id: "xiahoudun",
    assetId: "xiahoudun",
    factionId: "wei",
    name: "夏侯惇",
    title: "獨眼鐵壁",
    rarityLabel: "SR",
    stars: 4,
    role: "重甲血戰",
    quote: "傷痕越深，刀勢越重。",
    biography: "扛住前線壓力的魏軍猛將。重劈與血戰讓他能反打包圍。",
    bondIds: ["weiwu"],
    palette: { primary: "#526ab7", secondary: "#17182a", accent: "#ff6963" }
  }),
  createPlayableArt({
    id: "xuchu",
    assetId: "xuchu",
    factionId: "wei",
    name: "許褚",
    title: "虎癡護衛",
    rarityLabel: "SR",
    stars: 4,
    role: "護主猛將",
    quote: "主公身前，寸步不退。",
    biography: "魏陣營的重裝護衛。高生命、高護甲，技能以近身震擊為主。",
    bondIds: ["weiwu"],
    palette: { primary: "#6676a8", secondary: "#181b29", accent: "#f3b05e" }
  }),
  createPlayableArt({
    id: "zhangliao",
    assetId: "zhangliao",
    factionId: "wei",
    name: "張遼",
    title: "逍遙突騎",
    rarityLabel: "SSR",
    stars: 5,
    role: "突進斬將",
    quote: "逍遙一破，敵膽先寒。",
    biography: "魏陣營的高速突進武將。能以槍影和衝鋒切穿敵線。",
    bondIds: ["weiwu"],
    palette: { primary: "#5d82d9", secondary: "#13213c", accent: "#d8e6ff" }
  }),
  createPlayableArt({
    id: "simayi",
    assetId: "simayi",
    factionId: "wei",
    name: "司馬懿",
    title: "狼顧謀主",
    rarityLabel: "SSR",
    stars: 5,
    role: "雷符控場",
    quote: "忍到最後，才是勝者。",
    biography: "魏陣營的謀略法師。雷符與冰陣能處理高威脅目標。",
    bondIds: ["weiwu"],
    palette: { primary: "#8aa0ff", secondary: "#17152d", accent: "#c9a8ff" }
  }),
  createPlayableArt({
    id: "sunquan",
    assetId: "sunquan",
    factionId: "wu",
    name: "孫權",
    title: "江東少主",
    rarityLabel: "SSR",
    stars: 5,
    role: "火令指揮",
    quote: "江東基業，由我坐鎮。",
    biography: "吳陣營的指揮型武將。火令與軍勢支援讓他能穩定鋪場。",
    bondIds: ["jiangdong"],
    palette: { primary: "#f06d55", secondary: "#421815", accent: "#ffd36a" }
  }),
  createPlayableArt({
    id: "zhouyu",
    assetId: "zhouyu",
    factionId: "wu",
    name: "周瑜",
    title: "赤壁雅將",
    rarityLabel: "SSR",
    stars: 5,
    role: "火攻法師",
    quote: "一曲東風，萬艦成燼。",
    biography: "以琴音與火陣壓制戰場的吳國雅將。火攻範圍清場能力突出。",
    bondIds: ["jiangdong"],
    palette: { primary: "#ff6f67", secondary: "#451915", accent: "#ffc15f" }
  }),
  createPlayableArt({
    id: "sunshangxiang",
    assetId: "sunshangxiang",
    factionId: "wu",
    name: "孫尚香",
    title: "弓腰姬",
    rarityLabel: "SR",
    stars: 4,
    role: "遠程箭雨",
    quote: "雙弩已張，誰敢靠近？",
    biography: "以雙弩與箭雨清場的吳國女將。高機動遠程代表。",
    bondIds: ["jiangdong"],
    palette: { primary: "#ff7b8d", secondary: "#431726", accent: "#ffd37f" }
  }),
  createPlayableArt({
    id: "ganning",
    assetId: "ganning",
    factionId: "wu",
    name: "甘寧",
    title: "錦帆夜襲",
    rarityLabel: "SR",
    stars: 4,
    role: "高速奇襲",
    quote: "鈴聲一響，敵營已亂。",
    biography: "吳陣營的奇襲武將。以分身斬影與突進切開敵陣。",
    bondIds: ["jiangdong"],
    palette: { primary: "#ff8a57", secondary: "#3c1711", accent: "#ffe08a" }
  }),
  createPlayableArt({
    id: "taishici",
    assetId: "taishici",
    factionId: "wu",
    name: "太史慈",
    title: "神亭神射",
    rarityLabel: "SR",
    stars: 4,
    role: "穿刺射手",
    quote: "信義在弦，箭無虛發。",
    biography: "吳陣營的穿刺射手。箭矢角度大，適合處理長列敵人。",
    bondIds: ["jiangdong"],
    palette: { primary: "#e86d4f", secondary: "#361717", accent: "#ffd88f" }
  }),
  createPlayableArt({
    id: "diaochan",
    assetId: "diaochan",
    factionId: "qun",
    name: "貂蟬",
    title: "閉月舞姬",
    rarityLabel: "UR",
    stars: 6,
    role: "近戰魅惑",
    quote: "一舞傾城，萬軍失神。",
    biography: "群雄陣營的高人氣舞姬。以花刃、魅惑與華麗近戰節奏控場。",
    bondIds: ["qunfang"],
    palette: { primary: "#ff78b7", secondary: "#4c1834", accent: "#ffd98a" }
  }),
  createPlayableArt({
    id: "zhangjiao",
    assetId: "zhangjiao",
    factionId: "qun",
    name: "張角",
    title: "太平妖道",
    rarityLabel: "SSR",
    stars: 5,
    role: "雷法控場",
    quote: "蒼天已死，雷符當立。",
    biography: "群雄陣營的雷法武將。擅長鎖定多名敵人，以雷符與法陣控場。",
    bondIds: ["qunfang"],
    palette: { primary: "#d49bff", secondary: "#27153a", accent: "#ffe577" }
  }),
  createPlayableArt({
    id: "yuanshao",
    assetId: "yuanshao",
    factionId: "qun",
    name: "袁紹",
    title: "河北盟主",
    rarityLabel: "SR",
    stars: 4,
    role: "軍勢壓制",
    quote: "四世三公，萬軍聽令。",
    biography: "群雄陣營的軍勢型武將。以旗令與騎兵衝鋒壓制前線。",
    bondIds: ["qunfang"],
    palette: { primary: "#d2a1ff", secondary: "#2f1a3d", accent: "#ffd36a" }
  }),
  createPlayableArt({
    id: "dongzhuo",
    assetId: "dongzhuo",
    factionId: "qun",
    name: "董卓",
    title: "西涼暴君",
    rarityLabel: "SR",
    stars: 4,
    role: "重壓近戰",
    quote: "擋路者，皆成塵土。",
    biography: "群雄陣營的重壓近戰武將。先複用呂布素材作為西涼系代用外觀。",
    bondIds: ["qunfang"],
    palette: { primary: "#8d4f7f", secondary: "#221020", accent: "#ff8b55" },
    battleScale: 0.66
  }),
  createPlayableArt({
    id: "huatuo",
    assetId: "huatuo",
    factionId: "qun",
    name: "華佗",
    title: "青囊神醫",
    rarityLabel: "SSR",
    stars: 5,
    role: "靈巧支援",
    quote: "救人亦可破陣。",
    biography: "群雄陣營的支援型武將。以法陣牽制與大拾取範圍維持安全距離。",
    bondIds: ["qunfang"],
    palette: { primary: "#82d7b4", secondary: "#153329", accent: "#fff0a6" }
  }),
  {
    id: "lubu",
    factionId: "qun",
    name: "呂布",
    title: "飛將無雙",
    rarityLabel: "UR",
    stars: 6,
    role: "虎牢關 Boss",
    quote: "誰能擋我方天畫戟？",
    biography: "虎牢關終局 Boss 收藏角色。保留為非可選角色，用於 Boss 圖鑑與戰鬥挑戰。",
    bondIds: ["feijiang"],
    cardImage: artPath("lubu", "card.png"),
    battleImage: artPath("lubu", "battle-idle.png"),
    attackStrip: artPath("lubu", "attack-strip.png"),
    attackFrames: attackFrames("lubu"),
    textureKey: "enemy_lubu",
    attackFrameKeys: attackFrameKeys("enemy_lubu"),
    animations: heroAnimations("lubu", "enemy_lubu"),
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
