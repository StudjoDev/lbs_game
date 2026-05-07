import type { ChapterId, ConquestCityId, FactionId, HeroId } from "../types";

export type ConquestRegionId = "shu" | "wei" | "wu" | "qun" | "final";

export interface ConquestCityDef {
  id: ConquestCityId;
  name: string;
  region: ConquestRegionId;
  regionName: string;
  gatekeeperHeroId: HeroId;
  chapterId: ChapterId;
  prerequisiteCityIds: ConquestCityId[];
  recommendedPower: number;
  tier: number;
  firstClearRewards: {
    merit: number;
    provisions: number;
    renown: number;
    chestKeys: number;
  };
}

export const starterHeroIds = ["liubei", "caocao", "sunquan", "diaochan"] as const satisfies readonly HeroId[];
export const entryCityIds = ["jingzhou", "xuchang", "jianye", "julu"] as const satisfies readonly ConquestCityId[];
export const finalCityId = "luoyang" as const satisfies ConquestCityId;

export const conquestCities: ConquestCityDef[] = [
  city("jingzhou", "荊州", "shu", "蜀漢", "guanyu", "yellow_turbans", [], 2, 1),
  city("changban", "長坂", "shu", "蜀漢", "zhangfei", "yellow_turbans", ["jingzhou"], 5, 1),
  city("hanzhong", "漢中", "shu", "蜀漢", "zhaoyun", "hulao_outer", ["changban"], 9, 2),
  city("tongguan", "潼關", "shu", "蜀漢", "machao", "hulao_outer", ["hanzhong"], 12, 2),
  city("longzhong", "隆中", "shu", "蜀漢", "zhugeliang", "red_cliff_line", ["tongguan"], 17, 3),
  city("xuchang", "許昌", "wei", "魏國", "xiahoudun", "yellow_turbans", [], 2, 1),
  city("qiaojun", "譙郡", "wei", "魏國", "xuchu", "yellow_turbans", ["xuchang"], 5, 1),
  city("hefei", "合肥", "wei", "魏國", "zhangliao", "hulao_outer", ["qiaojun"], 10, 2),
  city("yecheng", "鄴城", "wei", "魏國", "simayi", "red_cliff_line", ["hefei"], 16, 3),
  city("luoshui", "洛水", "wei", "魏國", "zhenji", "red_cliff_line", ["yecheng"], 19, 3),
  city("jianye", "建業", "wu", "江東", "zhouyu", "yellow_turbans", [], 2, 1),
  city("wujun", "吳郡", "wu", "江東", "sunshangxiang", "yellow_turbans", ["jianye"], 5, 1),
  city("jinfan_camp", "錦帆營", "wu", "江東", "ganning", "hulao_outer", ["wujun"], 10, 2),
  city("shenting", "神亭", "wu", "江東", "taishici", "red_cliff_line", ["jinfan_camp"], 16, 3),
  city("wan_city", "皖城", "wu", "江東", "xiaoqiao", "red_cliff_line", ["shenting"], 19, 3),
  city("julu", "鉅鹿", "qun", "群雄", "zhangjiao", "yellow_turbans", [], 2, 1),
  city("guandu", "官渡", "qun", "群雄", "yuanshao", "hulao_outer", ["julu"], 9, 2),
  city("qingnang_valley", "青囊谷", "qun", "群雄", "huatuo", "red_cliff_line", ["guandu"], 15, 3),
  city("hulao_gate", "虎牢關", "qun", "群雄", "lubu", "hulao_outer", ["qingnang_valley"], 20, 3),
  city("luoyang", "洛陽", "final", "天下", "dongzhuo", "red_cliff_line", ["longzhong", "luoshui", "wan_city", "hulao_gate"], 22, 4)
];

export const conquestCityById = Object.fromEntries(conquestCities.map((cityDef) => [cityDef.id, cityDef])) as Record<
  ConquestCityId,
  ConquestCityDef
>;

export function getConquestCityDef(cityId: ConquestCityId | undefined): ConquestCityDef | undefined {
  return cityId ? conquestCityById[cityId] : undefined;
}

export function getConquestCityForHero(heroId: HeroId): ConquestCityDef | undefined {
  return conquestCities.find((cityDef) => cityDef.gatekeeperHeroId === heroId);
}

export function isStarterHeroId(heroId: HeroId): boolean {
  return (starterHeroIds as readonly HeroId[]).includes(heroId);
}

export function regionFactionId(region: ConquestRegionId): FactionId | undefined {
  return region === "shu" || region === "wei" || region === "wu" || region === "qun" ? region : undefined;
}

function city(
  id: ConquestCityId,
  name: string,
  region: ConquestRegionId,
  regionName: string,
  gatekeeperHeroId: HeroId,
  chapterId: ChapterId,
  prerequisiteCityIds: ConquestCityId[],
  recommendedPower: number,
  tier: number
): ConquestCityDef {
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
    firstClearRewards: {
      merit: 80 + tier * 42,
      provisions: 40 + tier * 28,
      renown: tier >= 3 ? 2 : 1,
      chestKeys: tier >= 3 ? 2 : 1
    }
  };
}
