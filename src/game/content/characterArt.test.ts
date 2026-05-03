import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
  it("contains the eight collection characters with complete art slots", () => {
    expect(characterArts).toHaveLength(8);
    for (const art of characterArts) {
      expect(art.cardImage).toMatch(/card\.png$/);
      expect(art.battleImage).toMatch(/battle-idle\.png$/);
      expect(art.attackStrip).toMatch(/attack-strip\.png$/);
      expect([art.cardImage, art.battleImage, art.attackStrip, ...art.attackFrames].every((path) => !path.endsWith(".svg"))).toBe(true);
      expect(art.attackFrames).toHaveLength(4);
      expect(art.attackFrames.every((path) => path.endsWith(".png"))).toBe(true);
      expect(art.attackFrameKeys).toHaveLength(4);
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
  });

  it("has generated browser assets for each manifest path", () => {
    const paths = characterArts.flatMap((art) => [art.cardImage, art.battleImage, art.attackStrip, ...art.attackFrames]);

    for (const path of paths) {
      const filePath = join(projectRoot, "public", publicRelativeFromBrowserPath(path));
      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
  });

  it("uses dedicated full-body battle sprites for the full character roster", () => {
    for (const art of characterArts) {
      if (art.playable) {
        expect(art.battleScale).toBe(0.72);
      }
      expect(art.battleImage).not.toBe(art.cardImage);
      expect(art.battleImage).toMatch(/battle-idle\.png$/);
      expect(pngSize(art.battleImage)).toEqual({ width: 192, height: 224 });
      for (const framePath of art.attackFrames) {
        expect(framePath).not.toBe(art.cardImage);
        expect(pngSize(framePath)).toEqual({ width: 192, height: 224 });
      }
      expect(pngSize(art.attackStrip)).toEqual({ width: 768, height: 224 });
    }
  });

  it("keeps SVG assets out of the active character art directory", () => {
    const activeRoot = join(projectRoot, "public", "assets", "characters");
    const files = listFiles(activeRoot);

    expect(files.some((path) => path.endsWith(".svg"))).toBe(false);
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
