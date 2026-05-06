import type { BattlefieldObjectiveState, ChapterId, ChapterRoomType, EnemyId, ObjectiveEvent } from "../types";

export interface ChapterRoomDef {
  type: ChapterRoomType;
  title: string;
  objective: {
    event: ObjectiveEvent;
    title: string;
    description: string;
    goal: number;
    rewardXp: number;
    rewardMorale: number;
  };
  spawn: {
    intervalScale: number;
    countBonus: number;
    eliteChance: number;
    guardChance: number;
    preferred: EnemyId[];
  };
}

export interface ChapterDef {
  id: ChapterId;
  name: string;
  subtitle: string;
  recommendedPower: number;
  rewardPreview: string;
  rooms: ChapterRoomDef[];
}

const quietSpawn = {
  intervalScale: 1,
  countBonus: 0,
  eliteChance: 0,
  guardChance: 0,
  preferred: ["infantry"] as EnemyId[]
};

export const chapters: ChapterDef[] = [
  {
    id: "yellow_turbans",
    name: "黃巾前哨",
    subtitle: "破陣、奪糧、斬渠帥",
    recommendedPower: 1,
    rewardPreview: "戰功、軍糧、前哨寶箱鑰匙",
    rooms: createRooms("yellow_turbans", 0)
  },
  {
    id: "hulao_outer",
    name: "虎牢外圍",
    subtitle: "精兵壓境，呂布守關",
    recommendedPower: 8,
    rewardPreview: "聲望、軍械碎片、虎牢寶箱鑰匙",
    rooms: createRooms("hulao_outer", 1)
  },
  {
    id: "red_cliff_line",
    name: "赤壁火線",
    subtitle: "火攻亂軍，水寨突進",
    recommendedPower: 16,
    rewardPreview: "兵書碎片、聲望、赤壁寶箱鑰匙",
    rooms: createRooms("red_cliff_line", 2)
  }
];

export const defaultChapterId: ChapterId = "yellow_turbans";

export const chapterById = Object.fromEntries(chapters.map((chapter) => [chapter.id, chapter])) as Record<
  ChapterId,
  ChapterDef
>;

export function getChapterDef(chapterId: ChapterId | undefined): ChapterDef {
  return chapterById[chapterId ?? defaultChapterId] ?? chapterById[defaultChapterId];
}

export function getRoomDef(chapterId: ChapterId, roomIndex: number): ChapterRoomDef {
  const chapter = getChapterDef(chapterId);
  return chapter.rooms[Math.max(0, Math.min(chapter.rooms.length - 1, Math.floor(roomIndex)))] ?? chapter.rooms[0];
}

export function createRoomObjective(chapterId: ChapterId, roomIndex: number): BattlefieldObjectiveState {
  const chapter = getChapterDef(chapterId);
  const room = getRoomDef(chapterId, roomIndex);
  return {
    id: `${chapter.id}_room_${roomIndex + 1}`,
    event: room.objective.event,
    title: room.objective.title,
    description: room.objective.description,
    progress: 0,
    goal: room.objective.goal,
    rewardXp: room.objective.rewardXp,
    rewardMorale: room.objective.rewardMorale
  };
}

function createRooms(chapterId: ChapterId, tier: number): ChapterRoomDef[] {
  const prefix =
    chapterId === "yellow_turbans" ? "前哨" : chapterId === "hulao_outer" ? "虎牢" : "火線";
  const killGoal = 20 + tier * 6;
  return [
    normalRoom(`${prefix}一陣`, killGoal, tier, ["infantry", "archer"]),
    normalRoom(`${prefix}二陣`, killGoal + 4, tier, ["infantry", "cavalry"]),
    eliteRoom(`${prefix}菁英哨`, 1 + Math.min(2, tier), tier),
    treasureRoom(`${prefix}輜重箱`, tier),
    normalRoom(`${prefix}夾擊`, killGoal + 8, tier, ["archer", "shield", "cavalry"]),
    restRoom(`${prefix}整軍`, tier),
    normalRoom(`${prefix}破圍`, killGoal + 12, tier, ["shield", "cavalry", "captain"]),
    bossRoom(`${prefix}主將`, tier)
  ];
}

function normalRoom(title: string, goal: number, tier: number, preferred: EnemyId[]): ChapterRoomDef {
  return {
    type: "normal",
    title,
    objective: {
      event: "kill",
      title: "清剿亂軍",
      description: "擊破本房敵軍後開門",
      goal,
      rewardXp: 24 + tier * 10,
      rewardMorale: 12 + tier * 4
    },
    spawn: {
      intervalScale: Math.max(0.72, 1 - tier * 0.08),
      countBonus: tier,
      eliteChance: 5 + tier * 4,
      guardChance: 12 + tier * 8,
      preferred
    }
  };
}

function eliteRoom(title: string, goal: number, tier: number): ChapterRoomDef {
  return {
    type: "elite",
    title,
    objective: {
      event: "eliteKill",
      title: "斬菁英",
      description: "擊破菁英將領後開門",
      goal,
      rewardXp: 48 + tier * 16,
      rewardMorale: 28 + tier * 6
    },
    spawn: {
      intervalScale: Math.max(0.64, 0.82 - tier * 0.06),
      countBonus: 1 + tier,
      eliteChance: 30 + tier * 10,
      guardChance: 36 + tier * 8,
      preferred: ["captain", "shield", "cavalry"]
    }
  };
}

function treasureRoom(title: string, tier: number): ChapterRoomDef {
  return {
    type: "treasure",
    title,
    objective: {
      event: "treasure",
      title: "開啟寶箱",
      description: "短暫停火並取得房間獎勵",
      goal: 1,
      rewardXp: 32 + tier * 8,
      rewardMorale: 18
    },
    spawn: quietSpawn
  };
}

function restRoom(title: string, tier: number): ChapterRoomDef {
  return {
    type: "rest",
    title,
    objective: {
      event: "rest",
      title: "休整補給",
      description: "恢復少量體力後繼續推進",
      goal: 1,
      rewardXp: 18 + tier * 6,
      rewardMorale: 26
    },
    spawn: quietSpawn
  };
}

function bossRoom(title: string, tier: number): ChapterRoomDef {
  return {
    type: "boss",
    title,
    objective: {
      event: "bossKill",
      title: "擊破守關主將",
      description: "擊敗 Boss 才算章節通關",
      goal: 1,
      rewardXp: 90 + tier * 28,
      rewardMorale: 40
    },
    spawn: {
      intervalScale: Math.max(0.9, 1.08 - tier * 0.04),
      countBonus: tier,
      eliteChance: 0,
      guardChance: 28 + tier * 8,
      preferred: ["infantry", "shield", "archer"]
    }
  };
}
