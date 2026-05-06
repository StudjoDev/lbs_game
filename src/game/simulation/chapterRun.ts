import { createRoomObjective, getChapterDef, getRoomDef } from "../content/chapters";
import type { ChapterId, ObjectiveEvent, RunState } from "../types";
import type { CompletedObjective } from "./objectives";

export function initializeChapterRun(state: RunState, chapterId: ChapterId, roomIndex = 0): void {
  enterChapterRoom(state, roomIndex, chapterId);
}

export function enterChapterRoom(state: RunState, roomIndex: number, chapterId = state.chapterId): void {
  const chapter = getChapterDef(chapterId);
  const safeRoomIndex = Math.max(0, Math.min(chapter.rooms.length - 1, Math.floor(roomIndex)));
  const room = chapter.rooms[safeRoomIndex];
  const objective = createRoomObjective(chapter.id, safeRoomIndex);

  state.chapterId = chapter.id;
  state.chapterName = chapter.name;
  state.roomIndex = safeRoomIndex;
  state.roomCount = chapter.rooms.length;
  state.roomType = room.type;
  state.roomTitle = room.title;
  state.roomObjective = objective;
  state.objective = objective;
  state.objectiveIndex = safeRoomIndex;
  state.roomStatus = "fighting";
  state.doorOpen = false;
  state.roomElapsed = 0;
  state.roomClearTimer = 0;
  state.bossSpawned = false;
  state.spawnTimer = room.type === "boss" ? 0.15 : 0.2;
  state.enemies = [];
  state.projectiles = [];
  state.areas = [];
  state.xpOrbs = [];
  state.player.x = state.world.width / 2;
  state.player.y = state.world.height / 2;
}

export function enterNextChapterRoom(state: RunState): boolean {
  if (!state.doorOpen || state.roomIndex >= state.roomCount - 1) {
    return false;
  }
  enterChapterRoom(state, state.roomIndex + 1);
  return true;
}

export function updateChapterRoom(state: RunState, manualPressed: boolean, dt: number): CompletedObjective | undefined {
  state.roomElapsed += dt;

  if (state.elapsed >= state.duration && state.status === "playing") {
    state.status = "lost";
    return undefined;
  }

  if (state.roomStatus === "cleared") {
    state.roomClearTimer += dt;
    if (state.doorOpen && (manualPressed || state.roomClearTimer >= 1.45)) {
      enterNextChapterRoom(state);
    }
    return undefined;
  }

  if (state.roomType === "treasure" && state.roomElapsed >= 0.65) {
    return advanceRoomObjective(state, "treasure");
  }

  if (state.roomType === "rest" && state.roomElapsed >= 0.65) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + Math.max(12, state.player.maxHp * 0.12));
    return advanceRoomObjective(state, "rest");
  }

  return undefined;
}

export function advanceRoomObjective(
  state: RunState,
  event: ObjectiveEvent,
  amount = 1
): CompletedObjective | undefined {
  const objective = state.roomObjective;
  if (state.status !== "playing" || state.roomStatus !== "fighting" || objective.event !== event || amount <= 0) {
    return undefined;
  }

  objective.progress = Math.min(objective.goal, objective.progress + amount);
  if (objective.progress < objective.goal) {
    return undefined;
  }

  return completeRoom(state);
}

export function completeBossRoom(state: RunState): CompletedObjective {
  const completed = completeRoom(state);
  state.chapterCleared = true;
  state.doorOpen = false;
  state.status = "won";
  state.roomObjective.progress = state.roomObjective.goal;
  return completed;
}

export function currentRoomDef(state: RunState) {
  return getRoomDef(state.chapterId, state.roomIndex);
}

function completeRoom(state: RunState): CompletedObjective {
  state.roomStatus = "cleared";
  state.doorOpen = state.roomIndex < state.roomCount - 1;
  state.roomClearTimer = 0;
  state.spawnTimer = 999;
  state.roomObjective.progress = state.roomObjective.goal;
  state.objective = state.roomObjective;
  state.enemies = [];
  state.projectiles = [];
  state.areas = [];
  return {
    title: state.roomObjective.title,
    rewardXp: state.roomObjective.rewardXp,
    rewardMorale: state.roomObjective.rewardMorale
  };
}
