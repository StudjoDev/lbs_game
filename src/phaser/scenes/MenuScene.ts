import Phaser from "phaser";
import { loadDisplaySettings, saveDisplaySettings, type DisplaySettings } from "../../game/display/settings";
import { loadGameSettings, saveGameSettings, type GameSettings } from "../../game/settings/gameSettings";
import type { ChapterId, ConquestCityId, HeroId } from "../../game/types";
import { getAudioController } from "../audio/AudioController";
import { MenuController } from "../../ui/menu";
import { MenuTrainingGroundView } from "./MenuTrainingGroundView";

export class MenuScene extends Phaser.Scene {
  private menu?: MenuController;
  private trainingGround?: MenuTrainingGroundView;
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
    this.trainingGround = new MenuTrainingGroundView(this);
    this.menu = new MenuController({
      onHomePreviewChange: (state) => {
        this.trainingGround?.setState(state);
      },
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
    this.installDebugHooks();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.menu?.destroy();
      this.trainingGround?.destroy();
    });
  }

  update(time: number): void {
    this.trainingGround?.update(time);
  }

  private installDebugHooks(): void {
    if (!import.meta.env.DEV) {
      return;
    }
    const debugWindow = window as Window & { render_game_to_text?: () => string };
    const render = () =>
      JSON.stringify({
        scene: "MenuScene",
        coordinateSystem: "origin top-left; x increases right; y increases down",
        trainingGround: this.trainingGround?.getDebugState() ?? null
      });
    debugWindow.render_game_to_text = render;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (debugWindow.render_game_to_text === render) {
        delete debugWindow.render_game_to_text;
      }
    });
  }
}
