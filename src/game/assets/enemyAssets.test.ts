import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enemyVisualProfiles } from "./manifest";

const projectRoot = process.cwd();
const enemyAuditScript = join(projectRoot, "scripts", "audit_enemy_runtime_frames.py");

describe("enemy runtime assets", () => {
  it("keeps enemy display scales in the same range as warrior battle sprites", () => {
    expect(enemyVisualProfiles.infantry.animationScale).toBeLessThanOrEqual(0.72);
    expect(enemyVisualProfiles.archer.animationScale).toBeLessThanOrEqual(0.72);
    expect(enemyVisualProfiles.shield.animationScale).toBeLessThanOrEqual(0.74);
    expect(enemyVisualProfiles.cavalry.animationScale).toBeLessThanOrEqual(0.74);
    expect(enemyVisualProfiles.captain.animationScale).toBeLessThanOrEqual(0.76);
    expect(enemyVisualProfiles.lubu.animationScale).toBeLessThanOrEqual(0.78);
  });

  it("keeps enemy frames on the warrior runtime grid and safe box", () => {
    const output = execFileSync(
      "python",
      [
        enemyAuditScript,
        "--no-contact-sheet",
        "--min-padding",
        "8",
        "--max-occupancy",
        "0.67",
        "--max-center-offset-x",
        "18",
        "--max-center-offset-y",
        "16"
      ],
      {
        cwd: projectRoot,
        encoding: "utf8"
      }
    );

    expect(output).toContain("audited 78 enemy frames");
  });
});
