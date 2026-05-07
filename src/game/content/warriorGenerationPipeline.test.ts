import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const pipelineScript = join(projectRoot, "scripts", "generate_warrior_pipeline.py");
const fixtureSpec = join(projectRoot, "scripts", "warrior-generation", "fixtures", "pipeline_fixture.json");
const outputRoot = join(projectRoot, "output");
const tempDirs: string[] = [];

function runPipeline(args: string[]): string {
  return execFileSync("python", [pipelineScript, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function runPipelineFailure(args: string[]): string {
  try {
    runPipeline(args);
  } catch (error) {
    const result = error as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    expect(result.status).not.toBe(0);
    return `${result.stdout?.toString() ?? ""}${result.stderr?.toString() ?? ""}`;
  }
  throw new Error("Expected warrior generation pipeline to fail");
}

function tempSpec(mutator: (spec: Record<string, unknown>) => void): string {
  mkdirSync(outputRoot, { recursive: true });
  const dir = mkdtempSync(join(outputRoot, "warrior-pipeline-test-"));
  tempDirs.push(dir);
  const spec = JSON.parse(readFileSync(fixtureSpec, "utf8")) as Record<string, unknown>;
  mutator(spec);
  const path = join(dir, "spec.json");
  writeFileSync(path, JSON.stringify(spec, null, 2), "utf8");
  return path;
}

describe("warrior generation pipeline", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop() as string, { recursive: true, force: true });
    }
  });

  it("validates a complete warrior spec without generating assets", () => {
    expect(runPipeline(["--validate-only", "--spec", fixtureSpec])).toContain("validated pipeline_fixture");
  });

  it("rejects duplicate hero ids, missing bonds, and invalid vfx keys", () => {
    const duplicateSpec = tempSpec((spec) => {
      spec.id = "liubei";
    });
    expect(runPipelineFailure(["--validate-only", "--spec", duplicateSpec])).toContain("duplicate hero id liubei");

    const missingBondSpec = tempSpec((spec) => {
      spec.id = "pipeline_missing_bond";
      spec.bondIds = ["missing_bond"];
    });
    expect(runPipelineFailure(["--validate-only", "--spec", missingBondSpec])).toContain("missing bond missing_bond");

    const invalidVfxSpec = tempSpec((spec) => {
      spec.id = "pipeline_bad_vfx";
      const abilities = spec.abilities as { auto: { vfxKey: string } };
      abilities.auto.vfxKey = "missing_vfx_key";
    });
    expect(runPipelineFailure(["--validate-only", "--spec", invalidVfxSpec])).toContain("missing_vfx_key");
  });

  it("rejects square or panel-like effect grammar before generation", () => {
    const bannedSpec = tempSpec((spec) => {
      spec.id = "pipeline_square_effect";
      const effects = spec.effects as { attack: { shape: string } };
      effects.attack.shape = "square panel burst";
    });

    expect(runPipelineFailure(["--validate-only", "--spec", bannedSpec])).toContain("banned square/panel effect language");
  });

  it("rejects specs that cannot supply true per-frame raster poses", () => {
    const missingFramesSpec = tempSpec((spec) => {
      spec.id = "pipeline_missing_true_frames";
      const sourceImages = spec.sourceImages as { animationFrames?: unknown };
      delete sourceImages.animationFrames;
    });

    expect(runPipelineFailure(["--validate-only", "--spec", missingFramesSpec])).toContain("sourceImages.animationFrames is required");
  });

  it("inserts new hero ids only into the HeroId union", () => {
    const source = [
      "export type HeroId =",
      '  | "alpha"',
      '  | "beta";',
      "export type CharacterId = HeroId;",
      "export type CombatEventType =",
      '  | "hit";'
    ].join("\n");
    const output = execFileSync(
      "python",
      [
        "-c",
        [
          "import sys",
          "sys.path.insert(0, r'scripts')",
          "import generate_warrior_pipeline as pipeline",
          "source = sys.stdin.read()",
          "print(pipeline.insert_hero_id_type(source, 'gamma'), end='')"
        ].join("; ")
      ],
      {
        cwd: projectRoot,
        input: source,
        encoding: "utf8"
      }
    );

    const normalizedOutput = output.replace(/\r\n/g, "\n");
    expect(normalizedOutput).toContain('  | "gamma";\nexport type CharacterId = HeroId;');
    expect(normalizedOutput).toContain('export type CombatEventType =\n  | "hit";');
  });

  it("runs dry-run into candidate output without mutating the formal roster", () => {
    mkdirSync(outputRoot, { recursive: true });
    const dryRunRoot = mkdtempSync(join(outputRoot, "warrior-pipeline-dryrun-"));
    const heroesPath = join(projectRoot, "src", "game", "content", "heroes.ts");
    const beforeHeroes = readFileSync(heroesPath, "utf8");

    expect(runPipeline(["--dry-run", "--max-retries", "0", "--spec", fixtureSpec, "--output-root", dryRunRoot])).toContain(
      "dry-run passed pipeline_fixture"
    );

    const reportPath = join(dryRunRoot, "pipeline_fixture", "candidate", "generation-report.json");
    expect(existsSync(reportPath)).toBe(true);
    expect(JSON.parse(readFileSync(reportPath, "utf8"))).toMatchObject({
      heroId: "pipeline_fixture",
      promoted: false,
      status: "passed"
    });
    expect(readFileSync(heroesPath, "utf8")).toBe(beforeHeroes);
    rmSync(dryRunRoot, { recursive: true, force: true });
  });
});
