import Phaser from "phaser";
import { loadDisplaySettings, saveDisplaySettings, type DisplaySettings } from "../../game/display/settings";
import { loadGameSettings, saveGameSettings, type GameSettings } from "../../game/settings/gameSettings";
import type { ChapterId, ConquestCityId, HeroId } from "../../game/types";
import { getAudioController } from "../audio/AudioController";
import { MenuController } from "../../ui/menu";

export class MenuScene extends Phaser.Scene {
  private menu?: MenuController;
  private displaySettings: DisplaySettings = loadDisplaySettings();
  private gameSettings: GameSettings = loadGameSettings();

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.displaySettings = loadDisplaySettings();
    this.gameSettings = loadGameSettings();
    const audio = getAudioController(this);
    audio.bindUnlock(this);
    audio.playMusic(this, "music_menu");
    this.menu = new MenuController({
      getAudioSettings: () => audio.getSettings(),
      onAudioSettingsChange: (settings) => {
        audio.updateSettings(this, settings);
      },
      getDisplaySettings: () => this.displaySettings,
      onDisplaySettingsChange: (settings) => {
        this.displaySettings = saveDisplaySettings(settings);
      },
      getGameSettings: () => this.gameSettings,
      onGameSettingsChange: (settings) => {
        this.gameSettings = saveGameSettings(settings);
      },
      onAudioCue: (key) => {
        audio.playSfx(this, key);
      },
      onStart: (heroId: HeroId, chapterId: ChapterId, conquestCityId?: ConquestCityId) => {
        audio.playSfx(this, "sfx_ui_confirm");
        this.menu?.destroy();
        this.scene.start("BattleScene", { heroId, chapterId, conquestCityId });
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.menu?.destroy());
  }
}
