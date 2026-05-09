import { upgradeById } from "../game/content/upgrades";
import { ultimateByHeroId } from "../game/content/ultimates";
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

interface UpgradeIdentity {
  key: string;
  icon: string;
  label: string;
  hint: string;
}

interface UpgradeCardFit {
  score: number;
  badges: string[];
  hint: string;
  isCore: boolean;
}

interface UpgradeCardModel {
  upgrade: UpgradeDef;
  stacks: number;
  identity: UpgradeIdentity;
  fit: UpgradeCardFit;
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
    const skillView = getSkillButtonView(state);
    const ultimateStatus = getUltimateStatus(state);
    const bossName = state.conquestCityId ? (state.gatekeeperName ?? "守將") : "呂布";
    const bossText = state.bossSpawned ? `${bossName}已現身` : `${formatTime(Math.max(0, state.bossSpawnTime - state.elapsed))} ${bossName}`;
    const roomText = state.doorOpen
      ? "門已開"
      : state.conquestCityName
        ? `${state.conquestCityName} · ${roomTypeLabel(state.roomType)}`
        : `${state.chapterName} · ${roomTypeLabel(state.roomType)}`;
    const objectiveProgress = Math.min(state.roomObjective.goal, Math.floor(state.roomObjective.progress));

    this.status.innerHTML = `
      <div class="hud-card bars hud-vitals">
        <div class="bar-row"><span>兵力</span><div class="bar"><i style="width:${hpPercent * 100}%"></i></div><b>${Math.ceil(state.player.hp)}</b></div>
        <div class="bar-row xp"><span>戰功</span><div class="bar"><i style="width:${xpPercent * 100}%"></i></div><b>Lv.${state.player.level}</b></div>
      </div>
      <div class="hud-card objective-chip">
        <span>戰場目標</span>
        <strong>${state.objective.title}</strong>
        <small>${objectiveProgress}/${state.objective.goal} · ${state.objective.description}</small>
      </div>
      <div class="hud-meta">
        <span>${state.hero.name}</span>
        <span>${formatTime(remaining)}</span>
        <span>${state.kills}斬</span>
        <span>士氣 ${Math.floor(moralePercent * 100)}%</span>
        <span class="hud-ultimate ${ultimateStatus.tone}">${ultimateStatus.label}</span>
        <span>${bossText}</span>
        <span>${roomText}</span>
      </div>
      <button class="pause-button" data-pause="true">暫停</button>
    `;
    bindButtonActivation(this.status.querySelector<HTMLButtonElement>("[data-pause]"), this.callbacks.onPause);

    this.skill.classList.toggle("is-ready", skillView.kind === "door" || skillView.kind === "manual-ready" || skillView.kind === "ultimate-ready");
    this.skill.classList.toggle("is-manual-ready", skillView.kind === "manual-ready");
    this.skill.classList.toggle("is-ultimate-ready", skillView.kind === "ultimate-ready");
    this.skill.classList.toggle("is-ultimate", ultimateActive);
    this.skill.classList.toggle("is-cooldown", skillView.kind === "cooldown");
    this.skill.style.setProperty("--skill-progress", `${skillView.progress * 100}%`);
    this.skill.setAttribute("aria-label", skillView.ariaLabel);
    this.skill.innerHTML = `
      <strong>${skillView.title}</strong>
      <span>${skillView.hint}</span>
      <small>${skillView.detail}</small>
      <i class="skill-progress" aria-hidden="true"><b></b></i>
    `;

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
    const cards = options.map((upgrade) => createUpgradeCardModel(upgrade, state));
    const bestScore = Math.max(0, ...cards.map((card) => card.fit.score));
    const recommendedUpgradeId = cards.find((card) => card.fit.score === bestScore && bestScore >= 2)?.upgrade.id;
    this.modal.className = "hud-modal is-open";
    this.modal.innerHTML = `
      <section class="upgrade-panel">
        <div class="modal-heading">
          <span class="panel-kicker">戰功已滿</span>
          <h2>選擇軍令</h2>
          <small>${renderUpgradeContextLine(state)}</small>
        </div>
        <div class="upgrade-grid">
          ${cards.map((card) => renderUpgradeCard(card, card.upgrade.id === recommendedUpgradeId)).join("")}
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
        <div class="modal-heading">
          <span class="panel-kicker">軍令暫停</span>
          <h2>整軍再戰</h2>
        </div>
        ${state ? renderPauseRunSummary(state) : ""}
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
        <div class="modal-heading">
          <span class="panel-kicker">${won ? "虎牢告捷" : "兵敗虎牢"}</span>
          <h2>${won ? "呂布已敗" : "亂軍壓境"}</h2>
          <small>${state.hero.name} 斬敵 ${state.kills}，戰功 ${state.score}</small>
        </div>
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
      ${
        settlement.unified
          ? `<span><b>天下</b>統一完成</span><span><b>全城進度</b>${settlement.conqueredCityCount}/${settlement.totalCityCount}</span>${settlement.factionName ? `<span><b>出戰陣營</b>${settlement.factionName}</span>` : ""}`
          : ""
      }
    </div>
  `;
}

function renderPauseRunSummary(state: RunState): string {
  const remaining = Math.max(0, state.duration - state.elapsed);
  const buildChips = getBuildChips(state);
  return `
    <div class="pause-run-summary">
      <span><b>武將</b>${state.hero.name}</span>
      <span><b>時間</b>${formatTime(remaining)}</span>
      <span><b>斬敵</b>${state.kills}</span>
      <span><b>房間</b>${state.roomIndex + 1}/${state.roomCount}</span>
      <div>${buildChips.map((chip) => `<i class="${chip.tone}">${chip.label}</i>`).join("")}</div>
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

type SkillButtonKind = "door" | "manual-ready" | "ultimate-ready" | "ultimate-active" | "cooldown";

interface SkillButtonView {
  kind: SkillButtonKind;
  title: string;
  hint: string;
  detail: string;
  progress: number;
  ariaLabel: string;
}

function getSkillButtonView(state: RunState): SkillButtonView {
  const ultimateChargePercent = Math.floor(clamp01(state.player.ultimateCharge) * 100);
  if (state.doorOpen) {
    return {
      kind: "door",
      title: "進下一房",
      hint: "Space / Tap",
      detail: "門已開",
      progress: 1,
      ariaLabel: "進入下一房"
    };
  }
  if (state.player.ultimateTimer > 0) {
    const seconds = formatShortSeconds(state.player.ultimateTimer);
    const ultimateDuration = Math.max(1, ultimateByHeroId[state.hero.id].duration + state.player.ultimateDurationBonus);
    return {
      kind: "ultimate-active",
      title: "爆發中",
      hint: `無雙 ${seconds}`,
      detail: state.hero.manualAbility.name,
      progress: clamp01(state.player.ultimateTimer / ultimateDuration),
      ariaLabel: `無雙爆發中，剩餘 ${seconds}`
    };
  }
  if (state.player.manualCooldown <= 0 && state.player.ultimateCharge >= 1) {
    return {
      kind: "ultimate-ready",
      title: "無雙就緒",
      hint: "按下開無雙",
      detail: `同放 ${state.hero.manualAbility.name}`,
      progress: 1,
      ariaLabel: `技能與無雙就緒，按下會施放 ${state.hero.manualAbility.name} 並開啟無雙`
    };
  }
  if (state.player.manualCooldown <= 0) {
    return {
      kind: "manual-ready",
      title: state.hero.manualAbility.name,
      hint: "技能可用",
      detail: `無雙 ${ultimateChargePercent}%`,
      progress: clamp01(state.player.ultimateCharge),
      ariaLabel: `${state.hero.manualAbility.name} 可用，無雙充能 ${ultimateChargePercent}%`
    };
  }

  const manualBaseCooldown = Math.max(0.4, state.hero.manualAbility.cooldown * state.player.cooldownScale);
  const cooldownProgress = 1 - Math.min(1, state.player.manualCooldown / manualBaseCooldown);
  return {
    kind: "cooldown",
    title: formatShortSeconds(state.player.manualCooldown),
    hint: "冷卻中",
    detail: state.player.ultimateCharge >= 1 ? "無雙待命" : `無雙 ${ultimateChargePercent}%`,
    progress: clamp01(cooldownProgress),
    ariaLabel: `技能冷卻中，剩餘 ${formatShortSeconds(state.player.manualCooldown)}`
  };
}

function getUltimateStatus(state: RunState): { label: string; tone: string } {
  if (state.player.ultimateTimer > 0) {
    return { label: `無雙爆發 ${formatShortSeconds(state.player.ultimateTimer)}`, tone: "is-bursting" };
  }
  if (state.player.ultimateCharge >= 1) {
    return { label: "無雙就緒", tone: "is-ready" };
  }
  return { label: `無雙充能 ${Math.floor(clamp01(state.player.ultimateCharge) * 100)}%`, tone: "is-charging" };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatShortSeconds(seconds: number): string {
  return `${Math.ceil(Math.max(0, seconds))}秒`;
}

function createUpgradeCardModel(upgrade: UpgradeDef, state: RunState): UpgradeCardModel {
  const stacks = state.upgrades[upgrade.id] ?? 0;
  const identity = upgradeIdentity(upgrade);
  return {
    upgrade,
    stacks,
    identity,
    fit: upgradeFit(upgrade, state, stacks, identity)
  };
}

function renderUpgradeCard(card: UpgradeCardModel, recommended: boolean): string {
  const { upgrade, stacks, identity, fit } = card;
  const badges = upgradeBadges(fit, recommended);
  return `
    <button class="upgrade-card rarity-${upgrade.rarity} archetype-${identity.key} ${recommended ? "is-recommended" : ""} ${fit.isCore ? "is-core" : ""}" data-upgrade="${upgrade.id}">
      <span class="upgrade-card-top">
        <span class="upgrade-rarity">${rarityLabel(upgrade.rarity)} · ${stacks + 1}/${upgrade.maxStacks}</span>
        ${badges.length > 0 ? `<span class="upgrade-badges">${badges.map((badge) => `<span class="upgrade-badge ${badge === "推薦" ? "is-recommend" : ""}">${badge}</span>`).join("")}</span>` : ""}
      </span>
      <span class="upgrade-build"><i>${identity.icon}</i>${identity.label}</span>
      <strong>${upgrade.name}</strong>
      <em>${fit.hint}</em>
      <small>${upgrade.description}</small>
    </button>
  `;
}

function upgradeIdentity(upgrade: UpgradeDef): UpgradeIdentity {
  if (upgrade.rarity === "build") {
    if (upgradeHasAnyEffect(upgrade, ["frontShot", "rearShot", "extraVolley", "projectilePierce", "ricochet"])) {
      return { key: "projectile", icon: "矢", label: "彈道", hint: "改造主武技的清線形狀" };
    }
    if (upgradeHasAnyEffect(upgrade, ["orbitGuard", "killHeal", "lowHpPower"])) {
      return { key: "guard", icon: "守", label: "護身", hint: "把近身壓力轉成反打" };
    }
    if (upgradeHasAnyEffect(upgrade, ["companionCount", "companionDamage"])) {
      return { key: "support", icon: "援", label: "支援", hint: "增加副將與陣營火力" };
    }
    return { key: "build", icon: "+", label: "攻勢", hint: "改變本局攻擊型態" };
  }
  if (upgrade.rarity === "evolution") {
    return { key: "evolution", icon: "醒", label: "進化", hint: "改變武將核心招式" };
  }
  if (upgrade.rarity === "faction") {
    return { key: "faction", icon: "旗", label: "陣營", hint: "放大同陣營被動與支援" };
  }
  if (upgrade.rarity === "hero") {
    return { key: "ultimate", icon: "魂", label: "名將魂", hint: "強化大招覺醒窗口" };
  }
  if (upgrade.rarity === "technique") {
    return { key: "technique", icon: "術", label: "新招式", hint: "加入自動攻擊模組" };
  }
  if (upgradeHasAnyEffect(upgrade, ["companionDamage", "companionCount"])) {
    return { key: "support", icon: "援", label: "支援", hint: "提高副將與陣營火力" };
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
  if (upgrade.rarity === "relic") {
    return { key: "relic", icon: "器", label: "遺物", hint: "提供稀有混合加成" };
  }
  return { key: "strike", icon: "攻", label: "輸出", hint: "穩定提高殺敵效率" };
}

function upgradeFit(upgrade: UpgradeDef, state: RunState, stacks: number, identity: UpgradeIdentity): UpgradeCardFit {
  const badges: string[] = [];
  const hints: string[] = [];
  let score = 0;
  let isCore = false;
  const heroEvolution = getUpgradeById(`evo_${state.hero.id}`);
  const evolutionRequirement = heroEvolution?.requires;
  const evolutionRequiredStacks = evolutionRequirement?.stacks ?? 1;
  const isHeroEvolutionPrerequisite = evolutionRequirement?.upgradeId === upgrade.id;
  const requiredUpgrade = getUpgradeById(upgrade.requires?.upgradeId);
  const requiredStacks = upgrade.requires?.stacks ?? 1;
  const requiredOwned = upgrade.requires?.upgradeId ? (state.upgrades[upgrade.requires.upgradeId] ?? 0) : 0;
  const prerequisiteReady = Boolean(requiredUpgrade && requiredOwned >= requiredStacks);

  if (upgrade.heroId === state.hero.id && upgrade.rarity === "evolution") {
    addUnique(badges, "本局核心");
    hints.push(`${state.hero.name}核心招式進化`);
    score += 10;
    isCore = true;
  } else if (upgrade.heroId === state.hero.id && upgrade.rarity === "hero") {
    addUnique(badges, "本局核心");
    hints.push(`${state.hero.name}無雙窗口升級`);
    score += 9;
    isCore = true;
  } else if (upgrade.heroId === state.hero.id) {
    addUnique(badges, `與${state.hero.name}相性高`);
    hints.push(`貼合${state.hero.name}專屬成長`);
    score += 5;
  }

  if (stacks > 0) {
    addUnique(badges, "已投入");
    hints.push(`延續已堆疊的${identity.label}`);
    score += Math.min(4, stacks + 2);
  }

  if (isHeroEvolutionPrerequisite) {
    addUnique(badges, stacks >= evolutionRequiredStacks ? "前置已滿" : "進化前置");
    hints.push(`${state.hero.name}覺醒前置`);
    score += stacks >= evolutionRequiredStacks ? 3 : 6;
    isCore = true;
  }

  if (prerequisiteReady && requiredUpgrade) {
    addUnique(badges, "前置已滿");
    hints.push(`承接${requiredUpgrade.name}`);
    score += 4;
  }

  if (upgrade.factionId === state.faction.id) {
    addUnique(badges, `同${state.faction.name}`);
    hints.push(`${state.faction.name}陣營加成`);
    score += 5;
  }

  const investedIdentityStacks = countInvestedIdentityStacks(state, identity.key, upgrade.id);
  if (investedIdentityStacks > 0) {
    addUnique(badges, "延續流派");
    hints.push(`本局已走${identity.label}`);
    score += Math.min(3, investedIdentityStacks);
  }

  const effectFit = heroEffectFit(upgrade, state);
  score += effectFit.score;
  if (effectFit.score >= 2) {
    addUnique(badges, `與${state.hero.name}相性高`);
  }
  if (effectFit.hint) {
    hints.push(effectFit.hint);
  }

  if (upgrade.rarity === "build" || upgrade.rarity === "technique") {
    score += 2;
  } else if (upgrade.rarity === "relic") {
    score += 1;
  }

  return {
    score,
    badges,
    hint: hints[0] ?? identity.hint,
    isCore
  };
}

function heroEffectFit(upgrade: UpgradeDef, state: RunState): { score: number; hint?: string } {
  const hero = state.hero;
  const auto = hero.autoAbility;
  const manual = hero.manualAbility;
  const heroTags = [...auto.damageTags, ...manual.damageTags];
  const hasTag = (tag: (typeof heroTags)[number]) => heroTags.includes(tag);
  const closeRange = auto.range <= 300 || manual.range <= 280;
  let score = 0;
  const hints: string[] = [];

  if (upgradeHasAnyEffect(upgrade, ["damageScale"])) {
    score += 2;
    hints.push("直接提高主要輸出");
  }
  if (upgradeHasAnyEffect(upgrade, ["cooldownScale"])) {
    score += auto.cooldown <= 0.9 || manual.cooldown <= 7 || hasTag("command") || hasTag("charm") ? 3 : 2;
    hints.push("高頻招式更吃冷卻");
  }
  if (upgradeHasAnyEffect(upgrade, ["areaScale"])) {
    score += auto.radius >= 64 || manual.radius >= 84 || hasTag("fire") || hasTag("shock") || hasTag("charm") ? 3 : 2;
    hints.push("放大範圍與控場覆蓋");
  }
  if (upgradeHasAnyEffect(upgrade, ["critChance", "critDamage"])) {
    score += hasTag("blade") || hasTag("pierce") || hasTag("arrow") || manual.damage >= 72 ? 3 : 2;
    hints.push("爆發斬殺更穩");
  }
  if (upgradeHasAnyEffect(upgrade, ["moveSpeed"])) {
    score += hero.baseStats.moveSpeed >= 240 || closeRange || manual.effectId.includes("dash") ? 3 : 1;
    hints.push("強化拉扯與突進角度");
  }
  if (upgradeHasAnyEffect(upgrade, ["maxHp", "armor", "regen", "killHeal", "lowHpPower"])) {
    score += closeRange || hero.baseStats.armor <= 2 || hero.baseStats.maxHp <= 126 || manual.effectId === "blood_rage" ? 3 : 1;
    hints.push("補足近身容錯");
  }
  if (upgradeHasAnyEffect(upgrade, ["pickupRadius", "xpScale"])) {
    score += state.player.level <= 3 ? 2 : 1;
    hints.push("前期成長更快");
  }
  if (upgradeHasAnyEffect(upgrade, ["companionDamage", "companionCount"])) {
    score += state.player.companionCount > 0 || state.faction.id === "wei" || state.faction.id === "wu" ? 3 : 2;
    hints.push("支援火力成形更快");
  }
  if (upgradeHasAnyEffect(upgrade, ["frontShot", "rearShot", "extraVolley", "projectilePierce", "ricochet"])) {
    score += auto.range >= 400 || hasTag("arrow") || hasTag("pierce") || hasTag("command") ? 3 : 1;
    hints.push("改造遠程清線角度");
  }
  if (upgradeHasAnyEffect(upgrade, ["orbitGuard"])) {
    score += closeRange ? 3 : 1;
    hints.push("處理貼身包圍");
  }
  if (upgradeHasAnyEffect(upgrade, ["evolvedPower", "ultimateDuration", "ultimatePower"])) {
    score += 4;
    hints.push("推進覺醒與無雙爆發");
  }
  if (upgradeHasAnyEffect(upgrade, ["bossDamage"])) {
    score += state.bossSpawned || state.bossSpawnTime - state.elapsed < 90 ? 3 : 1;
    hints.push("提高守將與 Boss 壓制");
  }

  return { score, hint: hints[0] };
}

function upgradeBadges(fit: UpgradeCardFit, recommended: boolean): string[] {
  const badges = recommended ? ["推薦", ...fit.badges] : fit.badges;
  return badges.slice(0, 3);
}

function renderUpgradeContextLine(state: RunState): string {
  const buildText = getBuildChips(state)
    .map((chip) => chip.label)
    .join(" / ");
  return `${state.hero.name} · ${state.faction.name} · ${buildText}`;
}

function countInvestedIdentityStacks(state: RunState, identityKey: string, currentUpgradeId: string): number {
  return Object.entries(state.upgrades).reduce((total, [id, stacks]) => {
    const ownedUpgrade = getUpgradeById(id);
    if (!ownedUpgrade || id === currentUpgradeId || stacks <= 0 || upgradeIdentity(ownedUpgrade).key !== identityKey) {
      return total;
    }
    return total + stacks;
  }, 0);
}

type UpgradeEffectStat = UpgradeDef["apply"][number]["stat"];

function upgradeHasAnyEffect(upgrade: UpgradeDef, stats: UpgradeEffectStat[]): boolean {
  return upgrade.apply.some((effect) => stats.includes(effect.stat));
}

function getUpgradeById(id: string | undefined): UpgradeDef | undefined {
  return id ? (upgradeById as Record<string, UpgradeDef | undefined>)[id] : undefined;
}

function addUnique(items: string[], item: string): void {
  if (!items.includes(item)) {
    items.push(item);
  }
}

function getBuildChips(state: RunState): Array<{ label: string; tone: string }> {
  const coreChips: Array<{ label: string; tone: string }> = [];
  const investedArchetypes = new Map<string, { label: string; stacks: number }>();
  for (const [id, stacks] of Object.entries(state.upgrades)) {
    const upgrade = upgradeById[id];
    if (!upgrade || stacks <= 0) {
      continue;
    }
    const identity = upgradeIdentity(upgrade);
    if (
      upgrade.rarity === "evolution" ||
      upgrade.rarity === "build" ||
      upgrade.rarity === "technique" ||
      upgrade.rarity === "hero" ||
      upgrade.rarity === "faction" ||
      upgrade.rarity === "relic"
    ) {
      coreChips.push({ label: `${upgrade.name}${stacks > 1 ? ` ${stacks}` : ""}`, tone: `tone-${upgrade.rarity}` });
      continue;
    }
    const invested = investedArchetypes.get(identity.key);
    if (invested) {
      invested.stacks += stacks;
    } else {
      investedArchetypes.set(identity.key, { label: identity.label, stacks });
    }
  }
  const archetypeChips = [...investedArchetypes.values()].map((item) => ({ label: `${item.label} ${item.stacks}`, tone: "tone-common" }));
  const chips = [...coreChips.slice(-2), ...archetypeChips].slice(0, 3);
  if (chips.length === 0) {
    chips.push({ label: "尋找進化軍令", tone: "tone-common" });
  }
  return chips;
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
