import Phaser from "phaser";
import { revealBossDefeat } from "../../game/collection/collectionStore";
import { characterArtById } from "../../game/content/characterArt";
import { enemyById } from "../../game/content/enemies";
import { createKeyboardBindings, readInput, type KeyboardBindings } from "../../game/input/bindings";
import { applyUpgrade } from "../../game/simulation/combat";
import { createRun } from "../../game/simulation/createRun";
import { setPaused, updateRun } from "../../game/simulation/updateRun";
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
import { BattleHud } from "../../ui/hud";

interface BattleData {
  heroId?: HeroId;
}

export class BattleScene extends Phaser.Scene {
  private run?: RunState;
  private keys?: KeyboardBindings;
  private hud?: BattleHud;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private playerGroundAura?: Phaser.GameObjects.Graphics;
  private manualQueued = false;
  private enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  private enemyPool: Phaser.GameObjects.Sprite[] = [];
  private projectileSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private xpOrbSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private areaGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private combatEventGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private floatingTexts = new Map<number, Phaser.GameObjects.Text>();
  private playerAttackTimers: Phaser.Time.TimerEvent[] = [];
  private playerAttackActive = false;
  private bossUnlockSaved = false;

  constructor() {
    super("BattleScene");
  }

  create(data: BattleData): void {
    const heroId = data.heroId ?? "guanyu";
    this.playerAttackTimers.forEach((timer) => timer.remove(false));
    this.playerAttackTimers = [];
    this.playerAttackActive = false;
    this.bossUnlockSaved = false;
    this.run = createRun(heroId, Date.now() >>> 0);
    this.keys = createKeyboardBindings(this);
    this.cameras.main.setBounds(0, 0, this.run.world.width, this.run.world.height);
    this.add.tileSprite(0, 0, this.run.world.width, this.run.world.height, "ground_tile").setOrigin(0);
    this.createBattlefieldDressings();
    const art = characterArtById[this.run.hero.artId];
    this.playerSprite = this.add
      .sprite(this.run.player.x, this.run.player.y, this.run.hero.spriteKey)
      .setOrigin(art.anchor.x, art.anchor.y)
      .setScale(art.battleScale ?? 1)
      .setDepth(1000);
    this.playerGroundAura = this.add.graphics();
    this.cameras.main.startFollow(this.playerSprite, true, 0.11, 0.11);
    this.cameras.main.setZoom(1);
    this.hud = new BattleHud({
      onManual: () => {
        this.manualQueued = true;
      },
      onPause: () => {
        if (this.run) {
          setPaused(this.run, true);
        }
      },
      onResume: () => {
        if (this.run) {
          setPaused(this.run, false);
        }
      },
      onUpgrade: (upgradeId) => {
        if (this.run) {
          applyUpgrade(this.run, upgradeId);
        }
      },
      onRestart: () => {
        this.scene.restart({ heroId });
      },
      onMenu: () => {
        this.scene.start("MenuScene");
      }
    });
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
    this.syncFloatingTexts(state.floatingTexts);
  }

  private syncPlayer(state: RunState): void {
    if (!this.playerSprite) {
      return;
    }
    const art = characterArtById[state.hero.artId];
    const baseScale = art.battleScale ?? 1;
    this.playerSprite.setPosition(state.player.x, state.player.y);
    this.playerSprite.setDepth(state.player.y);
    this.playerSprite.setScale(baseScale * (state.player.berserkTimer > 0 ? 1.14 : 1));
    this.playerSprite.setTint(state.player.berserkTimer > 0 ? 0xff9b80 : 0xffffff);
    if (!this.playerAttackActive && this.playerSprite.texture.key !== state.hero.spriteKey) {
      this.playerSprite.setTexture(state.hero.spriteKey);
    }
    this.syncPlayerGroundAura(state, baseScale);
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
    const x = state.player.x;
    const y = state.player.y - 5;

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
    this.playerGroundAura.setDepth(state.player.y - 4);
  }

  private syncEnemies(enemies: EnemyState[]): void {
    const liveIds = new Set<number>();
    for (const enemy of enemies) {
      liveIds.add(enemy.uid);
      let sprite = this.enemySprites.get(enemy.uid);
      if (!sprite) {
        sprite = this.acquireEnemySprite(enemyById[enemy.defId].spriteKey);
        this.enemySprites.set(enemy.uid, sprite);
      }
      const healthRatio = Math.max(0, enemy.hp / enemy.maxHp);
      sprite.setPosition(enemy.x, enemy.y);
      sprite.setDepth(enemy.y - 5);
      sprite.setScale(enemy.defId === "lubu" ? 1.14 : 1);
      sprite.setAlpha(0.72 + healthRatio * 0.28);
      if (enemy.flashTimer > 0) {
        sprite.setTint(0xffffff);
        sprite.setScale((enemy.defId === "lubu" ? 1.14 : 1) * 1.08);
      } else {
        sprite.setTint(enemy.burnTimer > 0 ? 0xff9e57 : 0xffffff);
      }
    }
    for (const [id, sprite] of this.enemySprites) {
      if (!liveIds.has(id)) {
        this.releaseEnemySprite(sprite);
        this.enemySprites.delete(id);
      }
    }
  }

  private syncProjectiles(projectiles: ProjectileState[]): void {
    const liveIds = new Set<number>();
    for (const projectile of projectiles) {
      liveIds.add(projectile.uid);
      let sprite = this.projectileSprites.get(projectile.uid);
      if (!sprite) {
        sprite = this.add.sprite(projectile.x, projectile.y, projectile.vfxKey).setBlendMode(Phaser.BlendModes.ADD);
        this.projectileSprites.set(projectile.uid, sprite);
      }
      sprite.setPosition(projectile.x, projectile.y);
      sprite.setRotation(Math.atan2(projectile.vy, projectile.vx));
      sprite.setDepth(projectile.y + 20);
      sprite.setScale(Math.max(0.55, projectile.radius / 30));
    }
    for (const [id, sprite] of this.projectileSprites) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        this.projectileSprites.delete(id);
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
        this.xpOrbSprites.set(orb.uid, sprite);
      }
      sprite.setPosition(orb.x, orb.y);
      sprite.setDepth(orb.y - 30);
      sprite.setScale(orb.value >= 20 ? 0.95 : 0.65);
      sprite.setAlpha(0.72 + Math.sin(this.time.now / 120 + orb.uid) * 0.18);
    }
    for (const [id, sprite] of this.xpOrbSprites) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        this.xpOrbSprites.delete(id);
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
        this.areaGraphics.set(area.uid, graphics);
      }
      const color = areaColor(area.vfxKey);
      graphics.clear();
      graphics.fillStyle(color, Math.min(0.28, 0.1 + area.ttl * 0.08));
      graphics.fillCircle(area.x, area.y, area.radius);
      graphics.lineStyle(2, color, 0.55);
      graphics.strokeCircle(area.x, area.y, area.radius * (0.85 + Math.sin(this.time.now / 80) * 0.05));
      if (area.vfxKey.includes("petal") || area.vfxKey.includes("allure")) {
        graphics.fillStyle(0xffb7d6, 0.34);
        for (let index = 0; index < 12; index += 1) {
          const angle = this.time.now / 260 + (Math.PI * 2 * index) / 12;
          const ring = area.radius * (0.38 + (index % 3) * 0.18);
          graphics.fillEllipse(area.x + Math.cos(angle) * ring, area.y + Math.sin(angle) * ring, 10, 4);
        }
      }
      graphics.setDepth(area.y - 20);
    }
    for (const [id, graphics] of this.areaGraphics) {
      if (!liveIds.has(id)) {
        graphics.destroy();
        this.areaGraphics.delete(id);
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
        this.combatEventGraphics.set(event.uid, graphics);
        this.playEventImpulse(event);
      }
      const color = areaColor(event.vfxKey);
      graphics.clear();
      if (event.type === "hit" || event.type === "crit" || event.type === "kill" || event.type === "playerHit") {
        const radius = (event.type === "crit" ? 34 : 18) * event.intensity * (1 + progress * 0.7);
        graphics.fillStyle(color, 0.35 * (1 - progress));
        graphics.fillCircle(event.x, event.y, radius);
        graphics.lineStyle(event.type === "crit" ? 4 : 2, color, 0.85 * (1 - progress));
        for (let index = 0; index < 6; index += 1) {
          const angle = (Math.PI * 2 * index) / 6 + progress * 1.7;
          graphics.lineBetween(event.x, event.y, event.x + Math.cos(angle) * radius * 1.6, event.y + Math.sin(angle) * radius * 1.6);
        }
      } else {
        const radius = 90 * event.intensity + progress * 180 * event.intensity;
        graphics.lineStyle(5, color, 0.75 * (1 - progress));
        graphics.strokeCircle(event.x, event.y, radius);
        graphics.lineStyle(2, 0xfff1cf, 0.35 * (1 - progress));
        graphics.strokeCircle(event.x, event.y, radius * 0.62);
      }
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
    const duration = event.type === "evolution" || event.type === "boss" ? 260 : 90;
    const intensity = event.type === "crit" ? 0.0045 : event.type === "playerHit" ? 0.006 : 0.003 * event.intensity;
    this.cameras.main.shake(duration, intensity);
    if (event.type === "manual" || event.type === "evolution" || event.type === "morale") {
      this.cameras.main.flash(event.type === "evolution" ? 160 : 80, 255, 225, 160, false);
    }
    if (event.type === "manual") {
      this.playHeroAttackAnimation();
    }
  }

  private playHeroAttackAnimation(): void {
    if (!this.run || !this.playerSprite) {
      return;
    }
    const art = characterArtById[this.run.hero.artId];
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

  private acquireEnemySprite(textureKey: string): Phaser.GameObjects.Sprite {
    const sprite = this.enemyPool.pop() ?? this.add.sprite(0, 0, textureKey);
    sprite.setTexture(textureKey);
    sprite.setVisible(true);
    sprite.setActive(true);
    return sprite;
  }

  private releaseEnemySprite(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setVisible(false);
    sprite.setActive(false);
    this.enemyPool.push(sprite);
  }

  private createBattlefieldDressings(): void {
    if (!this.run) {
      return;
    }
    const graphics = this.add.graphics();
    graphics.lineStyle(3, 0xd2a45f, 0.2);
    for (let x = 320; x < this.run.world.width; x += 320) {
      graphics.lineBetween(x, 0, x, this.run.world.height);
    }
    for (let y = 320; y < this.run.world.height; y += 320) {
      graphics.lineBetween(0, y, this.run.world.width, y);
    }
    graphics.fillStyle(0x61251f, 0.5);
    for (let index = 0; index < 18; index += 1) {
      const x = 260 + ((index * 577) % (this.run.world.width - 520));
      const y = 260 + ((index * 821) % (this.run.world.height - 520));
      graphics.fillTriangle(x, y, x + 52, y + 18, x, y + 58);
      graphics.lineStyle(4, 0x2d2218, 0.65);
      graphics.lineBetween(x, y, x, y + 110);
    }
    graphics.setDepth(-20);
  }

  private cleanup(): void {
    this.hud?.destroy();
    this.enemySprites.clear();
    this.enemyPool = [];
    this.projectileSprites.clear();
    this.xpOrbSprites.clear();
    this.areaGraphics.clear();
    this.combatEventGraphics.clear();
    this.floatingTexts.clear();
    this.playerGroundAura?.destroy();
    this.playerGroundAura = undefined;
    this.playerAttackTimers.forEach((timer) => timer.remove(false));
    this.playerAttackTimers = [];
  }
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
  if (vfxKey.includes("arrow")) {
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
