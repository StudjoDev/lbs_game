import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(root, "public", "assets", "characters-legacy");
const sourceRoot = join(root, "scripts", "source");

const characters = [
  {
    id: "guanyu",
    primary: "#25845c",
    secondary: "#10291d",
    accent: "#e0b64f",
    glow: "#79ffb2",
    hair: "#24100d",
    skin: "#edaa78",
    eye: "#dca43e",
    weapon: "glaive",
    hairStyle: "long",
    mood: "calm",
    headgear: "greenHelmet",
    gem: "#ffe05a"
  },
  {
    id: "zhaoyun",
    primary: "#2c96a5",
    secondary: "#0e3139",
    accent: "#dceeff",
    glow: "#8beeff",
    hair: "#e9f7ff",
    skin: "#efb184",
    eye: "#4edfff",
    weapon: "spear",
    hairStyle: "wind",
    mood: "bright",
    headgear: "blueCirclet",
    gem: "#75f4ff"
  },
  {
    id: "caocao",
    primary: "#405fbb",
    secondary: "#12172f",
    accent: "#d8dff8",
    glow: "#9bb5ff",
    hair: "#16121b",
    skin: "#e8a979",
    eye: "#8ea7ff",
    weapon: "sword",
    hairStyle: "crown",
    mood: "sharp",
    headgear: "goldCrown",
    gem: "#76ffb8"
  },
  {
    id: "xiahoudun",
    primary: "#344d88",
    secondary: "#141725",
    accent: "#dd514b",
    glow: "#ff756d",
    hair: "#20151a",
    skin: "#d8946c",
    eye: "#ff8a6d",
    weapon: "blade",
    hairStyle: "wild",
    mood: "fierce",
    headgear: "redHelm",
    gem: "#ffdb5b"
  },
  {
    id: "zhouyu",
    primary: "#c24a3c",
    secondary: "#361111",
    accent: "#f2bb64",
    glow: "#ff9850",
    hair: "#241019",
    skin: "#efad82",
    eye: "#ffbc65",
    weapon: "fan",
    hairStyle: "flow",
    mood: "elegant",
    headgear: "jadeCrown",
    gem: "#4fffe1"
  },
  {
    id: "sunshangxiang",
    primary: "#c74754",
    secondary: "#351018",
    accent: "#ffd078",
    glow: "#ffdf76",
    hair: "#3b1720",
    skin: "#f0ac83",
    eye: "#ffc46c",
    weapon: "bow",
    hairStyle: "twin",
    mood: "smile",
    headgear: "blueTiara",
    gem: "#86f6ff"
  },
  {
    id: "diaochan",
    primary: "#ff78b7",
    secondary: "#4c1834",
    accent: "#ffd98a",
    glow: "#ffaad6",
    hair: "#4b2219",
    skin: "#f7b492",
    eye: "#ff5f9e",
    weapon: "fan",
    hairStyle: "long",
    mood: "smile",
    headgear: "flowerCrown",
    gem: "#ff78b7"
  },
  {
    id: "lubu",
    primary: "#68408b",
    secondary: "#170b20",
    accent: "#ff4b5f",
    glow: "#cb72ff",
    hair: "#160912",
    skin: "#d89168",
    eye: "#ff3854",
    weapon: "halberd",
    hairStyle: "plume",
    mood: "fierce",
    headgear: "demonHelm",
    gem: "#ff4b5f"
  }
];

async function main() {
  for (const character of characters) {
    const dir = join(outputRoot, character.id);
    await mkdir(dir, { recursive: true });
    const card = drawCard(character);
    await writePng(join(dir, "card.png"), card);
    if (character.id === "diaochan") {
      await copySourceCardIfPresent(join(sourceRoot, "diaochan-card.png"), join(dir, "card.png"));
    }

    const battleSize = character.id === "lubu" ? { width: 160, height: 186, scale: 0.86 } : { width: 128, height: 150, scale: 0.67 };
    const idle = drawBattle(character, 0, battleSize);
    await writePng(join(dir, "battle-idle.png"), idle);

    const frames = [];
    for (let frame = 0; frame < 4; frame += 1) {
      const image = drawBattle(character, frame, battleSize);
      frames.push(image);
      await writePng(join(dir, `attack-${frame}.png`), image);
    }
    await writePng(join(dir, "attack-strip.png"), stitchFrames(frames));
  }

  console.log(`Generated ${characters.length} bitmap character asset sets in ${outputRoot}`);
}

class Bitmap {
  constructor(width, height, fill = [0, 0, 0, 0]) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    if (fill[3] > 0) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          this.setPixel(x, y, fill);
        }
      }
    }
  }

  setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }
    const index = (Math.floor(y) * this.width + Math.floor(x)) * 4;
    this.data[index] = color[0];
    this.data[index + 1] = color[1];
    this.data[index + 2] = color[2];
    this.data[index + 3] = color[3];
  }

  blendPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || color[3] <= 0) {
      return;
    }
    const index = (Math.floor(y) * this.width + Math.floor(x)) * 4;
    const sourceA = color[3] / 255;
    const destA = this.data[index + 3] / 255;
    const outA = sourceA + destA * (1 - sourceA);
    if (outA <= 0) {
      return;
    }
    this.data[index] = Math.round((color[0] * sourceA + this.data[index] * destA * (1 - sourceA)) / outA);
    this.data[index + 1] = Math.round((color[1] * sourceA + this.data[index + 1] * destA * (1 - sourceA)) / outA);
    this.data[index + 2] = Math.round((color[2] * sourceA + this.data[index + 2] * destA * (1 - sourceA)) / outA);
    this.data[index + 3] = Math.round(outA * 255);
  }

  fillGradient(top, middle, bottom) {
    for (let y = 0; y < this.height; y += 1) {
      const t = y / Math.max(1, this.height - 1);
      const color = t < 0.48 ? mix(top, middle, t / 0.48) : mix(middle, bottom, (t - 0.48) / 0.52);
      for (let x = 0; x < this.width; x += 1) {
        const shade = 1 - Math.abs(x / this.width - 0.52) * 0.22;
        this.setPixel(x, y, [Math.round(color[0] * shade), Math.round(color[1] * shade), Math.round(color[2] * shade), 255]);
      }
    }
  }

  ellipse(cx, cy, rx, ry, color) {
    const minX = Math.max(0, Math.floor(cx - rx));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + rx));
    const minY = Math.max(0, Math.floor(cy - ry));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + ry));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d <= 1) {
          const edge = clamp((1 - d) * 8, 0, 1);
          this.blendPixel(x, y, withAlpha(color, Math.round(color[3] * edge)));
        }
      }
    }
  }

  polygon(points, color) {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(...ys)));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (pointInPolygon(x + 0.5, y + 0.5, points)) {
          this.blendPixel(x, y, color);
        }
      }
    }
  }

  line(x1, y1, x2, y2, width, color) {
    const steps = Math.max(1, Math.ceil(distance(x1, y1, x2, y2) / Math.max(1, width * 0.34)));
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      this.ellipse(lerp(x1, x2, t), lerp(y1, y2, t), width / 2, width / 2, color);
    }
  }

  rect(x, y, width, height, color) {
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(this.height, Math.ceil(y + height)); yy += 1) {
      for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(this.width, Math.ceil(x + width)); xx += 1) {
        this.blendPixel(xx, yy, color);
      }
    }
  }

  drawImage(source, dx, dy) {
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const index = (y * source.width + x) * 4;
        this.blendPixel(dx + x, dy + y, [source.data[index], source.data[index + 1], source.data[index + 2], source.data[index + 3]]);
      }
    }
  }
}

function drawCard(character) {
  const canvas = new Bitmap(1024, 1024, [0, 0, 0, 255]);
  canvas.fillGradient(rgb(character.primary), rgb(character.secondary), [8, 6, 9]);
  drawPanelBackdrop(canvas, character);
  glow(canvas, 512, 330, 360, rgba(character.glow, 108));
  glow(canvas, 500, 700, 340, rgba(character.primary, 104));
  canvas.polygon([[-20, 690], [1060, 118], [1060, 300], [-20, 850]], rgba("#ffffff", 22));
  canvas.polygon([[-20, 820], [1060, 300], [1060, 382], [-20, 900]], rgba(character.glow, 46));
  for (let index = 0; index < 38; index += 1) {
    const x = 92 + ((index * 181) % 840);
    const y = 86 + ((index * 263) % 850);
    const s = 4 + (index % 4) * 2;
    canvas.polygon([[x, y - s], [x + s, y], [x, y + s], [x - s, y]], rgba(character.accent, 36 + (index % 3) * 18));
  }
  drawFigure(canvas, character, 512, 820, 6.05, 0, true);
  drawCardFrame(canvas, character);
  return canvas;
}

function drawBattle(character, frame, size) {
  const canvas = new Bitmap(size.width, size.height, [0, 0, 0, 0]);
  canvas.ellipse(size.width / 2, size.height - 14, size.width * 0.32, size.height * 0.055, [0, 0, 0, 85]);
  drawFigure(canvas, character, size.width / 2, size.height * 0.57, size.scale, frame, false);
  return canvas;
}

function stitchFrames(frames) {
  const strip = new Bitmap(frames[0].width * frames.length, frames[0].height, [0, 0, 0, 0]);
  frames.forEach((frame, index) => strip.drawImage(frame, frame.width * index, 0));
  return strip;
}

function drawPanelBackdrop(canvas, character) {
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const panelWidth = canvas.width / 5;
  for (let index = 0; index < 5; index += 1) {
    const x = Math.floor(index * panelWidth);
    const alpha = index % 2 === 0 ? 46 : 24;
    canvas.rect(x, 0, panelWidth - 2, canvas.height, rgba(index === 2 ? character.glow : character.secondary, alpha));
    canvas.rect(x + panelWidth - 4, 0, 2, canvas.height, rgba("#ffffff", 34));
    canvas.rect(x + 7, 0, 1, canvas.height, rgba("#000000", 82));
  }
  canvas.ellipse(centerX, height * 0.16, 150, 150, rgba("#ffffff", 30));
  canvas.ellipse(centerX, height * 0.16, 116, 116, rgba(character.secondary, 78));
  for (let spoke = 0; spoke < 10; spoke += 1) {
    const a = (Math.PI * 2 * spoke) / 10;
    canvas.line(centerX, height * 0.16, centerX + Math.cos(a) * 104, height * 0.16 + Math.sin(a) * 104, 2.2, rgba(character.accent, 38));
  }
  canvas.line(width * 0.09, height * 0.07, width * 0.91, height * 0.07, 4, rgba(character.accent, 150));
  canvas.line(width * 0.09, height * 0.93, width * 0.91, height * 0.93, 4, rgba(character.accent, 150));
  canvas.line(width * 0.12, height * 0.12, width * 0.88, height * 0.12, 2, rgba("#fff8dc", 58));
  canvas.line(width * 0.12, height * 0.88, width * 0.88, height * 0.88, 2, rgba("#fff8dc", 58));
}

function drawFigure(canvas, character, cx, cy, scale, frame, cardMode) {
  const pose = [
    { lean: -0.02, weapon: -0.15, arm: -0.22, slash: 0, step: 0 },
    { lean: -0.13, weapon: -0.52, arm: -0.55, slash: -0.3, step: -6 },
    { lean: 0.15, weapon: 0.62, arm: 0.48, slash: 0.36, step: 6 },
    { lean: 0.04, weapon: 0.25, arm: 0.18, slash: 0.16, step: 2 }
  ][frame];
  const t = (x, y) => rotatePoint(cx + x * scale, cy + y * scale, cx, cy, pose.lean);
  const colorPrimary = rgba(character.primary, cardMode ? 210 : 230);
  const colorSecondary = rgba(character.secondary, 245);
  const colorAccent = rgba(character.accent, 230);
  const skin = rgba(character.skin, 255);

  canvas.ellipse(cx, cy - 18 * scale, 70 * scale, 78 * scale, rgba(character.glow, cardMode ? 110 : 46));
  drawCape(canvas, character, cx, cy, scale, pose.lean, cardMode);
  drawWeapon(canvas, character, cx, cy, scale, pose.weapon);
  if (pose.slash !== 0) {
    drawSlash(canvas, character, cx, cy, scale, pose.slash);
  }

  canvas.polygon([t(-38, -2), t(38, -2), t(30, 58), t(0, 76), t(-30, 58)], colorPrimary);
  canvas.polygon([t(-29, 8), t(-10, 30), t(0, 66), t(12, 30), t(30, 8), t(18, 64), t(-18, 64)], rgba(character.accent, 178));
  canvas.line(...t(-25, 26), ...t(25, 26), 3.5 * scale, rgba("#fff8dc", 80));
  canvas.line(...t(-18, 45), ...t(18, 45), 3.2 * scale, rgba("#fff8dc", 62));
  canvas.ellipse(...t(-48, 5), 19 * scale, 26 * scale, colorAccent);
  canvas.ellipse(...t(48, 5), 19 * scale, 26 * scale, colorAccent);
  canvas.ellipse(...t(0, 10), 12 * scale, 12 * scale, rgba(character.gem, 230));
  drawArms(canvas, character, cx, cy, scale, pose, skin);
  canvas.line(...t(-20, 62), ...t(-36, 94 + pose.step), 13 * scale, colorSecondary);
  canvas.line(...t(20, 62), ...t(38, 92 - pose.step), 13 * scale, colorSecondary);
  canvas.line(...t(-20, 62), ...t(-36, 94 + pose.step), 3.5 * scale, colorAccent);
  canvas.line(...t(20, 62), ...t(38, 92 - pose.step), 3.5 * scale, colorAccent);
  drawHead(canvas, character, cx, cy - 66 * scale, scale * (cardMode ? 1.42 : 1.18));
}

function drawCape(canvas, character, cx, cy, scale, lean, cardMode) {
  const points = [
    [-44, -8],
    [-88, 22],
    [-66, 88],
    [-26, 116],
    [0, 76],
    [28, 116],
    [70, 86],
    [88, 20],
    [44, -8]
  ].map(([x, y]) => rotatePoint(cx + x * scale, cy + y * scale, cx, cy, lean));
  canvas.polygon(points, rgba(character.primary, cardMode ? 150 : 120));
  canvas.line(...points[1], ...points[7], 3 * scale, rgba(character.glow, 50));
}

function drawWeapon(canvas, character, cx, cy, scale, angle) {
  const weaponColor = rgba(character.accent, 245);
  const glowColor = rgba(character.glow, 46);
  const rotate = (x, y) => rotatePoint(cx + x * scale, cy + y * scale, cx, cy, angle);
  if (character.weapon === "fan") {
    const center = rotate(-48, 42);
    const fan = [[-56, 44], [-20, -62], [46, -64], [82, 40]].map(([x, y]) => rotate(x, y));
    canvas.polygon(fan, rgba(character.accent, 205));
    for (const [x, y] of [[62, -22], [54, -48], [40, -64], [72, -8]]) {
      canvas.line(...center, ...rotate(x, y), 2.2 * scale, rgba("#fff8dc", 110));
    }
    return;
  }
  if (character.weapon === "bow") {
    canvas.line(...rotate(45, -82), ...rotate(42, 86), 4 * scale, rgba("#fff8dc", 170));
    canvas.line(...rotate(46, -82), ...rotate(43, 86), 8 * scale, weaponColor);
    canvas.line(...rotate(-66, 10), ...rotate(90, -5), 7 * scale, weaponColor);
    canvas.polygon([rotate(90, -5), rotate(64, -18), rotate(68, 9)], weaponColor);
    return;
  }
  const end = character.weapon === "halberd" ? [76, -86] : character.weapon === "spear" ? [78, -84] : [68, -76];
  canvas.line(...rotate(-74, 84), ...rotate(...end), 15 * scale, glowColor);
  canvas.line(...rotate(-74, 84), ...rotate(...end), 7 * scale, weaponColor);
  if (character.weapon === "glaive") {
    canvas.polygon([rotate(64, -84), rotate(101, -70), rotate(66, -18), rotate(44, -60)], weaponColor);
  } else if (character.weapon === "spear") {
    canvas.polygon([rotate(78, -84), rotate(66, -45), rotate(100, -64)], weaponColor);
  } else if (character.weapon === "blade") {
    canvas.polygon([rotate(36, -72), rotate(78, -50), rotate(38, 8), rotate(15, -48)], rgba(character.accent, 235));
  } else if (character.weapon === "halberd") {
    canvas.polygon([rotate(56, -92), rotate(92, -98), rotate(78, -64), rotate(104, -48), rotate(65, -44), rotate(47, -16), rotate(42, -50)], rgba(character.accent, 240));
  } else {
    canvas.polygon([rotate(61, -84), rotate(78, -94), rotate(74, -70)], weaponColor);
  }
}

function drawSlash(canvas, character, cx, cy, scale, angle) {
  const rotate = (x, y) => rotatePoint(cx + x * scale, cy + y * scale, cx, cy, angle);
  canvas.line(...rotate(-92, 8), ...rotate(92, 4), 10 * scale, rgba(character.glow, 42));
  canvas.line(...rotate(-78, 16), ...rotate(84, 10), 3 * scale, rgba("#fff8dc", 80));
}

function drawArms(canvas, character, cx, cy, scale, pose, skin) {
  const rotate = (x, y) => rotatePoint(cx + x * scale, cy + y * scale, cx, cy, pose.lean + pose.arm * 0.35);
  const armor = rgba(character.accent, 155);
  canvas.line(...rotate(-31, 8), ...rotate(-66, 46), 10 * scale, skin);
  canvas.line(...rotate(31, 8), ...rotate(66, 46), 10 * scale, skin);
  canvas.line(...rotate(-31, 8), ...rotate(-58, 32), 4.5 * scale, armor);
  canvas.line(...rotate(31, 8), ...rotate(58, 32), 4.5 * scale, armor);
}

function drawHead(canvas, character, cx, cy, scale) {
  drawHairBack(canvas, character, cx, cy, scale);
  canvas.ellipse(cx, cy, 29 * scale, 31 * scale, rgba(character.skin, 255));
  canvas.ellipse(cx - 8 * scale, cy - 8 * scale, 10 * scale, 8 * scale, rgba("#ffe4c8", 72));
  drawHairFront(canvas, character, cx, cy, scale);
  drawHeadgear(canvas, character, cx, cy, scale);
  drawEyes(canvas, character, cx, cy, scale);
  canvas.ellipse(cx - 17 * scale, cy + 12 * scale, 5 * scale, 3 * scale, rgba("#ff8a9a", 54));
  canvas.ellipse(cx + 18 * scale, cy + 12 * scale, 5 * scale, 3 * scale, rgba("#ff8a9a", 54));
  canvas.line(cx - 1.5 * scale, cy + 7 * scale, cx + 3 * scale, cy + 10 * scale, 1.7 * scale, rgba("#7a3b2b", 145));
  if (character.mood === "fierce") {
    canvas.line(cx - 8 * scale, cy + 19 * scale, cx + 10 * scale, cy + 18 * scale, 2.5 * scale, rgba("#7a2524", 210));
  } else {
    canvas.line(cx - 9 * scale, cy + 18 * scale, cx + 1 * scale, cy + 21 * scale, 2.4 * scale, rgba("#7a3025", 210));
    canvas.line(cx + 1 * scale, cy + 21 * scale, cx + 11 * scale, cy + 18 * scale, 2.4 * scale, rgba("#7a3025", 210));
  }
  if (character.hairStyle === "long") {
    canvas.polygon([[cx - 8 * scale, cy + 24 * scale], [cx + 9 * scale, cy + 24 * scale], [cx + 1 * scale, cy + 45 * scale]], rgba(character.hair, 245));
  }
  if (character.hairStyle === "plume") {
    canvas.polygon([[cx - 7 * scale, cy - 26 * scale], [cx - 35 * scale, cy - 72 * scale], [cx, cy - 38 * scale], [cx + 35 * scale, cy - 72 * scale], [cx + 7 * scale, cy - 26 * scale]], rgba(character.accent, 235));
  }
}

function drawHairBack(canvas, character, cx, cy, scale) {
  if (character.hairStyle === "long") {
    canvas.ellipse(cx - 29 * scale, cy + 29 * scale, 18 * scale, 58 * scale, rgba(character.hair, 255));
    canvas.ellipse(cx + 29 * scale, cy + 29 * scale, 18 * scale, 58 * scale, rgba(character.hair, 255));
  } else if (character.hairStyle === "twin") {
    canvas.ellipse(cx - 37 * scale, cy + 18 * scale, 26 * scale, 42 * scale, rgba(character.hair, 255));
    canvas.ellipse(cx + 37 * scale, cy + 18 * scale, 26 * scale, 42 * scale, rgba(character.hair, 255));
  } else if (character.hairStyle === "flow") {
    canvas.ellipse(cx - 31 * scale, cy + 25 * scale, 21 * scale, 62 * scale, rgba(character.hair, 255));
    canvas.ellipse(cx + 31 * scale, cy + 25 * scale, 21 * scale, 62 * scale, rgba(character.hair, 255));
  } else {
    canvas.ellipse(cx, cy - 7 * scale, 35 * scale, 26 * scale, rgba(character.hair, 255));
  }
}

function drawHairFront(canvas, character, cx, cy, scale) {
  const hair = rgba(character.hair, 255);
  canvas.ellipse(cx, cy - 15 * scale, 34 * scale, 20 * scale, hair);
  canvas.polygon([[cx - 31 * scale, cy - 3 * scale], [cx - 15 * scale, cy - 30 * scale], [cx - 7 * scale, cy + 4 * scale]], hair);
  canvas.polygon([[cx - 10 * scale, cy - 8 * scale], [cx + 1 * scale, cy - 34 * scale], [cx + 7 * scale, cy + 4 * scale]], hair);
  canvas.polygon([[cx + 8 * scale, cy - 8 * scale], [cx + 29 * scale, cy - 26 * scale], [cx + 25 * scale, cy + 4 * scale]], hair);
  canvas.line(cx - 15 * scale, cy - 19 * scale, cx - 8 * scale, cy + 1 * scale, 2.5 * scale, rgba("#ffffff", 50));
  canvas.line(cx + 8 * scale, cy - 20 * scale, cx + 14 * scale, cy - 2 * scale, 1.8 * scale, rgba("#ffffff", 34));
}

function drawHeadgear(canvas, character, cx, cy, scale) {
  const gold = rgba(character.accent, 245);
  const gem = rgba(character.gem, 250);
  const main = rgba(character.primary, 238);
  const dark = rgba(character.secondary, 245);

  if (character.headgear === "greenHelmet") {
    canvas.polygon([[cx - 36 * scale, cy - 12 * scale], [cx - 26 * scale, cy - 36 * scale], [cx + 27 * scale, cy - 36 * scale], [cx + 37 * scale, cy - 12 * scale], [cx + 24 * scale, cy - 3 * scale], [cx - 24 * scale, cy - 3 * scale]], main);
    canvas.line(cx - 30 * scale, cy - 14 * scale, cx + 30 * scale, cy - 14 * scale, 5 * scale, gold);
    canvas.polygon([[cx - 37 * scale, cy - 23 * scale], [cx - 62 * scale, cy - 42 * scale], [cx - 46 * scale, cy - 8 * scale]], gold);
    canvas.polygon([[cx + 37 * scale, cy - 23 * scale], [cx + 62 * scale, cy - 42 * scale], [cx + 46 * scale, cy - 8 * scale]], gold);
  } else if (character.headgear === "blueCirclet") {
    canvas.line(cx - 32 * scale, cy - 13 * scale, cx + 32 * scale, cy - 13 * scale, 6 * scale, gold);
    canvas.polygon([[cx - 27 * scale, cy - 15 * scale], [cx - 9 * scale, cy - 36 * scale], [cx, cy - 18 * scale], [cx + 10 * scale, cy - 36 * scale], [cx + 28 * scale, cy - 15 * scale]], rgba("#dffaff", 230));
    canvas.ellipse(cx - 34 * scale, cy - 8 * scale, 7 * scale, 12 * scale, rgba("#74f4ff", 210));
    canvas.ellipse(cx + 34 * scale, cy - 8 * scale, 7 * scale, 12 * scale, rgba("#74f4ff", 210));
  } else if (character.headgear === "goldCrown") {
    canvas.polygon([[cx - 27 * scale, cy - 12 * scale], [cx - 20 * scale, cy - 43 * scale], [cx - 5 * scale, cy - 24 * scale], [cx + 10 * scale, cy - 48 * scale], [cx + 25 * scale, cy - 12 * scale]], gold);
    canvas.rect(cx - 26 * scale, cy - 18 * scale, 52 * scale, 10 * scale, rgba(character.primary, 230));
  } else if (character.headgear === "redHelm") {
    canvas.polygon([[cx - 35 * scale, cy - 9 * scale], [cx - 23 * scale, cy - 35 * scale], [cx + 25 * scale, cy - 35 * scale], [cx + 36 * scale, cy - 9 * scale]], dark);
    canvas.polygon([[cx - 12 * scale, cy - 30 * scale], [cx + 2 * scale, cy - 62 * scale], [cx + 16 * scale, cy - 30 * scale]], rgba(character.accent, 235));
    canvas.line(cx - 31 * scale, cy - 12 * scale, cx + 31 * scale, cy - 12 * scale, 4.8 * scale, gold);
  } else if (character.headgear === "jadeCrown") {
    canvas.line(cx - 31 * scale, cy - 13 * scale, cx + 31 * scale, cy - 13 * scale, 5.2 * scale, gold);
    canvas.polygon([[cx - 20 * scale, cy - 14 * scale], [cx, cy - 43 * scale], [cx + 22 * scale, cy - 14 * scale]], rgba("#6effd7", 220));
    canvas.ellipse(cx - 26 * scale, cy - 17 * scale, 5 * scale, 7 * scale, rgba("#fff8dc", 160));
    canvas.ellipse(cx + 26 * scale, cy - 17 * scale, 5 * scale, 7 * scale, rgba("#fff8dc", 160));
  } else if (character.headgear === "blueTiara") {
    canvas.polygon([[cx - 32 * scale, cy - 10 * scale], [cx - 14 * scale, cy - 31 * scale], [cx, cy - 15 * scale], [cx + 14 * scale, cy - 31 * scale], [cx + 32 * scale, cy - 10 * scale]], rgba("#9ff8ff", 220));
    canvas.line(cx - 28 * scale, cy - 12 * scale, cx + 28 * scale, cy - 12 * scale, 3.8 * scale, gold);
  } else if (character.headgear === "flowerCrown") {
    canvas.line(cx - 34 * scale, cy - 13 * scale, cx + 34 * scale, cy - 13 * scale, 5.2 * scale, gold);
    canvas.polygon([[cx - 24 * scale, cy - 17 * scale], [cx, cy - 48 * scale], [cx + 26 * scale, cy - 17 * scale]], gold);
    canvas.ellipse(cx - 35 * scale, cy - 21 * scale, 13 * scale, 8 * scale, rgba("#ffd0df", 235));
    canvas.ellipse(cx - 45 * scale, cy - 14 * scale, 8 * scale, 13 * scale, rgba("#ff8fbd", 225));
    canvas.ellipse(cx - 29 * scale, cy - 11 * scale, 8 * scale, 13 * scale, rgba("#ff8fbd", 225));
    canvas.ellipse(cx - 36 * scale, cy - 15 * scale, 5 * scale, 5 * scale, rgba(character.gem, 245));
    canvas.ellipse(cx + 33 * scale, cy - 15 * scale, 7 * scale, 10 * scale, rgba(character.gem, 230));
    canvas.line(cx + 37 * scale, cy - 8 * scale, cx + 49 * scale, cy + 14 * scale, 2.2 * scale, gold);
  } else if (character.headgear === "demonHelm") {
    canvas.polygon([[cx - 39 * scale, cy - 6 * scale], [cx - 25 * scale, cy - 35 * scale], [cx + 24 * scale, cy - 35 * scale], [cx + 39 * scale, cy - 6 * scale]], dark);
    canvas.polygon([[cx - 30 * scale, cy - 24 * scale], [cx - 58 * scale, cy - 47 * scale], [cx - 43 * scale, cy - 10 * scale]], rgba(character.accent, 238));
    canvas.polygon([[cx + 30 * scale, cy - 24 * scale], [cx + 58 * scale, cy - 47 * scale], [cx + 43 * scale, cy - 10 * scale]], rgba(character.accent, 238));
    canvas.polygon([[cx - 7 * scale, cy - 31 * scale], [cx, cy - 70 * scale], [cx + 9 * scale, cy - 31 * scale]], rgba("#ff3c58", 240));
  }

  canvas.ellipse(cx, cy - 17 * scale, 7.2 * scale, 8.4 * scale, gem);
  canvas.ellipse(cx - 2 * scale, cy - 20 * scale, 2.2 * scale, 2.2 * scale, rgba("#ffffff", 210));
}

function drawEyes(canvas, character, cx, cy, scale) {
  if (character.id === "xiahoudun") {
    canvas.ellipse(cx - 12 * scale, cy + 3 * scale, 9 * scale, 7 * scale, rgba("#15100f", 255));
    canvas.line(cx - 23 * scale, cy - 5 * scale, cx + 3 * scale, cy + 11 * scale, 4 * scale, rgba("#0c0808", 255));
  } else {
    drawEye(canvas, cx - 11 * scale, cy + 3 * scale, scale, character.eye);
  }
  drawEye(canvas, cx + 12 * scale, cy + 3 * scale, scale, character.eye);
  canvas.line(cx - 22 * scale, cy - 5 * scale, cx - 4 * scale, cy - 9 * scale, 2.7 * scale, rgba(character.hair, 255));
  canvas.line(cx + 5 * scale, cy - 9 * scale, cx + 24 * scale, cy - 5 * scale, 2.7 * scale, rgba(character.hair, 255));
}

function drawEye(canvas, cx, cy, scale, color) {
  canvas.ellipse(cx, cy, 8.6 * scale, 10.4 * scale, rgba("#fff8ea", 255));
  canvas.ellipse(cx, cy + 1.2 * scale, 5.4 * scale, 8.2 * scale, rgba(color, 250));
  canvas.ellipse(cx + 0.7 * scale, cy + 2.5 * scale, 2.5 * scale, 5.1 * scale, rgba("#21110e", 255));
  canvas.ellipse(cx - 2.4 * scale, cy - 3.5 * scale, 2.5 * scale, 2.5 * scale, rgba("#ffffff", 245));
  canvas.ellipse(cx + 2.1 * scale, cy - 1.2 * scale, 1.2 * scale, 1.2 * scale, rgba("#ffffff", 210));
  canvas.line(cx - 6.2 * scale, cy + 6.5 * scale, cx + 5.4 * scale, cy + 7 * scale, 1.1 * scale, rgba("#ffffff", 64));
}

function drawCardFrame(canvas, character) {
  const width = canvas.width;
  const height = canvas.height;
  const gold = rgba(character.accent, 230);
  for (let inset = 28; inset < 36; inset += 1) {
    canvas.rect(inset, inset, width - inset * 2, 1, gold);
    canvas.rect(inset, height - inset, width - inset * 2, 1, gold);
    canvas.rect(inset, inset, 1, height - inset * 2, gold);
    canvas.rect(width - inset, inset, 1, height - inset * 2, gold);
  }
  for (let inset = 52; inset < 54; inset += 1) {
    canvas.rect(inset, inset, width - inset * 2, 1, rgba("#fff8dc", 70));
    canvas.rect(inset, height - inset, width - inset * 2, 1, rgba("#fff8dc", 70));
    canvas.rect(inset, inset, 1, height - inset * 2, rgba("#fff8dc", 70));
    canvas.rect(width - inset, inset, 1, height - inset * 2, rgba("#fff8dc", 70));
  }
  canvas.line(76, 104, 212, 104, 5, gold);
  canvas.line(76, 104, 76, 240, 5, gold);
  canvas.line(width - 76, 104, width - 212, 104, 5, gold);
  canvas.line(width - 76, 104, width - 76, 240, 5, gold);
  canvas.line(76, height - 104, 212, height - 104, 5, gold);
  canvas.line(76, height - 104, 76, height - 240, 5, gold);
  canvas.line(width - 76, height - 104, width - 212, height - 104, 5, gold);
  canvas.line(width - 76, height - 104, width - 76, height - 240, 5, gold);
}

function glow(canvas, cx, cy, radius, color) {
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(canvas.width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(canvas.height - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = distance(cx, cy, x, y) / radius;
      if (d <= 1) {
        canvas.blendPixel(x, y, withAlpha(color, Math.round(color[3] * (1 - d) * (1 - d))));
      }
    }
  }
}

async function writePng(path, bitmap) {
  await writeFile(path, encodePng(bitmap.width, bitmap.height, bitmap.data));
}

async function copySourceCardIfPresent(source, destination) {
  try {
    await access(source);
    await copyFile(source, destination);
  } catch {
    // Keep the generated fallback when the optional high-quality source card is unavailable.
  }
}

function encodePng(width, height, data) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(data.buffer, y * width * 4, width * 4).copy(raw, rowStart + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([uint32(data.length), typeBuffer, data, uint32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function rgb(hex) {
  return [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((part) => Number.parseInt(part, 16));
}

function rgba(hex, alpha) {
  return [...rgb(hex), alpha];
}

function mix(a, b, t) {
  return [0, 1, 2].map((index) => Math.round(lerp(a[index], b[index], t)));
}

function withAlpha(color, alpha) {
  return [color[0], color[1], color[2], alpha];
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 0.0001) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function rotatePoint(x, y, cx, cy, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

await main();
