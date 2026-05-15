import Phaser from "phaser";
import { vfxProfiles } from "../../game/assets/manifest";
import { characterArtById } from "../../game/content/characterArt";
import { heroes } from "../../game/content/heroes";
import type { CharacterAnimationId, CharacterArtDef, HeroId } from "../../game/types";

export interface MenuTrainingGroundState {
  visible: boolean;
  heroId?: HeroId;
  companionHeroIds?: readonly HeroId[];
}

const dummyTextureKey = "menu_training_dummy";

export class MenuTrainingGroundView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly floor: Phaser.GameObjects.Graphics;
  private readonly props: Phaser.GameObjects.Sprite[] = [];
  private readonly dummies: Phaser.GameObjects.Sprite[] = [];
  private readonly companions: Phaser.GameObjects.Sprite[] = [];
  private readonly companionEffects: Phaser.GameObjects.Sprite[] = [];
  private readonly fxLayer: Phaser.GameObjects.Container;
  private readonly mainSprite: Phaser.GameObjects.Sprite;
  private readonly mainEffect: Phaser.GameObjects.Sprite;
  private readonly floorTile?: Phaser.GameObjects.TileSprite;
  private attackEvent?: Phaser.Time.TimerEvent;
  private companionEvent?: Phaser.Time.TimerEvent;
  private selectedHeroId: HeroId = "diaochan";
  private companionHeroIds: HeroId[] = [];
  private lastWidth = 0;
  private lastHeight = 0;
  private mainBaseScale = 1;
  private mainX = 0;
  private mainY = 0;
  private attackUntil = 0;
  private visible = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.ensureTrainingDummyTexture();

    this.root = scene.add.container(0, 0).setDepth(0);
    this.background = scene.add.graphics();
    this.floorTile = scene.textures.exists("ground_tile") ? scene.add.tileSprite(0, 0, 1, 1, "ground_tile") : undefined;
    this.floor = scene.add.graphics();
    this.fxLayer = scene.add.container(0, 0);
    this.mainSprite = scene.add.sprite(0, 0, "hero_diaochan");
    this.mainEffect = scene.add.sprite(0, 0, "hero_diaochan").setVisible(false).setAlpha(0);

    this.root.add(this.background);
    if (this.floorTile) {
      this.root.add(this.floorTile);
    }
    this.root.add(this.floor);
    this.createProps();
    this.createDummies();
    this.createCompanions();
    this.root.add(this.fxLayer);
    this.root.add(this.mainSprite);
    this.root.add(this.mainEffect);

    this.setState({ visible: true, heroId: this.selectedHeroId });
    this.layout(true);
    this.attackEvent = scene.time.addEvent({ delay: 2350, loop: true, callback: () => this.playTrainingBurst() });
    this.companionEvent = scene.time.addEvent({ delay: 3100, loop: true, callback: () => this.playCompanionDrill() });
  }

  setState(state: MenuTrainingGroundState): void {
    this.visible = state.visible;
    this.root.setVisible(state.visible);
    if (!state.visible) {
      return;
    }

    const nextHeroId = state.heroId ?? this.selectedHeroId;
    const nextCompanions = [...(state.companionHeroIds ?? [])].filter((heroId) => heroId !== nextHeroId).slice(0, 2);
    const heroChanged = nextHeroId !== this.selectedHeroId;
    const companionsChanged = nextCompanions.join("|") !== this.companionHeroIds.join("|");
    this.selectedHeroId = nextHeroId;
    this.companionHeroIds = nextCompanions;

    if (heroChanged) {
      this.configureMainHero();
      this.flashArrival();
    }
    if (heroChanged || companionsChanged) {
      this.configureCompanions();
    }
    this.layout(true);
  }

  update(time: number): void {
    if (!this.visible) {
      return;
    }
    const width = this.scene.scale.gameSize.width;
    const height = this.scene.scale.gameSize.height;
    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.layout(true);
    }
    if (this.floorTile) {
      this.floorTile.tilePositionX = time * 0.018;
      this.floorTile.tilePositionY = time * 0.006;
    }

    const breathing = Math.sin(time / 420) * 4;
    const attacking = time < this.attackUntil;
    const lunge = attacking ? Math.sin(((this.attackUntil - time) / 680) * Math.PI) * -28 : 0;
    this.mainSprite.setPosition(this.mainX + lunge, this.mainY + breathing);
    this.mainSprite.setScale(this.mainBaseScale * (attacking ? 1.04 : 1), this.mainBaseScale * (attacking ? 0.98 : 1));
    this.syncEffectTransform(this.mainSprite, this.mainEffect);

    this.companions.forEach((sprite, index) => {
      const offset = Math.sin(time / 360 + index * 1.7) * 3;
      sprite.y = Number(sprite.getData("baseY") ?? sprite.y) + offset;
      const effect = this.companionEffects[index];
      if (effect) {
        this.syncEffectTransform(sprite, effect);
      }
    });
  }

  destroy(): void {
    this.attackEvent?.remove(false);
    this.companionEvent?.remove(false);
    this.root.destroy(true);
  }

  getDebugState(): object {
    return {
      visible: this.visible,
      heroId: this.selectedHeroId,
      companionHeroIds: this.companionHeroIds,
      mainAnimation: this.mainSprite.anims.currentAnim?.key ?? null,
      mainTexture: this.mainSprite.texture.key,
      dummies: this.dummies.length,
      width: this.lastWidth,
      height: this.lastHeight
    };
  }

  private createProps(): void {
    const propKeys = ["battle_legacy_banner_red", "battle_legacy_banner_jade", "battle_spear_prop", "battle_stone_prop"];
    for (let index = 0; index < 10; index += 1) {
      const key = propKeys[index % propKeys.length];
      if (!this.scene.textures.exists(key)) {
        continue;
      }
      const sprite = this.scene.add.sprite(0, 0, key).setAlpha(index < 2 ? 0.74 : 0.42);
      this.props.push(sprite);
      this.root.add(sprite);
    }
  }

  private createDummies(): void {
    for (let index = 0; index < 2; index += 1) {
      const dummy = this.scene.add.sprite(0, 0, dummyTextureKey).setOrigin(0.5, 0.86).setAlpha(0.88);
      this.dummies.push(dummy);
      this.root.add(dummy);
    }
  }

  private createCompanions(): void {
    for (let index = 0; index < 2; index += 1) {
      const sprite = this.scene.add.sprite(0, 0, "hero_diaochan").setOrigin(0.5, 0.82).setAlpha(0.86);
      const effect = this.scene.add.sprite(0, 0, "hero_diaochan").setVisible(false).setAlpha(0);
      this.companions.push(sprite);
      this.companionEffects.push(effect);
      this.root.add(sprite);
      this.root.add(effect);
    }
  }

  private configureMainHero(): void {
    const art = this.selectedArt();
    this.mainSprite
      .setTexture(this.scene.textures.exists(art.textureKey) ? art.textureKey : art.battleImage)
      .setOrigin(art.anchor.x, art.anchor.y)
      .clearTint()
      .setFlipX(false);
    this.playCharacterAnimation(this.mainSprite, art, "idle", false);
    this.playEffectOverlay(this.mainEffect, this.mainSprite, art, "idle", false);
  }

  private configureCompanions(): void {
    const fallbackCompanions = heroes
      .filter((hero) => hero.id !== this.selectedHeroId && hero.factionId === this.selectedHero().factionId)
      .map((hero) => hero.id);
    const companionIds = [...this.companionHeroIds, ...fallbackCompanions].filter((heroId, index, list) => list.indexOf(heroId) === index).slice(0, 2);
    this.companions.forEach((sprite, index) => {
      const heroId = companionIds[index];
      const art = heroId ? characterArtById[heroId] : undefined;
      const effect = this.companionEffects[index];
      if (!art || !this.scene.textures.exists(art.textureKey)) {
        sprite.setVisible(false);
        effect?.setVisible(false);
        return;
      }
      sprite
        .setVisible(true)
        .setTexture(art.textureKey)
        .setOrigin(art.anchor.x, art.anchor.y)
        .clearTint();
      this.playCharacterAnimation(sprite, art, "idle", false);
      if (effect) {
        this.playEffectOverlay(effect, sprite, art, "idle", false);
      }
    });
  }

  private layout(force = false): void {
    const width = this.scene.scale.gameSize.width;
    const height = this.scene.scale.gameSize.height;
    if (!force && width === this.lastWidth && height === this.lastHeight) {
      return;
    }
    this.lastWidth = width;
    this.lastHeight = height;
    const mobile = width < 760;
    this.mainX = width * (mobile ? 0.52 : 0.5);
    this.mainY = height * (mobile ? 0.51 : 0.68);
    this.mainBaseScale = (this.selectedArt().battleScale ?? 0.72) * (mobile ? 1.02 : 1.56);

    this.background.clear();
    this.background.fillStyle(0x10110e, 1);
    this.background.fillRect(0, 0, width, height);
    this.background.fillStyle(0x1f1d15, 0.92);
    this.background.fillRect(0, height * 0.54, width, height * 0.46);
    this.background.lineStyle(1, 0xd9ad5f, 0.1);
    for (let x = -120; x < width + 120; x += 46) {
      this.background.lineBetween(x, height * 0.54, x + 170, height);
    }
    this.background.lineStyle(2, 0x5e6b49, 0.12);
    for (let y = height * 0.6; y < height; y += 42) {
      this.background.lineBetween(0, y, width, y + 18);
    }

    if (this.floorTile) {
      this.floorTile.setPosition(width / 2, height * 0.73).setSize(width, Math.max(260, height * 0.48)).setAlpha(0.34);
    }

    this.floor.clear();
    this.floor.fillStyle(0x000000, 0.24);
    this.floor.fillEllipse(this.mainX, this.mainY + 42, mobile ? 330 : 560, mobile ? 78 : 116);
    this.floor.lineStyle(2, 0xd9ad5f, 0.22);
    this.floor.strokeEllipse(this.mainX, this.mainY + 42, mobile ? 330 : 560, mobile ? 78 : 116);
    this.floor.fillStyle(this.selectedColor(), 0.11);
    this.floor.fillEllipse(this.mainX, this.mainY + 18, mobile ? 260 : 430, mobile ? 48 : 74);

    this.mainSprite.setPosition(this.mainX, this.mainY).setScale(this.mainBaseScale);
    this.syncEffectTransform(this.mainSprite, this.mainEffect);
    this.layoutProps(width, height, mobile);
    this.layoutDummies(width, height, mobile);
    this.layoutCompanions(width, height, mobile);
  }

  private layoutProps(width: number, height: number, mobile: boolean): void {
    const positions = [
      { x: width * 0.16, y: height * 0.55, scale: mobile ? 0.48 : 0.68, rotation: -0.06 },
      { x: width * 0.84, y: height * 0.55, scale: mobile ? 0.48 : 0.68, rotation: 0.08 },
      { x: width * 0.26, y: height * 0.75, scale: mobile ? 0.42 : 0.56, rotation: -0.76 },
      { x: width * 0.73, y: height * 0.76, scale: mobile ? 0.42 : 0.56, rotation: 0.64 },
      { x: width * 0.38, y: height * 0.82, scale: mobile ? 0.36 : 0.48, rotation: -0.12 },
      { x: width * 0.62, y: height * 0.83, scale: mobile ? 0.36 : 0.48, rotation: 0.16 },
      { x: width * 0.1, y: height * 0.78, scale: mobile ? 0.32 : 0.46, rotation: -0.25 },
      { x: width * 0.91, y: height * 0.8, scale: mobile ? 0.32 : 0.46, rotation: 0.22 },
      { x: width * 0.46, y: height * 0.9, scale: mobile ? 0.3 : 0.42, rotation: -0.1 },
      { x: width * 0.56, y: height * 0.91, scale: mobile ? 0.3 : 0.42, rotation: 0.1 }
    ];
    this.props.forEach((sprite, index) => {
      const position = positions[index];
      sprite.setPosition(position.x, position.y).setScale(position.scale).setRotation(position.rotation);
    });
  }

  private layoutDummies(width: number, height: number, mobile: boolean): void {
    const spread = mobile ? width * 0.24 : width * 0.14;
    const y = height * (mobile ? 0.57 : 0.71);
    this.dummies.forEach((dummy, index) => {
      const side = index === 0 ? -1 : 1;
      dummy.setPosition(this.mainX + spread * side, y).setScale(mobile ? 0.72 : 0.92);
    });
  }

  private layoutCompanions(width: number, height: number, mobile: boolean): void {
    const spread = mobile ? width * 0.34 : width * 0.21;
    const y = height * (mobile ? 0.61 : 0.75);
    this.companions.forEach((sprite, index) => {
      const side = index === 0 ? -1 : 1;
      const scale = (characterArtById[this.companionHeroIds[index]]?.battleScale ?? 0.72) * (mobile ? 0.52 : 0.7);
      sprite.setPosition(this.mainX + spread * side, y).setData("baseY", y).setScale(scale).setFlipX(side > 0);
      const effect = this.companionEffects[index];
      if (effect) {
        this.syncEffectTransform(sprite, effect);
      }
    });
  }

  private playTrainingBurst(): void {
    if (!this.visible) {
      return;
    }
    const art = this.selectedArt();
    this.attackUntil = this.scene.time.now + 680;
    this.playCharacterAnimation(this.mainSprite, art, "attack", true);
    this.playEffectOverlay(this.mainEffect, this.mainSprite, art, "attack", true);
    this.scene.time.delayedCall(560, () => {
      if (this.visible && this.selectedArt() === art) {
        this.playCharacterAnimation(this.mainSprite, art, "idle", false);
        this.playEffectOverlay(this.mainEffect, this.mainSprite, art, "idle", false);
      }
    });
    this.spawnStrikeFx();
    this.dummies.forEach((dummy, index) => {
      this.scene.tweens.add({
        targets: dummy,
        x: dummy.x + (index === 0 ? -14 : 14),
        angle: index === 0 ? -5 : 5,
        scaleX: dummy.scaleX * 1.06,
        yoyo: true,
        duration: 90,
        ease: "Sine.easeOut"
      });
    });
  }

  private playCompanionDrill(): void {
    if (!this.visible) {
      return;
    }
    this.companions.forEach((sprite, index) => {
      if (!sprite.visible) {
        return;
      }
      const art = characterArtById[this.companionHeroIds[index]];
      if (!art) {
        return;
      }
      this.playCharacterAnimation(sprite, art, "attack", true);
      const effect = this.companionEffects[index];
      if (effect) {
        this.playEffectOverlay(effect, sprite, art, "attack", true);
      }
      this.scene.time.delayedCall(460, () => {
        this.playCharacterAnimation(sprite, art, "idle", false);
        if (effect) {
          this.playEffectOverlay(effect, sprite, art, "idle", false);
        }
      });
    });
  }

  private spawnStrikeFx(): void {
    const hero = this.selectedHero();
    const profile = vfxProfiles[hero.autoAbility.vfxKey] ?? vfxProfiles[hero.manualAbility.vfxKey];
    const textureKey =
      profile && this.scene.textures.exists(profile.textureKey)
        ? profile.textureKey
        : this.scene.textures.exists("melee_arc")
          ? "melee_arc"
          : "xp_orb";
    const color = profile?.color ?? this.selectedColor();
    const fx = this.scene.add
      .sprite(this.mainX + (this.mainSprite.flipX ? -88 : 88), this.mainY - 105, textureKey)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color)
      .setAlpha(0.82)
      .setRotation(this.mainSprite.flipX ? Math.PI : 0)
      .setScale(this.lastWidth < 760 ? 0.62 : 0.86);
    this.fxLayer.add(fx);
    this.scene.tweens.add({
      targets: fx,
      alpha: 0,
      scaleX: fx.scaleX * 1.35,
      scaleY: fx.scaleY * 1.2,
      duration: 430,
      ease: "Cubic.easeOut",
      onComplete: () => fx.destroy()
    });
  }

  private flashArrival(): void {
    const ring = this.scene.add
      .sprite(this.mainX, this.mainY + 10, this.scene.textures.exists("particle_circle") ? "particle_circle" : "xp_orb")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(this.selectedColor())
      .setAlpha(0.5)
      .setScale(4.4);
    this.fxLayer.add(ring);
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 7.2,
      duration: 620,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private playCharacterAnimation(
    sprite: Phaser.GameObjects.Sprite,
    art: CharacterArtDef,
    animationId: CharacterAnimationId,
    restart: boolean
  ): boolean {
    const key = characterAnimationKey(art.textureKey, animationId);
    if (!this.scene.anims.exists(key)) {
      if (this.scene.textures.exists(art.textureKey) && sprite.texture.key !== art.textureKey) {
        sprite.setTexture(art.textureKey);
      }
      return false;
    }
    if (restart || sprite.anims.currentAnim?.key !== key || !sprite.anims.isPlaying) {
      sprite.play(key, restart);
    }
    return true;
  }

  private playEffectOverlay(
    effect: Phaser.GameObjects.Sprite,
    source: Phaser.GameObjects.Sprite,
    art: CharacterArtDef,
    animationId: CharacterAnimationId,
    restart: boolean
  ): boolean {
    const overlay = art.animations?.[animationId]?.effectOverlay;
    const key = characterAnimationEffectOverlayKey(art.textureKey, animationId);
    if (!overlay || !this.scene.anims.exists(key)) {
      effect.setVisible(false).setAlpha(0);
      return false;
    }
    this.syncEffectTransform(source, effect);
    effect
      .setVisible(true)
      .setAlpha(overlay.alpha)
      .setBlendMode(overlay.blendMode === "add" ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (restart || effect.anims.currentAnim?.key !== key || !effect.anims.isPlaying) {
      effect.play(key, restart);
      if (overlay.repeat === 0) {
        effect.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => effect.setVisible(false).setAlpha(0));
      }
    }
    return true;
  }

  private syncEffectTransform(source: Phaser.GameObjects.Sprite, effect: Phaser.GameObjects.Sprite): void {
    effect
      .setPosition(source.x, source.y)
      .setOrigin(source.originX, source.originY)
      .setScale(source.scaleX, source.scaleY)
      .setFlipX(source.flipX)
      .setRotation(source.rotation);
  }

  private selectedHero() {
    return heroes.find((hero) => hero.id === this.selectedHeroId) ?? heroes[0];
  }

  private selectedArt(): CharacterArtDef {
    return characterArtById[this.selectedHero().artId];
  }

  private selectedColor(): number {
    return Phaser.Display.Color.HexStringToColor(this.selectedArt().palette.accent).color;
  }

  private ensureTrainingDummyTexture(): void {
    if (this.scene.textures.exists(dummyTextureKey)) {
      return;
    }
    const texture = this.scene.textures.createCanvas(dummyTextureKey, 96, 150)!;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 96, 150);
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(48, 135, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a3926";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(48, 38);
    ctx.lineTo(48, 129);
    ctx.moveTo(23, 66);
    ctx.lineTo(73, 66);
    ctx.stroke();
    const gradient = ctx.createLinearGradient(26, 28, 72, 104);
    gradient.addColorStop(0, "#d5b273");
    gradient.addColorStop(1, "#71512d");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#eed190";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(25, 26, 46, 76, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(79, 37, 26, 0.78)";
    ctx.font = "700 30px serif";
    ctx.textAlign = "center";
    ctx.fillText("武", 48, 76);
    texture.refresh();
  }
}

function characterAnimationKey(textureKey: string, animationId: CharacterAnimationId): string {
  return `${textureKey}_${animationId}`;
}

function characterAnimationEffectOverlayKey(textureKey: string, animationId: CharacterAnimationId): string {
  return `${textureKey}_${animationId}_effect_overlay`;
}
