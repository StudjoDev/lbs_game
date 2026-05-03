import { upgradeById } from "../game/content/upgrades";
import type { RunState, UpgradeDef, Vector2 } from "../game/types";
import { bindAudioControls, renderAudioControls, type AudioControlCallbacks } from "./audioControls";
import { createUiLayer, removeUiLayer } from "./layer";

interface HudCallbacks extends AudioControlCallbacks {
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

  update(state: RunState): void {
    const hpPercent = Math.max(0, state.player.hp / state.player.maxHp);
    const xpPercent = Math.max(0, state.player.xp / state.player.nextXp);
    const moralePercent = Math.max(0, state.player.morale / state.player.maxMorale);
    const remaining = Math.max(0, state.duration - state.elapsed);
    const ultimateActive = state.player.ultimateTimer > 0;
    const manualReady = state.player.manualCooldown <= 0;
    const bossText = state.bossSpawned ? "呂布已現身" : `${formatTime(Math.max(0, state.bossSpawnTime - state.elapsed))} 呂布`;
    const buildChips = getBuildChips(state);

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
        <small>${bossText}</small>
      </div>
      <div class="hud-card build-strip">
        ${buildChips.map((chip) => `<span class="${chip.tone}">${chip.label}</span>`).join("")}
      </div>
      <button class="pause-button" data-pause="true">暫停</button>
    `;
    bindButtonActivation(this.status.querySelector<HTMLButtonElement>("[data-pause]"), this.callbacks.onPause);

    this.skill.classList.toggle("is-ready", manualReady);
    this.skill.classList.toggle("is-ultimate", ultimateActive);
    this.skill.innerHTML = `
      <strong>${ultimateActive ? `無雙 ${Math.ceil(state.player.ultimateTimer)}` : manualReady ? state.hero.manualAbility.name : Math.ceil(state.player.manualCooldown)}</strong>
      <span>${ultimateActive ? "覺醒中" : "Space / Q"}</span>
    `;

    if (state.status === "levelUp") {
      this.renderUpgradeModal(state);
    } else if (state.status === "paused") {
      this.renderPauseModal();
    } else if (state.status === "won" || state.status === "lost") {
      this.renderResultModal(state);
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

  private renderPauseModal(): void {
    if (this.lastResult === "paused") {
      return;
    }
    this.lastResult = "paused";
    this.modal.className = "hud-modal is-open";
    this.modal.innerHTML = `
      <section class="pause-panel">
        <span class="panel-kicker">軍令暫停</span>
        <h2>整軍再戰</h2>
        ${renderAudioControls(this.callbacks.getAudioSettings())}
        <div class="pause-actions">
          <button data-resume="true">繼續</button>
          <button data-menu="true">回主選單</button>
        </div>
      </section>
    `;
    bindButtonActivation(this.modal.querySelector<HTMLButtonElement>("[data-resume]"), this.callbacks.onResume);
    bindButtonActivation(this.modal.querySelector<HTMLButtonElement>("[data-menu]"), this.callbacks.onMenu);
    bindAudioControls(this.modal, this.callbacks);
  }

  private renderResultModal(state: RunState): void {
    const key = `${state.status}-${state.kills}-${state.score}`;
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
  return `
    <button class="upgrade-card rarity-${upgrade.rarity}" data-upgrade="${upgrade.id}">
      <span>${rarityLabel(upgrade.rarity)} · ${stacks + 1}/${upgrade.maxStacks}</span>
      <strong>${upgrade.name}</strong>
      <small>${upgrade.description}</small>
    </button>
  `;
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

function rarityLabel(rarity: UpgradeDef["rarity"]): string {
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

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
