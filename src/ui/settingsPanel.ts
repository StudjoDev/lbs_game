import { defaultAudioSettings } from "../game/audio/settings";
import type { AudioSettings } from "../game/audio/settings";
import { defaultDisplaySettings, normalizeDisplaySettings, type DisplaySettings } from "../game/display/settings";
import { defaultGameSettings, normalizeGameSettings, type GameSettings } from "../game/settings/gameSettings";
import { bindAudioControls, renderAudioControls, type AudioControlCallbacks } from "./audioControls";

export interface SettingsPanelCallbacks extends AudioControlCallbacks {
  getDisplaySettings: () => DisplaySettings;
  onDisplaySettingsChange: (settings: DisplaySettings) => void;
  getGameSettings?: () => GameSettings;
  onGameSettingsChange?: (settings: GameSettings) => void;
}

interface SettingsPanelOptions {
  title?: string;
  kicker?: string;
  closeLabel?: string;
  closeData?: string;
  showAudio?: boolean;
  showClose?: boolean;
  gameSettings?: GameSettings;
}

const displayRangeControls = [
  {
    key: "viewScale",
    label: "畫面比例",
    min: 100,
    max: 160,
    step: 5,
    suffix: "%",
    description: "拉高會縮小鏡頭，看到更大的戰場。"
  },
  {
    key: "uiScale",
    label: "介面大小",
    min: 85,
    max: 115,
    step: 5,
    suffix: "%",
    description: "調整戰鬥 HUD、技能鍵與搖桿尺寸。"
  },
  {
    key: "effectsIntensity",
    label: "特效強度",
    min: 50,
    max: 125,
    step: 5,
    suffix: "%",
    description: "控制打擊火花、粒子與爆點的密度。"
  },
  {
    key: "screenShake",
    label: "鏡頭震動",
    min: 0,
    max: 125,
    step: 5,
    suffix: "%",
    description: "降低可減少暈眩感，0% 會關閉震動。"
  }
] as const;

type DisplayRangeKey = (typeof displayRangeControls)[number]["key"];

export function renderSettingsPanel(
  audioSettings: AudioSettings,
  displaySettings: DisplaySettings,
  options: SettingsPanelOptions = {}
): string {
  const display = normalizeDisplaySettings(displaySettings);
  const gameSettings = options.gameSettings ? normalizeGameSettings(options.gameSettings) : undefined;
  const closeData = options.closeData ?? "settings-close";
  return `
    <section class="settings-panel">
      <div class="settings-topline">
        <div>
          <span class="panel-kicker">${options.kicker ?? "設定"}</span>
          <h2>${options.title ?? "設定"}</h2>
        </div>
        <div class="settings-top-actions">
          <button data-settings-reset="true">恢復預設</button>
          ${options.showClose === false ? "" : `<button class="settings-close" data-${closeData}="true">${options.closeLabel ?? "\u8fd4\u56de"}</button>`}
        </div>
      </div>
      <div class="settings-grid">
        <div class="settings-section">
          <strong>畫面</strong>
          ${displayRangeControls.map((control) => renderDisplayRange(display, control)).join("")}
          <label class="settings-toggle">
            <span>
              <b>傷害數字</b>
              <small>關閉後只保留打擊與拾取效果，畫面會更乾淨。</small>
            </span>
            <input type="checkbox" ${display.showDamageNumbers ? "checked" : ""} data-display-toggle="showDamageNumbers" />
          </label>
        </div>
        ${
          options.showAudio === false
            ? ""
            : `<div class="settings-section"><strong>聲音</strong>${renderAudioControls(audioSettings)}</div>`
        }
        ${gameSettings ? renderGameSettings(gameSettings) : ""}
      </div>
    </section>
  `;
}

export function bindSettingsPanel(root: ParentNode, callbacks: SettingsPanelCallbacks, onReset?: () => void): void {
  bindAudioControls(root, callbacks);

  root.querySelectorAll<HTMLInputElement>("[data-display-range]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.displayRange as DisplayRangeKey;
      const next = normalizeDisplaySettings({
        ...callbacks.getDisplaySettings(),
        [key]: Number(input.value) / 100
      });
      callbacks.onDisplaySettingsChange(next);
      updateRangeLabel(input, next[key]);
    });
    input.addEventListener("pointerdown", () => callbacks.onAudioCue("sfx_ui_select"));
  });

  root.querySelectorAll<HTMLInputElement>("[data-display-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.displayToggle as "showDamageNumbers";
      callbacks.onDisplaySettingsChange(
        normalizeDisplaySettings({
          ...callbacks.getDisplaySettings(),
          [key]: input.checked
        })
      );
      callbacks.onAudioCue("sfx_ui_select");
    });
  });

  root.querySelectorAll<HTMLInputElement>("[data-game-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!callbacks.getGameSettings || !callbacks.onGameSettingsChange) {
        return;
      }
      const key = input.dataset.gameToggle as "testMode";
      callbacks.onGameSettingsChange(
        normalizeGameSettings({
          ...callbacks.getGameSettings(),
          [key]: input.checked
        })
      );
      callbacks.onAudioCue("sfx_ui_select");
    });
  });

  root.querySelector<HTMLButtonElement>("[data-settings-reset]")?.addEventListener("click", () => {
    callbacks.onAudioSettingsChange(defaultAudioSettings);
    callbacks.onDisplaySettingsChange(defaultDisplaySettings);
    callbacks.onGameSettingsChange?.(defaultGameSettings);
    callbacks.onAudioCue("sfx_ui_confirm");
    onReset?.();
  });
}

function renderDisplayRange(
  display: DisplaySettings,
  control: (typeof displayRangeControls)[number]
): string {
  const value = Math.round(display[control.key] * 100);
  return `
    <label class="settings-range">
      <span>
        <b>${control.label}</b>
        <small>${control.description}</small>
      </span>
      <input
        type="range"
        min="${control.min}"
        max="${control.max}"
        step="${control.step}"
        value="${value}"
        data-display-range="${control.key}"
      />
      <em>${value}${control.suffix}</em>
    </label>
  `;
}

function updateRangeLabel(input: HTMLInputElement, value: number): void {
  const label = input.closest(".settings-range")?.querySelector("em");
  if (label) {
    label.textContent = `${Math.round(value * 100)}%`;
  }
}

function renderGameSettings(settings: GameSettings): string {
  return `
    <div class="settings-section">
      <strong>遊戲</strong>
      <label class="settings-toggle">
        <span>
          <b>測試模式</b>
          <small>開啟後，未招降武將也能在武將與圖鑑頁選擇出戰；不會寫入收藏解鎖。</small>
        </span>
        <input type="checkbox" ${settings.testMode ? "checked" : ""} data-game-toggle="testMode" />
      </label>
    </div>
  `;
}
