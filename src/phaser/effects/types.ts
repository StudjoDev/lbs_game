import type Phaser from "phaser";

export interface XpEffectPoint {
  x: number;
  y: number;
}

export interface XpOrbEffectInput {
  uid: number;
  x: number;
  y: number;
  value: number;
  radius?: number;
}

export interface XpOrbEffectFrame {
  orb: XpOrbEffectInput;
  playerPosition: XpEffectPoint;
  now: number;
}

export interface XpPickupBurstOptions {
  x: number;
  y: number;
  now: number;
  count?: number;
  value?: number;
  spread?: number;
  depth?: number;
}

export interface XpPickupPulseOptions {
  playerPosition: XpEffectPoint;
  now: number;
  count?: number;
  intensity?: number;
}

export interface XpPickupEffectsConfig {
  scene: Phaser.Scene;
  orbLayer: Phaser.GameObjects.Layer;
  effectLayer?: Phaser.GameObjects.Layer;
  orbTextureKey?: string;
  particleTextureKey?: string;
}
