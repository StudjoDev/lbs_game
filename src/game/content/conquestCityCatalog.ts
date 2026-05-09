import type { ChapterId, ConquestCityId, HeroId } from "../types";

export type ConquestRegionId =
  | "guanzhong"
  | "liangyi"
  | "hebei"
  | "zhongyuan"
  | "jingchu"
  | "jiangdong"
  | "nanman"
  | "pass";

export interface ConquestCityCatalogEntry {
  id: ConquestCityId;
  name: string;
  region: ConquestRegionId;
  regionName: string;
  gatekeeperHeroId?: HeroId;
  chapterId: ChapterId;
  prerequisiteCityIds: ConquestCityId[];
  recommendedPower: number;
  tier: number;
  mapPosition: {
    x: number;
    y: number;
  };
  historicalNote: string;
}

function city(
  id: ConquestCityId,
  name: string,
  region: ConquestRegionId,
  regionName: string,
  mapPosition: { x: number; y: number },
  prerequisiteCityIds: ConquestCityId[],
  recommendedPower: number,
  tier: number,
  chapterId: ChapterId,
  historicalNote: string,
  gatekeeperHeroId?: HeroId
): ConquestCityCatalogEntry {
  return {
    id,
    name,
    region,
    regionName,
    gatekeeperHeroId,
    chapterId,
    prerequisiteCityIds,
    recommendedPower,
    tier,
    mapPosition,
    historicalNote
  };
}

export const conquestCityCatalog = [
  city("wuwei", "武威", "liangyi", "涼州", { x: 10, y: 14 }, ["anding"], 15, 3, "red_cliff_line", "河西走廊重鎮，涼州軍馬與西北門戶所在。"),
  city("xiping", "西平", "liangyi", "涼州", { x: 15, y: 27 }, ["tianshui"], 13, 2, "hulao_outer", "湟水一帶的西北據點，連接羌胡與關中。"),
  city("anding", "安定", "guanzhong", "關中", { x: 22, y: 20 }, ["tianshui"], 13, 2, "hulao_outer", "關隴要地，常作西北軍勢南下關中的跳板。"),
  city("tianshui", "天水", "guanzhong", "隴右", { x: 27, y: 32 }, ["hanzhong"], 12, 2, "hulao_outer", "隴右重鎮，演義中與諸葛北伐、姜維登場相關。"),
  city("changan", "長安", "guanzhong", "關中", { x: 38, y: 34 }, ["tongguan"], 18, 3, "red_cliff_line", "漢唐舊都，三國時為關中政治與軍事中樞。"),
  city("tongguan", "潼關", "pass", "關隘", { x: 43, y: 39 }, ["hanzhong"], 12, 2, "hulao_outer", "關中東門，馬超、曹操潼關之戰的要衝。", "machao"),
  city("hongnong", "弘農", "guanzhong", "弘農", { x: 47, y: 35 }, ["changan"], 19, 3, "red_cliff_line", "洛陽與長安之間的戰略走廊，控扼崤函道路。"),
  city("luoyang", "洛陽", "zhongyuan", "司隸", { x: 52, y: 40 }, ["hulao_gate"], 22, 4, "red_cliff_line", "東漢舊都，董卓遷都與群雄逐鹿的象徵中心。", "dongzhuo"),
  city("hulao_gate", "虎牢關", "pass", "關隘", { x: 57, y: 38 }, ["guandu"], 20, 3, "hulao_outer", "洛陽東門名關，演義中三英戰呂布的舞台。", "lubu"),

  city("xiangping", "襄平", "hebei", "遼東", { x: 90, y: 9 }, ["beiping"], 18, 3, "red_cliff_line", "遼東公孫氏根據地，東北邊境的終端城。"),
  city("beiping", "北平", "hebei", "幽州", { x: 78, y: 14 }, ["nanpi"], 14, 2, "hulao_outer", "幽州北部據點，連接塞外與河北平原。"),
  city("jinyang", "晉陽", "hebei", "并州", { x: 55, y: 14 }, ["yecheng"], 15, 3, "red_cliff_line", "并州重鎮，太原盆地的北方軍事據點。"),
  city("nanpi", "南皮", "hebei", "冀州", { x: 69, y: 20 }, ["yecheng"], 13, 2, "hulao_outer", "袁紹勢力曾控河北，南皮是冀州北部重城。"),
  city("pingyuan", "平原", "hebei", "青冀", { x: 72, y: 28 }, ["julu"], 10, 2, "hulao_outer", "劉備早年曾任平原相，是其起勢履歷之一。"),
  city("yecheng", "鄴城", "hebei", "冀州", { x: 61, y: 27 }, ["julu"], 16, 3, "red_cliff_line", "袁紹、曹魏皆重視的河北核心都會。", "simayi"),
  city("julu", "鉅鹿", "hebei", "冀州", { x: 54, y: 24 }, [], 2, 1, "yellow_turbans", "黃巾起義張角活動核心區，北方亂世起點之一。", "zhangjiao"),

  city("guandu", "官渡", "zhongyuan", "中原", { x: 61, y: 45 }, ["julu"], 9, 2, "hulao_outer", "曹操擊敗袁紹的決定性戰役地，北方局勢由此改寫。", "yuanshao"),
  city("chenliu", "陳留", "zhongyuan", "兗豫", { x: 68, y: 43 }, ["xuchang"], 7, 1, "yellow_turbans", "曹操起兵與中原轉運的重要節點。"),
  city("puyang", "濮陽", "zhongyuan", "兗州", { x: 72, y: 37 }, ["chenliu"], 9, 2, "hulao_outer", "曹操與呂布爭奪兗州時的重要戰場。"),
  city("xuchang", "許昌", "zhongyuan", "豫州", { x: 64, y: 52 }, [], 2, 1, "yellow_turbans", "曹操迎天子後的政治中心，挾天子以令諸侯之地。", "xiahoudun"),
  city("qiaojun", "譙郡", "zhongyuan", "豫州", { x: 75, y: 47 }, ["xuchang"], 5, 1, "yellow_turbans", "曹氏故里，曹魏宗族勢力的重要根脈。", "xuchu"),
  city("xiaopei", "小沛", "zhongyuan", "徐州", { x: 82, y: 53 }, ["qiaojun"], 8, 2, "hulao_outer", "劉備、呂布、曹操多方拉鋸的徐州前線。"),
  city("xiapi", "下邳", "zhongyuan", "徐州", { x: 88, y: 49 }, ["xiaopei"], 11, 2, "hulao_outer", "呂布最終敗亡之城，也是徐州爭奪焦點。"),
  city("runan", "汝南", "zhongyuan", "豫州", { x: 65, y: 61 }, ["xuchang"], 8, 2, "hulao_outer", "豫南大郡，連接中原與荊州、淮南。"),
  city("shouchun", "壽春", "zhongyuan", "淮南", { x: 76, y: 63 }, ["runan"], 12, 2, "hulao_outer", "袁術稱帝之地，淮南政治軍事核心。"),
  city("hefei", "合肥", "jiangdong", "淮南", { x: 84, y: 66 }, ["shouchun"], 10, 2, "hulao_outer", "張遼威震逍遙津，魏吳長期對峙的名城。", "zhangliao"),
  city("luoshui", "洛水", "zhongyuan", "河洛", { x: 56, y: 50 }, ["yecheng"], 19, 3, "red_cliff_line", "洛水意象連結洛神傳說，適合作為甄姬守城節點。", "zhenji"),

  city("jingzhou", "荊州", "jingchu", "荊楚", { x: 47, y: 70 }, [], 2, 1, "yellow_turbans", "南北交通樞紐，劉表、劉備、孫權皆曾爭奪。", "guanyu"),
  city("changban", "長坂", "jingchu", "荊楚", { x: 44, y: 63 }, ["jingzhou"], 5, 1, "yellow_turbans", "趙雲救阿斗、張飛據橋喝退曹軍的演義名場面。", "zhangfei"),
  city("xiangyang", "襄陽", "jingchu", "荊北", { x: 46, y: 56 }, ["changban"], 9, 2, "hulao_outer", "漢水重鎮，北控中原、南接荊州腹地。"),
  city("fancheng", "樊城", "jingchu", "荊北", { x: 51, y: 53 }, ["xiangyang"], 11, 2, "hulao_outer", "關羽水淹七軍與襄樊戰役的重要城。"),
  city("xinye", "新野", "jingchu", "荊北", { x: 55, y: 56 }, ["xiangyang"], 8, 2, "hulao_outer", "劉備寄居荊州時的據點，連結三顧茅廬故事。"),
  city("longzhong", "隆中", "jingchu", "荊北", { x: 41, y: 57 }, ["xiangyang"], 17, 3, "red_cliff_line", "諸葛亮隆中對策源地，天下三分戰略由此成形。", "zhugeliang"),
  city("wan_city", "宛城", "zhongyuan", "南陽", { x: 58, y: 58 }, ["xuchang"], 19, 3, "red_cliff_line", "南陽要地，曹操宛城之敗與張繡故事相關。", "xiaoqiao"),
  city("hanzhong", "漢中", "liangyi", "漢中", { x: 29, y: 47 }, ["longzhong"], 9, 2, "hulao_outer", "巴蜀北門，劉備與曹操爭漢中後奠定蜀漢根基。", "zhaoyun"),
  city("zitong", "梓潼", "liangyi", "益州", { x: 23, y: 57 }, ["hanzhong"], 12, 2, "hulao_outer", "入蜀北線重鎮，連接漢中與成都平原。"),
  city("chengdu", "成都", "liangyi", "益州", { x: 15, y: 64 }, ["zitong"], 16, 3, "red_cliff_line", "蜀漢都城，巴蜀政權核心。"),
  city("jiangzhou", "江州", "liangyi", "巴郡", { x: 25, y: 72 }, ["chengdu"], 16, 3, "red_cliff_line", "巴郡重鎮，長江上游水陸轉運節點。"),
  city("yongan", "永安", "liangyi", "巴東", { x: 36, y: 68 }, ["jiangzhou"], 17, 3, "red_cliff_line", "白帝城所在區域，劉備託孤的歷史舞台。"),
  city("jianning", "建寧", "nanman", "南中", { x: 18, y: 83 }, ["jiangzhou"], 19, 3, "red_cliff_line", "南中郡治之一，蜀漢南征與南中治理相關。"),
  city("yunnan", "雲南", "nanman", "南中", { x: 29, y: 89 }, ["jianning"], 20, 3, "red_cliff_line", "南中深處據點，常與孟獲、南蠻故事連結。"),

  city("jiangling", "江陵", "jingchu", "荊南", { x: 41, y: 72 }, ["jingzhou"], 9, 2, "hulao_outer", "荊州南北水道樞紐，魏蜀吳長期爭奪。"),
  city("yiling", "夷陵", "jingchu", "峽口", { x: 34, y: 73 }, ["jiangling"], 13, 2, "hulao_outer", "夷陵之戰主戰場，劉備伐吳失利於此。"),
  city("jiangxia", "江夏", "jingchu", "江漢", { x: 55, y: 69 }, ["jiangling"], 12, 2, "hulao_outer", "長江與漢水交會戰略點，連通荊州與江東。"),
  city("changsha", "長沙", "jingchu", "荊南", { x: 50, y: 82 }, ["jiangling"], 12, 2, "hulao_outer", "荊南四郡之一，黃忠、魏延故事常與此地相連。"),
  city("wuling", "武陵", "jingchu", "荊南", { x: 39, y: 84 }, ["changsha"], 13, 2, "hulao_outer", "荊南西部郡，控洞庭以西山地。"),
  city("lingling", "零陵", "jingchu", "荊南", { x: 48, y: 91 }, ["changsha"], 14, 2, "hulao_outer", "荊南四郡之一，南下嶺南的通道。"),
  city("guiyang", "桂陽", "jingchu", "荊南", { x: 59, y: 90 }, ["changsha"], 14, 2, "hulao_outer", "荊南四郡之一，接近嶺南邊界。"),

  city("jianye", "建業", "jiangdong", "江東", { x: 87, y: 70 }, [], 2, 1, "yellow_turbans", "孫吳都城，江東政權中心。", "zhouyu"),
  city("wujun", "吳郡", "jiangdong", "江東", { x: 91, y: 82 }, ["jianye"], 5, 1, "yellow_turbans", "孫氏起家核心區之一，江東富庶腹地。", "sunshangxiang"),
  city("kuaiji", "會稽", "jiangdong", "江東", { x: 86, y: 91 }, ["wujun"], 9, 2, "hulao_outer", "東南大郡，孫策平定江東的重要區域。"),
  city("lujiang", "廬江", "jiangdong", "淮南", { x: 75, y: 70 }, ["hefei"], 13, 2, "hulao_outer", "江淮之間重地，魏吳攻防前線之一。"),
  city("chaisang", "柴桑", "jiangdong", "江右", { x: 67, y: 76 }, ["lujiang"], 14, 2, "hulao_outer", "赤壁前後孫劉聯盟的重要據點。"),
  city("poyang", "鄱陽", "jiangdong", "江右", { x: 72, y: 86 }, ["chaisang"], 15, 3, "red_cliff_line", "鄱陽湖區域，控制江東內陸水網。"),
  city("jinfan_camp", "錦帆營", "jiangdong", "江表", { x: 59, y: 78 }, ["chaisang"], 10, 2, "hulao_outer", "甘寧錦帆賊形象來源，適合作江上奇襲據點。", "ganning"),
  city("shenting", "神亭", "jiangdong", "江東", { x: 79, y: 80 }, ["kuaiji"], 16, 3, "red_cliff_line", "孫策與太史慈交鋒的名場面。", "taishici"),
  city("qingnang_valley", "青囊谷", "zhongyuan", "醫谷", { x: 78, y: 39 }, ["guandu"], 15, 3, "red_cliff_line", "以華佗青囊書意象設計的醫者據點。", "huatuo")
] as const satisfies readonly ConquestCityCatalogEntry[];
