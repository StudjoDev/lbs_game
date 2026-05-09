import type { ConquestCityId, FactionId, HeroId } from "../types";
import { conquestCityCatalog, type ConquestCityCatalogEntry, type ConquestRegionId } from "./conquestCityCatalog";

export type { ConquestRegionId } from "./conquestCityCatalog";

export interface ConquestCityDef extends ConquestCityCatalogEntry {
  firstClearRewards: {
    merit: number;
    provisions: number;
    renown: number;
    chestKeys: number;
  };
}

export const starterHeroIds = ["liubei", "caocao", "sunquan", "diaochan"] as const satisfies readonly HeroId[];
export const entryCityIds = ["jingzhou", "xuchang", "jianye", "julu"] as const satisfies readonly ConquestCityId[];

export const conquestCities: ConquestCityDef[] = conquestCityCatalog.map((cityDef) => ({
  ...cityDef,
  firstClearRewards: {
    merit: 80 + cityDef.tier * 42,
    provisions: 40 + cityDef.tier * 28,
    renown: cityDef.tier >= 3 ? 2 : 1,
    chestKeys: cityDef.tier >= 3 ? 2 : 1
  }
}));

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
  if (region === "liangyi" || region === "jingchu" || region === "nanman") {
    return "shu";
  }
  if (region === "guanzhong" || region === "hebei" || region === "zhongyuan" || region === "pass") {
    return "wei";
  }
  if (region === "jiangdong") {
    return "wu";
  }
  return undefined;
}
