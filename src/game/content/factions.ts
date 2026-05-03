import type { FactionDef } from "../types";

export const factions: FactionDef[] = [
  {
    id: "shu",
    name: "蜀",
    subtitle: "義膽群英",
    passiveName: "桃園連心",
    passiveText: "連擊傷害 +12%，移動速度 +8%。",
    palette: {
      primary: "#2dc77d",
      secondary: "#ffe08a",
      accent: "#80ffc4"
    }
  },
  {
    id: "wei",
    name: "魏",
    subtitle: "魏武霸業",
    passiveName: "虎衛軍令",
    passiveText: "護甲 +2，親衛與軍令傷害提高。",
    palette: {
      primary: "#6d8cff",
      secondary: "#edf2ff",
      accent: "#9ed1ff"
    }
  },
  {
    id: "wu",
    name: "吳",
    subtitle: "江東烈焰",
    passiveName: "赤壁火勢",
    passiveText: "燃燒傷害 +18%，範圍效果 +8%。",
    palette: {
      primary: "#ff6868",
      secondary: "#ffd27f",
      accent: "#ff9e72"
    }
  },
  {
    id: "qun",
    name: "群",
    subtitle: "群雄異彩",
    passiveName: "亂世華舞",
    passiveText: "移動速度 +14%，冷卻 -6%，近戰範圍 +6%。",
    palette: {
      primary: "#ff78b7",
      secondary: "#ffe2a8",
      accent: "#d9a7ff"
    }
  }
];

export const factionById = Object.fromEntries(factions.map((faction) => [faction.id, faction])) as Record<
  FactionDef["id"],
  FactionDef
>;
