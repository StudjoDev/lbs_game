import Phaser from "phaser";
import type { CombatEventState } from "../../game/types";
import type { MusicKey, SfxKey } from "../../game/audio/catalog";
import { sfxKeyForCombatEvent, SfxThrottle } from "../../game/audio/events";
import { loadAudioSettings, normalizeAudioSettings, saveAudioSettings, type AudioSettings } from "../../game/audio/settings";

const registryKey = "audioController";

type VolumeSound = Phaser.Sound.BaseSound & { volume: number };

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

  bindUnlock(scene: Phaser.Scene): void {
    const resume = () => this.resumeDesiredMusic(scene);
    scene.input.once("pointerdown", resume);
    scene.input.keyboard?.once("keydown", resume);
    scene.sound.once("unlocked", resume);
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
    scene.sound.play(key, {
      volume: this.settings.sfxVolume * volumeScale
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
