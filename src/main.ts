import Phaser from "phaser";
import { BattleScene } from "./phaser/scenes/BattleScene";
import { BootScene } from "./phaser/scenes/BootScene";
import { MenuScene } from "./phaser/scenes/MenuScene";
import "./styles.css";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#15120f",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  render: {
    antialias: true,
    pixelArt: false
  },
  scene: [BootScene, MenuScene, BattleScene]
};

new Phaser.Game(config);
