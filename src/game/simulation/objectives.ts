import type { BattlefieldObjectiveState, ObjectiveEvent, RunState } from "../types";

interface ObjectiveBlueprint {
  id: string;
  event: ObjectiveEvent;
  title: string;
  description: string;
  goal: number;
  rewardXp: number;
  rewardMorale: number;
}

export interface CompletedObjective {
  title: string;
  rewardXp: number;
  rewardMorale: number;
}

const objectiveBlueprints: ObjectiveBlueprint[] = [
  {
    id: "break_vanguard",
    event: "kill",
    title: "斬破前鋒",
    description: "快速擊破敵軍，打開第一波戰場節奏。",
    goal: 24,
    rewardXp: 24,
    rewardMorale: 18
  },
  {
    id: "hunt_elite",
    event: "eliteKill",
    title: "點殺精銳",
    description: "擊倒校尉或強敵，取得名將魂燃料。",
    goal: 1,
    rewardXp: 42,
    rewardMorale: 30
  },
  {
    id: "sweep_field",
    event: "kill",
    title: "橫掃戰線",
    description: "保持擊殺效率，讓敵潮變成戰功。",
    goal: 42,
    rewardXp: 58,
    rewardMorale: 34
  },
  {
    id: "awaken_soul",
    event: "moraleBurst",
    title: "名將魂覺醒",
    description: "累積士氣並觸發一次覺醒爆發。",
    goal: 1,
    rewardXp: 70,
    rewardMorale: 18
  },
  {
    id: "boss_preparation",
    event: "kill",
    title: "虎牢備戰",
    description: "在呂布現身前清出安全空間。",
    goal: 66,
    rewardXp: 92,
    rewardMorale: 42
  }
];

export function createObjective(index = 0): BattlefieldObjectiveState {
  const blueprint = objectiveBlueprints[index % objectiveBlueprints.length];
  const loop = Math.floor(index / objectiveBlueprints.length);
  const goalScale = blueprint.event === "kill" ? loop * 16 : loop;
  const rewardScale = loop * 18;
  return {
    id: `${blueprint.id}_${index}`,
    event: blueprint.event,
    title: blueprint.title,
    description: blueprint.description,
    progress: 0,
    goal: blueprint.goal + goalScale,
    rewardXp: blueprint.rewardXp + rewardScale,
    rewardMorale: blueprint.rewardMorale + Math.min(18, loop * 5)
  };
}

export function advanceObjective(
  state: RunState,
  event: ObjectiveEvent,
  amount = 1
): CompletedObjective | undefined {
  const objective = state.objective;
  if (objective.event !== event || amount <= 0 || state.status !== "playing") {
    return undefined;
  }

  objective.progress = Math.min(objective.goal, objective.progress + amount);
  if (objective.progress < objective.goal) {
    return undefined;
  }

  const completed: CompletedObjective = {
    title: objective.title,
    rewardXp: objective.rewardXp,
    rewardMorale: objective.rewardMorale
  };
  state.objectiveIndex += 1;
  state.objective = createObjective(state.objectiveIndex);
  return completed;
}
