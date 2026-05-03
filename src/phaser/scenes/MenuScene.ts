import Phaser from "phaser";
import type { HeroId } from "../../game/types";
import { getAudioController } from "../audio/AudioController";
import { MenuController } from "../../ui/menu";

export class MenuScene extends Phaser.Scene {
  private menu?: MenuController;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    const audio = getAudioController(this);
    audio.bindUnlock(this);
    audio.playMusic(this, "music_menu");
    this.menu = new MenuController({
      getAudioSettings: () => audio.getSettings(),
      onAudioSettingsChange: (settings) => {
        audio.updateSettings(this, settings);
      },
      onAudioCue: (key) => {
        audio.playSfx(this, key);
      },
      onStart: (heroId: HeroId) => {
        audio.playSfx(this, "sfx_ui_confirm");
        this.menu?.destroy();
        this.scene.start("BattleScene", { heroId });
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.menu?.destroy());
  }
}
