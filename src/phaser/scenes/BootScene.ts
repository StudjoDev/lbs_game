import Phaser from "phaser";
import {
  audioAssetEntries,
  enemyBaseAssetEntries,
  enemyAnimationAssetEntries,
  enemyAnimationsById,
  enemyAnimationKey,
  hitRadialAnimationKey,
  hitRadialSpritesheet,
  hitSparkAnimationKey,
  hitSparkSpritesheet,
  slashAnimationFrames,
  slashAnimationKey,
  visualAssetEntries,
  visualSpritesheetEntries,
  type EnemyAnimationDef,
  type EnemyAnimationId
} from "../../game/assets/manifest";
import { characterArts } from "../../game/content/characterArt";
import type { CharacterAnimationDef } from "../../game/types";

interface HeroLook {
  key: string;
  portrait: string;
  glyph: string;
  primary: string;
  accent: string;
  weapon: "glaive" | "spear" | "sword" | "blade" | "fan" | "bow";
}

const heroLooks: HeroLook[] = [
  { key: "hero_guanyu", portrait: "portrait_guanyu", glyph: "關", primary: "#28634d", accent: "#d6a23b", weapon: "glaive" },
  { key: "hero_zhaoyun", portrait: "portrait_zhaoyun", glyph: "趙", primary: "#2f8d76", accent: "#e7e8df", weapon: "spear" },
  { key: "hero_caocao", portrait: "portrait_caocao", glyph: "曹", primary: "#365d9f", accent: "#d7dbe9", weapon: "sword" },
  { key: "hero_xiahoudun", portrait: "portrait_xiahoudun", glyph: "夏", primary: "#2f4778", accent: "#c9473b", weapon: "blade" },
  { key: "hero_zhouyu", portrait: "portrait_zhouyu", glyph: "周", primary: "#9f3b31", accent: "#f0b15f", weapon: "fan" },
  { key: "hero_sunshangxiang", portrait: "portrait_sunshangxiang", glyph: "香", primary: "#b4473d", accent: "#f6c779", weapon: "bow" },
  { key: "hero_diaochan", portrait: "portrait_diaochan", glyph: "貂", primary: "#ff78b7", accent: "#ffd98a", weapon: "fan" }
];

const enemyLooks = [
  { key: "enemy_infantry", glyph: "卒", primary: "#6c5a4d", accent: "#ded0b0", size: 58 },
  { key: "enemy_archer", glyph: "弓", primary: "#6b7042", accent: "#d6c17a", size: 54 },
  { key: "enemy_shield", glyph: "盾", primary: "#59606a", accent: "#c5cbd6", size: 64 },
  { key: "enemy_cavalry", glyph: "騎", primary: "#7d4c34", accent: "#e0b16b", size: 62 },
  { key: "enemy_captain", glyph: "將", primary: "#73444d", accent: "#e2b55f", size: 74 },
  { key: "enemy_lubu", glyph: "呂", primary: "#4b2c5c", accent: "#f04e4e", size: 112 }
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    for (const asset of audioAssetEntries) {
      this.load.audio(asset.key, asset.path);
    }
    for (const art of characterArts) {
      this.load.image(art.textureKey, art.battleImage);
      art.attackFrames.forEach((framePath, index) => {
        this.load.image(art.attackFrameKeys[index], framePath);
      });
      for (const animation of Object.values(art.animations ?? {})) {
        animation.framePaths.forEach((framePath, index) => {
          this.load.image(animation.frameKeys[index], framePath);
        });
      }
    }
    for (const asset of visualAssetEntries) {
      this.load.image(asset.key, asset.path);
    }
    for (const asset of visualSpritesheetEntries) {
      this.load.spritesheet(asset.key, asset.path, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
        endFrame: asset.endFrame
      });
    }
    for (const asset of enemyBaseAssetEntries) {
      this.load.image(asset.key, asset.path);
    }
    for (const asset of enemyAnimationAssetEntries) {
      this.load.image(asset.key, asset.path);
    }
  }

  create(): void {
    this.createGroundTile();
    this.createBattlefieldTextures();
    this.createFxTextures();
    this.createSlashAnimation();
    this.createHitFxAnimations();
    this.createCharacterAnimations();
    this.createEnemyAnimations();
    for (const look of heroLooks) {
      if (!this.textures.exists(look.key)) {
        this.createHeroTexture(look);
      }
      if (!this.textures.exists(look.portrait)) {
        this.createPortraitTexture(look);
      }
    }
    for (const enemy of enemyLooks) {
      if (!this.textures.exists(enemy.key)) {
        this.createEnemyTexture(enemy.key, enemy.glyph, enemy.primary, enemy.accent, enemy.size);
      }
    }
    this.scene.start("MenuScene");
  }

  private createGroundTile(): void {
    const texture = this.textures.createCanvas("ground_tile", 192, 192)!;
    const ctx = texture.getContext();
    const gradient = ctx.createLinearGradient(0, 0, 192, 192);
    gradient.addColorStop(0, "#2d1824");
    gradient.addColorStop(0.45, "#191017");
    gradient.addColorStop(1, "#3f2230");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 192, 192);
    ctx.strokeStyle = "rgba(255, 217, 138, 0.13)";
    ctx.lineWidth = 1;
    for (let x = -64; x < 224; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 64, 192);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 120, 183, 0.08)";
    for (let y = 12; y < 208; y += 38) {
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.lineTo(212, y + 24);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 229, 167, 0.1)";
    for (let index = 0; index < 36; index += 1) {
      ctx.beginPath();
      ctx.arc((index * 47) % 192, (index * 83) % 192, 0.9 + (index % 3) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 154, 203, 0.13)";
    for (let index = 0; index < 14; index += 1) {
      const x = (index * 59) % 192;
      const y = (index * 97) % 192;
      ctx.beginPath();
      ctx.ellipse(x, y, 9, 3.5, index * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    for (let index = 0; index < 10; index += 1) {
      const x = (index * 71 + 18) % 192;
      const y = (index * 41 + 36) % 192;
      ctx.beginPath();
      ctx.ellipse(x, y, 16 + (index % 4) * 3, 5 + (index % 3), index * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    texture.refresh();
  }

  private createBattlefieldTextures(): void {
    this.createBattlefieldDetailTile();
    this.createGroundClothTexture("battle_cloth_red", "#7d2626", "#ffd36a");
    this.createGroundClothTexture("battle_cloth_jade", "#23614c", "#dffade");
    this.createBannerTexture("battle_legacy_banner_red", "#7d2626", "#ffd36a");
    this.createBannerTexture("battle_legacy_banner_jade", "#23614c", "#dffade");
    this.createPropTexture("battle_spear_prop", "#3a271e", "#e2b55f", "spear");
    this.createPropTexture("battle_stone_prop", "#2e2830", "#8b7b77", "stone");
  }

  private createBattlefieldDetailTile(): void {
    const texture = this.textures.createCanvas("ground_detail_tile", 256, 256)!;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(255, 229, 167, 0.18)";
    ctx.lineWidth = 2;
    for (let x = -96; x < 300; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 96, 256);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 120, 183, 0.1)";
    ctx.lineWidth = 4;
    for (let y = 32; y < 256; y += 72) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(58, y + 24, 134, y - 18, 256, y + 18);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(244, 195, 113, 0.15)";
    for (let index = 0; index < 18; index += 1) {
      const x = (index * 97 + 27) % 256;
      const y = (index * 53 + 44) % 256;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(index * 0.55);
      ctx.fillRect(-9, -2, 18, 4);
      ctx.restore();
    }
    texture.refresh();
  }

  private createGroundClothTexture(key: string, cloth: string, trim: string): void {
    const texture = this.textures.createCanvas(key, 128, 74)!;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 128, 74);
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.beginPath();
    ctx.ellipse(64, 55, 44, 10, -0.08, 0, Math.PI * 2);
    ctx.fill();
    const gradient = ctx.createLinearGradient(22, 18, 106, 62);
    gradient.addColorStop(0, cloth);
    gradient.addColorStop(0.58, "#3a1720");
    gradient.addColorStop(1, "#161012");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = trim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, 22);
    ctx.lineTo(103, 15);
    ctx.lineTo(94, 34);
    ctx.lineTo(108, 52);
    ctx.lineTo(32, 61);
    ctx.lineTo(42, 43);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255, 242, 201, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, 31);
    ctx.bezierCurveTo(54, 25, 72, 29, 96, 24);
    ctx.moveTo(36, 48);
    ctx.bezierCurveTo(59, 43, 75, 45, 98, 39);
    ctx.stroke();
    texture.refresh();
  }

  private createBannerTexture(key: string, cloth: string, trim: string): void {
    const texture = this.textures.createCanvas(key, 96, 150)!;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 96, 150);
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(44, 142, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#211611";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(34, 20);
    ctx.lineTo(34, 140);
    ctx.stroke();
    const gradient = ctx.createLinearGradient(36, 18, 82, 118);
    gradient.addColorStop(0, cloth);
    gradient.addColorStop(1, "#211018");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = trim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(36, 22);
    ctx.lineTo(82, 30);
    ctx.lineTo(72, 72);
    ctx.lineTo(84, 114);
    ctx.lineTo(36, 102);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 242, 201, 0.7)";
    ctx.font = "700 28px serif";
    ctx.textAlign = "center";
    ctx.fillText("令", 58, 74);
    texture.refresh();
  }

  private createPropTexture(key: string, primary: string, accent: string, kind: "spear" | "stone"): void {
    const texture = this.textures.createCanvas(key, 96, 96)!;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 96, 96);
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath();
    ctx.ellipse(48, 78, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (kind === "spear") {
      ctx.strokeStyle = primary;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(26, 78);
      ctx.lineTo(72, 16);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(72, 16);
      ctx.lineTo(65, 36);
      ctx.lineTo(84, 28);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 244, 210, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
      ctx.beginPath();
      ctx.ellipse(48, 63, 24, 7, -0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(139, 123, 119, 0.28)";
      for (let index = 0; index < 4; index += 1) {
        const x = 28 + index * 13;
        const y = 56 + (index % 2) * 4;
        ctx.beginPath();
        ctx.ellipse(x, y, 9 + index, 3.5 + (index % 2), index * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255, 229, 167, 0.07)";
      ctx.beginPath();
      ctx.ellipse(43, 52, 8, 2, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    texture.refresh();
  }

  private createHeroTexture(look: HeroLook): void {
    const texture = this.textures.createCanvas(look.key, 128, 150)!;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 128, 150);
    drawShadow(ctx, 64, 132, 44, 12);
    ctx.fillStyle = look.primary;
    ctx.strokeStyle = look.accent;
    ctx.lineWidth = 4;
    drawCape(ctx, look.primary);
    drawArmor(ctx, look.primary, look.accent);
    drawHead(ctx, look.accent);
    drawWeapon(ctx, look.weapon, look.accent);
    ctx.fillStyle = "rgba(255, 246, 214, 0.92)";
    ctx.font = "700 24px serif";
    ctx.textAlign = "center";
    ctx.fillText(look.glyph, 64, 82);
    texture.refresh();
  }

  private createPortraitTexture(look: HeroLook): void {
    const texture = this.textures.createCanvas(look.portrait, 320, 420)!;
    const ctx = texture.getContext();
    const gradient = ctx.createLinearGradient(0, 0, 320, 420);
    gradient.addColorStop(0, look.primary);
    gradient.addColorStop(0.52, "#17120f");
    gradient.addColorStop(1, look.accent);
    ctx.fillStyle = gradient;
    roundRect(ctx, 0, 0, 320, 420, 22);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 244, 207, 0.13)";
    ctx.font = "700 190px serif";
    ctx.textAlign = "center";
    ctx.fillText(look.glyph, 160, 250);
    ctx.strokeStyle = "rgba(255, 242, 201, 0.44)";
    ctx.lineWidth = 8;
    roundRect(ctx, 18, 18, 284, 384, 18);
    ctx.stroke();
    texture.refresh();
  }

  private createEnemyTexture(key: string, glyph: string, primary: string, accent: string, size: number): void {
    const texture = this.textures.createCanvas(key, size, size + 20)!;
    const ctx = texture.getContext();
    const mid = size / 2;
    const role = enemyRoleFromKey(key);
    drawShadow(ctx, mid, size + 12, size * 0.33, size * 0.12);
    const boss = key === "enemy_lubu";
    if (role === "cavalry") {
      ctx.fillStyle = "#2a1a16";
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, size * 0.025);
      ctx.beginPath();
      ctx.ellipse(mid, size * 0.66, size * 0.4, size * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.ellipse(mid + size * 0.22, size * 0.58, size * 0.14, size * 0.15, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = primary;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(3, size * 0.045);
    ctx.beginPath();
    ctx.ellipse(mid, size * 0.47, size * (role === "shield" ? 0.38 : 0.32), size * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (role === "shield") {
      const shieldGradient = ctx.createLinearGradient(mid - size * 0.28, size * 0.34, mid + size * 0.28, size * 0.74);
      shieldGradient.addColorStop(0, "#e9edf4");
      shieldGradient.addColorStop(1, primary);
      ctx.fillStyle = shieldGradient;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(3, size * 0.04);
      ctx.beginPath();
      ctx.moveTo(mid, size * 0.28);
      ctx.quadraticCurveTo(mid + size * 0.31, size * 0.35, mid + size * 0.24, size * 0.68);
      ctx.quadraticCurveTo(mid, size * 0.84, mid - size * 0.24, size * 0.68);
      ctx.quadraticCurveTo(mid - size * 0.31, size * 0.35, mid, size * 0.28);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = boss ? "#352044" : "#f2c79b";
    ctx.beginPath();
    ctx.ellipse(mid, size * 0.46, size * 0.24, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 245, 218, 0.34)";
    ctx.lineWidth = Math.max(2, size * 0.024);
    ctx.stroke();
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(mid - size * 0.36, size * 0.34);
    ctx.lineTo(mid - size * (boss ? 0.28 : 0.18), size * 0.08);
    ctx.lineTo(mid + size * (boss ? 0.28 : 0.18), size * 0.08);
    ctx.lineTo(mid + size * 0.36, size * 0.34);
    ctx.lineTo(mid + size * 0.24, size * 0.28);
    ctx.lineTo(mid - size * 0.24, size * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(3, size * 0.045);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(mid, size * 0.22, size * 0.08, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    if (boss || role === "captain") {
      ctx.strokeStyle = boss ? "#ff4e74" : "#ffd36a";
      ctx.lineWidth = Math.max(4, size * 0.045);
      ctx.beginPath();
      ctx.moveTo(mid - size * 0.23, size * 0.14);
      ctx.lineTo(mid - size * 0.38, size * 0.02);
      ctx.moveTo(mid + size * 0.23, size * 0.14);
      ctx.lineTo(mid + size * 0.38, size * 0.02);
      ctx.stroke();
    }
    drawCuteEye(ctx, mid - size * 0.09, size * 0.47, size * 0.11, boss ? "#ff5f9e" : "#5a3b2e");
    drawCuteEye(ctx, mid + size * 0.09, size * 0.47, size * 0.11, boss ? "#ff5f9e" : "#5a3b2e");
    ctx.strokeStyle = boss ? "#ffd98a" : "#6d3a2c";
    ctx.lineWidth = Math.max(2, size * 0.025);
    ctx.beginPath();
    ctx.arc(mid, size * 0.57, size * 0.07, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.fillStyle = primary;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(3, size * 0.04);
    roundRect(ctx, mid - size * 0.22, size * 0.69, size * 0.44, size * 0.26, size * 0.07);
    ctx.fill();
    ctx.stroke();
    drawEnemyWeapon(ctx, role, mid, size, accent);
    ctx.fillStyle = "rgba(255, 238, 194, 0.88)";
    ctx.font = `700 ${Math.floor(size * 0.2)}px serif`;
    ctx.textAlign = "center";
    ctx.fillText(glyph, mid, size * 0.87);
    texture.refresh();
  }

  private createFxTextures(): void {
    this.createMeleeFxTextures();
    this.createStreakTexture("qinglong_arc", "#7bf0af", 96, 28);
    this.createStreakTexture("dragon_slash", "#86ffc6", 150, 32);
    this.createStreakTexture("spear_flash", "#dffcff", 120, 18);
    this.createStreakTexture("dragon_dash", "#9bf3ff", 130, 24);
    this.createStreakTexture("wei_swords", "#d6ddff", 102, 20);
    this.createStreakTexture("tiger_cavalry", "#a8bdff", 150, 30);
    this.createStreakTexture("iron_cleave", "#d9dde8", 96, 30);
    this.createStreakTexture("blood_rage", "#ff5548", 104, 36);
    this.createStreakTexture("fire_note", "#ff8d3e", 82, 26);
    this.createStreakTexture("red_cliff_fire", "#ff6a35", 122, 40);
    this.createStreakTexture("crossbow_fan", "#ffd36a", 82, 14);
    this.createStreakTexture("arrow_rain", "#ffc759", 72, 16);
    this.createStreakTexture("petal_waltz", "#ff9acb", 92, 24);
    this.createStreakTexture("allure_dance", "#ffd98a", 124, 34);
    this.createStreakTexture("moon_blades", "#fff1a8", 104, 20);
    this.createStreakTexture("frost_lotus", "#9eefff", 110, 28);
    this.createStreakTexture("phoenix_feathers", "#ff8a4f", 104, 20);
    this.createStreakTexture("thunder_charm", "#c9a8ff", 118, 26);
    this.createStreakTexture("shadow_clones", "#c7d2ff", 124, 22);
    this.createStreakTexture("siege_drums", "#ffd98a", 132, 34);
    this.createStreakTexture("enemy_arrow", "#e7c27b", 62, 12);
    this.createOrbTexture("xp_orb", "#75e8ff", "#f7f8cc");
  }

  private createMeleeFxTextures(): void {
    this.createArcTexture("melee_arc", "#fff1cf", "#75f0aa", 210, 150, 0.58);
    this.createThrustTexture("spear_thrust", "#dffcff", "#75f0aa", 230, 58);
    this.createArcTexture("petal_blade", "#ffd4eb", "#ff78b7", 180, 132, 0.48);
    this.createArcTexture("heavy_cleave_wave", "#ffe2b8", "#ff7a45", 240, 170, 0.66);
  }

  private createArcTexture(key: string, core: string, edge: string, width: number, height: number, thickness: number): void {
    if (this.textures.exists(key)) {
      return;
    }
    const texture = this.textures.createCanvas(key, width, height)!;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, width, height);
    const centerX = width * 0.48;
    const centerY = height * 0.58;
    const outer = Math.min(width, height) * thickness;
    const inner = outer * 0.56;
    const gradient = ctx.createRadialGradient(centerX, centerY, inner * 0.55, centerX, centerY, outer * 1.15);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.42, edge);
    gradient.addColorStop(0.66, core);
    gradient.addColorStop(0.88, "rgba(255,255,255,0.18)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = gradient;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(14, height * 0.2);
    ctx.beginPath();
    ctx.arc(centerX, centerY, outer, -2.38, 0.34);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.86)";
    ctx.lineWidth = Math.max(3, height * 0.035);
    ctx.beginPath();
    ctx.arc(centerX, centerY, inner, -2.18, 0.16);
    ctx.stroke();
    ctx.fillStyle = edge;
    ctx.globalAlpha = 0.45;
    for (let index = 0; index < 9; index += 1) {
      const angle = -2.2 + index * 0.26;
      const radius = inner + (outer - inner) * (index % 3 === 0 ? 0.3 : 0.72);
      ctx.beginPath();
      ctx.ellipse(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, 6, 2, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    texture.refresh();
  }

  private createThrustTexture(key: string, core: string, edge: string, width: number, height: number): void {
    if (this.textures.exists(key)) {
      return;
    }
    const texture = this.textures.createCanvas(key, width, height)!;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, height / 2, width, height / 2);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.18, edge);
    gradient.addColorStop(0.58, core);
    gradient.addColorStop(0.86, "rgba(255,255,255,0.92)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(width * 0.04, height * 0.5);
    ctx.quadraticCurveTo(width * 0.42, height * 0.08, width * 0.96, height * 0.5);
    ctx.quadraticCurveTo(width * 0.42, height * 0.92, width * 0.04, height * 0.5);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.06, height * 0.5);
    ctx.lineTo(width * 0.95, height * 0.5);
    ctx.stroke();
    texture.refresh();
  }

  private createSlashAnimation(): void {
    if (this.anims.exists(slashAnimationKey)) {
      return;
    }
    for (const [index, frame] of slashAnimationFrames.entries()) {
      if (!this.textures.exists(frame.key)) {
        this.createStreakTexture(frame.key, index % 2 === 0 ? "#fff1cf" : "#ffd98a", 168, 82);
      }
    }
    this.anims.create({
      key: slashAnimationKey,
      frames: slashAnimationFrames.map((frame) => ({ key: frame.key })),
      frameRate: 28,
      repeat: 0
    });
  }

  private createHitFxAnimations(): void {
    if (!this.anims.exists(hitSparkAnimationKey) && this.textures.exists(hitSparkSpritesheet.key)) {
      this.anims.create({
        key: hitSparkAnimationKey,
        frames: this.anims.generateFrameNumbers(hitSparkSpritesheet.key, { start: 0, end: hitSparkSpritesheet.endFrame }),
        frameRate: 32,
        repeat: 0
      });
    }
    if (!this.anims.exists(hitRadialAnimationKey) && this.textures.exists(hitRadialSpritesheet.key)) {
      this.anims.create({
        key: hitRadialAnimationKey,
        frames: this.anims.generateFrameNumbers(hitRadialSpritesheet.key, { start: 0, end: hitRadialSpritesheet.endFrame }),
        frameRate: 24,
        repeat: 0
      });
    }
  }

  private createCharacterAnimations(): void {
    for (const art of characterArts) {
      for (const [animationId, animation] of Object.entries(art.animations ?? {}) as [string, CharacterAnimationDef][]) {
        const key = `${art.textureKey}_${animationId}`;
        if (this.anims.exists(key)) {
          continue;
        }
        const frames = animation.frameKeys.filter((frameKey) => this.textures.exists(frameKey)).map((frameKey) => ({ key: frameKey }));
        if (frames.length !== animation.frameKeys.length) {
          continue;
        }
        this.anims.create({
          key,
          frames,
          frameRate: animation.frameRate,
          repeat: animation.repeat
        });
      }
    }
  }

  private createEnemyAnimations(): void {
    for (const [enemyId, animations] of Object.entries(enemyAnimationsById)) {
      for (const [animationId, animation] of Object.entries(animations) as [EnemyAnimationId, EnemyAnimationDef][]) {
        const key = enemyAnimationKey(enemyId as keyof typeof enemyAnimationsById, animationId);
        if (this.anims.exists(key)) {
          continue;
        }
        const frames = animation.frameKeys.filter((frameKey) => this.textures.exists(frameKey)).map((frameKey) => ({ key: frameKey }));
        if (frames.length !== animation.frameKeys.length) {
          continue;
        }
        this.anims.create({
          key,
          frames,
          frameRate: animation.frameRate,
          repeat: animation.repeat
        });
      }
    }
  }

  private createStreakTexture(key: string, color: string, width: number, height: number): void {
    if (this.textures.exists(key)) {
      return;
    }
    const texture = this.textures.createCanvas(key, width, height)!;
    const ctx = texture.getContext();
    const gradient = ctx.createLinearGradient(0, height / 2, width, height / 2);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.34, color);
    gradient.addColorStop(0.7, "rgba(255,255,255,0.9)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, width * 0.45, height * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    texture.refresh();
  }

  private createOrbTexture(key: string, color: string, core: string): void {
    if (this.textures.exists(key)) {
      return;
    }
    const texture = this.textures.createCanvas(key, 32, 32)!;
    const ctx = texture.getContext();
    const gradient = ctx.createRadialGradient(16, 16, 2, 16, 16, 16);
    gradient.addColorStop(0, core);
    gradient.addColorStop(0.35, color);
    gradient.addColorStop(1, "rgba(117,232,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    texture.refresh();
  }
}

function drawArmor(ctx: CanvasRenderingContext2D, primary: string, accent: string): void {
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.moveTo(42, 58);
  ctx.lineTo(86, 58);
  ctx.lineTo(102, 118);
  ctx.quadraticCurveTo(64, 138, 26, 118);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 244, 210, 0.45)";
  ctx.lineWidth = 2;
  for (let x = 43; x <= 84; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 63);
    ctx.lineTo(x + 6, 121);
    ctx.stroke();
  }
  ctx.strokeStyle = accent;
}

function drawCape(ctx: CanvasRenderingContext2D, primary: string): void {
  ctx.fillStyle = primary;
  ctx.globalAlpha = 0.58;
  ctx.beginPath();
  ctx.moveTo(44, 54);
  ctx.bezierCurveTo(9, 82, 11, 118, 32, 136);
  ctx.bezierCurveTo(54, 120, 72, 83, 84, 56);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHead(ctx: CanvasRenderingContext2D, accent: string): void {
  ctx.fillStyle = "#241813";
  ctx.beginPath();
  ctx.arc(64, 42, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(44, 35);
  ctx.quadraticCurveTo(64, 16, 84, 35);
  ctx.stroke();
}

function drawWeapon(ctx: CanvasRenderingContext2D, weapon: HeroLook["weapon"], accent: string): void {
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  if (weapon === "glaive") {
    ctx.beginPath();
    ctx.moveTo(28, 122);
    ctx.lineTo(102, 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(103, 24, 8, 20, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (weapon === "spear") {
    ctx.beginPath();
    ctx.moveTo(24, 118);
    ctx.lineTo(104, 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(104, 20);
    ctx.lineTo(99, 41);
    ctx.lineTo(117, 31);
    ctx.closePath();
    ctx.fill();
  } else if (weapon === "bow") {
    ctx.beginPath();
    ctx.arc(92, 74, 42, -1.25, 1.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(90, 34);
    ctx.lineTo(90, 114);
    ctx.stroke();
  } else if (weapon === "fan") {
    for (let angle = -0.6; angle <= 0.6; angle += 0.3) {
      ctx.beginPath();
      ctx.moveTo(38, 96);
      ctx.lineTo(38 + Math.cos(angle) * 62, 96 + Math.sin(angle) * 62);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(100, 118);
    ctx.lineTo(38, 38);
    ctx.stroke();
  }
}

function enemyRoleFromKey(key: string): "infantry" | "archer" | "shield" | "cavalry" | "captain" | "boss" {
  if (key.includes("archer")) {
    return "archer";
  }
  if (key.includes("shield")) {
    return "shield";
  }
  if (key.includes("cavalry")) {
    return "cavalry";
  }
  if (key.includes("captain")) {
    return "captain";
  }
  if (key.includes("lubu")) {
    return "boss";
  }
  return "infantry";
}

function drawEnemyWeapon(
  ctx: CanvasRenderingContext2D,
  role: ReturnType<typeof enemyRoleFromKey>,
  mid: number,
  size: number,
  accent: string
): void {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (role === "archer") {
    ctx.lineWidth = Math.max(3, size * 0.045);
    ctx.beginPath();
    ctx.arc(mid + size * 0.24, size * 0.56, size * 0.25, -1.25, 1.2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, size * 0.018);
    ctx.beginPath();
    ctx.moveTo(mid + size * 0.3, size * 0.35);
    ctx.lineTo(mid + size * 0.3, size * 0.76);
    ctx.stroke();
  } else if (role === "captain" || role === "boss") {
    ctx.lineWidth = Math.max(5, size * 0.055);
    ctx.beginPath();
    ctx.moveTo(mid - size * 0.34, size * 0.78);
    ctx.lineTo(mid + size * 0.44, size * 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(mid + size * 0.46, size * 0.17, size * 0.09, size * 0.2, -0.55, 0, Math.PI * 2);
    ctx.fill();
  } else if (role === "shield") {
    ctx.lineWidth = Math.max(3, size * 0.04);
    ctx.beginPath();
    ctx.moveTo(mid - size * 0.36, size * 0.72);
    ctx.lineTo(mid - size * 0.12, size * 0.38);
    ctx.stroke();
  } else {
    ctx.lineWidth = Math.max(4, size * 0.05);
    ctx.beginPath();
    ctx.moveTo(mid - size * 0.32, size * 0.78);
    ctx.lineTo(mid + size * 0.28, size * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mid + size * 0.28, size * 0.22);
    ctx.lineTo(mid + size * 0.18, size * 0.38);
    ctx.lineTo(mid + size * 0.38, size * 0.34);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCuteEye(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.fillStyle = "rgba(255, 248, 235, 0.98)";
  ctx.beginPath();
  ctx.ellipse(x, y, radius * 0.86, radius * 1.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.08, radius * 0.48, radius * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(35, 15, 20, 0.95)";
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.08, y + radius * 0.16, radius * 0.24, radius * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.beginPath();
  ctx.arc(x - radius * 0.18, y - radius * 0.28, radius * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
