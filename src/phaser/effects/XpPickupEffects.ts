import Phaser from "phaser";
import type {
  XpEffectPoint,
  XpOrbEffectFrame,
  XpOrbEffectInput,
  XpPickupBurstOptions,
  XpPickupEffectsConfig,
  XpPickupPulseOptions
} from "./types";

interface ActiveOrbFx {
  sprite: Phaser.GameObjects.Sprite;
  trail: Phaser.GameObjects.Graphics;
  streak: Phaser.GameObjects.Graphics;
  previousX: number;
  previousY: number;
  lastTrailAt: number;
  lastStreakAt: number;
  value: number;
}

const defaultOrbTextureKey = "xp_orb";
const defaultParticleTextureKey = "particle_spark";
const largeOrbThreshold = 20;

export class XpPickupEffects {
  private readonly scene: Phaser.Scene;
  private readonly orbLayer: Phaser.GameObjects.Layer;
  private readonly effectLayer: Phaser.GameObjects.Layer;
  private readonly orbTextureKey: string;
  private readonly particleTextureKey: string;
  private readonly activeOrbs = new Map<number, ActiveOrbFx>();
  private readonly transients = new Set<Phaser.GameObjects.GameObject>();

  constructor(config: XpPickupEffectsConfig) {
    this.scene = config.scene;
    this.orbLayer = config.orbLayer;
    this.effectLayer = config.effectLayer ?? config.orbLayer;
    this.orbTextureKey = config.orbTextureKey ?? defaultOrbTextureKey;
    this.particleTextureKey = config.particleTextureKey ?? defaultParticleTextureKey;
  }

  syncOrb(frame: XpOrbEffectFrame): Phaser.GameObjects.Sprite {
    const { orb, playerPosition, now } = frame;
    const fx = this.getOrCreateOrb(orb, now);
    const color = orbColor(orb.value);
    const scale = orbScale(orb);
    const distanceToPlayer = Phaser.Math.Distance.Between(orb.x, orb.y, playerPosition.x, playerPosition.y);
    const movementTowardPlayer = distanceToPoint(fx.previousX, fx.previousY, playerPosition) - distanceToPlayer;
    const magnetBlend = Phaser.Math.Clamp((220 - distanceToPlayer) / 180, 0, 1);
    const suctionBlend = Math.max(magnetBlend, Phaser.Math.Clamp(movementTowardPlayer / 14, 0, 1));

    fx.sprite.setPosition(orb.x, orb.y);
    fx.sprite.setDepth(orb.y - 30);
    fx.sprite.setScale(scale * (1 + suctionBlend * 0.15));
    fx.sprite.setTint(color);
    fx.sprite.setAlpha(0.72 + Math.sin(now / 120 + orb.uid) * 0.18);

    this.drawTrail(fx, orb, now, color);
    this.drawSuctionStreak(fx, orb, playerPosition, now, color, suctionBlend);

    fx.previousX = orb.x;
    fx.previousY = orb.y;
    fx.value = orb.value;
    return fx.sprite;
  }

  syncOrbs(orbs: readonly XpOrbEffectInput[], playerPosition: XpEffectPoint, now: number): void {
    const liveIds = new Set<number>();
    for (const orb of orbs) {
      liveIds.add(orb.uid);
      this.syncOrb({ orb, playerPosition, now });
    }
    this.removeMissing(liveIds, { playerPosition, now });
  }

  removeMissing(liveIds: ReadonlySet<number>, context?: { playerPosition?: XpEffectPoint; now?: number }): void {
    for (const [uid, fx] of this.activeOrbs) {
      if (liveIds.has(uid)) {
        continue;
      }
      this.emitBurst({
        x: fx.sprite.x,
        y: fx.sprite.y,
        now: context?.now ?? this.scene.time.now,
        count: fx.value >= largeOrbThreshold ? 5 : 3,
        value: fx.value,
        spread: context?.playerPosition ? 34 : 28,
        depth: fx.sprite.y + 20
      });
      this.destroyOrb(uid);
    }
  }

  emitBurst(options: XpPickupBurstOptions): void {
    const count = Math.max(1, Math.floor(options.count ?? 4));
    const value = options.value ?? 1;
    const spread = options.spread ?? (value >= largeOrbThreshold ? 34 : 22);
    const color = orbColor(value);
    const textureKey = this.textureOrFallback(this.particleTextureKey, this.orbTextureKey);

    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * (index + 0.5)) / count + ((options.now + index * 97) % 360) * Phaser.Math.DEG_TO_RAD;
      const distance = spread * (0.35 + ((index * 29 + Math.floor(options.now)) % 70) / 100);
      const particle = this.scene.add
        .sprite(options.x, options.y, textureKey)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(color)
        .setDepth(options.depth ?? options.y + 20)
        .setAlpha(0.74)
        .setScale(0.045 + (index % 3) * 0.014);
      this.effectLayer.add(particle);
      this.trackTransient(particle);
      this.scene.tweens.add({
        targets: particle,
        x: options.x + Math.cos(angle) * distance,
        y: options.y + Math.sin(angle) * distance * 0.68,
        alpha: 0,
        scale: particle.scaleX * 2.1,
        duration: 280,
        ease: "Quad.easeOut",
        onComplete: () => this.destroyTransient(particle)
      });
    }
  }

  emitPickupPulse(options: XpPickupPulseOptions): void {
    const intensity = Phaser.Math.Clamp(options.intensity ?? 1, 0.35, 2.4);
    const count = Math.max(1, Math.floor(options.count ?? 1));
    for (let index = 0; index < count; index += 1) {
      const ring = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(options.playerPosition.y + 120 + index);
      this.effectLayer.add(ring);
      this.trackTransient(ring);
      const createdAt = options.now + index * 28;
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 260 + index * 28,
        ease: "Quad.easeOut",
        onUpdate: (tween) => {
          const progress = Phaser.Math.Clamp(tween.getValue() ?? 0, 0, 1);
          const radius = (22 + index * 5) * intensity + progress * (34 + count * 3);
          const alpha = (1 - progress) * (0.42 / Math.sqrt(count));
          ring.clear();
          ring.lineStyle(3, 0xffe28c, alpha);
          ring.strokeCircle(options.playerPosition.x, options.playerPosition.y, radius);
          ring.lineStyle(1, 0x9eefff, alpha * 0.7);
          ring.strokeCircle(options.playerPosition.x, options.playerPosition.y, radius * 0.62);
        },
        onComplete: () => this.destroyTransient(ring),
        delay: Math.max(0, createdAt - options.now)
      });
    }
  }

  destroy(): void {
    for (const uid of this.activeOrbs.keys()) {
      this.destroyOrb(uid);
    }
    this.activeOrbs.clear();
    for (const transient of this.transients) {
      this.scene.tweens.killTweensOf(transient);
      transient.destroy();
    }
    this.transients.clear();
  }

  private getOrCreateOrb(orb: XpOrbEffectInput, now: number): ActiveOrbFx {
    const existing = this.activeOrbs.get(orb.uid);
    if (existing) {
      return existing;
    }
    const textureKey = this.textureOrFallback(this.orbTextureKey, defaultOrbTextureKey);
    const sprite = this.scene.add.sprite(orb.x, orb.y, textureKey).setBlendMode(Phaser.BlendModes.ADD);
    const trail = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const streak = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.orbLayer.add([trail, streak, sprite]);
    const fx: ActiveOrbFx = {
      sprite,
      trail,
      streak,
      previousX: orb.x,
      previousY: orb.y,
      lastTrailAt: now - 999,
      lastStreakAt: now - 999,
      value: orb.value
    };
    this.activeOrbs.set(orb.uid, fx);
    return fx;
  }

  private drawTrail(fx: ActiveOrbFx, orb: XpOrbEffectInput, now: number, color: number): void {
    fx.trail.clear();
    const dx = orb.x - fx.previousX;
    const dy = orb.y - fx.previousY;
    const speed = Math.hypot(dx, dy);
    if (speed < 0.5 && fx.lastTrailAt + 150 > now) {
      return;
    }
    fx.lastTrailAt = now;
    const length = Phaser.Math.Clamp(speed * 2.2 + orbScale(orb) * 12, 12, 48);
    const angle = speed > 0.5 ? Math.atan2(dy, dx) : now / 260 + orb.uid;
    fx.trail.setDepth(orb.y - 32);
    fx.trail.lineStyle(5 * orbScale(orb), color, 0.22);
    fx.trail.lineBetween(orb.x - Math.cos(angle) * length, orb.y - Math.sin(angle) * length, orb.x, orb.y);
    fx.trail.lineStyle(2, 0xfff1cf, 0.18);
    fx.trail.lineBetween(orb.x - Math.cos(angle) * length * 0.55, orb.y - Math.sin(angle) * length * 0.55, orb.x, orb.y);
  }

  private drawSuctionStreak(
    fx: ActiveOrbFx,
    orb: XpOrbEffectInput,
    playerPosition: XpEffectPoint,
    now: number,
    color: number,
    suctionBlend: number
  ): void {
    fx.streak.clear();
    if (suctionBlend <= 0.02 || fx.lastStreakAt + 34 > now) {
      return;
    }
    fx.lastStreakAt = now;
    const distance = Phaser.Math.Distance.Between(orb.x, orb.y, playerPosition.x, playerPosition.y);
    const alpha = Phaser.Math.Clamp(suctionBlend * 0.5, 0.08, 0.46);
    const middleX = Phaser.Math.Linear(orb.x, playerPosition.x, 0.52) + Math.sin(now / 90 + orb.uid) * 10;
    const middleY = Phaser.Math.Linear(orb.y, playerPosition.y, 0.52) + Math.cos(now / 110 + orb.uid) * 6;
    fx.streak.setDepth(Math.max(orb.y, playerPosition.y) + 8);
    fx.streak.lineStyle(Phaser.Math.Clamp(1.5 + (180 - distance) / 70, 1.5, 4), color, alpha);
    strokeQuadratic(fx.streak, orb.x, orb.y, middleX, middleY, playerPosition.x, playerPosition.y);
    fx.streak.lineStyle(1, 0xfff1cf, alpha * 0.55);
    strokeQuadratic(fx.streak, orb.x, orb.y, middleX, middleY, playerPosition.x, playerPosition.y);
  }

  private destroyOrb(uid: number): void {
    const fx = this.activeOrbs.get(uid);
    if (!fx) {
      return;
    }
    this.scene.tweens.killTweensOf([fx.sprite, fx.trail, fx.streak]);
    fx.sprite.destroy();
    fx.trail.destroy();
    fx.streak.destroy();
    this.activeOrbs.delete(uid);
  }

  private trackTransient(gameObject: Phaser.GameObjects.GameObject): void {
    this.transients.add(gameObject);
    gameObject.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.transients.delete(gameObject);
    });
  }

  private destroyTransient(gameObject: Phaser.GameObjects.GameObject): void {
    this.transients.delete(gameObject);
    gameObject.destroy();
  }

  private textureOrFallback(preferredKey: string, fallbackKey: string): string {
    if (this.scene.textures.exists(preferredKey)) {
      return preferredKey;
    }
    if (this.scene.textures.exists(fallbackKey)) {
      return fallbackKey;
    }
    return defaultOrbTextureKey;
  }
}

function orbColor(value: number): number {
  return value >= largeOrbThreshold ? 0xffe28c : 0x9eefff;
}

function orbScale(orb: XpOrbEffectInput): number {
  const radiusScale = orb.radius ? Phaser.Math.Clamp(orb.radius / 10, 0.56, 1.18) : 1;
  return (orb.value >= largeOrbThreshold ? 1.05 : 0.72) * radiusScale;
}

function distanceToPoint(x: number, y: number, point: XpEffectPoint): number {
  return Phaser.Math.Distance.Between(x, y, point.x, point.y);
}

function strokeQuadratic(
  graphics: Phaser.GameObjects.Graphics,
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number
): void {
  graphics.beginPath();
  graphics.moveTo(startX, startY);
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8;
    const inv = 1 - t;
    graphics.lineTo(
      inv * inv * startX + 2 * inv * t * controlX + t * t * endX,
      inv * inv * startY + 2 * inv * t * controlY + t * t * endY
    );
  }
  graphics.strokePath();
}
