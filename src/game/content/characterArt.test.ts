import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { heroes } from "./heroes";
import { bonds, characterArtById, characterArts } from "./characterArt";

const projectRoot = process.cwd();

/** Map Vite-resolved URL paths back to `public/`-relative paths for filesystem checks. */
function publicRelativeFromBrowserPath(browserPath: string): string {
  let path = browserPath.startsWith("/") ? browserPath.slice(1) : browserPath;
  const base = import.meta.env.BASE_URL.replace(/^\/+|\/+$/g, "");
  if (base && path.startsWith(`${base}/`)) {
    path = path.slice(base.length + 1);
  }
  return path;
}

describe("character art manifest", () => {
  it("contains the full playable roster with complete art slots", () => {
    expect(characterArts).toHaveLength(heroes.length);
    for (const art of characterArts) {
      expect(art.cardImage).toMatch(/card\.png$/);
      expect(art.battleImage).toMatch(/battle-idle\.png$/);
      expect(art.attackStrip).toMatch(/attack-strip\.png$/);
      expect([art.cardImage, art.battleImage, art.attackStrip, ...art.attackFrames].every((path) => !path.endsWith(".svg"))).toBe(true);
      expect(art.attackFrames).toHaveLength(4);
      expect(art.attackFrames.every((path) => path.endsWith(".png"))).toBe(true);
      expect(art.attackFrameKeys).toHaveLength(4);
      expect(art.animations?.idle?.framePaths).toHaveLength(6);
      expect(art.animations?.run?.framePaths).toHaveLength(6);
      expect(art.animations?.attack?.framePaths).toHaveLength(8);
      if (art.playable) {
        expect(art.animations?.ultimate?.framePaths).toHaveLength(8);
        expect(art.animations?.ultimate?.frameKeys).toHaveLength(8);
        expect(art.animations?.ultimate?.frameRate).toBe(20);
      } else {
        expect(art.animations?.ultimate).toBeUndefined();
      }
      for (const animation of Object.values(art.animations ?? {})) {
        expect(animation.effectOverlay?.framePaths).toHaveLength(animation.framePaths.length);
        expect(animation.effectOverlay?.frameKeys).toHaveLength(animation.frameKeys.length);
        expect(animation.effectOverlay?.blendMode).toBe("add");
      }
      expect(art.stars).toBeGreaterThanOrEqual(4);
      expect(art.bondIds.length).toBeGreaterThan(0);
    }
  });

  it("links every playable hero to a character art definition", () => {
    for (const hero of heroes) {
      const art = characterArtById[hero.artId];

      expect(art.playable).toBe(true);
      expect(art.textureKey).toBe(hero.spriteKey);
    }
    expect(characterArts.filter((art) => art.playable)).toHaveLength(heroes.length);
  });

  it("has generated browser assets for each manifest path", () => {
    const paths = characterArts.flatMap((art) => [
      art.cardImage,
      art.battleImage,
      art.attackStrip,
      ...art.attackFrames,
      ...Object.values(art.animations ?? {}).flatMap((animation) => [
        ...animation.framePaths,
        ...(animation.effectOverlay?.framePaths ?? [])
      ])
    ]);

    for (const path of paths) {
      const filePath = join(projectRoot, "public", publicRelativeFromBrowserPath(path));
      expect(existsSync(filePath), filePath).toBe(true);
      expect(readFileSync(filePath).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
  });

  it("uses dedicated full-body battle sprites for the full character roster", () => {
    for (const art of characterArts) {
      if (art.playable) {
        expect(art.battleScale).toBeGreaterThanOrEqual(0.62);
        expect(art.battleScale).toBeLessThanOrEqual(0.78);
      }
      expect(art.battleImage).not.toBe(art.cardImage);
      expect(art.battleImage).toMatch(/battle-idle\.png$/);
      expect(pngSize(art.battleImage)).toEqual({ width: 192, height: 224 });
      for (const framePath of art.attackFrames) {
        expect(framePath).not.toBe(art.cardImage);
        expect(pngSize(framePath)).toEqual({ width: 192, height: 224 });
      }
      if (art.playable) {
        for (const framePath of art.animations?.ultimate?.framePaths ?? []) {
          expect(framePath).not.toBe(art.cardImage);
          expect(pngSize(framePath)).toEqual({ width: 192, height: 224 });
        }
      }
      expect(pngSize(art.attackStrip)).toEqual({ width: 768, height: 224 });
    }
  });

  it("keeps active runtime frames centered inside the safe action box", () => {
    for (const art of characterArts) {
      const framePaths = [
        art.battleImage,
        ...Object.values(art.animations ?? {}).flatMap((animation) => animation.framePaths)
      ];

      for (const framePath of framePaths) {
        const bounds = pngAlphaBounds(framePath);
        expect(bounds, framePath).not.toBeNull();
        if (!bounds) {
          continue;
        }
        const centerOffsetX = Math.abs((bounds.left + bounds.right) / 2 - 96);
        const centerOffsetY = Math.abs((bounds.top + bounds.bottom) / 2 - 112);
        const minPadding = Math.min(bounds.left, bounds.top, 192 - bounds.right, 224 - bounds.bottom);
        const occupancy = Math.max((bounds.right - bounds.left) / 192, (bounds.bottom - bounds.top) / 224);

        expect(centerOffsetX, `${framePath} horizontal center`).toBeLessThanOrEqual(18);
        expect(centerOffsetY, `${framePath} vertical center`).toBeLessThanOrEqual(16);
        expect(minPadding, `${framePath} padding`).toBeGreaterThanOrEqual(8);
        expect(occupancy, `${framePath} safe-box occupancy`).toBeLessThanOrEqual(0.71);
      }
    }
  });

  it("keeps SVG assets out of the active character art directory", () => {
    const activeRoot = join(projectRoot, "public", "assets", "characters");
    const files = listFiles(activeRoot);

    expect(files.some((path) => path.endsWith(".svg"))).toBe(false);
  });

  it("does not keep or regenerate legacy SVG character placeholders", () => {
    expect(existsSync(join(projectRoot, "scripts", "legacy", "generate-character-assets-svg.mjs"))).toBe(false);
    expect(existsSync(join(projectRoot, "public", "assets", "legacy", "characters-svg"))).toBe(false);
  });

  it("defines collection bonds for every referenced bond id", () => {
    const bondIds = new Set(bonds.map((bond) => bond.id));

    for (const art of characterArts) {
      for (const id of art.bondIds) {
        expect(bondIds.has(id)).toBe(true);
      }
    }
  });
});

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function pngSize(assetPath: string): { width: number; height: number } {
  const filePath = join(projectRoot, "public", publicRelativeFromBrowserPath(assetPath));
  const data = readFileSync(filePath);

  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20)
  };
}

function pngAlphaBounds(assetPath: string): { left: number; top: number; right: number; bottom: number } | null {
  const filePath = join(projectRoot, "public", publicRelativeFromBrowserPath(assetPath));
  const data = readFileSync(filePath);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
    } else if (type === "IDAT") {
      idatChunks.push(chunk);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`${assetPath}: expected 8-bit RGBA PNG`);
  }

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(height * stride);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowOffset = y * stride;
    const previousRowOffset = rowOffset - stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceOffset];
      sourceOffset += 1;
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[previousRowOffset + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[previousRowOffset + x - bytesPerPixel] : 0;
      const predictor =
        filter === 0 ? 0 :
        filter === 1 ? left :
        filter === 2 ? up :
        filter === 3 ? Math.floor((left + up) / 2) :
        paethPredictor(left, up, upLeft);
      pixels[rowOffset + x] = (raw + predictor) & 0xff;
    }
  }

  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[y * stride + x * bytesPerPixel + 3];
      if (alpha <= 8) {
        continue;
      }
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }

  return right > left && bottom > top ? { left, top, right, bottom } : null;
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  return upDistance <= upLeftDistance ? up : upLeft;
}
