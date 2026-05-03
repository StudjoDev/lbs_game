import Phaser from "phaser";
import {
  defaultVfxProfile,
  enemyVisualProfiles,
  vfxProfiles,
  type EnemyVisualProfile,
  type VfxProfile
} from "../../game/assets/manifest";
import type { MusicKey } from "../../game/audio/catalog";
import { revealBossDefeat } from "../../game/collection/collectionStore";
import { characterArtById } from "../../game/content/characterArt";
import { ultimateByHeroId } from "../../game/content/ultimates";
import { createKeyboardBindings, readInput, type KeyboardBindings } from "../../game/input/bindings";
import { applyUpgrade } from "../../game/simulation/combat";
import { createRun } from "../../game/simulation/createRun";
import { collectDebugXp, setPaused, updateRun } from "../../game/simulation/updateRun";
import type {
  AreaState,
  CombatEventState,
  EnemyState,
  FloatingTextState,
  HeroId,
  ProjectileState,
  RunState,
  XpOrbState
} from "../../game/types";
import { getAudioController } from "../audio/AudioController";
import { BattleHud } from "../../ui/hud";

interface BattleData {
  heroId?: HeroId;
}

interface PlayerVisualState {
  visualX: number;
  visualY: number;
  facingAngle: number;
  bobOffset: number;
  attackTimer: number;
  castTimer: number;
  squashScale: number;
}

interface ActiveMeleeFx {
  id: number;
  sprite: Phaser.GameObjects.Sprite;
  profile: VfxProfile;
  createdAt: number;
  lifetimeMs: number;
  followPlayer: boolean;
  offsetX: number;
  offsetY: number;
  baseRotation: number;
  baseScale: number;
}

const baseBattleViewport = {
  width: 860,
  height: 680,
  minZoom: 0.5,
  maxZoom: 1
};

export class BattleScene extends Phaser.Scene {
  private run?: RunState;
  private keys?: KeyboardBindings;
  private hud?: BattleHud;
  private backgroundLayer?: Phaser.GameObjects.Layer;
  private areaLayer?: Phaser.GameObjects.Layer;
  private unitLayer?: Phaser.GameObjects.Layer;
  private projectileLayer?: Phaser.GameObjects.Layer;
  private impactLayer?: Phaser.GameObjects.Layer;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private playerGroundAura?: Phaser.GameObjects.Graphics;
  private manualQueued = false;
  private playerVisualState: PlayerVisualState = {
    visualX: 0,
    visualY: 0,
    facingAngle: 0,
    bobOffset: 0,
    attackTimer: 0,
    castTimer: 0,
    squashScale: 1
  };
  private lastPlayerPosition?: Phaser.Math.Vector2;
  private activeMeleeFx = new Map<number, ActiveMeleeFx>();
  private nextMeleeFxId = 1;
  private enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  private enemyShadows = new Map<number, Phaser.GameObjects.Ellipse>();
  private enemyFrames = new Map<number, Phaser.GameObjects.Graphics>();
  private enemyPool: Phaser.GameObjects.Sprite[] = [];
  private projectileSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private projectileTrailTimestamps = new Map<number, number>();
  private meleeProjectileTimestamps = new Map<number, number>();
  private xpOrbSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private xpOrbTrailTimestamps = new Map<number, number>();
  private areaGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private areaParticleTimestamps = new Map<number, number>();
  private combatEventGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private floatingTexts = new Map<number, Phaser.GameObjects.Text>();
  private playerAttackTimers: Phaser.Time.TimerEvent[] = [];
  private playerAttackActive = false;
  private bossUnlockSaved = false;
  private lastResultSfx?: "won" | "lost";
  private cameraBaseZoom = 1;

  constructor() {
    super("BattleScene");
  }

  create(data: BattleData): void {
    const heroId = data.heroId ?? "guanyu";
    this.playerAttackTimers.forEach((timer) => timer.remove(false));
    this.playerAttackTimers = [];
    this.playerAttackActive = false;
    this.bossUnlockSaved = false;
    this.lastResultSfx = undefined;
    this.run = createRun(heroId, Date.now() >>> 0);
    this.lastPlayerPosition = new Phaser.Math.Vector2(this.run.player.x, this.run.player.y);
    this.playerVisualState = {
      visualX: this.run.player.x,
      visualY: this.run.player.y,
      facingAngle: Math.atan2(this.run.lastFacing.y, this.run.lastFacing.x),
      bobOffset: 0,
      attackTimer: 0,
      castTimer: 0,
      squashScale: 1
    };
    this.keys = createKeyboardBindings(this);
    const audio = getAudioController(this);
    audio.bindUnlock(this);
    audio.playMusic(this, "music_battle", 360);
    this.cameras.main.setBounds(0, 0, this.run.world.width, this.run.world.height);
    this.createRenderLayers();
    this.createBattlefield();
    const art = characterArtById[this.run.hero.artId];
    this.playerSprite = this.add
      .sprite(this.run.player.x, this.run.player.y, this.run.hero.spriteKey)
      .setOrigin(art.anchor.x, art.anchor.y)
      .setScale(art.battleScale ?? 1)
      .setDepth(1000);
    this.unitLayer?.add(this.playerSprite);
    this.playerGroundAura = this.add.graphics();
    this.areaLayer?.add(this.playerGroundAura);
    this.cameras.main.startFollow(this.playerSprite, true, 0.11, 0.11);
    this.applyResponsiveCameraZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyResponsiveCameraZoom, this);
    this.hud = new BattleHud({
      getAudioSettings: () => audio.getSettings(),
      onAudioSettingsChange: (settings) => {
        audio.updateSettings(this, settings);
      },
      onAudioCue: (key) => {
        audio.playSfx(this, key);
      },
      onManual: () => {
        this.manualQueued = true;
        audio.playSfx(this, "sfx_ui_confirm", 0.72);
      },
      onPause: () => {
        if (this.run) {
          audio.playSfx(this, "sfx_ui_select");
          setPaused(this.run, true);
        }
      },
      onResume: () => {
        if (this.run) {
          audio.playSfx(this, "sfx_ui_confirm");
          setPaused(this.run, false);
        }
      },
      onUpgrade: (upgradeId) => {
        if (this.run) {
          audio.playSfx(this, "sfx_ui_confirm");
          applyUpgrade(this.run, upgradeId);
        }
      },
      onRestart: () => {
        audio.playSfx(this, "sfx_ui_confirm");
        this.scene.restart({ heroId });
      },
      onMenu: () => {
        audio.playSfx(this, "sfx_ui_select");
        this.scene.start("MenuScene");
      }
    });
    this.installDebugHooks();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  update(_time: number, deltaMs: number): void {
    if (!this.run || !this.keys || !this.hud) {
      return;
    }

    const input = readInput(this.keys, this.hud.getMoveVector(), this.manualQueued);
    this.manualQueued = false;
    if (input.pausePressed) {
      setPaused(this.run, this.run.status !== "paused");
    }
    updateRun(this.run, input, deltaMs / 1000);
    if (this.run.status === "won" && !this.bossUnlockSaved) {
      revealBossDefeat("lubu");
      this.bossUnlockSaved = true;
    }
    this.syncAudioState(this.run);
    this.syncRender(this.run);
    this.hud.update(this.run);
  }

  private syncRender(state: RunState): void {
    this.syncPlayer(state);
    this.syncEnemies(state.enemies);
    this.syncXpOrbs(state.xpOrbs);
    this.syncProjectiles(state.projectiles);
    this.syncAreas(state.areas);
    this.syncCombatEvents(state.combatEvents);
    this.syncActiveMeleeFx();
    this.syncFloatingTexts(state.floatingTexts);
  }

  private syncAudioState(state: RunState): void {
    const audio = getAudioController(this);
    if (state.status === "won" || state.status === "lost") {
      if (this.lastResultSfx !== state.status) {
        this.lastResultSfx = state.status;
        audio.stopMusic(this, 520);
        audio.playSfx(this, state.status === "won" ? "sfx_victory" : "sfx_defeat");
      }
      return;
    }
    const musicKey: MusicKey = state.bossSpawned ? "music_boss" : "music_battle";
    audio.playMusic(this, musicKey);
  }

  private syncPlayer(state: RunState): void {
    if (!this.playerSprite) {
      return;
    }
    this.updatePlayerVisualState(state);
    const art = characterArtById[state.hero.artId];
    const baseScale = art.battleScale ?? 1;
    const ultimateActive = state.player.ultimateTimer > 0;
    const visual = this.playerVisualState;
    const powerScale = (state.player.berserkTimer > 0 ? 1.14 : 1) * (ultimateActive ? 1.08 : 1);
    const squashX = 1 + (1 - visual.squashScale) * 0.52;
    const squashY = visual.squashScale;
    this.playerSprite.setPosition(visual.visualX, visual.visualY + visual.bobOffset);
    this.playerSprite.setDepth(state.player.y);
    this.playerSprite.setFlipX(Math.cos(visual.facingAngle) < -0.08);
    this.playerSprite.setRotation(Math.sin(visual.facingAngle) * 0.025 + visual.attackTimer * 0.04);
    this.playerSprite.setScale(baseScale * powerScale * squashX, baseScale * powerScale * squashY);
    this.playerSprite.setTint(ultimateActive ? areaColor(ultimateByHeroId[state.hero.id].vfxKey) : state.player.berserkTimer > 0 ? 0xff9b80 : 0xffffff);
    if (!this.playerAttackActive && this.playerSprite.texture.key !== state.hero.spriteKey) {
      this.playerSprite.setTexture(state.hero.spriteKey);
    }
    this.syncPlayerGroundAura(state, baseScale);
  }

  private updatePlayerVisualState(state: RunState): void {
    const dt = Math.min(0.05, this.game.loop.delta / 1000);
    const previous = this.lastPlayerPosition ?? new Phaser.Math.Vector2(state.player.x, state.player.y);
    const dx = state.player.x - previous.x;
    const dy = state.player.y - previous.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.8) {
      this.playerVisualState.facingAngle = Math.atan2(dy, dx);
    } else if (Math.hypot(state.lastFacing.x, state.lastFacing.y) > 0.01) {
      this.playerVisualState.facingAngle = Math.atan2(state.lastFacing.y, state.lastFacing.x);
    }
    this.lastPlayerPosition = new Phaser.Math.Vector2(state.player.x, state.player.y);

    this.playerVisualState.attackTimer = Math.max(0, this.playerVisualState.attackTimer - dt * 4.5);
    this.playerVisualState.castTimer = Math.max(0, this.playerVisualState.castTimer - dt * 3.2);
    const moveBlend = Phaser.Math.Clamp(distance / 9, 0, 1);
    const breath = Math.sin(this.time.now / 430) * 1.8;
    const step = Math.sin(this.time.now / 82) * 5.2 * moveBlend;
    const lunge = Math.sin(this.playerVisualState.attackTimer * Math.PI) * 28;
    const castLift = Math.sin(this.playerVisualState.castTimer * Math.PI) * -7;
    this.playerVisualState.visualX = state.player.x + Math.cos(this.playerVisualState.facingAngle) * lunge;
    this.playerVisualState.visualY = state.player.y + Math.sin(this.playerVisualState.facingAngle) * lunge + castLift;
    this.playerVisualState.bobOffset = breath + step;
    this.playerVisualState.squashScale = 1 + Math.sin(this.time.now / 360) * 0.018 - this.playerVisualState.attackTimer * 0.08 + moveBlend * 0.018;
  }

  private syncPlayerGroundAura(state: RunState, baseScale: number): void {
    if (!this.playerGroundAura) {
      return;
    }
    const art = characterArtById[state.hero.artId];
    const accent = Number.parseInt(art.palette.accent.replace("#", ""), 16);
    const primary = Number.parseInt(art.palette.primary.replace("#", ""), 16);
    const radiusX = 78 * baseScale;
    const radiusY = 20 * baseScale;
    const x = this.playerVisualState.visualX;
    const y = this.playerVisualState.visualY - 5;

    this.playerGroundAura.clear();
    this.playerGroundAura.fillStyle(0x050207, 0.3);
    this.playerGroundAura.fillEllipse(x, y + 2, radiusX, radiusY);
    this.playerGroundAura.lineStyle(state.hero.artId === "diaochan" ? 3 : 2, accent, state.hero.artId === "diaochan" ? 0.58 : 0.28);
    this.playerGroundAura.strokeEllipse(x, y, radiusX * 1.08, radiusY * 1.2);
    this.playerGroundAura.lineStyle(1, primary, state.hero.artId === "diaochan" ? 0.42 : 0.2);
    this.playerGroundAura.strokeEllipse(x, y, radiusX * 0.74, radiusY * 0.78);

    if (state.hero.artId === "diaochan") {
      this.playerGroundAura.fillStyle(0xffb7d6, 0.5);
      for (let index = 0; index < 6; index += 1) {
        const angle = this.time.now / 900 + (Math.PI * 2 * index) / 6;
        const petalX = x + Math.cos(angle) * radiusX * 0.46;
        const petalY = y + Math.sin(angle) * radiusY * 0.72;
        this.playerGroundAura.fillEllipse(petalX, petalY, 8 * baseScale, 3.2 * baseScale);
      }
    }
    if (state.player.ultimateTimer > 0) {
      const ultimateColor = areaColor(ultimateByHeroId[state.hero.id].vfxKey);
      const pulse = 0.72 + Math.sin(this.time.now / 130) * 0.12;
      this.playerGroundAura.lineStyle(4, ultimateColor, 0.56);
      this.playerGroundAura.strokeEllipse(x, y, radiusX * (1.55 + pulse * 0.18), radiusY * (2.15 + pulse * 0.26));
      this.playerGroundAura.lineStyle(2, 0xfff1cf, 0.32);
      this.playerGroundAura.strokeEllipse(x, y, radiusX * (1.15 + pulse * 0.12), radiusY * (1.62 + pulse * 0.18));
    }
    this.playerGroundAura.setDepth(state.player.y - 4);
  }

  private syncEnemies(enemies: EnemyState[]): void {
    const liveIds = new Set<number>();
    for (const enemy of enemies) {
      liveIds.add(enemy.uid);
      let sprite = this.enemySprites.get(enemy.uid);
      if (!sprite) {
        sprite = this.acquireEnemySprite(enemyVisualProfiles[enemy.defId].spriteKey);
        this.enemySprites.set(enemy.uid, sprite);
      }
      let shadow = this.enemyShadows.get(enemy.uid);
      if (!shadow) {
        shadow = this.add.ellipse(enemy.x, enemy.y, 54, 16, 0x050207, 0.38).setDepth(enemy.y - 16);
        this.areaLayer?.add(shadow);
        this.enemyShadows.set(enemy.uid, shadow);
      }
      let frame = this.enemyFrames.get(enemy.uid);
      if (!frame && enemyVisualProfiles[enemy.defId].eliteFrame) {
        frame = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        this.areaLayer?.add(frame);
        this.enemyFrames.set(enemy.uid, frame);
      }
      const visual = enemyVisualProfiles[enemy.defId];
      const healthRatio = Math.max(0, enemy.hp / enemy.maxHp);
      const flash = enemy.flashTimer > 0;
      const wobble = Math.sin(this.time.now / 180 + enemy.uid) * 0.025;
      const baseScale = visual.baseScale * (flash ? 1.1 : 1) * (enemy.stunTimer > 0 ? 0.97 : 1);
      sprite.setPosition(enemy.x, enemy.y);
      sprite.setDepth(enemy.y - 5);
      sprite.setTexture(visual.spriteKey);
      sprite.setScale(baseScale + wobble);
      sprite.setAlpha(0.78 + healthRatio * 0.22);
      sprite.setFlipX(enemy.x < (this.run?.player.x ?? enemy.x));
      shadow.setPosition(enemy.x, enemy.y + enemy.radius * 0.78);
      shadow.setSize(enemy.radius * 2.5 * visual.shadowScale, enemy.radius * 0.82);
      shadow.setDepth(enemy.y - 18);
      shadow.setAlpha(0.24 + healthRatio * 0.18);
      if (flash) {
        sprite.setTint(visual.hitTint);
        if (enemy.flashTimer > 0.09) {
          this.emitParticleBurst(enemy.x, enemy.y - enemy.radius * 0.2, vfxProfile("hit_spark"), enemy.defId === "lubu" ? 4 : 1, enemy.radius * 1.2, enemy.y + 80);
        }
      } else {
        sprite.setTint(enemy.burnTimer > 0 ? 0xff9e57 : 0xffffff);
      }
      if (frame) {
        drawEnemyFrame(frame, enemy, visual, this.time.now);
      }
    }
    for (const [id, sprite] of this.enemySprites) {
      if (!liveIds.has(id)) {
        const profile = this.lastEnemyProfile(sprite.texture.key);
        this.emitParticleBurst(sprite.x, sprite.y, vfxProfile(profile.deathFxKey), profile.eliteFrame ? 10 : 4, 42 * profile.shadowScale, sprite.y + 120);
        this.releaseEnemySprite(sprite);
        this.enemySprites.delete(id);
        this.enemyShadows.get(id)?.destroy();
        this.enemyShadows.delete(id);
        this.enemyFrames.get(id)?.destroy();
        this.enemyFrames.delete(id);
      }
    }
  }

  private syncProjectiles(projectiles: ProjectileState[]): void {
    const liveIds = new Set<number>();
    for (const projectile of projectiles) {
      liveIds.add(projectile.uid);
      const profile = vfxProfile(projectile.vfxKey);
      if (isMeleeProfile(profile)) {
        if ((this.meleeProjectileTimestamps.get(projectile.uid) ?? 0) === 0) {
          this.meleeProjectileTimestamps.set(projectile.uid, this.time.now);
          this.spawnMeleeFx(
            profile,
            Math.atan2(projectile.vy, projectile.vx),
            Math.max(72, projectile.radius * 1.8),
            profile.followPlayer ?? true
          );
        }
        continue;
      }
      let sprite = this.projectileSprites.get(projectile.uid);
      if (!sprite) {
        sprite = this.add
          .sprite(projectile.x, projectile.y, textureOrFallback(this, profile.textureKey, projectile.vfxKey))
          .setBlendMode(blendMode(profile))
          .setTint(profile.color);
        if (profile.animationKey && this.anims.exists(profile.animationKey)) {
          sprite.play(profile.animationKey);
        }
        this.projectileLayer?.add(sprite);
        this.projectileSprites.set(projectile.uid, sprite);
      }
      sprite.setPosition(projectile.x, projectile.y);
      sprite.setRotation(Math.atan2(projectile.vy, projectile.vx));
      sprite.setDepth(projectile.y + 20);
      sprite.setTint(profile.color);
      sprite.setBlendMode(blendMode(profile));
      sprite.setScale(Math.max(0.55, projectile.radius / 30) * profile.scale);
      if ((this.projectileTrailTimestamps.get(projectile.uid) ?? 0) + 72 < this.time.now) {
        this.projectileTrailTimestamps.set(projectile.uid, this.time.now);
        this.emitParticleBurst(projectile.x, projectile.y, profile, 1, Math.max(8, projectile.radius * 0.55), projectile.y + 10);
      }
    }
    for (const [id, sprite] of this.projectileSprites) {
      if (!liveIds.has(id)) {
        this.emitParticleBurst(sprite.x, sprite.y, vfxProfile(sprite.texture.key), 3, 22, sprite.y + 40);
        sprite.destroy();
        this.projectileSprites.delete(id);
        this.projectileTrailTimestamps.delete(id);
      }
    }
    for (const id of this.meleeProjectileTimestamps.keys()) {
      if (!liveIds.has(id)) {
        this.meleeProjectileTimestamps.delete(id);
      }
    }
  }

  private syncXpOrbs(orbs: XpOrbState[]): void {
    const liveIds = new Set<number>();
    for (const orb of orbs) {
      liveIds.add(orb.uid);
      let sprite = this.xpOrbSprites.get(orb.uid);
      if (!sprite) {
        sprite = this.add.sprite(orb.x, orb.y, "xp_orb").setBlendMode(Phaser.BlendModes.ADD);
        this.projectileLayer?.add(sprite);
        this.xpOrbSprites.set(orb.uid, sprite);
      }
      sprite.setPosition(orb.x, orb.y);
      sprite.setDepth(orb.y - 30);
      sprite.setScale(orb.value >= 20 ? 1.05 : 0.72);
      sprite.setTint(orb.value >= 20 ? 0xffe28c : 0x9eefff);
      sprite.setAlpha(0.72 + Math.sin(this.time.now / 120 + orb.uid) * 0.18);
      if ((this.xpOrbTrailTimestamps.get(orb.uid) ?? 0) + 150 < this.time.now) {
        this.xpOrbTrailTimestamps.set(orb.uid, this.time.now);
        this.emitParticleBurst(orb.x, orb.y, vfxProfile("level_ring"), 1, orb.value >= 20 ? 18 : 10, orb.y + 15);
      }
    }
    for (const [id, sprite] of this.xpOrbSprites) {
      if (!liveIds.has(id)) {
        this.emitParticleBurst(sprite.x, sprite.y, vfxProfile("level_ring"), 3, 28, sprite.y + 20);
        sprite.destroy();
        this.xpOrbSprites.delete(id);
        this.xpOrbTrailTimestamps.delete(id);
      }
    }
  }

  private syncAreas(areas: AreaState[]): void {
    const liveIds = new Set<number>();
    for (const area of areas) {
      liveIds.add(area.uid);
      let graphics = this.areaGraphics.get(area.uid);
      if (!graphics) {
        graphics = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        this.areaLayer?.add(graphics);
        this.areaGraphics.set(area.uid, graphics);
      }
      const profile = vfxProfile(area.vfxKey);
      const renderArea = profile.followPlayer ? { ...area, x: this.playerVisualState.visualX, y: this.playerVisualState.visualY } : area;
      graphics.clear();
      drawAreaTelegraph(graphics, renderArea, profile, this.time.now);
      if ((this.areaParticleTimestamps.get(area.uid) ?? 0) + 180 < this.time.now) {
        this.areaParticleTimestamps.set(area.uid, this.time.now);
        this.emitAreaParticles(renderArea, profile);
        if (isMeleeProfile(profile) || profile.presentationKind === "aura") {
          this.spawnMeleeFx(profile, this.playerVisualState.facingAngle + area.uid * 0.7, Math.max(86, area.radius * 0.82), true);
        }
      }
      graphics.setDepth(renderArea.y - 20);
    }
    for (const [id, graphics] of this.areaGraphics) {
      if (!liveIds.has(id)) {
        graphics.destroy();
        this.areaGraphics.delete(id);
        this.areaParticleTimestamps.delete(id);
      }
    }
  }

  private syncCombatEvents(events: CombatEventState[]): void {
    const liveIds = new Set<number>();
    for (const event of events) {
      liveIds.add(event.uid);
      let graphics = this.combatEventGraphics.get(event.uid);
      const progress = Phaser.Math.Clamp(1 - event.ttl / eventLifetime(event), 0, 1);
      if (!graphics) {
        graphics = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(5200);
        this.impactLayer?.add(graphics);
        this.combatEventGraphics.set(event.uid, graphics);
        getAudioController(this).playCombatEvent(this, event);
        this.playEventImpulse(event);
        this.emitParticleBurst(event.x, event.y, vfxProfile(event.vfxKey), particleCountForEvent(event), 54 * event.intensity, 5300);
      }
      const profile = vfxProfile(event.vfxKey);
      graphics.clear();
      drawCombatEvent(graphics, event, profile, progress, this.time.now);
    }
    for (const [id, graphics] of this.combatEventGraphics) {
      if (!liveIds.has(id)) {
        graphics.destroy();
        this.combatEventGraphics.delete(id);
      }
    }
  }

  private playEventImpulse(event: CombatEventState): void {
    if (event.type === "hit") {
      return;
    }
    const duration = event.type === "evolution" || event.type === "boss" || event.type === "ultimate" ? 260 : 90;
    const intensity =
      event.type === "crit" ? 0.0045 : event.type === "playerHit" ? 0.006 : event.type === "ultimate" ? 0.0042 : 0.003 * event.intensity;
    this.cameras.main.shake(duration, intensity);
    if (event.type === "manual" || event.type === "evolution" || event.type === "morale" || event.type === "ultimate") {
      this.cameras.main.flash(event.type === "evolution" || event.type === "ultimate" ? 160 : 80, 255, 225, 160, false);
      const impulseZoom = this.cameraBaseZoom * (event.type === "ultimate" || event.type === "evolution" ? 1.035 : 1.018);
      this.cameras.main.zoomTo(impulseZoom, 80);
      this.time.delayedCall(120, () => this.cameras.main.zoomTo(this.cameraBaseZoom, 160));
    }
    if (event.type === "manual") {
      this.playHeroAttackAnimation();
    }
  }

  private applyResponsiveCameraZoom(): void {
    const { width, height } = this.scale.gameSize;
    const nextZoom = Phaser.Math.Clamp(
      Math.min(width / baseBattleViewport.width, height / baseBattleViewport.height, baseBattleViewport.maxZoom),
      baseBattleViewport.minZoom,
      baseBattleViewport.maxZoom
    );
    this.cameraBaseZoom = nextZoom;
    this.cameras.main.setZoom(nextZoom);
  }

  private playHeroAttackAnimation(): void {
    if (!this.run || !this.playerSprite) {
      return;
    }
    const art = characterArtById[this.run.hero.artId];
    const profile = vfxProfile(this.run.hero.manualAbility.vfxKey);
    this.playerVisualState.castTimer = Math.max(this.playerVisualState.castTimer, 0.7);
    if (isMeleeProfile(profile) || profile.presentationKind === "dash" || profile.presentationKind === "aura") {
      this.spawnMeleeFx(profile, this.playerVisualState.facingAngle, this.run.hero.manualAbility.radius * 1.15, true);
    }
    const frameKeys = art.attackFrameKeys.filter((key) => this.textures.exists(key));
    this.playerAttackTimers.forEach((timer) => timer.remove(false));
    this.playerAttackTimers = [];

    if (frameKeys.length < 4) {
      const baseScale = art.battleScale ?? 1;
      this.tweens.add({
        targets: this.playerSprite,
        scale: baseScale * (this.run.player.berserkTimer > 0 ? 1.22 : 1.08),
        duration: 70,
        yoyo: true,
        ease: "Quad.easeOut"
      });
      return;
    }

    this.playerAttackActive = true;
    frameKeys.forEach((key, index) => {
      const timer = this.time.delayedCall(index * 52, () => {
        this.playerSprite?.setTexture(key);
      });
      this.playerAttackTimers.push(timer);
    });
    this.playerAttackTimers.push(
      this.time.delayedCall(frameKeys.length * 52, () => {
        if (this.run && this.playerSprite) {
          this.playerSprite.setTexture(this.run.hero.spriteKey);
        }
        this.playerAttackActive = false;
      })
    );
  }

  private syncFloatingTexts(texts: FloatingTextState[]): void {
    const liveIds = new Set<number>();
    for (const item of texts) {
      liveIds.add(item.uid);
      let text = this.floatingTexts.get(item.uid);
      if (!text) {
        text = this.add
          .text(item.x, item.y, item.text, {
            fontFamily: "serif",
            fontSize: item.tone === "damage" ? "18px" : "26px",
            fontStyle: "700",
            color: textColor(item.tone),
            stroke: "#211611",
            strokeThickness: 4
          })
          .setOrigin(0.5)
          .setDepth(5000);
        this.floatingTexts.set(item.uid, text);
      }
      text.setPosition(item.x, item.y);
      text.setAlpha(Math.min(1, item.ttl * 2));
    }
    for (const [id, text] of this.floatingTexts) {
      if (!liveIds.has(id)) {
        text.destroy();
        this.floatingTexts.delete(id);
      }
    }
  }

  private spawnMeleeFx(profile: VfxProfile, rotation: number, radius: number, followPlayer: boolean): void {
    const textureKey = textureOrFallback(this, profile.textureKey, profile.animationKey ? "fx_slash_01" : profile.textureKey);
    const distance =
      profile.motionStyle === "thrust"
        ? radius * 0.54
        : profile.motionStyle === "spin" || profile.presentationKind === "aura"
          ? radius * 0.1
          : radius * 0.36;
    const id = this.nextMeleeFxId++;
    const sprite = this.add
      .sprite(
        this.playerVisualState.visualX + Math.cos(rotation) * distance,
        this.playerVisualState.visualY + Math.sin(rotation) * distance,
        textureKey
      )
      .setBlendMode(blendMode(profile))
      .setTint(profile.color)
      .setAlpha(0.84)
      .setDepth(this.playerVisualState.visualY + 220)
      .setRotation(rotation)
      .setScale(meleeScale(profile, radius));
    if (profile.animationKey && this.anims.exists(profile.animationKey) && textureKey.startsWith("fx_slash_")) {
      sprite.play(profile.animationKey);
    }
    this.impactLayer?.add(sprite);
    this.activeMeleeFx.set(id, {
      id,
      sprite,
      profile,
      createdAt: this.time.now,
      lifetimeMs: Math.max(180, profile.lifetime * 1000),
      followPlayer,
      offsetX: Math.cos(rotation) * distance,
      offsetY: Math.sin(rotation) * distance,
      baseRotation: rotation,
      baseScale: meleeScale(profile, radius)
    });
    this.playerVisualState.attackTimer = Math.max(this.playerVisualState.attackTimer, profile.motionStyle === "cast" ? 0.28 : 1);
    this.playerVisualState.castTimer = Math.max(this.playerVisualState.castTimer, profile.presentationKind === "areaField" ? 0.7 : 0.38);
  }

  private syncActiveMeleeFx(): void {
    for (const [id, fx] of this.activeMeleeFx) {
      const progress = Phaser.Math.Clamp((this.time.now - fx.createdAt) / fx.lifetimeMs, 0, 1);
      if (progress >= 1) {
        fx.sprite.destroy();
        this.activeMeleeFx.delete(id);
        continue;
      }
      if (fx.followPlayer) {
        const spin = fx.profile.motionStyle === "spin" ? progress * Math.PI * 1.45 : 0;
        const x = this.playerVisualState.visualX + fx.offsetX * (1 - progress * 0.18);
        const y = this.playerVisualState.visualY + fx.offsetY * (1 - progress * 0.18);
        fx.sprite.setPosition(x, y + this.playerVisualState.bobOffset * 0.45);
        fx.sprite.setDepth(y + 230);
        fx.sprite.setRotation(fx.baseRotation + spin);
      }
      const swell = 1 + Math.sin(progress * Math.PI) * (fx.profile.motionStyle === "thrust" ? 0.12 : 0.24);
      fx.sprite.setAlpha((1 - progress) * 0.88);
      fx.sprite.setScale(fx.baseScale * swell);
    }
  }

  private emitAreaParticles(area: AreaState, profile: VfxProfile): void {
    const count = area.vfxKey.includes("arrow") ? 2 : area.vfxKey.includes("fire") || area.vfxKey.includes("cliff") ? 4 : 3;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * (index + area.uid * 0.37)) / count + this.time.now / 420;
      const distance = area.radius * (0.25 + ((index * 37 + area.uid) % 60) / 100);
      const x = area.x + Math.cos(angle) * distance;
      const y = area.y + Math.sin(angle) * distance * 0.72;
      this.emitParticleBurst(x, y, profile, 1, Math.max(18, area.radius * 0.16), area.y + 80);
    }
  }

  private emitParticleBurst(x: number, y: number, profile: VfxProfile, count: number, spread: number, depth: number): void {
    const particleKey = profile.particleKey ?? "particle_spark";
    const textureKey = this.textures.exists(particleKey) ? particleKey : "xp_orb";
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * (index + 0.5)) / Math.max(1, count) + ((this.time.now + index * 97) % 360) * Phaser.Math.DEG_TO_RAD;
      const distance = spread * (0.35 + ((index * 29 + Math.floor(this.time.now)) % 70) / 100);
      const sprite = this.add
        .sprite(x, y, textureKey)
        .setBlendMode(blendMode(profile))
        .setTint(profile.color)
        .setDepth(depth)
        .setAlpha(0.72)
        .setScale(profile.scale * (0.035 + (index % 3) * 0.012));
      this.impactLayer?.add(sprite);
      this.tweens.add({
        targets: sprite,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance * 0.68,
        alpha: 0,
        scale: sprite.scaleX * (1.7 + (index % 3) * 0.28),
        duration: 260 + profile.lifetime * 260,
        ease: "Quad.easeOut",
        onComplete: () => sprite.destroy()
      });
    }
  }

  private lastEnemyProfile(textureKey: string): EnemyVisualProfile {
    return Object.values(enemyVisualProfiles).find((profile) => profile.spriteKey === textureKey) ?? enemyVisualProfiles.infantry;
  }

  private acquireEnemySprite(textureKey: string): Phaser.GameObjects.Sprite {
    const sprite = this.enemyPool.pop() ?? this.add.sprite(0, 0, textureKey);
    sprite.setTexture(textureKey);
    sprite.setOrigin(0.5, 0.82);
    sprite.setVisible(true);
    sprite.setActive(true);
    this.unitLayer?.add(sprite);
    return sprite;
  }

  private releaseEnemySprite(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setVisible(false);
    sprite.setActive(false);
    this.enemyPool.push(sprite);
  }

  private createRenderLayers(): void {
    this.backgroundLayer = this.add.layer().setDepth(-2000);
    this.areaLayer = this.add.layer().setDepth(-200);
    this.unitLayer = this.add.layer().setDepth(0);
    this.projectileLayer = this.add.layer().setDepth(1800);
    this.impactLayer = this.add.layer().setDepth(3600);
  }

  private createBattlefield(): void {
    if (!this.run) {
      return;
    }
    const ground = this.add.tileSprite(0, 0, this.run.world.width, this.run.world.height, "ground_tile").setOrigin(0).setDepth(-80);
    const detail = this.add
      .tileSprite(0, 0, this.run.world.width, this.run.world.height, "ground_detail_tile")
      .setOrigin(0)
      .setAlpha(0.42)
      .setDepth(-70);
    const haze = this.add.graphics().setDepth(-55);
    this.backgroundLayer?.add([ground, detail, haze]);

    haze.fillStyle(0x080407, 0.22);
    haze.fillRect(0, 0, this.run.world.width, this.run.world.height);
    haze.lineStyle(2, 0xffd98a, 0.08);
    for (let x = 360; x < this.run.world.width; x += 520) {
      haze.lineBetween(x, 0, x - 180, this.run.world.height);
    }
    haze.fillStyle(0xffd98a, 0.06);
    for (let index = 0; index < 28; index += 1) {
      const x = 220 + ((index * 719) % (this.run.world.width - 440));
      const y = 240 + ((index * 587) % (this.run.world.height - 480));
      haze.fillCircle(x, y, 2 + (index % 3));
    }

    for (let index = 0; index < 42; index += 1) {
      const x = 180 + ((index * 577) % (this.run.world.width - 360));
      const y = 180 + ((index * 821) % (this.run.world.height - 360));
      const texture = index % 7 === 0 ? "battle_banner_red" : index % 7 === 3 ? "battle_banner_jade" : index % 3 === 0 ? "battle_spear_prop" : "battle_stone_prop";
      const sprite = this.add
        .sprite(x, y, texture)
        .setDepth(y - 120)
        .setAlpha(texture.includes("banner") ? 0.64 : 0.48)
        .setScale(texture.includes("banner") ? 0.78 + (index % 4) * 0.08 : 0.55 + (index % 5) * 0.07)
        .setRotation(texture.includes("spear") ? -0.6 + (index % 5) * 0.25 : 0);
      this.backgroundLayer?.add(sprite);
    }
  }

  private installDebugHooks(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    const debugWindow = window as Window & {
      advanceTime?: (ms: number) => void;
      collectDebugXp?: (amount?: number) => void;
      render_game_to_text?: () => string;
    };
    const render = () => {
      const state = this.run;
      if (!state) {
        return JSON.stringify({ scene: "BattleScene", status: "missing" });
      }
      return JSON.stringify({
        scene: "BattleScene",
        coordinateSystem: "origin top-left; x increases right; y increases down",
        status: state.status,
        player: {
          x: Math.round(state.player.x),
          y: Math.round(state.player.y),
          hp: Math.round(state.player.hp),
          level: state.player.level,
          xp: Math.round(state.player.xp),
          nextXp: state.player.nextXp
        },
        camera: {
          zoom: Number(this.cameraBaseZoom.toFixed(3)),
          screenWidth: Math.round(this.scale.gameSize.width),
          screenHeight: Math.round(this.scale.gameSize.height),
          worldViewWidth: Math.round(this.scale.gameSize.width / this.cameraBaseZoom),
          worldViewHeight: Math.round(this.scale.gameSize.height / this.cameraBaseZoom)
        },
        enemies: state.enemies.length,
        xpOrbs: state.xpOrbs.length,
        pendingUpgradeIds: state.pendingUpgradeIds,
        modalOpen: Boolean(document.querySelector(".hud-modal.is-open"))
      });
    };
    const advanceTime = (ms: number) => {
      const stepMs = 1000 / 60;
      const steps = Math.max(1, Math.round(ms / stepMs));
      for (let index = 0; index < steps; index += 1) {
        this.update(this.time.now, stepMs);
      }
    };
    const collectXp = (amount = 200) => {
      if (!this.run) {
        return;
      }
      collectDebugXp(this.run, amount);
      this.hud?.update(this.run);
    };

    debugWindow.render_game_to_text = render;
    debugWindow.advanceTime = advanceTime;
    debugWindow.collectDebugXp = collectXp;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (debugWindow.render_game_to_text === render) {
        delete debugWindow.render_game_to_text;
      }
      if (debugWindow.advanceTime === advanceTime) {
        delete debugWindow.advanceTime;
      }
      if (debugWindow.collectDebugXp === collectXp) {
        delete debugWindow.collectDebugXp;
      }
    });
  }

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.applyResponsiveCameraZoom, this);
    this.hud?.destroy();
    this.enemySprites.clear();
    this.enemyShadows.clear();
    this.enemyFrames.clear();
    this.enemyPool = [];
    this.projectileSprites.clear();
    this.projectileTrailTimestamps.clear();
    this.xpOrbSprites.clear();
    this.xpOrbTrailTimestamps.clear();
    this.areaGraphics.clear();
    this.areaParticleTimestamps.clear();
    this.activeMeleeFx.forEach((fx) => fx.sprite.destroy());
    this.activeMeleeFx.clear();
    this.meleeProjectileTimestamps.clear();
    this.lastPlayerPosition = undefined;
    this.combatEventGraphics.clear();
    this.floatingTexts.clear();
    this.backgroundLayer = undefined;
    this.areaLayer = undefined;
    this.unitLayer = undefined;
    this.projectileLayer = undefined;
    this.impactLayer = undefined;
    this.playerGroundAura?.destroy();
    this.playerGroundAura = undefined;
    this.playerAttackTimers.forEach((timer) => timer.remove(false));
    this.playerAttackTimers = [];
  }
}

function vfxProfile(vfxKey: string): VfxProfile {
  return vfxProfiles[vfxKey] ?? { ...defaultVfxProfile, color: areaColor(vfxKey), textureKey: vfxKey };
}

function blendMode(profile: VfxProfile): Phaser.BlendModes {
  return profile.blendMode === "add" ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL;
}

function isMeleeProfile(profile: VfxProfile): boolean {
  return profile.presentationKind === "meleeArc" || profile.originMode === "playerAnchored";
}

function meleeScale(profile: VfxProfile, radius: number): number {
  const base =
    profile.motionStyle === "thrust"
      ? 0.7
      : profile.motionStyle === "spin"
        ? 0.6
        : profile.presentationKind === "aura"
          ? 0.74
          : 0.94;
  return Phaser.Math.Clamp((radius / 130) * profile.scale * base, 0.34, 1.45);
}

function textureOrFallback(scene: Phaser.Scene, preferredKey: string, fallbackKey: string): string {
  if (scene.textures.exists(preferredKey)) {
    return preferredKey;
  }
  if (scene.textures.exists(fallbackKey)) {
    return fallbackKey;
  }
  return "command";
}

function drawEnemyFrame(
  graphics: Phaser.GameObjects.Graphics,
  enemy: EnemyState,
  visual: EnemyVisualProfile,
  now: number
): void {
  graphics.clear();
  const pulse = 0.5 + Math.sin(now / 180 + enemy.uid) * 0.16;
  const color = visual.outlineColor ?? 0xffd98a;
  graphics.lineStyle(enemy.defId === "lubu" ? 4 : 2, color, pulse);
  graphics.strokeEllipse(enemy.x, enemy.y + enemy.radius * 0.18, enemy.radius * 2.45, enemy.radius * 0.92);
  graphics.lineStyle(1, 0xfff1cf, pulse * 0.35);
  graphics.strokeEllipse(enemy.x, enemy.y + enemy.radius * 0.18, enemy.radius * 1.72, enemy.radius * 0.62);
  graphics.setDepth(enemy.y - 22);
}

function drawAreaTelegraph(
  graphics: Phaser.GameObjects.Graphics,
  area: AreaState,
  profile: VfxProfile,
  now: number
): void {
  const color = profile.color;
  const pulse = Math.sin(now / 95 + area.uid) * 0.045;
  if (profile.presentationKind === "meleeArc") {
    const arc = Phaser.Math.DegToRad(profile.arcDegrees ?? 160);
    const baseAngle = now / 520 + area.uid * 0.7;
    graphics.lineStyle(Math.max(5, area.radius * 0.055), color, 0.34);
    graphics.beginPath();
    graphics.arc(area.x, area.y, area.radius * 0.72, baseAngle - arc / 2, baseAngle + arc / 2);
    graphics.strokePath();
    graphics.lineStyle(2, 0xfff1cf, 0.22);
    graphics.beginPath();
    graphics.arc(area.x, area.y, area.radius * 0.45, baseAngle - arc / 2 + 0.2, baseAngle + arc / 2 - 0.2);
    graphics.strokePath();
    return;
  }
  if (profile.presentationKind === "aura") {
    graphics.fillStyle(color, 0.08);
    graphics.fillCircle(area.x, area.y, area.radius * 0.86);
    graphics.lineStyle(3, color, 0.42);
    graphics.strokeCircle(area.x, area.y, area.radius * (0.74 + pulse));
    graphics.lineStyle(1, 0xfff1cf, 0.24);
    graphics.strokeCircle(area.x, area.y, area.radius * (0.48 - pulse));
    return;
  }
  const alpha = area.vfxKey.includes("petal") || area.vfxKey.includes("allure") ? 0.13 : area.vfxKey.includes("fire") ? 0.2 : 0.16;
  graphics.fillStyle(color, alpha);
  graphics.fillCircle(area.x, area.y, area.radius);
  graphics.lineStyle(area.vfxKey.includes("fire") ? 3 : 2, color, 0.48);
  graphics.strokeCircle(area.x, area.y, area.radius * (0.92 + pulse));
  graphics.lineStyle(1, 0xfff1cf, 0.22);
  graphics.strokeCircle(area.x, area.y, area.radius * (0.58 - pulse));

  if (profile.telegraphShape === "rain") {
    graphics.lineStyle(2, color, 0.44);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 + area.uid * 0.4;
      const x = area.x + Math.cos(angle) * area.radius * 0.62;
      const y = area.y + Math.sin(angle) * area.radius * 0.44;
      graphics.lineBetween(x - 16, y - 42, x + 8, y + 18);
    }
  } else if (profile.telegraphShape === "slash") {
    graphics.lineStyle(5, color, 0.28);
    graphics.beginPath();
    graphics.arc(area.x, area.y, area.radius * 0.72, -0.9 + pulse, 0.9 + pulse);
    graphics.strokePath();
    graphics.lineStyle(2, 0xfff1cf, 0.24);
    graphics.beginPath();
    graphics.arc(area.x, area.y, area.radius * 0.48, 2.4 - pulse, 4.2 - pulse);
    graphics.strokePath();
  } else if (profile.telegraphShape === "storm") {
    graphics.fillStyle(color, 0.18);
    for (let index = 0; index < 14; index += 1) {
      const angle = now / 420 + (Math.PI * 2 * index) / 14;
      const ring = area.radius * (0.28 + (index % 4) * 0.14);
      graphics.fillEllipse(area.x + Math.cos(angle) * ring, area.y + Math.sin(angle) * ring * 0.68, 12, 4);
    }
  } else if (profile.telegraphShape === "burst") {
    graphics.lineStyle(2, color, 0.32);
    for (let index = 0; index < 10; index += 1) {
      const angle = now / 260 + (Math.PI * 2 * index) / 10;
      graphics.lineBetween(
        area.x + Math.cos(angle) * area.radius * 0.28,
        area.y + Math.sin(angle) * area.radius * 0.28,
        area.x + Math.cos(angle) * area.radius * 0.86,
        area.y + Math.sin(angle) * area.radius * 0.86
      );
    }
  }
}

function drawCombatEvent(
  graphics: Phaser.GameObjects.Graphics,
  event: CombatEventState,
  profile: VfxProfile,
  progress: number,
  now: number
): void {
  const color = profile.color;
  const fade = 1 - progress;
  if (event.type === "hit" || event.type === "crit" || event.type === "kill" || event.type === "playerHit") {
    const radius = (event.type === "crit" ? 38 : event.type === "kill" ? 26 : 18) * event.intensity * (1 + progress * 0.85);
    graphics.fillStyle(color, 0.3 * fade);
    graphics.fillCircle(event.x, event.y, radius);
    graphics.lineStyle(event.type === "crit" ? 4 : 2, color, 0.86 * fade);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 + progress * 1.9;
      const inner = radius * 0.45;
      graphics.lineBetween(
        event.x + Math.cos(angle) * inner,
        event.y + Math.sin(angle) * inner,
        event.x + Math.cos(angle) * radius * 1.7,
        event.y + Math.sin(angle) * radius * 1.7
      );
    }
    return;
  }

  const radius = 78 * event.intensity + progress * 190 * event.intensity;
  graphics.lineStyle(event.type === "ultimate" || event.type === "evolution" ? 6 : 4, color, 0.68 * fade);
  graphics.strokeCircle(event.x, event.y, radius);
  graphics.lineStyle(2, 0xfff1cf, 0.3 * fade);
  graphics.strokeCircle(event.x, event.y, radius * 0.62);
  graphics.fillStyle(color, 0.12 * fade);
  for (let index = 0; index < 16; index += 1) {
    const angle = now / 240 + (Math.PI * 2 * index) / 16;
    graphics.fillEllipse(event.x + Math.cos(angle) * radius * 0.48, event.y + Math.sin(angle) * radius * 0.48, 14, 4);
  }
}

function particleCountForEvent(event: CombatEventState): number {
  if (event.type === "ultimate" || event.type === "evolution" || event.type === "boss") {
    return 18;
  }
  if (event.type === "crit" || event.type === "kill" || event.type === "morale") {
    return 10;
  }
  return event.type === "hit" ? 2 : 5;
}

function areaColor(vfxKey: string): number {
  if (vfxKey.includes("crit") || vfxKey.includes("level") || vfxKey.includes("evolution")) {
    return 0xffdd7a;
  }
  if (vfxKey.includes("hit") || vfxKey.includes("guard")) {
    return 0xfff1cf;
  }
  if (vfxKey.includes("morale_dragon")) {
    return 0x77f0ae;
  }
  if (vfxKey.includes("morale_banner")) {
    return 0x9db8ff;
  }
  if (vfxKey.includes("morale_fire")) {
    return 0xff6d32;
  }
  if (vfxKey.includes("fire") || vfxKey.includes("cliff")) {
    return 0xff6d32;
  }
  if (vfxKey.includes("tiger") || vfxKey.includes("wei")) {
    return 0x9db8ff;
  }
  if (vfxKey.includes("iron")) {
    return 0xffa15f;
  }
  if (vfxKey.includes("blood")) {
    return 0xff3f47;
  }
  if (vfxKey.includes("petal") || vfxKey.includes("allure")) {
    return 0xff9acb;
  }
  if (vfxKey.includes("frost")) {
    return 0x9eefff;
  }
  if (vfxKey.includes("phoenix")) {
    return 0xff8a4f;
  }
  if (vfxKey.includes("thunder")) {
    return 0xc9a8ff;
  }
  if (vfxKey.includes("moon") || vfxKey.includes("siege")) {
    return 0xffd98a;
  }
  if (vfxKey.includes("shadow")) {
    return 0xc7d2ff;
  }
  if (vfxKey.includes("dragon") || vfxKey.includes("qinglong")) {
    return 0x75f0aa;
  }
  if (vfxKey.includes("arrow") || vfxKey.includes("crossbow")) {
    return 0xffcc5a;
  }
  if (vfxKey.includes("lubu")) {
    return 0xb15cff;
  }
  return 0xaec5ff;
}

function eventLifetime(event: CombatEventState): number {
  if (event.type === "hit") {
    return 0.18;
  }
  if (event.type === "ultimate") {
    return 0.75;
  }
  return 0.45;
}

function textColor(tone: FloatingTextState["tone"]): string {
  if (tone === "heal") {
    return "#8ff0aa";
  }
  if (tone === "xp") {
    return "#ffe28c";
  }
  if (tone === "alert") {
    return "#ff9b80";
  }
  return "#fff1cf";
}
