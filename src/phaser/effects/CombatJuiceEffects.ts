import Phaser from "phaser";

export interface CombatJuiceEffectsOptions {
  layer?: Phaser.GameObjects.Layer;
  depth?: number;
}

export interface CombatImpactOptions {
  x: number;
  y: number;
  direction?: Phaser.Math.Vector2 | { x: number; y: number } | number;
  radius?: number;
  intensity?: number;
  color?: number;
  accentColor?: number;
  depth?: number;
  critical?: boolean;
}

export interface CombatDeathOptions {
  x: number;
  y: number;
  radius?: number;
  intensity?: number;
  color?: number;
  accentColor?: number;
  depth?: number;
}

export interface HitStopRequest {
  requestedMs: number;
  suggestedMs: number;
  apply: (callback: (durationMs: number) => void) => number;
}

type DestroyableGameObject = Phaser.GameObjects.GameObject & { destroy: (fromScene?: boolean) => void };

const defaultDepth = 3600;
const defaultHitColor = 0xfff1cf;
const defaultHitAccent = 0xff7a45;
const defaultDeathColor = 0xd8d7c8;
const defaultEliteColor = 0xb15cff;

export class CombatJuiceEffects {
  private readonly scene: Phaser.Scene;
  private readonly layer?: Phaser.GameObjects.Layer;
  private readonly depth: number;
  private readonly objects = new Set<DestroyableGameObject>();
  private readonly tweens = new Set<Phaser.Tweens.Tween>();
  private cleanedUp = false;

  constructor(scene: Phaser.Scene, options: CombatJuiceEffectsOptions = {}) {
    this.scene = scene;
    this.layer = options.layer;
    this.depth = options.depth ?? defaultDepth;
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  renderHitSpark(options: CombatImpactOptions): void {
    if (this.cleanedUp) {
      return;
    }
    const radius = options.radius ?? 24;
    const intensity = clampIntensity(options.intensity);
    const angle = directionAngle(options.direction);
    const depth = options.depth ?? this.depth;
    const color = options.color ?? defaultHitColor;
    const accent = options.accentColor ?? defaultHitAccent;

    this.renderDirectionalImpact({ ...options, direction: angle, radius, intensity, color, accentColor: accent, depth });
    this.renderImpactRing(options.x, options.y, radius, intensity, color, depth + 1, options.critical === true);
    this.renderContactFlash(options.x, options.y, angle, radius, intensity, color, accent, depth + 2, options.critical === true);
    this.emitSparkShardBurst(options.x, options.y, angle, radius, intensity, color, accent, depth + 2);
    if (options.critical) {
      this.renderStarburst(options.x, options.y, angle, radius * 1.25, intensity, accent, depth + 3);
    }
  }

  renderDirectionalImpact(options: CombatImpactOptions): void {
    if (this.cleanedUp) {
      return;
    }
    const radius = options.radius ?? 24;
    const intensity = clampIntensity(options.intensity);
    const angle = directionAngle(options.direction);
    const depth = options.depth ?? this.depth;
    const color = options.color ?? defaultHitColor;
    const accent = options.accentColor ?? defaultHitAccent;
    const graphics = this.addGraphics(depth + 1, Phaser.BlendModes.ADD);
    const length = radius * (1.05 + intensity * 0.55);
    const width = radius * (0.42 + intensity * 0.1);

    graphics.fillStyle(accent, 0.36);
    drawWedge(graphics, options.x, options.y, angle, length * 1.35, width * 1.25);
    graphics.fillStyle(color, 0.82);
    drawWedge(graphics, options.x, options.y, angle, length, width);
    graphics.lineStyle(Math.max(2, radius * 0.08), color, 0.74);
    graphics.lineBetween(
      options.x - Math.cos(angle) * radius * 0.18,
      options.y - Math.sin(angle) * radius * 0.18,
      options.x + Math.cos(angle) * length * 1.12,
      options.y + Math.sin(angle) * length * 1.12
    );

    this.addTween({
      targets: graphics,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.18,
      duration: 120 + intensity * 35,
      ease: "Quad.easeOut",
      onComplete: () => this.destroyObject(graphics)
    });
  }

  renderBriefOutline(options: CombatImpactOptions): void {
    if (this.cleanedUp) {
      return;
    }
    this.renderImpactRing(
      options.x,
      options.y,
      options.radius ?? 26,
      clampIntensity(options.intensity),
      options.color ?? defaultHitColor,
      options.depth ?? this.depth,
      options.critical === true
    );
  }

  renderDeathPuff(options: CombatDeathOptions): void {
    if (this.cleanedUp) {
      return;
    }
    const radius = options.radius ?? 32;
    const intensity = clampIntensity(options.intensity);
    const color = options.color ?? defaultDeathColor;
    const accent = options.accentColor ?? 0xfff1cf;
    const depth = options.depth ?? this.depth;

    this.renderDustCloud(options.x, options.y, radius, intensity, color, depth);
    this.renderGroundRipple(options.x, options.y, radius * 0.92, intensity, accent, depth + 1);
    this.emitCollapseBurst(options.x, options.y, radius, intensity, color, accent, depth + 2, 9);
  }

  renderCollapseBurst(options: CombatDeathOptions): void {
    if (this.cleanedUp) {
      return;
    }
    const radius = options.radius ?? 36;
    const intensity = clampIntensity(options.intensity);
    const color = options.color ?? defaultDeathColor;
    const accent = options.accentColor ?? 0xfff1cf;
    const depth = options.depth ?? this.depth;

    this.renderDustCloud(options.x, options.y, radius * 0.88, intensity, color, depth);
    this.renderGroundRipple(options.x, options.y, radius, intensity, accent, depth + 1);
    this.renderGroundCrack(options.x, options.y, radius, intensity, accent, depth + 1);
    this.emitCollapseBurst(options.x, options.y, radius, intensity, color, accent, depth + 2, 12);
  }

  renderEliteDeathBurst(options: CombatDeathOptions): void {
    if (this.cleanedUp) {
      return;
    }
    const radius = options.radius ?? 54;
    const intensity = clampIntensity((options.intensity ?? 1.2) + 0.35);
    const color = options.color ?? defaultEliteColor;
    const accent = options.accentColor ?? 0xfff1cf;
    const depth = options.depth ?? this.depth;

    this.renderDustCloud(options.x, options.y, radius, intensity, color, depth);
    this.renderGroundRipple(options.x, options.y, radius * 1.1, intensity, accent, depth + 1);
    this.renderGroundCrack(options.x, options.y, radius * 1.18, intensity, accent, depth + 1);
    this.renderImpactRing(options.x, options.y, radius * 0.95, intensity, color, depth + 2, true);
    this.emitCollapseBurst(options.x, options.y, radius * 1.25, intensity, color, accent, depth + 3, 18);
  }

  requestHitStop(ms: number): HitStopRequest {
    const requestedMs = Math.max(0, ms);
    const suggestedMs = Math.round(Phaser.Math.Clamp(requestedMs, 0, 90));
    return {
      requestedMs,
      suggestedMs,
      apply: (callback) => {
        callback(suggestedMs);
        return suggestedMs;
      }
    };
  }

  cleanup(): void {
    if (this.cleanedUp) {
      return;
    }
    this.cleanedUp = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    for (const tween of this.tweens) {
      tween.remove();
    }
    this.tweens.clear();
    for (const object of this.objects) {
      object.destroy();
    }
    this.objects.clear();
  }

  private renderImpactRing(
    x: number,
    y: number,
    radius: number,
    intensity: number,
    color: number,
    depth: number,
    critical: boolean
  ): void {
    const graphics = this.addGraphics(depth, Phaser.BlendModes.ADD);
    const lineWidth = critical ? 4 : 2;

    graphics.lineStyle(lineWidth, color, critical ? 0.92 : 0.62);
    graphics.strokeEllipse(x, y, radius * 1.5, radius * 0.62);
    graphics.lineStyle(1, 0xffffff, critical ? 0.54 : 0.28);
    graphics.strokeEllipse(x, y, radius * 0.9, radius * 0.38);

    this.addTween({
      targets: graphics,
      alpha: 0,
      scaleX: 1.45 + intensity * 0.22,
      scaleY: 1.25 + intensity * 0.16,
      duration: critical ? 190 : 145,
      ease: "Cubic.easeOut",
      onComplete: () => this.destroyObject(graphics)
    });
  }

  private renderContactFlash(
    x: number,
    y: number,
    angle: number,
    radius: number,
    intensity: number,
    color: number,
    accent: number,
    depth: number,
    critical: boolean
  ): void {
    const graphics = this.addGraphics(depth, Phaser.BlendModes.ADD);
    const forwardX = Math.cos(angle);
    const forwardY = Math.sin(angle);
    const sideX = Math.cos(angle + Math.PI / 2);
    const sideY = Math.sin(angle + Math.PI / 2);
    const core = radius * (critical ? 0.72 : 0.48);
    const flare = radius * (critical ? 1.32 : 0.92) * (1 + intensity * 0.08);

    graphics.fillStyle(0xffffff, critical ? 0.74 : 0.48);
    graphics.fillEllipse(x, y, core * 1.4, core * 0.56);
    graphics.fillStyle(color, critical ? 0.58 : 0.42);
    drawWedge(graphics, x - forwardX * core * 0.18, y - forwardY * core * 0.18, angle, flare, core * 0.36);
    graphics.fillStyle(accent, critical ? 0.42 : 0.26);
    drawWedge(
      graphics,
      x + sideX * core * 0.16,
      y + sideY * core * 0.16,
      angle + (critical ? 0.42 : -0.34),
      flare * 0.72,
      core * 0.26
    );

    this.addTween({
      targets: graphics,
      alpha: 0,
      scaleX: critical ? 1.42 : 1.24,
      scaleY: critical ? 1.28 : 1.12,
      duration: critical ? 130 : 92,
      ease: "Quad.easeOut",
      onComplete: () => this.destroyObject(graphics)
    });
  }

  private renderStarburst(
    x: number,
    y: number,
    angle: number,
    radius: number,
    intensity: number,
    color: number,
    depth: number
  ): void {
    const graphics = this.addGraphics(depth, Phaser.BlendModes.ADD);
    const spokes = 10 + Math.round(intensity * 3);

    graphics.lineStyle(Math.max(2, radius * 0.035), color, 0.76);
    for (let index = 0; index < spokes; index += 1) {
      const spokeAngle = angle + (Math.PI * 2 * index) / spokes;
      const inner = radius * (index % 2 === 0 ? 0.2 : 0.34);
      const outer = radius * (0.72 + (index % 3) * 0.16);
      graphics.lineBetween(
        x + Math.cos(spokeAngle) * inner,
        y + Math.sin(spokeAngle) * inner,
        x + Math.cos(spokeAngle) * outer,
        y + Math.sin(spokeAngle) * outer
      );
    }

    this.addTween({
      targets: graphics,
      alpha: 0,
      rotation: 0.18,
      scaleX: 1.34,
      scaleY: 1.34,
      duration: 170 + intensity * 35,
      ease: "Cubic.easeOut",
      onComplete: () => this.destroyObject(graphics)
    });
  }

  private renderDustCloud(x: number, y: number, radius: number, intensity: number, color: number, depth: number): void {
    const graphics = this.addGraphics(depth, Phaser.BlendModes.NORMAL);
    const count = 7 + Math.round(intensity * 3);

    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      const ring = radius * (0.16 + (index % 4) * 0.11);
      const puffX = x + Math.cos(angle) * ring;
      const puffY = y + Math.sin(angle) * ring * 0.42;
      const width = radius * (0.42 + (index % 3) * 0.08);
      const height = radius * (0.2 + (index % 2) * 0.06);
      graphics.fillStyle(index % 2 === 0 ? color : 0x2b2530, index % 2 === 0 ? 0.26 : 0.18);
      graphics.fillEllipse(puffX, puffY, width, height);
    }

    this.addTween({
      targets: graphics,
      alpha: 0,
      scaleX: 1.55 + intensity * 0.28,
      scaleY: 1.25 + intensity * 0.18,
      y: y - radius * 0.08,
      duration: 360 + intensity * 85,
      ease: "Quad.easeOut",
      onComplete: () => this.destroyObject(graphics)
    });
  }

  private renderGroundRipple(x: number, y: number, radius: number, intensity: number, color: number, depth: number): void {
    const graphics = this.addGraphics(depth, Phaser.BlendModes.ADD);
    const rings = 2 + Math.round(intensity);

    for (let index = 0; index < rings; index += 1) {
      const size = radius * (0.68 + index * 0.3);
      graphics.lineStyle(Math.max(2, radius * (0.024 - index * 0.003)), color, 0.38 - index * 0.08);
      graphics.strokeEllipse(x, y + radius * 0.08, size * 1.75, size * 0.58);
    }

    this.addTween({
      targets: graphics,
      alpha: 0,
      scaleX: 1.48 + intensity * 0.18,
      scaleY: 1.22 + intensity * 0.1,
      duration: 230 + intensity * 70,
      ease: "Quad.easeOut",
      onComplete: () => this.destroyObject(graphics)
    });
  }

  private renderGroundCrack(x: number, y: number, radius: number, intensity: number, color: number, depth: number): void {
    const graphics = this.addGraphics(depth, Phaser.BlendModes.ADD);
    const spokes = 8 + Math.round(intensity * 2);

    graphics.lineStyle(Math.max(2, radius * 0.035), color, 0.58);
    for (let index = 0; index < spokes; index += 1) {
      const angle = (Math.PI * 2 * index) / spokes + (index % 2) * 0.12;
      const inner = radius * 0.18;
      const outer = radius * (0.55 + (index % 3) * 0.12);
      graphics.lineBetween(
        x + Math.cos(angle) * inner,
        y + Math.sin(angle) * inner * 0.46,
        x + Math.cos(angle) * outer,
        y + Math.sin(angle) * outer * 0.46
      );
    }

    this.addTween({
      targets: graphics,
      alpha: 0,
      scaleX: 1.14,
      scaleY: 1.08,
      duration: 230 + intensity * 80,
      ease: "Quad.easeOut",
      onComplete: () => this.destroyObject(graphics)
    });
  }

  private emitSparkShardBurst(
    x: number,
    y: number,
    direction: number,
    radius: number,
    intensity: number,
    color: number,
    accent: number,
    depth: number
  ): void {
    const count = 6 + Math.round(intensity * 4);
    for (let index = 0; index < count; index += 1) {
      const spread = (index / Math.max(1, count - 1) - 0.5) * 1.65;
      const angle = direction + spread;
      const distance = radius * (0.16 + (index % 3) * 0.04) * (1 + intensity * 0.08);
      const shard = this.addGraphics(depth + index * 0.01, Phaser.BlendModes.ADD);
      const length = Math.max(8, radius * (0.24 + (index % 3) * 0.05));

      shard.fillStyle(index % 2 === 0 ? color : accent, 0.84);
      drawWedge(shard, x, y, angle, length, Math.max(3, radius * 0.08));
      this.addTween({
        targets: shard,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance * 0.72,
        alpha: 0,
        scaleX: 0.35,
        scaleY: 0.35,
        duration: 90 + (index % 3) * 18,
        ease: "Quad.easeOut",
        onComplete: () => this.destroyObject(shard)
      });
    }
  }

  private emitCollapseBurst(
    x: number,
    y: number,
    radius: number,
    intensity: number,
    color: number,
    accent: number,
    depth: number,
    count: number
  ): void {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + (index % 2) * 0.18;
      const distance = radius * (0.4 + (index % 5) * 0.13) * (1 + intensity * 0.12);
      const shard = this.addGraphics(depth + index * 0.01, Phaser.BlendModes.ADD);
      const length = radius * (0.14 + (index % 4) * 0.025);
      const width = Math.max(4, radius * 0.055);

      shard.fillStyle(index % 3 === 0 ? accent : color, index % 3 === 0 ? 0.76 : 0.54);
      drawDiamond(shard, x, y, angle, length, width);
      this.addTween({
        targets: shard,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance * 0.52 - radius * 0.12,
        alpha: 0,
        scaleX: 0.25,
        scaleY: 0.25,
        duration: 280 + (index % 4) * 42,
        ease: "Cubic.easeOut",
        onComplete: () => this.destroyObject(shard)
      });
    }
  }

  private addGraphics(depth: number, blendMode: Phaser.BlendModes): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics().setDepth(depth).setBlendMode(blendMode);
    this.layer?.add(graphics);
    this.objects.add(graphics);
    return graphics;
  }

  private addTween(config: Phaser.Types.Tweens.TweenBuilderConfig): void {
    const tween = this.scene.tweens.add({
      ...config,
      onComplete: (...args) => {
        this.tweens.delete(tween);
        config.onComplete?.(...args);
      }
    });
    this.tweens.add(tween);
  }

  private destroyObject(object: DestroyableGameObject): void {
    this.objects.delete(object);
    object.destroy();
  }
}

function clampIntensity(value = 1): number {
  return Phaser.Math.Clamp(value, 0.25, 2.5);
}

function directionAngle(direction: CombatImpactOptions["direction"]): number {
  if (typeof direction === "number") {
    return direction;
  }
  if (direction && Math.hypot(direction.x, direction.y) > 0.0001) {
    return Math.atan2(direction.y, direction.x);
  }
  return -Math.PI / 4;
}

function drawWedge(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number
): void {
  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);
  const sideX = Math.cos(angle + Math.PI / 2);
  const sideY = Math.sin(angle + Math.PI / 2);

  graphics.beginPath();
  graphics.moveTo(x - forwardX * length * 0.22, y - forwardY * length * 0.22);
  graphics.lineTo(x + forwardX * length + sideX * width, y + forwardY * length + sideY * width);
  graphics.lineTo(x + forwardX * length * 1.18, y + forwardY * length * 1.18);
  graphics.lineTo(x + forwardX * length - sideX * width, y + forwardY * length - sideY * width);
  graphics.closePath();
  graphics.fillPath();
}

function drawDiamond(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number
): void {
  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);
  const sideX = Math.cos(angle + Math.PI / 2);
  const sideY = Math.sin(angle + Math.PI / 2);

  graphics.beginPath();
  graphics.moveTo(x + forwardX * length, y + forwardY * length);
  graphics.lineTo(x + sideX * width, y + sideY * width);
  graphics.lineTo(x - forwardX * length * 0.72, y - forwardY * length * 0.72);
  graphics.lineTo(x - sideX * width, y - sideY * width);
  graphics.closePath();
  graphics.fillPath();
}
