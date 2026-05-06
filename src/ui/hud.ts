import { upgradeById } from "../game/content/upgrades";
import type { DisplaySettings } from "../game/display/settings";
import type { MetaRunSettlement } from "../game/meta/progression";
import type { RunState, UpgradeDef, Vector2 } from "../game/types";
import { bindAudioControls, renderAudioControls, type AudioControlCallbacks } from "./audioControls";
import { createUiLayer, removeUiLayer } from "./layer";
import { bindSettingsPanel, renderSettingsPanel } from "./settingsPanel";

interface HudCallbacks extends AudioControlCallbacks {
  getDisplaySettings: () => DisplaySettings;
  onDisplaySettingsChange: (settings: DisplaySettings) => void;
  onManual: () => void;
  onPause: () => void;
  onResume: () => void;
  onUpgrade: (upgradeId: string) => void;
  onRestart: () => void;
  onMenu: () => void;
}

export class BattleHud {
  private readonly root = createUiLayer("battle-ui");
  private readonly status = document.createElement("div");
  private readonly skill = document.createElement("button");
  private readonly joystick = document.createElement("div");
  private readonly knob = document.createElement("div");
  private readonly modal = document.createElement("div");
  private move: Vector2 = { x: 0, y: 0 };
  private activePointerId: number | undefined;
  private lastUpgradeKey = "";
  private lastResult = "";
  private upgradeSelectionLocked = false;
  private readonly maxJoystickDistance = 54;

  constructor(private readonly callbacks: HudCallbacks) {
    this.root.innerHTML = "";
    this.status.className = "hud-status";
    this.skill.className = "skill-button";
    this.joystick.className = "virtual-stick";
    this.knob.className = "stick-knob";
    this.modal.className = "hud-modal";
    this.joystick.appendChild(this.knob);
    this.root.append(this.status, this.joystick, this.skill, this.modal);
    this.bindControls();
  }

  destroy(): void {
    removeUiLayer();
  }

  getMoveVector(): Vector2 {
    return this.move;
  }

  update(state: RunState, settlement?: MetaRunSettlement): void {
    this.root.style.setProperty("--ui-scale", this.callbacks.getDisplaySettings().uiScale.toString());
    const hpPercent = Math.max(0, state.player.hp / state.player.maxHp);
    const xpPercent = Math.max(0, state.player.xp / state.player.nextXp);
    const moralePercent = Math.max(0, state.player.morale / state.player.maxMorale);
    const remaining = Math.max(0, state.duration - state.elapsed);
    const ultimateActive = state.player.ultimateTimer > 0;
    const manualReady = state.doorOpen || state.player.manualCooldown <= 0;
    const bossText = state.bossSpawned ? "呂布已現身" : `${formatTime(Math.max(0, state.bossSpawnTime - state.elapsed))} 呂布`;
    const buildChips = getBuildChips(state);
    const roomText = state.doorOpen
      ? "門已開"
      : state.conquestCityName
        ? `${state.conquestCityName} · ${roomTypeLabel(state.roomType)}`
        : `${state.chapterName} · ${roomTypeLabel(state.roomType)}`;
    void bossText;
    const objectiveProgress = Math.min(state.roomObjective.goal, Math.floor(state.roomObjective.progress));

    this.status.innerHTML = `
      <div class="hud-card hero-chip">
        <span>${state.faction.name}</span>
        <strong>${state.hero.name}</strong>
        <small>${state.hero.title}</small>
      </div>
      <div class="hud-card bars">
        <div class="bar-row"><span>兵力</span><div class="bar"><i style="width:${hpPercent * 100}%"></i></div><b>${Math.ceil(state.player.hp)}</b></div>
        <div class="bar-row xp"><span>戰功</span><div class="bar"><i style="width:${xpPercent * 100}%"></i></div><b>Lv.${state.player.level}</b></div>
        <div class="bar-row morale"><span>士氣</span><div class="bar"><i style="width:${moralePercent * 100}%"></i></div><b>${Math.floor(state.player.morale)}</b></div>
      </div>
      <div class="hud-card run-chip">
        <span>${formatTime(remaining)}</span>
        <strong>${state.kills} 斬</strong>
        <small>${roomText}</small>
      </div>
      <div class="hud-card objective-chip">
        <span>戰場目標</span>
        <strong>${state.objective.title}</strong>
        <small>${objectiveProgress}/${state.objective.goal} · ${state.objective.description}</small>
      </div>
      <div class="hud-card build-strip">
        ${buildChips.map((chip) => `<span class="${chip.tone}">${chip.label}</span>`).join("")}
      </div>
      <button class="pause-button" data-pause="true">暫停</button>
    `;
    bindButtonActivation(this.status.querySelector<HTMLButtonElement>("[data-pause]"), this.callbacks.onPause);

    this.skill.classList.toggle("is-ready", manualReady);
    this.skill.classList.toggle("is-ultimate", ultimateActive);
    const skillTitle = state.doorOpen
      ? "進下一房"
      : ultimateActive
        ? `無雙 ${Math.ceil(state.player.ultimateTimer)}`
        : manualReady
          ? state.hero.manualAbility.name
          : Math.ceil(state.player.manualCooldown).toString();
    const skillHint = state.doorOpen ? "Space / Tap" : ultimateActive ? "爆發中" : "Space / 技能";
    this.skill.innerHTML = `
      <strong>${ultimateActive ? `無雙 ${Math.ceil(state.player.ultimateTimer)}` : manualReady ? state.hero.manualAbility.name : Math.ceil(state.player.manualCooldown)}</strong>
      <span>${ultimateActive ? "覺醒中" : "Space / 點擊"}</span>
    `;

    this.skill.innerHTML = `<strong>${skillTitle}</strong><span>${skillHint}</span>`;

    if (state.status === "levelUp") {
      this.renderUpgradeModal(state);
    } else if (state.status === "paused") {
      if (this.lastResult === "settings") {
        return;
      }
      this.renderPauseModal(state);
    } else if (state.status === "won" || state.status === "lost") {
      this.renderResultModal(state, settlement);
    } else {
      this.lastUpgradeKey = "";
      this.lastResult = "";
      this.modal.className = "hud-modal";
      this.modal.innerHTML = "";
    }
  }

  private bindControls(): void {
    this.skill.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.callbacks.onManual();
    });
    this.joystick.addEventListener("pointerdown", (event) => {
      this.activePointerId = event.pointerId;
      this.joystick.setPointerCapture(event.pointerId);
      this.updateStick(event);
    });
    this.joystick.addEventListener("pointermove", (event) => {
      if (event.pointerId === this.activePointerId) {
        this.updateStick(event);
      }
    });
    const reset = (event: PointerEvent) => {
      if (event.pointerId !== this.activePointerId) {
        return;
      }
      this.activePointerId = undefined;
      this.move = { x: 0, y: 0 };
      this.knob.style.transform = "translate(-50%, -50%)";
    };
    this.joystick.addEventListener("pointerup", reset);
    this.joystick.addEventListener("pointercancel", reset);
  }

  private updateStick(event: PointerEvent): void {
    const rect = this.joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > this.maxJoystickDistance ? this.maxJoystickDistance / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    this.knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    this.move = {
      x: x / this.maxJoystickDistance,
      y: y / this.maxJoystickDistance
    };
  }

  private renderUpgradeModal(state: RunState): void {
    const key = state.pendingUpgradeIds.join("|");
    if (key === this.lastUpgradeKey) {
      return;
    }
    this.lastUpgradeKey = key;
    this.upgradeSelectionLocked = false;
    const options = state.pendingUpgradeIds.map((id) => upgradeById[id]).filter(Boolean);
    this.modal.className = "hud-modal is-open";
    this.modal.innerHTML = `
      <section class="upgrade-panel">
        <span class="panel-kicker">戰功已滿</span>
        <h2>選擇一項軍令</h2>
        <div class="upgrade-grid">
          ${options.map((upgrade) => renderUpgradeCard(upgrade, state.upgrades[upgrade.id] ?? 0)).join("")}
        </div>
      </section>
    `;
    this.modal.querySelectorAll<HTMLButtonElement>("[data-upgrade]").forEach((button) => {
      bindButtonActivation(button, () => this.confirmUpgrade(button.dataset.upgrade ?? ""));
    });
  }

  private confirmUpgrade(upgradeId: string): void {
    if (!upgradeId || this.upgradeSelectionLocked) {
      return;
    }
    this.upgradeSelectionLocked = true;
    this.lastUpgradeKey = "";
    this.modal.className = "hud-modal";
    this.modal.innerHTML = "";
    this.callbacks.onUpgrade(upgradeId);
  }

  private renderPauseModal(state?: RunState): void {
    if (this.lastResult === "paused") {
      return;
    }
    this.lastResult = "paused";
    this.modal.className = "hud-modal is-open";
    this.modal.innerHTML = `
      <section class="pause-panel">
        <span class="panel-kicker">軍令暫停</span>
        <h2>整軍再戰</h2>
        ${state ? renderCurrentBuildList(state) : ""}
        ${renderAudioControls(this.callbacks.getAudioSettings())}
        <div class="pause-actions">
          <button data-resume="true">繼續</button>
          <button data-settings="true">設定</button>
          <button data-menu="true">回主選單</button>
        </div>
      </section>
    `;
    bindButtonActivation(this.modal.querySelector<HTMLButtonElement>("[data-resume]"), this.callbacks.onResume);
    bindButtonActivation(this.modal.querySelector<HTMLButtonElement>("[data-settings]"), () => this.renderSettingsModal());
    bindButtonActivation(this.modal.querySelector<HTMLButtonElement>("[data-menu]"), this.callbacks.onMenu);
    bindAudioControls(this.modal, this.callbacks);
  }

  private renderSettingsModal(): void {
    this.lastResult = "settings";
    this.modal.className = "hud-modal is-open";
    this.modal.innerHTML = renderSettingsPanel(this.callbacks.getAudioSettings(), this.callbacks.getDisplaySettings(), {
      kicker: "戰鬥設定",
      title: "設定",
      closeLabel: "返回暫停",
      closeData: "settings-back"
    });
    bindSettingsPanel(this.modal, this.callbacks, () => this.renderSettingsModal());
    bindButtonActivation(this.modal.querySelector<HTMLButtonElement>("[data-settings-back]"), () => {
      this.lastResult = "";
      this.renderPauseModal();
    });
  }

  private renderResultModal(state: RunState, settlement?: MetaRunSettlement): void {
    const rewardKey = settlement
      ? `${settlement.resources.merit}-${settlement.resources.provisions}-${settlement.resources.renown}-${settlement.heroXp}-${settlement.heroLevelAfter}-${settlement.conqueredCityId ?? ""}-${settlement.recruitedHeroId ?? ""}-${settlement.unlockedCityIds.join(",")}-${settlement.unified}`
      : "pending";
    const key = `${state.status}-${state.kills}-${state.score}-${rewardKey}`;
    if (key === this.lastResult) {
      return;
    }
    this.lastResult = key;
    const won = state.status === "won";
    this.modal.className = "hud-modal is-open";
    this.modal.innerHTML = `
      <section class="result-panel ${won ? "won" : "lost"}">
        <span class="panel-kicker">${won ? "虎牢告捷" : "兵敗虎牢"}</span>
        <h2>${won ? "呂布已敗" : "亂軍壓境"}</h2>
        <p>${state.hero.name} 斬敵 ${state.kills}，戰功 ${state.score}</p>
        ${settlement ? renderSettlementRewards(settlement) : ""}
        ${settlement ? renderChapterSettlement(settlement) : ""}
        ${settlement ? renderConquestSettlement(settlement) : ""}
        <div class="pause-actions">
          <button data-restart="true">再戰一局</button>
          <button data-menu="true">回主選單</button>
        </div>
      </section>
    `;
    bindButtonActivation(this.modal.querySelector<HTMLButtonElement>("[data-restart]"), this.callbacks.onRestart);
    bindButtonActivation(this.modal.querySelector<HTMLButtonElement>("[data-menu]"), this.callbacks.onMenu);
  }
}

function renderSettlementRewards(settlement: MetaRunSettlement): string {
  const levelText =
    settlement.heroLevelAfter > settlement.heroLevelBefore
      ? `Lv.${settlement.heroLevelBefore} -> Lv.${settlement.heroLevelAfter}`
      : `Lv.${settlement.heroLevelAfter}`;
  return `
    <div class="settlement-rewards">
      <span><b>戰功</b>${settlement.resources.merit}</span>
      <span><b>軍糧</b>${settlement.resources.provisions}</span>
      <span><b>聲望</b>${settlement.resources.renown}</span>
      <span><b>武將熟練</b>+${settlement.heroXp} / ${levelText}</span>
    </div>
  `;
}

function renderChapterSettlement(settlement: MetaRunSettlement): string {
  return `
    <div class="settlement-rewards chapter-settlement">
      <span><b>章節</b>${settlement.chapterName} ${settlement.roomReached}房${settlement.chapterCleared ? " 通關" : ""}</span>
      <span><b>寶箱鑰匙</b>+${settlement.chestKeys}</span>
      <span><b>任務完成</b>${settlement.missionsCompleted.length}</span>
      <span><b>裝備碎片</b>${settlement.equipmentFragments.map((item) => `${item.name}x${item.amount}`).join(" / ") || "無"}</span>
    </div>
  `;
}

function renderConquestSettlement(settlement: MetaRunSettlement): string {
  if (!settlement.conqueredCityId && settlement.unlockedCityIds.length === 0 && !settlement.unified) {
    return "";
  }
  return `
    <div class="settlement-rewards conquest-settlement">
      ${settlement.conqueredCityName ? `<span><b>城池</b>攻下 ${settlement.conqueredCityName}</span>` : ""}
      ${settlement.recruitedHeroName ? `<span><b>守將加入</b>${settlement.recruitedHeroName}</span>` : ""}
      ${settlement.unlockedCityNames.length > 0 ? `<span><b>新城解鎖</b>${settlement.unlockedCityNames.join(" / ")}</span>` : ""}
      ${settlement.unified ? "<span><b>天下</b>統一完成</span>" : ""}
    </div>
  `;
}

function bindButtonActivation(button: HTMLButtonElement | null | undefined, handler: () => void): void {
  if (!button) {
    return;
  }
  let lastPointerActivation = 0;
  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    event.stopPropagation();
    lastPointerActivation = window.performance.now();
    handler();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (window.performance.now() - lastPointerActivation < 650) {
      return;
    }
    handler();
  });
}

function renderUpgradeCard(upgrade: UpgradeDef, stacks: number): string {
  const identity = upgradeIdentity(upgrade);
  return `
    <button class="upgrade-card rarity-${upgrade.rarity} archetype-${identity.key}" data-upgrade="${upgrade.id}">
      <span>${rarityLabel(upgrade.rarity)} · ${stacks + 1}/${upgrade.maxStacks}</span>
      <span class="upgrade-build"><i>${identity.icon}</i>${identity.label}</span>
      <strong>${upgrade.name}</strong>
      <em>${identity.hint}</em>
      <small>${upgrade.description}</small>
    </button>
  `;
}

function upgradeIdentity(upgrade: UpgradeDef): { key: string; icon: string; label: string; hint: string } {
  if (upgrade.rarity === "build") {
    return { key: "build", icon: "+", label: "攻勢", hint: "改變本局攻擊型態" };
  }
  if (upgrade.rarity === "evolution") {
    return { key: "evolution", icon: "醒", label: "進化", hint: "改變武將核心招式" };
  }
  if (upgrade.rarity === "hero") {
    return { key: "ultimate", icon: "魂", label: "名將魂", hint: "強化大招覺醒窗口" };
  }
  if (upgrade.rarity === "technique") {
    return { key: "technique", icon: "術", label: "新招式", hint: "加入自動攻擊模組" };
  }
  if (upgrade.apply.some((effect) => effect.stat === "regen" || effect.stat === "armor" || effect.stat === "maxHp")) {
    return { key: "survival", icon: "守", label: "生存", hint: "提高容錯與近身抗壓" };
  }
  if (upgrade.apply.some((effect) => effect.stat === "cooldownScale")) {
    return { key: "tempo", icon: "速", label: "節奏", hint: "更頻繁觸發攻擊" };
  }
  if (upgrade.apply.some((effect) => effect.stat === "areaScale")) {
    return { key: "field", icon: "域", label: "範圍", hint: "擴大清場覆蓋" };
  }
  if (upgrade.apply.some((effect) => effect.stat === "moveSpeed")) {
    return { key: "mobility", icon: "行", label: "走位", hint: "拉扯、撿戰功更安全" };
  }
  if (upgrade.apply.some((effect) => effect.stat === "pickupRadius" || effect.stat === "xpScale")) {
    return { key: "growth", icon: "功", label: "成長", hint: "加速升級和資源回收" };
  }
  if (upgrade.apply.some((effect) => effect.stat === "critChance" || effect.stat === "critDamage")) {
    return { key: "crit", icon: "斬", label: "爆發", hint: "提高斬殺和 Boss 輸出" };
  }
  return { key: "strike", icon: "攻", label: "輸出", hint: "穩定提高殺敵效率" };
}

function getBuildChips(state: RunState): Array<{ label: string; tone: string }> {
  const chips: Array<{ label: string; tone: string }> = [];
  for (const [id, stacks] of Object.entries(state.upgrades)) {
    const upgrade = upgradeById[id];
    if (!upgrade || stacks <= 0) {
      continue;
    }
    if (
      upgrade.rarity === "evolution" ||
      upgrade.rarity === "build" ||
      upgrade.rarity === "technique" ||
      upgrade.rarity === "hero" ||
      upgrade.rarity === "faction" ||
      upgrade.rarity === "relic"
    ) {
      chips.push({ label: `${upgrade.name}${stacks > 1 ? ` ${stacks}` : ""}`, tone: `tone-${upgrade.rarity}` });
    }
  }
  if (chips.length === 0) {
    chips.push({ label: "尋找進化軍令", tone: "tone-common" });
  }
  return chips.slice(-3);
}

function renderCurrentBuildList(state: RunState): string {
  const owned = Object.entries(state.upgrades)
    .map(([id, stacks]) => ({ upgrade: upgradeById[id], stacks }))
    .filter((item): item is { upgrade: UpgradeDef; stacks: number } => Boolean(item.upgrade) && item.stacks > 0);
  return `
    <div class="pause-build-list">
      <strong>本局技能</strong>
      <div>
        ${owned.length > 0 ? owned.map((item) => `<span>${item.upgrade.name}${item.stacks > 1 ? ` x${item.stacks}` : ""}</span>`).join("") : "<span>尚未取得技能</span>"}
      </div>
    </div>
  `;
}

function rarityLabel(rarity: UpgradeDef["rarity"]): string {
  if (rarity === "build") {
    return "軍令";
  }
  if (rarity === "evolution") {
    return "武器進化";
  }
  if (rarity === "faction") {
    return "陣營";
  }
  if (rarity === "technique") {
    return "招式";
  }
  if (rarity === "relic") {
    return "遺物";
  }
  if (rarity === "hero") {
    return "武將";
  }
  return "軍令";
}

function roomTypeLabel(type: RunState["roomType"]): string {
  if (type === "elite") {
    return "菁英房";
  }
  if (type === "treasure") {
    return "寶箱房";
  }
  if (type === "rest") {
    return "休整房";
  }
  if (type === "boss") {
    return "Boss 房";
  }
  return "普通房";
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
