import type { SfxKey } from "../game/audio/catalog";
import type { AudioSettings } from "../game/audio/settings";
import { normalizeAudioSettings } from "../game/audio/settings";

export interface AudioControlCallbacks {
  getAudioSettings: () => AudioSettings;
  onAudioSettingsChange: (settings: AudioSettings) => void;
  onAudioCue: (key: SfxKey) => void;
}

export function renderAudioControls(settings: AudioSettings): string {
  const normalized = normalizeAudioSettings(settings);
  return `
    <div class="audio-controls">
      <label class="audio-row">
        <span>Music</span>
        <input type="range" min="0" max="100" value="${Math.round(normalized.musicVolume * 100)}" data-audio-volume="music" />
      </label>
      <label class="audio-row">
        <span>SFX</span>
        <input type="range" min="0" max="100" value="${Math.round(normalized.sfxVolume * 100)}" data-audio-volume="sfx" />
      </label>
      <button class="mute-toggle ${normalized.muted ? "is-muted" : ""}" data-audio-mute="true">${normalized.muted ? "Unmute" : "Mute"}</button>
    </div>
  `;
}

export function bindAudioControls(root: ParentNode, callbacks: AudioControlCallbacks): void {
  root.querySelectorAll<HTMLInputElement>("[data-audio-volume]").forEach((input) => {
    input.addEventListener("input", () => {
      const settings = callbacks.getAudioSettings();
      const value = Number(input.value) / 100;
      callbacks.onAudioSettingsChange(
        normalizeAudioSettings({
          ...settings,
          musicVolume: input.dataset.audioVolume === "music" ? value : settings.musicVolume,
          sfxVolume: input.dataset.audioVolume === "sfx" ? value : settings.sfxVolume
        })
      );
    });
    input.addEventListener("pointerdown", () => callbacks.onAudioCue("sfx_ui_select"));
  });

  root.querySelectorAll<HTMLButtonElement>("[data-audio-mute]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = normalizeAudioSettings({
        ...callbacks.getAudioSettings(),
        muted: !callbacks.getAudioSettings().muted
      });
      callbacks.onAudioSettingsChange(next);
      callbacks.onAudioCue("sfx_ui_confirm");
      button.classList.toggle("is-muted", next.muted);
      button.textContent = next.muted ? "Unmute" : "Mute";
    });
  });
}
