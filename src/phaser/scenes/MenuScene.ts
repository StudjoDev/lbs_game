import Phaser from "phaser";
import type { HeroId } from "../../game/types";
import { MenuController } from "../../ui/menu";

export class MenuScene extends Phaser.Scene {
  private menu?: MenuController;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.menu = new MenuController({
      onStart: (heroId: HeroId) => {
        this.menu?.destroy();
        this.scene.start("BattleScene", { heroId });
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.menu?.destroy());
  }
}
