import Phaser from "phaser";
import type { InputState, Vector2 } from "../types";

export interface KeyboardBindings {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
  q: Phaser.Input.Keyboard.Key;
  esc: Phaser.Input.Keyboard.Key;
}

export function createKeyboardBindings(scene: Phaser.Scene): KeyboardBindings {
  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    throw new Error("Keyboard input is not available.");
  }
  return {
    up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
    down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
    left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
    right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    space: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    q: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
    esc: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
  };
}

export function readInput(keys: KeyboardBindings, joystick: Vector2, manualPressed: boolean): InputState {
  const move = {
    x: (keys.right.isDown || keys.d.isDown ? 1 : 0) - (keys.left.isDown || keys.a.isDown ? 1 : 0) + joystick.x,
    y: (keys.down.isDown || keys.s.isDown ? 1 : 0) - (keys.up.isDown || keys.w.isDown ? 1 : 0) + joystick.y
  };
  return {
    move,
    manualPressed:
      manualPressed || Phaser.Input.Keyboard.JustDown(keys.space) || Phaser.Input.Keyboard.JustDown(keys.q),
    pausePressed: Phaser.Input.Keyboard.JustDown(keys.esc)
  };
}
