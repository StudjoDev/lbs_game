import Phaser from "phaser";
import type { CombatEventState } from "../../game/types";
import type { MusicKey, SfxKey } from "../../game/audio/catalog";
import { selectSfxVariant, sfxKeyForCombatEvent, SfxThrottle } from "../../game/audio/events";
import { loadAudioSettings, normalizeAudioSettings, saveAudioSettings, type AudioSettings } from "../../game/audio/settings";

const registryKey = "audioController";

type VolumeSound = Phaser.Sound.BaseSound & { volume: number };
type SoundManagerWithContext = Phaser.Sound.BaseSoundManager & {
  context?: AudioContext;
  locked?: boolean;
  unlocked?: boolean;
};

export function getAudioController(scene: Phaser.Scene): AudioController {
  const existing = scene.registry.get(registryKey) as AudioController | undefined;
  if (existing) {
    return existing;
  }
  const controller = new AudioController();
  scene.registry.set(registryKey, controller);
  return controller;
}

export class AudioController {
  private currentMusic?: VolumeSound;
  private currentMusicKey?: MusicKey;
  private desiredMusicKey?: MusicKey;
  private readonly sfxThrottle = new SfxThrottle();
  private settings = loadAudioSettings();
  private cleanupUnlockListeners?: () => void;

  bindUnlock(scene: Phaser.Scene): void {
    const resume = () => this.unlockAndResume(scene);
    scene.input.once("pointerdown", resume);
    scene.input.keyboard?.once("keydown", resume);
    scene.sound.once("unlocked", resume);
    this.bindDomUnlock(scene, resume);
    this.installDebugHook(scene);
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  updateSettings(scene: Phaser.Scene, settings: AudioSettings): AudioSettings {
    this.settings = saveAudioSettings(normalizeAudioSettings(settings));
    this.applyMusicVolume(scene);
    return this.getSettings();
  }

  playMusic(scene: Phaser.Scene, key: MusicKey, fadeMs = 650): void {
    this.desiredMusicKey = key;
    if (this.currentMusicKey === key && this.currentMusic) {
      this.applyMusicVolume(scene);
      if (!this.currentMusic.isPlaying) {
        this.tryPlay(this.currentMusic);
      }
      return;
    }

    const previous = this.currentMusic;
    const next = scene.sound.add(key, {
      loop: true,
      volume: 0
    }) as VolumeSound;
    this.currentMusic = next;
    this.currentMusicKey = key;
    this.tryPlay(next);
    scene.tweens.add({
      targets: next,
      volume: this.musicVolume,
      duration: fadeMs,
      ease: "Sine.easeInOut"
    });

    if (previous) {
      scene.tweens.add({
        targets: previous,
        volume: 0,
        duration: Math.min(fadeMs, 420),
        ease: "Sine.easeInOut",
        onComplete: () => {
          previous.stop();
          previous.destroy();
        }
      });
    }
  }

  stopMusic(scene: Phaser.Scene, fadeMs = 500): void {
    const previous = this.currentMusic;
    this.currentMusic = undefined;
    this.currentMusicKey = undefined;
    this.desiredMusicKey = undefined;
    if (!previous) {
      return;
    }
    scene.tweens.add({
      targets: previous,
      volume: 0,
      duration: fadeMs,
      ease: "Sine.easeInOut",
      onComplete: () => {
        previous.stop();
        previous.destroy();
      }
    });
  }

  playSfx(scene: Phaser.Scene, key: SfxKey, volumeScale = 1): void {
    if (this.settings.muted || this.settings.sfxVolume <= 0) {
      return;
    }
    if (!this.sfxThrottle.canPlay(key, scene.time.now)) {
      return;
    }
    this.unlockFromGesture(scene);
    const variant = selectSfxVariant(key);
    scene.sound.play(variant.key, {
      volume: this.settings.sfxVolume * volumeScale * variant.volumeScale,
      detune: variant.detune
    });
  }

  playCombatEvent(scene: Phaser.Scene, event: CombatEventState): void {
    const key = sfxKeyForCombatEvent(event);
    const volumeScale = event.type === "hit" ? 0.62 : event.type === "kill" ? 0.75 : Math.min(1.2, 0.72 + event.intensity * 0.16);
    this.playSfx(scene, key, volumeScale);
  }

  private resumeDesiredMusic(scene: Phaser.Scene): void {
    if (this.desiredMusicKey) {
      this.playMusic(scene, this.desiredMusicKey, 220);
    }
  }

  private bindDomUnlock(scene: Phaser.Scene, resume: () => void): void {
    this.cleanupUnlockListeners?.();
    const options: AddEventListenerOptions = { capture: true, passive: true };
    const events = ["pointerdown", "pointerup", "touchstart", "touchend", "mousedown", "mouseup", "click", "keydown"] as const;
    for (const eventName of events) {
      document.addEventListener(eventName, resume, options);
    }
    this.cleanupUnlockListeners = () => {
      for (const eventName of events) {
        document.removeEventListener(eventName, resume, options);
      }
      this.cleanupUnlockListeners = undefined;
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupUnlockListeners?.());
  }

  private unlockAndResume(scene: Phaser.Scene): void {
    const didStartUnlock = this.unlockFromGesture(scene);
    if (!didStartUnlock) {
      this.resumeDesiredMusic(scene);
    }
  }

  private unlockFromGesture(scene: Phaser.Scene): boolean {
    const manager = scene.sound as SoundManagerWithContext;
    if (!manager.locked) {
      this.cleanupUnlockListeners?.();
      return false;
    }

    const context = manager.context;
    if (!context || context.state === "running") {
      this.markUnlocked(manager);
      this.resumeDesiredMusic(scene);
      return false;
    }

    void context
      .resume()
      .then(() => {
        this.markUnlocked(manager);
        this.resumeDesiredMusic(scene);
      })
      .catch(() => {
        // A later user gesture will retry.
      });
    return true;
  }

  private markUnlocked(manager: SoundManagerWithContext): void {
    if (!manager.locked) {
      this.cleanupUnlockListeners?.();
      return;
    }
    manager.unlocked = false;
    manager.locked = false;
    manager.emit(Phaser.Sound.Events.UNLOCKED, manager);
    this.cleanupUnlockListeners?.();
  }

  private installDebugHook(scene: Phaser.Scene): void {
    if (!import.meta.env.DEV) {
      return;
    }
    const debugWindow = window as Window & { render_audio_state?: () => string };
    const render = () => {
      const manager = scene.sound as SoundManagerWithContext;
      return JSON.stringify({
        locked: Boolean(manager.locked),
        contextState: manager.context?.state ?? "none",
        desiredMusicKey: this.desiredMusicKey ?? null,
        currentMusicKey: this.currentMusicKey ?? null,
        currentMusicPlaying: Boolean(this.currentMusic?.isPlaying),
        muted: this.settings.muted,
        musicVolume: this.settings.musicVolume,
        sfxVolume: this.settings.sfxVolume
      });
    };
    debugWindow.render_audio_state = render;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (debugWindow.render_audio_state === render) {
        delete debugWindow.render_audio_state;
      }
    });
  }

  private applyMusicVolume(scene: Phaser.Scene): void {
    if (!this.currentMusic) {
      return;
    }
    scene.tweens.killTweensOf(this.currentMusic);
    this.currentMusic.volume = this.musicVolume;
  }

  private get musicVolume(): number {
    return this.settings.muted ? 0 : this.settings.musicVolume;
  }

  private tryPlay(sound: Phaser.Sound.BaseSound): void {
    if (sound.manager.locked) {
      return;
    }
    try {
      sound.play();
    } catch {
      // The next user gesture will retry through bindUnlock.
    }
  }
}
