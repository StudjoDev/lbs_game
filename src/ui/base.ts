import { characterArtById } from "../game/content/characterArt";
import { heroes } from "../game/content/heroes";
import {
  canAfford,
  equipmentById,
  facilityDefs,
  getFacilityUpgradeCost,
  getTalentUpgradeCost,
  heroXpToNext,
  talentDefs,
  type DailyMissionId,
  type EquipmentSlot,
  type FacilityId,
  type MetaProgressionState,
  type MetaResources,
  type TalentId
} from "../game/meta/progression";
import type { HeroId } from "../game/types";

export type BaseTab = "overview" | "equipment" | "talents" | "missions" | "chests";

export interface BasePanelCallbacks {
  onBack: () => void;
  onClaimIdle: () => void;
  onUpgradeFacility: (facilityId: FacilityId) => void;
  onSelectHero: (heroId: HeroId) => void;
  onTab: (tab: BaseTab) => void;
  onUpgradeTalent: (talentId: TalentId) => void;
  onMergeEquipment: (itemKey: string) => void;
  onEquipItem: (itemKey: string) => void;
  onClaimMission: (missionId: DailyMissionId) => void;
  onOpenChest: () => void;
}

export function renderBasePanel(state: MetaProgressionState, selectedHeroId: HeroId, activeTab: BaseTab): string {
  const selectedHero = heroes.find((hero) => hero.id === selectedHeroId) ?? heroes[0];
  const selectedArt = characterArtById[selectedHero.artId];

  return `
    <main class="base-stage" style="--art-primary:${selectedArt.palette.primary}; --art-secondary:${selectedArt.palette.secondary}; --art-accent:${selectedArt.palette.accent};">
      <section class="base-topline">
        <div>
          <span class="panel-kicker">Base</span>
          <h2>武將基地</h2>
        </div>
      </section>
      <nav class="base-tabs">
        ${renderTab("overview", "概況", activeTab)}
        ${renderTab("equipment", "裝備", activeTab)}
        ${renderTab("talents", "天賦", activeTab)}
        ${renderTab("missions", "任務", activeTab)}
        ${renderTab("chests", "寶箱", activeTab)}
      </nav>
      ${renderResourceHeader(state)}
      ${renderActiveTab(state, selectedHero.id, activeTab)}
    </main>
  `;
}

export function bindBasePanel(root: HTMLElement, callbacks: BasePanelCallbacks): void {
  root.querySelector<HTMLButtonElement>("[data-claim-idle]")?.addEventListener("click", callbacks.onClaimIdle);
  root.querySelectorAll<HTMLButtonElement>("[data-base-tab]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onTab(button.dataset.baseTab as BaseTab));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-upgrade-facility]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onUpgradeFacility(button.dataset.upgradeFacility as FacilityId));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-base-hero]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onSelectHero(button.dataset.baseHero as HeroId));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-upgrade-talent]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onUpgradeTalent(button.dataset.upgradeTalent as TalentId));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-merge-equipment]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onMergeEquipment(button.dataset.mergeEquipment ?? ""));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-equip-item]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onEquipItem(button.dataset.equipItem ?? ""));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-claim-mission]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onClaimMission(button.dataset.claimMission as DailyMissionId));
  });
  root.querySelector<HTMLButtonElement>("[data-open-chest]")?.addEventListener("click", callbacks.onOpenChest);
}

function renderActiveTab(state: MetaProgressionState, selectedHeroId: HeroId, activeTab: BaseTab): string {
  if (activeTab === "equipment") {
    return renderEquipment(state);
  }
  if (activeTab === "talents") {
    return renderTalents(state);
  }
  if (activeTab === "missions") {
    return renderMissions(state);
  }
  if (activeTab === "chests") {
    return renderChests(state);
  }
  return renderOverview(state, selectedHeroId);
}

function renderOverview(state: MetaProgressionState, selectedHeroId: HeroId): string {
  const selectedHero = heroes.find((hero) => hero.id === selectedHeroId) ?? heroes[0];
  const selectedArt = characterArtById[selectedHero.artId];
  const selectedMastery = state.heroMastery[selectedHero.id];
  const xpToNext = heroXpToNext(selectedMastery.level);
  const masteryPercent = xpToNext > 0 ? Math.min(100, (selectedMastery.xp / xpToNext) * 100) : 100;
  return `
    <section class="base-grid">
      <div class="base-panel base-resources">
        <div class="panel-heading"><span>Idle</span><strong>離線收益</strong></div>
        <div class="idle-claim">
          <div>
            <strong>可領取</strong>
            <span>${formatResources(state.idle.unclaimed)}</span>
          </div>
          <button class="start-button" data-claim-idle="true" ${hasAnyResource(state.idle.unclaimed) ? "" : "disabled"}>領取</button>
        </div>
        <div class="base-stats">
          <span>出戰 ${state.stats.runsPlayed}</span>
          <span>通關 ${state.stats.wins}</span>
          <span>最高斬敵 ${state.stats.bestKills}</span>
          <span>Boss ${state.stats.bossDefeats}</span>
        </div>
      </div>
      <div class="base-panel base-facilities">
        <div class="panel-heading"><span>Facilities</span><strong>設施升級</strong></div>
        <div class="facility-list">
          ${facilityDefs.map((facility) => renderFacility(state, facility.id)).join("")}
        </div>
      </div>
      <div class="base-panel base-mastery">
        <div class="panel-heading"><span>Mastery</span><strong>${selectedHero.name}</strong></div>
        <div class="mastery-focus">
          <img src="${selectedArt.cardImage}" alt="${selectedArt.name}" draggable="false" />
          <div>
            <span>${selectedHero.title}</span>
            <strong>Lv.${selectedMastery.level}</strong>
            <small>永久生命 +${selectedMastery.level}% / 傷害 +${selectedMastery.level}%</small>
            <div class="mastery-bar"><i style="width:${masteryPercent}%"></i></div>
            <small>${xpToNext > 0 ? `${selectedMastery.xp}/${xpToNext} 熟練 XP` : "熟練已滿"}</small>
          </div>
        </div>
        <div class="mastery-roster">
          ${heroes.map((hero) => renderHeroMasteryButton(state, hero.id, hero.id === selectedHero.id)).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderEquipment(state: MetaProgressionState): string {
  return `
    <section class="base-panel base-wide-panel">
      <div class="panel-heading"><span>Equipment</span><strong>六格裝備</strong></div>
      <div class="equipment-slots">
        ${(["weapon", "armor", "ring", "charm", "mount", "book"] as EquipmentSlot[]).map((slot) => renderEquipmentSlot(state, slot)).join("")}
      </div>
      <div class="equipment-list">
        ${Object.entries(state.equipment.inventory).map(([key, item]) => renderEquipmentItem(state, key, item.defId)).join("")}
      </div>
    </section>
  `;
}

function renderTalents(state: MetaProgressionState): string {
  return `
    <section class="base-panel base-wide-panel">
      <div class="panel-heading"><span>Talents</span><strong>帳號天賦</strong></div>
      <div class="talent-grid">
        ${talentDefs.map((talent) => {
          const level = state.talents[talent.id];
          const cost = getTalentUpgradeCost(talent.id, level);
          const maxed = level >= talent.maxLevel;
          return `
            <div class="talent-row">
              <div>
                <span>${talent.category} · Lv.${level}/${talent.maxLevel}</span>
                <strong>${talent.name}</strong>
                <small>${talent.description} · ${maxed ? "已滿級" : formatResources(cost)}</small>
              </div>
              <button data-upgrade-talent="${talent.id}" ${maxed || !canAfford(state.resources, cost) ? "disabled" : ""}>升級</button>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderMissions(state: MetaProgressionState): string {
  return `
    <section class="base-panel base-wide-panel">
      <div class="panel-heading"><span>Daily</span><strong>今日任務</strong></div>
      <div class="mission-list">
        ${Object.values(state.dailyMissions.missions)
          .map((mission) => {
            const complete = mission.progress >= mission.goal;
            return `
              <div class="mission-row">
                <div>
                  <strong>${mission.label}</strong>
                  <span>${mission.progress}/${mission.goal}</span>
                  <div class="mastery-bar"><i style="width:${Math.min(100, (mission.progress / mission.goal) * 100)}%"></i></div>
                </div>
                <button data-claim-mission="${mission.id}" ${!complete || mission.claimed ? "disabled" : ""}>
                  ${mission.claimed ? "已領" : "領鑰匙"}
                </button>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderChests(state: MetaProgressionState): string {
  const fragmentRows = Object.entries(state.chapterChests.fragments)
    .map(([defId, amount]) => `<span>${equipmentById[defId]?.name ?? defId} x${amount}</span>`)
    .join("");
  return `
    <section class="base-panel base-wide-panel">
      <div class="panel-heading"><span>Chests</span><strong>章節寶箱</strong></div>
      <div class="chest-panel">
        <div>
          <span>可用鑰匙</span>
          <strong>${state.chapterChests.keys}</strong>
          <small>通關章節與每日任務可取得鑰匙。</small>
        </div>
        <button class="start-button" data-open-chest="true" ${state.chapterChests.keys > 0 ? "" : "disabled"}>開啟寶箱</button>
      </div>
      <div class="fragment-list">${fragmentRows || "<span>尚未取得裝備碎片</span>"}</div>
    </section>
  `;
}

function renderResourceHeader(state: MetaProgressionState): string {
  return `
    <section class="base-resource-strip">
      ${renderResourcePill("戰功", state.resources.merit)}
      ${renderResourcePill("軍糧", state.resources.provisions)}
      ${renderResourcePill("聲望", state.resources.renown)}
      ${renderResourcePill("鑰匙", state.chapterChests.keys)}
    </section>
  `;
}

function renderTab(tab: BaseTab, label: string, activeTab: BaseTab): string {
  return `<button class="${tab === activeTab ? "is-selected" : ""}" data-base-tab="${tab}">${label}</button>`;
}

function renderResourcePill(label: string, value: number): string {
  return `
    <div class="resource-pill">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderFacility(state: MetaProgressionState, facilityId: FacilityId): string {
  const facility = facilityDefs.find((item) => item.id === facilityId)!;
  const level = state.facilities[facilityId];
  const maxed = level >= facility.maxLevel;
  const cost = getFacilityUpgradeCost(facilityId, level);
  const affordable = canAfford(state.resources, cost);
  return `
    <div class="facility-row">
      <div>
        <span>${facility.name} Lv.${level}/${facility.maxLevel}</span>
        <strong>${facility.description}</strong>
        <small>${maxed ? "已滿級" : `下級成本 ${formatResources(cost)}`}</small>
      </div>
      <button data-upgrade-facility="${facility.id}" ${maxed || !affordable ? "disabled" : ""}>升級</button>
    </div>
  `;
}

function renderHeroMasteryButton(state: MetaProgressionState, heroId: HeroId, selected: boolean): string {
  const hero = heroes.find((item) => item.id === heroId)!;
  const art = characterArtById[hero.artId];
  const mastery = state.heroMastery[heroId];
  return `
    <button class="mastery-thumb ${selected ? "is-selected" : ""}" data-base-hero="${hero.id}" style="--art-primary:${art.palette.primary}; --art-accent:${art.palette.accent};">
      <img src="${art.cardImage}" alt="${art.name}" draggable="false" />
      <span>${hero.name}</span>
      <b>Lv.${mastery.level}</b>
    </button>
  `;
}

function renderEquipmentSlot(state: MetaProgressionState, slot: EquipmentSlot): string {
  const key = state.equipment.equipped[slot];
  const item = key ? state.equipment.inventory[key] : undefined;
  const def = item ? equipmentById[item.defId] : undefined;
  return `
    <div class="equipment-slot">
      <span>${slotLabel(slot)}</span>
      <strong>${def ? def.name : "未裝備"}</strong>
      <small>${item ? rarityLabel(item.rarity) : "選擇下方裝備"}</small>
    </div>
  `;
}

function renderEquipmentItem(state: MetaProgressionState, key: string, defId: string): string {
  const item = state.equipment.inventory[key];
  const def = equipmentById[defId];
  const equipped = state.equipment.equipped[def.slot] === key;
  const mergeable = item.quantity >= 3 && item.rarity !== "legendary";
  return `
    <div class="equipment-row">
      <div>
        <span>${slotLabel(def.slot)} · ${rarityLabel(item.rarity)} · x${item.quantity}</span>
        <strong>${def.name}</strong>
        <small>${def.passive}</small>
      </div>
      <button data-equip-item="${key}" ${equipped ? "disabled" : ""}>${equipped ? "已裝" : "裝備"}</button>
      <button data-merge-equipment="${key}" ${mergeable ? "" : "disabled"}>3合1</button>
    </div>
  `;
}

function hasAnyResource(resources: MetaResources): boolean {
  return resources.merit > 0 || resources.provisions > 0 || resources.renown > 0;
}

function formatResources(resources: MetaResources): string {
  const parts = [];
  if (resources.merit > 0) {
    parts.push(`戰功 ${resources.merit}`);
  }
  if (resources.provisions > 0) {
    parts.push(`軍糧 ${resources.provisions}`);
  }
  if (resources.renown > 0) {
    parts.push(`聲望 ${resources.renown}`);
  }
  return parts.length > 0 ? parts.join(" / ") : "0";
}

function slotLabel(slot: EquipmentSlot): string {
  if (slot === "weapon") {
    return "武器";
  }
  if (slot === "armor") {
    return "甲";
  }
  if (slot === "ring") {
    return "戒";
  }
  if (slot === "charm") {
    return "符";
  }
  if (slot === "mount") {
    return "坐騎";
  }
  return "兵書";
}

function rarityLabel(rarity: string): string {
  if (rarity === "legendary") {
    return "傳說";
  }
  if (rarity === "epic") {
    return "史詩";
  }
  if (rarity === "rare") {
    return "稀有";
  }
  return "普通";
}
