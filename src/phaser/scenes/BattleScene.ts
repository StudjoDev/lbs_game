import Phaser from "phaser";
import {
  defaultVfxProfile,
  enemyAnimationsById,
  enemyAnimationKey,
  enemyVisualProfiles,
  hitRadialAnimationKey,
  hitRadialSpritesheet,
  hitSparkAnimationKey,
  hitSparkSpritesheet,
  visualAnimationTextureKeys,
  vfxProfiles,
  type EnemyAnimationId,
  type EnemyVisualProfile,
  type VfxProfile
} from "../../game/assets/manifest";
import type { MusicKey } from "../../game/audio/catalog";
import { revealBossDefeat } from "../../game/collection/collectionStore";
import { characterArtById } from "../../game/content/characterArt";
import { loadDisplaySettings, saveDisplaySettings, type DisplaySettings } from "../../game/display/settings";
import { ultimateByHeroId } from "../../game/content/ultimates";
import { createKeyboardBindings, readInput, type KeyboardBindings } from "../../game/input/bindings";
import {
  applyRunSettlement,
  getMetaRunBonuses,
  loadMetaProgression,
  saveMetaProgression,
  type MetaRunSettlement
} from "../../game/meta/progression";
import { applyUpgrade } from "../../game/simulation/combat";
import { createRun } from "../../game/simulation/createRun";
import { collectDebugXp, setPaused, updateRun } from "../../game/simulation/updateRun";
import type {
  AreaState,
  CombatEventState,
  EnemyId,
  EnemyState,
  FloatingTextState,
  CharacterAnimationId,
  ChapterId,
  HeroId,
  ProjectileState,
  RunState,
  XpOrbState
} from "../../game/types";
import { getAudioController } from "../audio/AudioController";
import { CombatJuiceEffects } from "../effects/CombatJuiceEffects";
import { XpPickupEffects } from "../effects/XpPickupEffects";
import { BattleHud } from "../../ui/hud";

interface BattleData {
  heroId?: HeroId;
  chapterId?: ChapterId;
}

interface PlayerVisualState {
  visualX: number;
  visualY: number;
  facingAngle: number;
  bobOffset: number;
  attackTimer: number;
  castTimer: number;
  moveBlend: number;
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
  minFinalZoom: 0.32,
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
  private xpPickupEffects?: XpPickupEffects;
  private combatJuiceEffects?: CombatJuiceEffects;
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
    moveBlend: 0,
    squashScale: 1
  };
  private lastPlayerPosition?: Phaser.Math.Vector2;
  private activeMeleeFx = new Map<number, ActiveMeleeFx>();
  private nextMeleeFxId = 1;
  private enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  private enemyShadows = new Map<number, Phaser.GameObjects.Ellipse>();
  private enemyFrames = new Map<number, Phaser.GameObjects.Graphics>();
  private enemyPool: Phaser.GameObjects.Sprite[] = [];
  private enemyHitEffectTimestamps = new Map<number, number>();
  private enemyDeathSprites = new Set<Phaser.GameObjects.Sprite>();
  private hitFxSprites = new Set<Phaser.GameObjects.Sprite>();
  private projectileSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private projectileTrailTimestamps = new Map<number, number>();
  private projectileAfterimageTimestamps = new Map<number, number>();
  private meleeProjectileTimestamps = new Map<number, number>();
  private xpOrbSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private xpOrbTrailTimestamps = new Map<number, number>();
  private areaGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private areaParticleTimestamps = new Map<number, number>();
  private combatEventGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private floatingTexts = new Map<number, Phaser.GameObjects.Text>();
  private playerAttackTimers: Phaser.Time.TimerEvent[] = [];
  private playerAttackActive = false;
  private playerAttackAnimUntil = 0;
  private playerUltimateAnimationActive = false;
  private playerUltimateAnimUntil = 0;
  private lastAutoCooldown = 0;
  private bossUnlockSaved = false;
  private resultSettled = false;
  private lastResultSfx?: "won" | "lost";
  private metaSettlement?: MetaRunSettlement;
  private cameraBaseZoom = 1;
  private displaySettings: DisplaySettings = loadDisplaySettings();
  private recentKillTimestamps: number[] = [];

  constructor() {
    super("BattleScene");
  }

  create(data: BattleData): void {
    const heroId = data.heroId ?? "guanyu";
    const chapterId = data.chapterId ?? "yellow_turbans";
    this.displaySettings = loadDisplaySettings();
    this.playerAttackTimers.forEach((timer) => timer.remove(false));
    this.playerAttackTimers = [];
    this.playerAttackActive = false;
    this.playerUltimateAnimationActive = false;
    this.playerUltimateAnimUntil = 0;
    this.bossUnlockSaved = false;
    this.resultSettled = false;
    this.lastResultSfx = undefined;
    this.metaSettlement = undefined;
    const metaProgression = loadMetaProgression();
    this.run = createRun(heroId, Date.now() >>> 0, getMetaRunBonuses(metaProgression, heroId), chapterId);
    this.lastPlayerPosition = new Phaser.Math.Vector2(this.run.player.x, this.run.player.y);
    this.playerVisualState = {
      visualX: this.run.player.x,
      visualY: this.run.player.y,
      facingAngle: Math.atan2(this.run.lastFacing.y, this.run.lastFacing.x),
      bobOffset: 0,
      attackTimer: 0,
      castTimer: 0,
      moveBlend: 0,
      squashScale: 1
    };
    this.lastAutoCooldown = this.run.player.autoCooldown;
    this.keys = createKeyboardBindings(this);
    const audio = getAudioController(this);
    audio.bindUnlock(this);
    audio.playMusic(this, "music_battle", 360);
    this.cameras.main.setBounds(0, 0, this.run.world.width, this.run.world.height);
    this.createRenderLayers();
    this.createPresentationEffects();
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
      getDisplaySettings: () => this.displaySettings,
      onDisplaySettingsChange: (settings) => {
        this.displaySettings = saveDisplaySettings(settings);
        this.applyResponsiveCameraZoom();
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
        this.scene.restart({ heroId, chapterId });
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
    this.settleMetaProgression(this.run);
    this.syncAudioState(this.run);
    this.syncRender(this.run);
    this.hud.update(this.run, this.metaSettlement);
  }

  private settleMetaProgression(state: RunState): void {
    if (this.resultSettled || (state.status !== "won" && state.status !== "lost")) {
      return;
    }
    this.resultSettled = true;
    const result = applyRunSettlement(loadMetaProgression(), {
      heroId: state.hero.id,
      status: state.status,
      kills: state.kills,
      score: state.score,
      playerLevel: state.player.level,
      bossDefeated: state.status === "won",
      factionId: state.faction.id,
      chapterId: state.chapterId,
      roomIndex: state.roomIndex,
      roomCount: state.roomCount,
      chapterCleared: state.chapterCleared
    });
    saveMetaProgression(result.state);
    this.metaSettlement = result.settlement;
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
    const hasFrameAnimation = hasCharacterAnimation(this, art.textureKey, "idle");
    if (state.player.autoCooldown > this.lastAutoCooldown + 0.12) {
      this.playHeroAttackAnimation(false);
    }
    this.lastAutoCooldown = state.player.autoCooldown;
    const powerScale = hasFrameAnimation ? 1 : (state.player.berserkTimer > 0 ? 1.14 : 1) * (ultimateActive ? 1.08 : 1);
    const squashX = hasFrameAnimation ? 1 : 1 + (1 - visual.squashScale) * 0.52;
    const squashY = hasFrameAnimation ? 1 : visual.squashScale;
    this.playerSprite.setPosition(visual.visualX, visual.visualY + (hasFrameAnimation ? 0 : visual.bobOffset));
    this.playerSprite.setDepth(state.player.y);
    this.playerSprite.setFlipX(Math.cos(visual.facingAngle) < -0.08);
    this.playerSprite.setRotation(hasFrameAnimation ? 0 : Math.sin(visual.facingAngle) * 0.025 + visual.attackTimer * 0.04);
    this.playerSprite.setScale(baseScale * powerScale * squashX, baseScale * powerScale * squashY);
    this.playerSprite.setTint(ultimateActive ? areaColor(ultimateByHeroId[state.hero.id].vfxKey) : state.player.berserkTimer > 0 ? 0xff9b80 : 0xffffff);
    this.syncPlayerAnimation(state);
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
    this.playerVisualState.moveBlend = moveBlend;
    this.playerVisualState.squashScale = 1 + Math.sin(this.time.now / 360) * 0.018 - this.playerVisualState.attackTimer * 0.08 + moveBlend * 0.018;
  }

  private syncPlayerAnimation(state: RunState): void {
    if (!this.playerSprite) {
      return;
    }
    const art = characterArtById[state.hero.artId];
    const idleKey = characterAnimationKey(art.textureKey, "idle");
    const runKey = characterAnimationKey(art.textureKey, "run");
    const hasIdleRun = this.anims.exists(idleKey) && this.anims.exists(runKey);
    if (this.playerUltimateAnimationActive && this.time.now >= this.playerUltimateAnimUntil) {
      this.playerUltimateAnimationActive = false;
    }
    if (this.playerAttackActive && this.time.now >= this.playerAttackAnimUntil) {
      this.playerAttackActive = false;
    }
    if (this.playerUltimateAnimationActive) {
      return;
    }
    if (this.playSustainedHeroUltimateAnimation(state, art)) {
      return;
    }
    if (this.playerAttackActive) {
      return;
    }
    if (!hasIdleRun) {
      if (this.playerSprite.texture.key !== state.hero.spriteKey) {
        this.playerSprite.setTexture(state.hero.spriteKey);
      }
      return;
    }
    const nextKey = this.playerVisualState.moveBlend > 0.12 ? runKey : idleKey;
    if (this.playerSprite.anims.currentAnim?.key !== nextKey) {
      this.playerSprite.play(nextKey);
    }
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
      const visual = enemyVisualProfiles[enemy.defId];
      let sprite = this.enemySprites.get(enemy.uid);
      if (!sprite) {
        sprite = this.acquireEnemySprite(enemyInitialTextureKey(this, enemy.defId, visual.spriteKey));
        sprite.setData("enemyDefId", enemy.defId);
        sprite.setData("baseTextureKey", visual.spriteKey);
        this.playEnemyAnimation(sprite, enemy.defId, "walk", true);
        this.enemySprites.set(enemy.uid, sprite);
      } else {
        sprite.setData("enemyDefId", enemy.defId);
        sprite.setData("baseTextureKey", visual.spriteKey);
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
      const healthRatio = Math.max(0, enemy.hp / enemy.maxHp);
      const flash = enemy.flashTimer > 0;
      const hasAnimatedEnemy = hasEnemyAnimation(this, enemy.defId, "walk");
      const wobble = hasAnimatedEnemy ? 0 : Math.sin(this.time.now / 180 + enemy.uid) * 0.025;
      const hitScale = flash ? (hasAnimatedEnemy ? 1.06 : 1.1) : 1;
      const baseScale = enemyRenderScale(visual, hasAnimatedEnemy) * hitScale * (enemy.stunTimer > 0 ? 0.97 : 1);
      sprite.setPosition(enemy.x, enemy.y);
      sprite.setDepth(enemy.y - 5);
      if (hasAnimatedEnemy) {
        this.syncEnemyAnimation(sprite, enemy, flash);
      } else {
        sprite.setTexture(enemyInitialTextureKey(this, enemy.defId, visual.spriteKey));
      }
      sprite.setScale(baseScale + wobble);
      sprite.setAlpha(0.78 + healthRatio * 0.22);
      sprite.setFlipX(enemyShouldFlipX(enemy, this.run?.player.x ?? enemy.x));
      shadow.setPosition(enemy.x, enemy.y + enemy.radius * 0.78);
      shadow.setSize(enemy.radius * 2.5 * visual.shadowScale, enemy.radius * 0.82);
      shadow.setDepth(enemy.y - 18);
      shadow.setAlpha(0.24 + healthRatio * 0.18);
      if (flash) {
        sprite.setTint(hasAnimatedEnemy ? 0xffffff : visual.hitTint);
        const lastHitEffectAt = this.enemyHitEffectTimestamps.get(enemy.uid) ?? 0;
        if (enemy.flashTimer > 0.09 && lastHitEffectAt + 120 < this.time.now) {
          this.enemyHitEffectTimestamps.set(enemy.uid, this.time.now);
          this.spawnHitFx({
            x: enemy.x,
            y: enemy.y - enemy.radius * 0.15,
            angle: this.run ? Math.atan2(enemy.y - this.run.player.y, enemy.x - this.run.player.x) : 0,
            radius: enemy.radius,
            intensity: enemy.defId === "lubu" ? 1.6 : visual.eliteFrame ? 1.25 : 0.85,
            color: 0xfff1cf,
            critical: visual.eliteFrame !== undefined,
            depth: enemy.y + 90
          });
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
        const defId = this.enemyIdFromSprite(sprite);
        const profile = enemyVisualProfiles[defId] ?? this.lastEnemyProfile(sprite.getData("baseTextureKey") ?? sprite.texture.key);
        this.emitParticleBurst(sprite.x, sprite.y, vfxProfile(profile.deathFxKey), profile.eliteFrame ? 10 : 4, 42 * profile.shadowScale, sprite.y + 120);
        if (profile.eliteFrame) {
          this.combatJuiceEffects?.renderEliteDeathBurst({
            x: sprite.x,
            y: sprite.y,
            radius: defId === "lubu" ? 72 : 46,
            intensity: defId === "lubu" ? 1.6 : 1.15,
            color: profile.outlineColor,
            depth: sprite.y + 130
          });
        } else {
          this.combatJuiceEffects?.renderDeathPuff({
            x: sprite.x,
            y: sprite.y,
            radius: 28 * profile.shadowScale,
            intensity: 0.9,
            depth: sprite.y + 110
          });
        }
        this.spawnEnemyDeathAnimation(defId, sprite, profile);
        this.releaseEnemySprite(sprite);
        this.enemySprites.delete(id);
        this.enemyShadows.get(id)?.destroy();
        this.enemyShadows.delete(id);
        this.enemyFrames.get(id)?.destroy();
        this.enemyFrames.delete(id);
        this.enemyHitEffectTimestamps.delete(id);
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
        const animation = playableAnimationForProfile(this, profile);
        sprite = this.add
          .sprite(projectile.x, projectile.y, textureOrFallback(this, profile.textureKey, animation?.textureKey ?? projectile.vfxKey))
          .setBlendMode(blendMode(profile))
          .setTint(profile.color);
        applyProfileTint(sprite, profile);
        if (animation) {
          sprite.play(animation.animationKey);
        }
        sprite.setData("vfxKey", projectile.vfxKey);
        this.projectileLayer?.add(sprite);
        this.projectileSprites.set(projectile.uid, sprite);
        this.emitProjectileAfterimage(sprite, profile, true);
      }
      sprite.setPosition(projectile.x, projectile.y);
      sprite.setRotation(Math.atan2(projectile.vy, projectile.vx));
      sprite.setDepth(projectile.y + 20);
      applyProfileTint(sprite, profile);
      sprite.setBlendMode(blendMode(profile));
      sprite.setScale(Math.max(0.55, projectile.radius / 30) * profile.scale);
      if ((this.projectileAfterimageTimestamps.get(projectile.uid) ?? 0) + projectileAfterimageInterval(projectile.vfxKey) < this.time.now) {
        this.projectileAfterimageTimestamps.set(projectile.uid, this.time.now);
        this.emitProjectileAfterimage(sprite, profile);
      }
      if ((this.projectileTrailTimestamps.get(projectile.uid) ?? 0) + 118 < this.time.now) {
        this.projectileTrailTimestamps.set(projectile.uid, this.time.now);
        this.emitParticleBurst(projectile.x, projectile.y, profile, 1, Math.max(8, projectile.radius * 0.55), projectile.y + 10);
      }
    }
    for (const [id, sprite] of this.projectileSprites) {
      if (!liveIds.has(id)) {
        const profile = vfxProfile((sprite.getData("vfxKey") as string | undefined) ?? sprite.texture.key);
        this.emitProjectileAfterimage(sprite, profile, true);
        this.emitParticleBurst(sprite.x, sprite.y, profile, 3, 22, sprite.y + 40);
        sprite.destroy();
        this.projectileSprites.delete(id);
        this.projectileTrailTimestamps.delete(id);
        this.projectileAfterimageTimestamps.delete(id);
      }
    }
    for (const id of this.meleeProjectileTimestamps.keys()) {
      if (!liveIds.has(id)) {
        this.meleeProjectileTimestamps.delete(id);
      }
    }
  }

  private syncXpOrbs(orbs: XpOrbState[]): void {
    if (this.xpPickupEffects) {
      this.xpPickupEffects.syncOrbs(orbs, { x: this.playerVisualState.visualX, y: this.playerVisualState.visualY }, this.time.now);
      return;
    }
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
        } else {
          this.spawnProfileAnimation(profile, renderArea.x, renderArea.y, area.radius, renderArea.y + 96, area.uid * 0.25);
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
      const profile = vfxProfile(event.vfxKey);
      if (!graphics) {
        graphics = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(5200);
        this.impactLayer?.add(graphics);
        this.combatEventGraphics.set(event.uid, graphics);
        getAudioController(this).playCombatEvent(this, event);
        this.playEventImpulse(event);
        this.renderCombatJuiceEvent(event, profile);
        if (!usesGraphicsOnlyHitEvent(event)) {
          this.spawnProfileAnimation(profile, event.x, event.y, 84 * event.intensity, 5360, event.uid * 0.17);
          this.emitParticleBurst(event.x, event.y, profile, particleCountForEvent(event), 54 * event.intensity, 5300);
        }
      }
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
    const shakeScale = Phaser.Math.Clamp(this.displaySettings.screenShake, 0, 1.25);
    if (shakeScale > 0) {
      this.cameras.main.shake(duration, intensity * shakeScale);
    }
    if (event.type === "manual" || event.type === "evolution" || event.type === "morale" || event.type === "ultimate") {
      this.cameras.main.flash(event.type === "evolution" || event.type === "ultimate" ? 160 : 80, 255, 225, 160, false);
      const impulseZoom = this.cameraBaseZoom * (event.type === "ultimate" || event.type === "evolution" ? 1.04 : 1.018);
      this.cameras.main.zoomTo(impulseZoom, 80);
      this.time.delayedCall(120, () => this.cameras.main.zoomTo(this.cameraBaseZoom, 160));
    }
    if (event.type === "ultimate" && event.intensity >= 1.1) {
      this.playHeroUltimateAnimation(event.vfxKey);
    }
    if (event.type === "manual") {
      this.playHeroAttackAnimation();
    }
  }

  private createPresentationEffects(): void {
    if (this.projectileLayer && this.impactLayer) {
      this.xpPickupEffects = new XpPickupEffects({
        scene: this,
        orbLayer: this.projectileLayer,
        effectLayer: this.impactLayer
      });
      this.combatJuiceEffects = new CombatJuiceEffects(this, {
        layer: this.impactLayer,
        depth: 3600
      });
    }
  }

  private renderCombatJuiceEvent(event: CombatEventState, profile: VfxProfile): void {
    if (event.type === "hit" || event.type === "crit" || event.type === "playerHit") {
      const directionAngle =
        event.type === "playerHit" && this.run
          ? Math.atan2(this.run.player.y - event.y, this.run.player.x - event.x)
          : this.run
            ? Math.atan2(event.y - this.run.player.y, event.x - this.run.player.x)
            : 0;
      this.spawnHitFx({
        x: event.x,
        y: event.y,
        angle: directionAngle,
        radius: event.type === "crit" ? 34 : event.type === "playerHit" ? 30 : 22,
        intensity: event.intensity,
        color: profile.color,
        critical: event.type === "crit",
        depth: 5350
      });
      return;
    }
    if (event.type === "kill") {
      const killDensity = this.registerKillPulse();
      const intensity = event.intensity + Math.min(1.15, killDensity * 0.08);
      this.combatJuiceEffects?.renderCollapseBurst({
        x: event.x,
        y: event.y,
        radius: 28 * intensity,
        intensity,
        color: profile.color,
        depth: 5350
      });
      if (killDensity >= 4) {
        this.combatJuiceEffects?.renderBriefOutline({
          x: event.x,
          y: event.y,
          radius: 28 + Math.min(28, killDensity * 4),
          intensity: Math.min(1.8, 0.85 + killDensity * 0.08),
          color: profile.color,
          critical: killDensity >= 8,
          depth: 5352
        });
      }
      return;
    }
    if (event.type === "levelUp" || event.type === "evolution") {
      this.xpPickupEffects?.emitPickupPulse({
        playerPosition: { x: this.playerVisualState.visualX, y: this.playerVisualState.visualY },
        now: this.time.now,
        count: event.type === "evolution" ? 4 : 2,
        intensity: event.type === "evolution" ? 1.8 : 1.15
      });
    }
  }

  private registerKillPulse(): number {
    const now = this.time.now;
    this.recentKillTimestamps = this.recentKillTimestamps.filter((timestamp) => now - timestamp < 900);
    this.recentKillTimestamps.push(now);
    if (this.recentKillTimestamps.length > 24) {
      this.recentKillTimestamps.splice(0, this.recentKillTimestamps.length - 24);
    }
    return this.recentKillTimestamps.length;
  }

  private spawnHitFx(options: {
    x: number;
    y: number;
    angle: number;
    radius: number;
    intensity: number;
    color: number;
    critical: boolean;
    depth: number;
  }): void {
    const animationKey = options.critical ? hitRadialAnimationKey : hitSparkAnimationKey;
    const spritesheet = options.critical ? hitRadialSpritesheet : hitSparkSpritesheet;
    if (!this.anims.exists(animationKey) || !this.textures.exists(spritesheet.key)) {
      return;
    }
    const effectScale = Phaser.Math.Clamp(this.displaySettings.effectsIntensity, 0.5, 1.25);
    const scaleBase = options.critical
      ? Phaser.Math.Clamp((options.radius / 72) * options.intensity, 0.36, 0.78)
      : Phaser.Math.Clamp((options.radius / 16) * options.intensity, 1.25, 2.8);
    const scale = scaleBase * effectScale;
    const sprite = this.add
      .sprite(options.x, options.y, spritesheet.key, 0)
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(options.depth)
      .setAlpha(Phaser.Math.Clamp((options.critical ? 0.76 : 0.88) * (0.78 + effectScale * 0.22), 0.36, 1))
      .setRotation(options.critical ? options.angle * 0.25 : options.angle)
      .setScale(scale);
    if (options.critical) {
      sprite.setTint(options.color);
    }
    this.impactLayer?.add(sprite);
    this.hitFxSprites.add(sprite);
    sprite.once(Phaser.GameObjects.Events.DESTROY, () => this.hitFxSprites.delete(sprite));
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
    sprite.play(animationKey);
  }

  private syncEnemyAnimation(sprite: Phaser.GameObjects.Sprite, enemy: EnemyState, flash: boolean): void {
    const walkKey = enemyAnimationKey(enemy.defId, "walk");
    const hitKey = enemyAnimationKey(enemy.defId, "hit");
    const currentKey = sprite.anims.currentAnim?.key;
    const playingHit = currentKey === hitKey && sprite.anims.isPlaying;
    if (flash && !playingHit && this.anims.exists(hitKey) && (this.enemyHitEffectTimestamps.get(enemy.uid) ?? 0) + 120 < this.time.now) {
      this.playEnemyAnimation(sprite, enemy.defId, "hit", true);
      return;
    }
    if (!playingHit && (currentKey !== walkKey || !sprite.anims.isPlaying)) {
      this.playEnemyAnimation(sprite, enemy.defId, "walk");
    }
  }

  private playEnemyAnimation(
    sprite: Phaser.GameObjects.Sprite,
    enemyId: EnemyId,
    animationId: EnemyAnimationId,
    restart = false
  ): void {
    const key = enemyAnimationKey(enemyId, animationId);
    if (!this.anims.exists(key)) {
      return;
    }
    if (restart || sprite.anims.currentAnim?.key !== key) {
      sprite.play(key, restart);
    }
  }

  private spawnEnemyDeathAnimation(
    enemyId: EnemyId,
    source: Phaser.GameObjects.Sprite,
    profile: EnemyVisualProfile
  ): void {
    const key = enemyAnimationKey(enemyId, "death");
    const frameKey = enemyAnimationsById[enemyId]?.death.frameKeys[0] ?? profile.spriteKey;
    if (!this.anims.exists(key) || !this.textures.exists(frameKey)) {
      return;
    }
    const sprite = this.add
      .sprite(source.x, source.y, frameKey)
      .setOrigin(0.5, 0.82)
      .setDepth(source.depth + 2)
      .setFlipX(source.flipX)
      .setScale(enemyRenderScale(profile, true))
      .setAlpha(source.alpha);
    this.unitLayer?.add(sprite);
    this.enemyDeathSprites.add(sprite);
    sprite.once(Phaser.GameObjects.Events.DESTROY, () => this.enemyDeathSprites.delete(sprite));
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.tweens.add({
        targets: sprite,
        alpha: 0,
        y: sprite.y + 8,
        duration: 120,
        ease: "Quad.easeOut",
        onComplete: () => sprite.destroy()
      });
    });
    sprite.play(key);
  }

  private applyResponsiveCameraZoom(): void {
    const { width, height } = this.scale.gameSize;
    const responsiveZoom = Phaser.Math.Clamp(
      Math.min(width / baseBattleViewport.width, height / baseBattleViewport.height, baseBattleViewport.maxZoom),
      baseBattleViewport.minZoom,
      baseBattleViewport.maxZoom
    );
    const nextZoom = Phaser.Math.Clamp(
      responsiveZoom / this.displaySettings.viewScale,
      baseBattleViewport.minFinalZoom,
      baseBattleViewport.maxZoom
    );
    this.cameraBaseZoom = nextZoom;
    this.cameras.main.setZoom(nextZoom);
  }

  private playHeroUltimateAnimation(vfxKey: string): void {
    if (!this.run || !this.playerSprite) {
      return;
    }
    const art = characterArtById[this.run.hero.artId];
    const profile = vfxProfile(vfxKey);
    const ultimateAnimation = art.animations?.ultimate;
    const ultimateAnimationKey = ultimateByHeroId[this.run.hero.id].ultimateAnimationKey;
    this.playerAttackTimers.forEach((timer) => timer.remove(false));
    this.playerAttackTimers = [];
    this.playerAttackActive = false;
    this.playerAttackAnimUntil = 0;
    this.playerVisualState.attackTimer = Math.max(this.playerVisualState.attackTimer, 1.15);
    this.playerVisualState.castTimer = Math.max(this.playerVisualState.castTimer, 0.9);
    if (isMeleeProfile(profile) || profile.presentationKind === "dash" || profile.presentationKind === "aura") {
      this.spawnMeleeFx(profile, this.playerVisualState.facingAngle, Math.max(112, this.run.hero.manualAbility.radius * 1.35), true);
    }
    if (ultimateAnimation && this.anims.exists(ultimateAnimationKey)) {
      this.playerUltimateAnimationActive = true;
      this.playerUltimateAnimUntil = this.time.now + (ultimateAnimation.frameKeys.length / ultimateAnimation.frameRate) * 1000;
      this.playerSprite.play(ultimateAnimationKey);
      return;
    }
    this.playerUltimateAnimationActive = true;
    this.playerUltimateAnimUntil = this.time.now + 360;
    this.time.delayedCall(360, () => {
      this.playerUltimateAnimationActive = false;
      this.playerUltimateAnimUntil = 0;
    });
  }

  private playSustainedHeroUltimateAnimation(state: RunState, art = characterArtById[state.hero.artId]): boolean {
    if (!this.playerSprite || state.player.ultimateTimer <= 0) {
      return false;
    }
    const ultimateAnimation = art.animations?.ultimate;
    const ultimateAnimationKey = ultimateByHeroId[state.hero.id].ultimateAnimationKey;
    if (!ultimateAnimation || !this.anims.exists(ultimateAnimationKey)) {
      return false;
    }
    this.playerAttackTimers.forEach((timer) => timer.remove(false));
    this.playerAttackTimers = [];
    this.playerAttackActive = false;
    this.playerAttackAnimUntil = 0;
    if (this.playerSprite.anims.currentAnim?.key !== ultimateAnimationKey || !this.playerSprite.anims.isPlaying) {
      this.playerSprite.play(ultimateAnimationKey, true);
    }
    return true;
  }

  private playHeroAttackAnimation(includeManualFx = true): void {
    if (!this.run || !this.playerSprite) {
      return;
    }
    if (this.playerUltimateAnimationActive) {
      return;
    }
    const art = characterArtById[this.run.hero.artId];
    if (this.playSustainedHeroUltimateAnimation(this.run, art)) {
      return;
    }
    const profile = vfxProfile(this.run.hero.manualAbility.vfxKey);
    this.playerVisualState.attackTimer = Math.max(this.playerVisualState.attackTimer, includeManualFx ? 1 : 0.58);
    if (includeManualFx) {
      this.playerVisualState.castTimer = Math.max(this.playerVisualState.castTimer, 0.7);
    }
    if (includeManualFx && (isMeleeProfile(profile) || profile.presentationKind === "dash" || profile.presentationKind === "aura")) {
      this.spawnMeleeFx(profile, this.playerVisualState.facingAngle, this.run.hero.manualAbility.radius * 1.15, true);
    }
    const attackAnimation = art.animations?.attack;
    const attackAnimationKey = characterAnimationKey(art.textureKey, "attack");
    const frameKeys = art.attackFrameKeys.filter((key) => this.textures.exists(key));
    this.playerAttackTimers.forEach((timer) => timer.remove(false));
    this.playerAttackTimers = [];

    if (attackAnimation && this.anims.exists(attackAnimationKey)) {
      this.playerAttackActive = true;
      this.playerAttackAnimUntil = this.time.now + (attackAnimation.frameKeys.length / attackAnimation.frameRate) * 1000;
      this.playerSprite.play(attackAnimationKey);
      return;
    }

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
        this.playerAttackAnimUntil = 0;
      })
    );
  }

  private syncFloatingTexts(texts: FloatingTextState[]): void {
    const liveIds = new Set<number>();
    const visibleTexts = this.displaySettings.showDamageNumbers ? texts : texts.filter((item) => item.tone !== "damage");
    for (const item of visibleTexts) {
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
    const animation = playableAnimationForMeleeFx(this, profile);
    const textureKey = textureOrFallback(this, profile.textureKey, animation?.textureKey ?? profile.textureKey);
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
      .setOrigin(0.5)
      .setBlendMode(blendMode(profile))
      .setAlpha(0.84)
      .setDepth(this.playerVisualState.visualY + 220)
      .setRotation(rotation)
      .setScale(meleeScale(profile, radius));
    applyProfileTint(sprite, profile);
    if (animation) {
      sprite.play(animation.animationKey);
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
        const x = this.playerVisualState.visualX + fx.offsetX;
        const y = this.playerVisualState.visualY + fx.offsetY;
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
      if (profile.telegraphShape === "rain") {
        this.renderRainStreak(x, y, profile, area.radius, area.y + 85);
        continue;
      }
      this.emitParticleBurst(x, y, profile, 1, Math.max(18, area.radius * 0.16), area.y + 80);
    }
  }

  private renderRainStreak(x: number, y: number, profile: VfxProfile, radius: number, depth: number): void {
    const effectScale = Phaser.Math.Clamp(this.displaySettings.effectsIntensity, 0.5, 1.25);
    const graphics = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setAlpha(0.72 * effectScale);
    const length = Phaser.Math.Clamp(radius * 0.55, 32, 78);
    graphics.lineStyle(Math.max(2, radius * 0.018), profile.color, 0.72);
    graphics.lineBetween(x - length * 0.28, y - length, x + length * 0.14, y + length * 0.22);
    graphics.lineStyle(1, 0xfff1cf, 0.34);
    graphics.lineBetween(x - length * 0.12, y - length * 0.68, x + length * 0.22, y + length * 0.16);
    graphics.fillStyle(profile.color, 0.26);
    graphics.fillEllipse(x + length * 0.14, y + length * 0.24, radius * 0.24, radius * 0.08);
    this.impactLayer?.add(graphics);
    this.tweens.add({
      targets: graphics,
      y: graphics.y + 22,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 170,
      ease: "Quad.easeOut",
      onComplete: () => graphics.destroy()
    });
  }

  private emitProjectileAfterimage(sprite: Phaser.GameObjects.Sprite, profile: VfxProfile, burst = false): void {
    const effectScale = Phaser.Math.Clamp(this.displaySettings.effectsIntensity, 0.5, 1.25);
    const offset = burst ? 0 : Math.max(8, sprite.displayWidth * 0.16);
    const startX = sprite.x - Math.cos(sprite.rotation) * offset;
    const startY = sprite.y - Math.sin(sprite.rotation) * offset;
    const ghost = this.add
      .sprite(startX, startY, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY)
      .setRotation(sprite.rotation)
      .setScale(sprite.scaleX * (burst ? 1.05 : 0.82), sprite.scaleY * (burst ? 1.05 : 0.72))
      .setAlpha(Phaser.Math.Clamp((burst ? 0.34 : 0.24) * effectScale, 0.12, 0.42))
      .setDepth(sprite.depth - 1)
      .setBlendMode(blendMode(profile));
    applyProfileTint(ghost, profile);
    this.projectileLayer?.add(ghost);
    this.hitFxSprites.add(ghost);
    ghost.once(Phaser.GameObjects.Events.DESTROY, () => this.hitFxSprites.delete(ghost));
    this.tweens.add({
      targets: ghost,
      x: startX - Math.cos(sprite.rotation) * (burst ? 2 : 12),
      y: startY - Math.sin(sprite.rotation) * (burst ? 2 : 12),
      alpha: 0,
      scaleX: ghost.scaleX * (burst ? 1.45 : 1.9),
      scaleY: ghost.scaleY * (burst ? 1.25 : 0.58),
      duration: burst ? 135 : 185,
      ease: "Quad.easeOut",
      onComplete: () => ghost.destroy()
    });
  }

  private spawnProfileAnimation(profile: VfxProfile, x: number, y: number, radius: number, depth: number, rotation: number): void {
    const animation = playableAnimationForProfile(this, profile);
    if (!animation) {
      return;
    }
    const effectScale = Phaser.Math.Clamp(this.displaySettings.effectsIntensity, 0.45, 1.15);
    const scale = Phaser.Math.Clamp((radius / 220) * profile.scale * effectScale, 0.22, 1.25);
    const sprite = this.add
      .sprite(x, y, animation.textureKey)
      .setOrigin(0.5)
      .setBlendMode(blendMode(profile))
      .setDepth(depth)
      .setRotation(rotation)
      .setAlpha(Phaser.Math.Clamp(0.42 + effectScale * 0.18, 0.34, 0.72))
      .setScale(scale);
    applyProfileTint(sprite, profile);
    this.impactLayer?.add(sprite);
    this.hitFxSprites.add(sprite);
    sprite.once(Phaser.GameObjects.Events.DESTROY, () => this.hitFxSprites.delete(sprite));
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.tweens.add({
        targets: sprite,
        alpha: 0,
        scale: sprite.scaleX * 1.12,
        duration: 90,
        ease: "Quad.easeOut",
        onComplete: () => sprite.destroy()
      });
    });
    sprite.play(animation.animationKey);
  }

  private emitParticleBurst(x: number, y: number, profile: VfxProfile, count: number, spread: number, depth: number): void {
    const effectScale = Phaser.Math.Clamp(this.displaySettings.effectsIntensity, 0.5, 1.25);
    const adjustedCount = count > 0 ? Math.max(1, Math.round(count * effectScale)) : 0;
    if (adjustedCount <= 0) {
      return;
    }
    const particleKey = profile.particleKey ?? "particle_spark";
    const textureKey = this.textures.exists(particleKey) ? particleKey : "xp_orb";
    const staticBurst = usesStaticParticleBurst(profile);
    for (let index = 0; index < adjustedCount; index += 1) {
      const angle =
        (Math.PI * 2 * (index + 0.5)) / Math.max(1, adjustedCount) + ((this.time.now + index * 97) % 360) * Phaser.Math.DEG_TO_RAD;
      const distance = staticBurst ? Math.min(10, spread * 0.16) : spread * (0.18 + ((index * 17 + Math.floor(this.time.now)) % 32) / 100);
      const startX = x + (staticBurst ? Math.cos(angle) * distance : 0);
      const startY = y + (staticBurst ? Math.sin(angle) * distance * 0.62 : 0);
      const sprite = this.add
        .sprite(startX, startY, textureKey)
        .setBlendMode(blendMode(profile))
        .setDepth(depth)
        .setAlpha(Phaser.Math.Clamp(0.56 + effectScale * 0.16, 0.42, 0.82))
        .setScale(profile.scale * effectScale * (0.035 + (index % 3) * 0.012));
      applyProfileTint(sprite, profile);
      this.impactLayer?.add(sprite);
      this.tweens.add({
        targets: sprite,
        x: staticBurst ? startX : x + Math.cos(angle) * distance,
        y: staticBurst ? startY : y + Math.sin(angle) * distance * 0.68,
        alpha: 0,
        rotation: sprite.rotation + (staticBurst ? 0.35 : 0),
        scale: sprite.scaleX * (staticBurst ? 2.4 : 1.55 + (index % 3) * 0.22),
        duration: staticBurst ? 150 + profile.lifetime * 180 : 240 + profile.lifetime * 220,
        ease: "Quad.easeOut",
        onComplete: () => sprite.destroy()
      });
    }
  }

  private lastEnemyProfile(textureKey: string): EnemyVisualProfile {
    return Object.values(enemyVisualProfiles).find((profile) => profile.spriteKey === textureKey) ?? enemyVisualProfiles.infantry;
  }

  private enemyIdFromSprite(sprite: Phaser.GameObjects.Sprite): EnemyId {
    const enemyId = sprite.getData("enemyDefId") as EnemyId | undefined;
    if (enemyId && enemyId in enemyVisualProfiles) {
      return enemyId;
    }
    const baseTextureKey = sprite.getData("baseTextureKey") ?? sprite.texture.key;
    return (
      (Object.entries(enemyVisualProfiles).find(([, profile]) => profile.spriteKey === baseTextureKey)?.[0] as EnemyId | undefined) ??
      "infantry"
    );
  }

  private acquireEnemySprite(textureKey: string): Phaser.GameObjects.Sprite {
    const sprite = this.enemyPool.pop() ?? this.add.sprite(0, 0, textureKey);
    sprite.stop();
    sprite.setTexture(textureKey);
    sprite.setOrigin(0.5, 0.82);
    sprite.setVisible(true);
    sprite.setActive(true);
    sprite.setAlpha(1);
    sprite.clearTint();
    this.unitLayer?.add(sprite);
    return sprite;
  }

  private releaseEnemySprite(sprite: Phaser.GameObjects.Sprite): void {
    sprite.stop();
    sprite.clearTint();
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
      const texture =
        index % 9 === 0
          ? "battle_cloth_red"
          : index % 9 === 4
            ? "battle_cloth_jade"
            : index % 3 === 0
              ? "battle_spear_prop"
              : "battle_stone_prop";
      const isCloth = texture.includes("cloth");
      const isSpear = texture.includes("spear");
      const sprite = this.add
        .sprite(x, y, texture)
        .setDepth(y - 180)
        .setAlpha(isCloth ? 0.2 : isSpear ? 0.28 : 0.18)
        .setScale(isCloth ? 0.72 + (index % 3) * 0.05 : isSpear ? 0.5 + (index % 4) * 0.04 : 0.46 + (index % 5) * 0.04)
        .setRotation(isCloth ? -0.28 + (index % 5) * 0.14 : isSpear ? -0.88 + (index % 7) * 0.22 : -0.18 + (index % 4) * 0.12);
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
          nextXp: state.player.nextXp,
          ultimateTimer: Number(state.player.ultimateTimer.toFixed(2)),
          animation: this.playerSprite?.anims.currentAnim?.key ?? null,
          animationPlaying: this.playerSprite?.anims.isPlaying ?? false,
          texture: this.playerSprite?.texture.key ?? null
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
        objective: {
          title: state.objective.title,
          progress: state.objective.progress,
          goal: state.objective.goal
        },
        chapter: {
          id: state.chapterId,
          name: state.chapterName,
          room: state.roomIndex + 1,
          roomCount: state.roomCount,
          roomType: state.roomType,
          doorOpen: state.doorOpen,
          cleared: state.chapterCleared
        },
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
    this.enemyHitEffectTimestamps.clear();
    this.enemyDeathSprites.forEach((sprite) => sprite.destroy());
    this.enemyDeathSprites.clear();
    this.hitFxSprites.forEach((sprite) => sprite.destroy());
    this.hitFxSprites.clear();
    this.enemyPool = [];
    this.projectileSprites.clear();
    this.projectileTrailTimestamps.clear();
    this.projectileAfterimageTimestamps.clear();
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
    this.xpPickupEffects?.destroy();
    this.xpPickupEffects = undefined;
    this.combatJuiceEffects?.cleanup();
    this.combatJuiceEffects = undefined;
    this.playerGroundAura?.destroy();
    this.playerGroundAura = undefined;
    this.playerAttackTimers.forEach((timer) => timer.remove(false));
    this.playerAttackTimers = [];
    this.playerAttackActive = false;
    this.playerAttackAnimUntil = 0;
    this.playerUltimateAnimationActive = false;
    this.playerUltimateAnimUntil = 0;
    this.recentKillTimestamps = [];
  }
}

function vfxProfile(vfxKey: string): VfxProfile {
  return vfxProfiles[vfxKey] ?? { ...defaultVfxProfile, color: areaColor(vfxKey), textureKey: vfxKey };
}

function blendMode(profile: VfxProfile): Phaser.BlendModes {
  return profile.blendMode === "add" ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL;
}

function animationKeysForProfile(profile: VfxProfile): readonly string[] {
  if (profile.animationKeys && profile.animationKeys.length > 0) {
    return profile.animationKeys;
  }
  return profile.animationKey ? [profile.animationKey] : [];
}

function playableAnimationForProfile(
  scene: Phaser.Scene,
  profile: VfxProfile
): { animationKey: string; textureKey: string } | undefined {
  for (const animationKey of animationKeysForProfile(profile)) {
    const textureKey = visualAnimationTextureKeys[animationKey];
    if (textureKey && scene.anims.exists(animationKey) && scene.textures.exists(textureKey)) {
      return { animationKey, textureKey };
    }
  }
  return undefined;
}

function playableAnimationForMeleeFx(
  scene: Phaser.Scene,
  profile: VfxProfile
): { animationKey: string; textureKey: string } | undefined {
  if (profile.presentationKind === "meleeArc") {
    return undefined;
  }
  return playableAnimationForProfile(scene, profile);
}

function applyProfileTint(sprite: Phaser.GameObjects.Sprite, profile: VfxProfile): Phaser.GameObjects.Sprite {
  if (profile.nativeColor) {
    sprite.clearTint();
    return sprite;
  }
  return sprite.setTint(profile.color);
}

function characterAnimationKey(textureKey: string, animationId: CharacterAnimationId): string {
  return `${textureKey}_${animationId}`;
}

function hasCharacterAnimation(scene: Phaser.Scene, textureKey: string, animationId: CharacterAnimationId): boolean {
  return scene.anims.exists(characterAnimationKey(textureKey, animationId));
}

function hasEnemyAnimation(scene: Phaser.Scene, enemyId: EnemyId, animationId: EnemyAnimationId): boolean {
  return scene.anims.exists(enemyAnimationKey(enemyId, animationId));
}

function enemyInitialTextureKey(scene: Phaser.Scene, enemyId: EnemyId, fallbackKey: string): string {
  const frameKey = enemyAnimationsById[enemyId]?.walk.frameKeys[0];
  return frameKey && scene.textures.exists(frameKey) ? frameKey : fallbackKey;
}

function enemyShouldFlipX(enemy: EnemyState, playerX: number): boolean {
  return enemy.defId === "archer" ? enemy.x > playerX : enemy.x < playerX;
}

function enemyRenderScale(visual: EnemyVisualProfile, animated: boolean): number {
  return animated ? (visual.animationScale ?? visual.baseScale * 0.72) : visual.baseScale;
}

function isMeleeProfile(profile: VfxProfile): boolean {
  return profile.presentationKind === "meleeArc" || profile.originMode === "playerAnchored";
}

function usesStaticParticleBurst(profile: VfxProfile): boolean {
  return isMeleeProfile(profile) || profile.textureKey === "melee_arc" || profile.particleKey === "particle_spark";
}

function projectileAfterimageInterval(vfxKey: string): number {
  if (vfxKey.includes("fire") || vfxKey.includes("phoenix")) {
    return 42;
  }
  if (vfxKey.includes("arrow") || vfxKey.includes("crossbow")) {
    return 52;
  }
  if (vfxKey.includes("enemy")) {
    return 76;
  }
  return 58;
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
  const shimmer = 0.5 + Math.sin(now / 145 + area.uid * 0.37) * 0.5;
  if (profile.presentationKind === "meleeArc") {
    const arc = Phaser.Math.DegToRad(profile.arcDegrees ?? 160);
    const baseAngle = now / 520 + area.uid * 0.7;
    graphics.fillStyle(color, 0.06 + shimmer * 0.04);
    graphics.fillCircle(area.x, area.y, area.radius * 0.42);
    graphics.lineStyle(Math.max(5, area.radius * 0.055), color, 0.34);
    graphics.beginPath();
    graphics.arc(area.x, area.y, area.radius * 0.72, baseAngle - arc / 2, baseAngle + arc / 2);
    graphics.strokePath();
    graphics.lineStyle(2, 0xfff1cf, 0.22);
    graphics.beginPath();
    graphics.arc(area.x, area.y, area.radius * 0.45, baseAngle - arc / 2 + 0.2, baseAngle + arc / 2 - 0.2);
    graphics.strokePath();
    graphics.lineStyle(2, color, 0.22);
    for (let index = 0; index < 5; index += 1) {
      const slashAngle = baseAngle - arc * 0.42 + (arc * index) / 4;
      graphics.lineBetween(
        area.x + Math.cos(slashAngle) * area.radius * 0.28,
        area.y + Math.sin(slashAngle) * area.radius * 0.28,
        area.x + Math.cos(slashAngle) * area.radius * 0.82,
        area.y + Math.sin(slashAngle) * area.radius * 0.82
      );
    }
    return;
  }
  if (profile.presentationKind === "aura") {
    graphics.fillStyle(color, 0.08);
    graphics.fillCircle(area.x, area.y, area.radius * 0.86);
    graphics.lineStyle(3, color, 0.42);
    graphics.strokeCircle(area.x, area.y, area.radius * (0.74 + pulse));
    graphics.lineStyle(1, 0xfff1cf, 0.24);
    graphics.strokeCircle(area.x, area.y, area.radius * (0.48 - pulse));
    graphics.lineStyle(2, color, 0.22);
    for (let index = 0; index < 12; index += 1) {
      const angle = now / 650 + (Math.PI * 2 * index) / 12;
      graphics.lineBetween(
        area.x + Math.cos(angle) * area.radius * 0.58,
        area.y + Math.sin(angle) * area.radius * 0.58,
        area.x + Math.cos(angle) * area.radius * 0.74,
        area.y + Math.sin(angle) * area.radius * 0.74
      );
    }
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
      graphics.fillStyle(color, 0.18 + shimmer * 0.08);
      graphics.fillEllipse(x + 8, y + 18, area.radius * 0.12, area.radius * 0.04);
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
    graphics.lineStyle(2, color, 0.24);
    for (let index = 0; index < 4; index += 1) {
      const angle = -0.72 + index * 0.48 + pulse;
      graphics.lineBetween(
        area.x + Math.cos(angle) * area.radius * 0.24,
        area.y + Math.sin(angle) * area.radius * 0.24,
        area.x + Math.cos(angle) * area.radius * 0.9,
        area.y + Math.sin(angle) * area.radius * 0.9
      );
    }
  } else if (profile.telegraphShape === "storm") {
    graphics.fillStyle(color, 0.18);
    for (let index = 0; index < 14; index += 1) {
      const angle = now / 420 + (Math.PI * 2 * index) / 14;
      const ring = area.radius * (0.28 + (index % 4) * 0.14);
      graphics.fillEllipse(area.x + Math.cos(angle) * ring, area.y + Math.sin(angle) * ring * 0.68, 12, 4);
    }
    graphics.lineStyle(2, color, 0.3);
    for (let index = 0; index < 3; index += 1) {
      const radius = area.radius * (0.34 + index * 0.18);
      graphics.beginPath();
      graphics.arc(area.x, area.y, radius, now / 760 + index * 1.7, now / 760 + index * 1.7 + Math.PI * 0.9);
      graphics.strokePath();
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
    graphics.lineStyle(2, 0xfff1cf, 0.18 + shimmer * 0.12);
    graphics.strokeCircle(area.x, area.y, area.radius * (0.24 + shimmer * 0.18));
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
  if (event.type === "hit" || event.type === "crit" || event.type === "playerHit") {
    return;
  }
  if (event.type === "kill") {
    const radius = 26 * event.intensity * (1 + progress * 0.85);
    graphics.fillStyle(color, 0.3 * fade);
    graphics.fillCircle(event.x, event.y, radius);
    graphics.lineStyle(2, color, 0.86 * fade);
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

function usesGraphicsOnlyHitEvent(event: CombatEventState): boolean {
  return event.type === "hit" || event.type === "crit" || event.type === "playerHit";
}

function areaColor(vfxKey: string): number {
  const explicitProfile = vfxProfiles[vfxKey];
  if (explicitProfile) {
    return explicitProfile.color;
  }
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
