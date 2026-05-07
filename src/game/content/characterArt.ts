import type { BondDef, CharacterAnimationId, CharacterArtDef, CharacterId, FactionId, HeroId } from "../types";

export const bonds: BondDef[] = [
  {
    id: "taoyuan",
    name: "蜀漢同心",
    description: "蜀漢武將同場象徵仁義、突進、軍略、神射與機關術互補。",
    characterIds: ["liubei", "guanyu", "zhangfei", "zhaoyun", "machao", "zhugeliang", "huangzhong", "yueying", "jiangwei"]
  },
  {
    id: "weiwu",
    name: "魏武霸業",
    description: "魏武武將組成軍令、護衛、猛攻與謀略核心。",
    characterIds: ["caocao", "xiahoudun", "xuchu", "zhangliao", "simayi", "zhenji", "dianwei", "guojia"]
  },
  {
    id: "jiangdong",
    name: "江東烈焰",
    description: "江東武將以火攻、箭雨、奇襲、雙劍與雙扇控場建立節奏。",
    characterIds: ["sunquan", "zhouyu", "sunshangxiang", "ganning", "taishici", "xiaoqiao", "luxun", "daqiao"]
  },
  {
    id: "qunfang",
    name: "群雄異彩",
    description: "群雄武將各具奇術、軍勢、重壓、幻法與飛將系爆發風格。",
    characterIds: ["diaochan", "zhangjiao", "yuanshao", "dongzhuo", "huatuo", "zuoci", "lulingqi", "lubu"]
  },
  {
    id: "feijiang",
    name: "飛將無雙",
    description: "呂布從虎牢關加入群雄 roster，代表極高爆發與方天畫戟壓迫感。",
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
  attack: 8,
  ultimate: 8
} as const satisfies Record<CharacterAnimationId, number>;

const animationEffectOverlayDefaults = {
  idle: true,
  run: true,
  attack: true,
  ultimate: true
} as const satisfies Record<CharacterAnimationId, boolean>;

const animationFrameRates = {
  idle: 8,
  run: 12,
  attack: 18,
  ultimate: 20
} as const satisfies Record<CharacterAnimationId, number>;

function animationFramePaths(id: CharacterId, animation: CharacterAnimationId, count: number = animationFrameCounts[animation]): string[] {
  return Array.from({ length: count }, (_, index) =>
    artPath(id, `anim/${animation}/${(index + 1).toString().padStart(2, "0")}.png`)
  );
}

function animationFrameKeys(textureKey: string, animation: CharacterAnimationId, count: number = animationFrameCounts[animation]): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${textureKey}_${animation}_${(index + 1).toString().padStart(2, "0")}`
  );
}

type CharacterAnimationFrameCounts = Partial<Record<CharacterAnimationId, number>>;
type CharacterAnimationEffectOverlayFlags = Partial<Record<CharacterAnimationId, boolean>>;

function animationFrameCount(animation: CharacterAnimationId, overrides?: CharacterAnimationFrameCounts): number {
  return overrides?.[animation] ?? animationFrameCounts[animation];
}

function animationEffectOverlayPaths(id: CharacterId, animation: CharacterAnimationId, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    artPath(id, `anim/${animation}/effect/${(index + 1).toString().padStart(2, "0")}.png`)
  );
}

function animationEffectOverlayKeys(textureKey: string, animation: CharacterAnimationId, count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${textureKey}_${animation}_effect_${(index + 1).toString().padStart(2, "0")}`
  );
}

function heroAnimations(
  id: CharacterId,
  textureKey: string,
  includeUltimate = true,
  frameCountOverrides?: CharacterAnimationFrameCounts,
  effectOverlays?: CharacterAnimationEffectOverlayFlags
): CharacterArtDef["animations"] {
  const animationEffectOverlays = { ...animationEffectOverlayDefaults, ...effectOverlays };
  const animations: CharacterArtDef["animations"] = {
    idle: {
      framePaths: animationFramePaths(id, "idle", animationFrameCount("idle", frameCountOverrides)),
      frameKeys: animationFrameKeys(textureKey, "idle", animationFrameCount("idle", frameCountOverrides)),
      frameRate: animationFrameRates.idle,
      repeat: -1
    },
    run: {
      framePaths: animationFramePaths(id, "run", animationFrameCount("run", frameCountOverrides)),
      frameKeys: animationFrameKeys(textureKey, "run", animationFrameCount("run", frameCountOverrides)),
      frameRate: animationFrameRates.run,
      repeat: -1
    },
    attack: {
      framePaths: animationFramePaths(id, "attack", animationFrameCount("attack", frameCountOverrides)),
      frameKeys: animationFrameKeys(textureKey, "attack", animationFrameCount("attack", frameCountOverrides)),
      frameRate: animationFrameRates.attack,
      repeat: 0
    }
  };
  if (includeUltimate) {
    animations.ultimate = {
      framePaths: animationFramePaths(id, "ultimate", animationFrameCount("ultimate", frameCountOverrides)),
      frameKeys: animationFrameKeys(textureKey, "ultimate", animationFrameCount("ultimate", frameCountOverrides)),
      frameRate: animationFrameRates.ultimate,
      repeat: 0
    };
  }
  for (const [animationId, animation] of Object.entries(animations) as [CharacterAnimationId, NonNullable<CharacterArtDef["animations"]>[CharacterAnimationId]][]) {
    if (!animation || !animationEffectOverlays[animationId]) {
      continue;
    }
    animation.effectOverlay = {
      framePaths: animationEffectOverlayPaths(id, animationId, animation.framePaths.length),
      frameKeys: animationEffectOverlayKeys(textureKey, animationId, animation.frameKeys.length),
      frameRate: animation.frameRate,
      repeat: animation.repeat,
      blendMode: "add",
      alpha: 0.92,
      depthOffset: 1
    };
  }
  return animations;
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
  animationFrameCounts?: CharacterAnimationFrameCounts;
  animationEffectOverlays?: CharacterAnimationEffectOverlayFlags;
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
    animations: heroAnimations(input.assetId, textureKey, true, input.animationFrameCounts, input.animationEffectOverlays),
    battleScale: input.battleScale ?? 0.72,
    anchor: { x: 0.5, y: 0.82 },
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
    biography: "蜀陣營的核心君主型武將。以雙劍穩住前線節奏，保留仁德、聚義與穩定支援的玩法定位。",
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
    biography: "高血量與高護甲的蜀陣營猛將。以丈八蛇矛近身震擊，用來突破包圍。",
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
    id: "machao",
    assetId: "machao",
    factionId: "shu",
    name: "馬超",
    title: "西涼錦將",
    rarityLabel: "SSR",
    stars: 5,
    role: "撕裂突進",
    quote: "錦馬無聲，槍到陣裂。",
    biography: "西涼出身的蜀軍突擊型槍將，擅長狹線穿插與連刺壓制，與桃園線並肩推進。",
    bondIds: ["taoyuan"],
    palette: { primary: "#5cb8ff", secondary: "#143a5c", accent: "#ffe8a8" }
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
    id: "huangzhong",
    assetId: "huangzhong",
    factionId: "shu",
    name: "黃忠",
    title: "定軍神射",
    rarityLabel: "SSR",
    stars: 5,
    role: "遠程狙擊",
    quote: "弓弦一響，敵陣先寒。",
    biography: "蜀軍老將，以長弓神射貫穿敵線。定軍山的老當益壯以金色箭軌和穩定拉弓節奏呈現。",
    bondIds: ["taoyuan"],
    palette: { primary: "#d7b35a", secondary: "#2d3424", accent: "#fff0a6" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8, ultimate: 8 }
  }),
  createPlayableArt({
    id: "yueying",
    assetId: "yueying",
    factionId: "shu",
    name: "月英",
    title: "機關巧匠",
    rarityLabel: "SSR",
    stars: 5,
    role: "機關支援",
    quote: "巧思不止於紙上。",
    biography: "蜀軍機關術代表。以戰戈、飛輪與木牛連弩建立不同於軍師法術的機械控場風格。",
    bondIds: ["taoyuan"],
    palette: { primary: "#3cecc2", secondary: "#14524a", accent: "#f0b24a" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8, ultimate: 8 },
    animationEffectOverlays: { run: true, attack: true, ultimate: true }
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
    id: "zhenji",
    assetId: "zhenji",
    factionId: "wei",
    name: "甄姬",
    title: "洛水凌波",
    rarityLabel: "SSR",
    stars: 5,
    role: "冰雷控場",
    quote: "洛水起舞，寒雷自落。",
    biography: "魏陣營的冰雷法術武將。以鐵笛奏出冰蓮與雷符，守住中遠距離戰線。",
    bondIds: ["weiwu"],
    palette: { primary: "#8fb8ff", secondary: "#18223c", accent: "#d8f4ff" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8 }
  }),
  createPlayableArt({
    id: "dianwei",
    assetId: "dianwei",
    factionId: "wei",
    name: "典韋",
    title: "惡來護衛",
    rarityLabel: "SR",
    stars: 4,
    role: "短兵護主",
    quote: "主公身前，雙戟開路。",
    biography: "魏軍近身護衛猛將。以短雙戟、重步伐與地裂衝擊和許褚的護主重錘區分。",
    bondIds: ["weiwu"],
    palette: { primary: "#355f9f", secondary: "#101827", accent: "#d49a3e" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8, ultimate: 8 }
  }),
  createPlayableArt({
    id: "guojia",
    assetId: "guojia",
    factionId: "wei",
    name: "郭嘉",
    title: "天妒奇佐",
    rarityLabel: "SSR",
    stars: 5,
    role: "冰晶謀士",
    quote: "奇謀一落，勝負已偏。",
    biography: "魏軍天才謀士。以法球、冰星與星圖形成獨立的冰晶軌跡，避免與司馬懿雷符重疊。",
    bondIds: ["weiwu"],
    palette: { primary: "#72d7ff", secondary: "#14294d", accent: "#f6fbff" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8, ultimate: 8 }
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
    biography: "吳陣營的奇襲武將。以鎖鐮、短刃斬影與突進切開敵陣。",
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
    id: "xiaoqiao",
    assetId: "xiaoqiao",
    factionId: "wu",
    name: "小喬",
    title: "東風花火",
    rarityLabel: "SSR",
    stars: 5,
    role: "火舞支援",
    quote: "東風一轉，花火滿江。",
    biography: "吳陣營的火舞型支援武將。以雙扇舞步與火攻鋪場，讓江東路線多一名靈巧控場核心。",
    bondIds: ["jiangdong"],
    palette: { primary: "#ff8fa5", secondary: "#431726", accent: "#ffe19a" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8 }
  }),
  createPlayableArt({
    id: "luxun",
    assetId: "luxun",
    factionId: "wu",
    name: "陸遜",
    title: "夷陵火策",
    rarityLabel: "SSR",
    stars: 5,
    role: "火劍軍師",
    quote: "連營一燃，退路無存。",
    biography: "吳軍火策軍師。以雙劍與細長火線作為主體，和周瑜的琴火與小喬的扇舞火勢區分。",
    bondIds: ["jiangdong"],
    palette: { primary: "#f0602f", secondary: "#3a1712", accent: "#ffd166" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8, ultimate: 8 }
  }),
  createPlayableArt({
    id: "daqiao",
    assetId: "daqiao",
    factionId: "wu",
    name: "大喬",
    title: "江東清瀾",
    rarityLabel: "SSR",
    stars: 5,
    role: "水風支援",
    quote: "清瀾一開，兵鋒自散。",
    biography: "江東喬氏姐妹中的清瀾支援。以雙扇水風、蓮花波紋與小喬的火扇形成對照。",
    bondIds: ["jiangdong"],
    palette: { primary: "#63d5e8", secondary: "#133a4c", accent: "#e8fff9" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8, ultimate: 8 }
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
    biography: "群雄陣營的高人氣舞姬。以彩帶、魅惑與華麗近戰節奏控場。",
    bondIds: ["qunfang"],
    palette: { primary: "#ff78b7", secondary: "#4c1834", accent: "#ffd98a" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8 }
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
    biography: "群雄陣營的軍勢型武將。以寶劍、旗令與騎兵衝鋒壓制前線。",
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
    biography: "群雄陣營的重壓近戰武將。以鎖錘與壓迫感呈現西涼暴君的近身威脅。",
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
  createPlayableArt({
    id: "zuoci",
    assetId: "zuoci",
    factionId: "qun",
    name: "左慈",
    title: "遁甲仙人",
    rarityLabel: "SSR",
    stars: 5,
    role: "五行幻術",
    quote: "遁甲開門，真假難分。",
    biography: "群雄幻術型武將。以符咒、分身與五行法陣做出和張角雷法、華佗藥陣不同的仙術語彙。",
    bondIds: ["qunfang"],
    palette: { primary: "#a8f5e6", secondary: "#123c36", accent: "#f6fff4" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8, ultimate: 8 }
  }),
  createPlayableArt({
    id: "lulingqi",
    assetId: "lulingqi",
    factionId: "qun",
    name: "呂玲綺",
    title: "飛將戟姬",
    rarityLabel: "SSR",
    stars: 5,
    role: "高速戟舞",
    quote: "飛將之血，戟影不息。",
    biography: "飛將血脈的高速戟舞武將。十字戟與紅紫殘影保留呂家壓迫感，但節奏更靈巧敏捷。",
    bondIds: ["qunfang", "feijiang"],
    palette: { primary: "#c053ff", secondary: "#26102f", accent: "#ff5f8f" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8, ultimate: 8 }
  }),
  createPlayableArt({
    id: "lubu",
    assetId: "lubu",
    factionId: "qun",
    name: "呂布",
    title: "飛將無雙",
    rarityLabel: "UR",
    stars: 6,
    role: "近戰爆發",
    quote: "誰能擋我方天畫戟？",
    biography: "群雄陣營的飛將。從虎牢關招募後可作為一般武將出戰，保留強烈的方天畫戟與紅紫壓迫感。",
    bondIds: ["qunfang", "feijiang"],
    palette: { primary: "#7f45b7", secondary: "#1b1022", accent: "#ff4e74" },
    battleScale: 0.68
  }),
  createPlayableArt({
    id: "jiangwei",
    assetId: "jiangwei",
    factionId: "shu",
    name: "姜維",
    title: "麒麟繼志",
    rarityLabel: "SSR",
    stars: 5,
    role: "軍略突刺",
    quote: "承武侯遺志，麒麟破陣。",
    biography: "蜀漢後期的麒麟將才。以麒麟長槍和兵書軍令切入敵線，普通攻擊偏斜挑刺，無雙以星軌連突和軍略收束區分於趙雲、馬超的直線槍勢。",
    bondIds: ["taoyuan"],
    palette: { primary: "#46d8b8", secondary: "#143b34", accent: "#ffd36a" },
    animationFrameCounts: { idle: 6, run: 6, attack: 8, ultimate: 8 },
    animationEffectOverlays: { idle: true, run: true, attack: true, ultimate: true }
  })
];

export const characterArtById = Object.fromEntries(characterArts.map((art) => [art.id, art])) as Record<
  CharacterId,
  CharacterArtDef
>;

export const playableCharacterArts = characterArts.filter((art) => art.playable);
