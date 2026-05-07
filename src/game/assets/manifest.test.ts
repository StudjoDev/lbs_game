import { describe, expect, it } from "vitest";
import {
  vfxProfiles,
  visualAnimationEntries,
  visualParticleAssets,
  visualSpritesheetEntries,
  type VfxProfile
} from "./manifest";
import { heroes } from "../content/heroes";
import { ultimateProfiles } from "../content/ultimates";

function profileAnimationKeys(profile: VfxProfile): readonly string[] {
  if (profile.animationKeys && profile.animationKeys.length > 0) {
    return profile.animationKeys;
  }
  return profile.animationKey ? [profile.animationKey] : [];
}

describe("visual asset manifest", () => {
  it("defines profiles for all authored hero and ultimate vfx keys", () => {
    const authoredKeys = new Set<string>();
    for (const hero of heroes) {
      authoredKeys.add(hero.autoAbility.vfxKey);
      authoredKeys.add(hero.manualAbility.vfxKey);
    }
    for (const ultimate of ultimateProfiles) {
      authoredKeys.add(ultimate.vfxKey);
      authoredKeys.add(ultimate.presentation.startVfxKey);
      authoredKeys.add(ultimate.presentation.pulseVfxKey);
      authoredKeys.add(ultimate.presentation.finisherVfxKey);
      authoredKeys.add(ultimate.finisherVfxKey);
      authoredKeys.add(ultimate.finisherAbility.vfxKey);
      authoredKeys.add(ultimate.pulseAbility.vfxKey);
      if (ultimate.empoweredPulseAbility) {
        authoredKeys.add(ultimate.empoweredPulseAbility.vfxKey);
      }
      if (ultimate.alternatePulseAbility) {
        authoredKeys.add(ultimate.alternatePulseAbility.vfxKey);
      }
      if (ultimate.bonusPulseAbility) {
        authoredKeys.add(ultimate.bonusPulseAbility.vfxKey);
      }
    }
    authoredKeys.add("lubu_musou_warning");
    authoredKeys.add("lubu_musou_rampage");
    authoredKeys.add("lubu_musou_halberd");

    for (const key of authoredKeys) {
      expect(vfxProfiles[key], key).toBeDefined();
    }
  });

  it("keeps profile particle and animation references in the loaded manifest", () => {
    const particleKeys = new Set<string>(visualParticleAssets.map((asset) => asset.key));
    const animationKeys = new Set<string>(visualAnimationEntries.map((entry) => entry.key));

    for (const [profileKey, profile] of Object.entries(vfxProfiles)) {
      if (profile.particleKey) {
        expect(particleKeys.has(profile.particleKey), `${profileKey} particle ${profile.particleKey}`).toBe(true);
      }
      for (const animationKey of profileAnimationKeys(profile)) {
        expect(animationKeys.has(animationKey), `${profileKey} animation ${animationKey}`).toBe(true);
      }
    }
  });

  it("keeps square lightstreak panel effects out of the runtime manifest", () => {
    const bannedAnimationKey: string = "fx_brackeys_lightstreaks";
    const bannedSpritesheetPath: string = "lightstreaks-6x5.png";

    expect(visualAnimationEntries.some((entry) => entry.key === bannedAnimationKey), bannedAnimationKey).toBe(false);
    expect(
      visualSpritesheetEntries.some((entry) => entry.path.includes(bannedSpritesheetPath)),
      bannedSpritesheetPath
    ).toBe(false);

    for (const [profileKey, profile] of Object.entries(vfxProfiles)) {
      expect(profileAnimationKeys(profile), `${profileKey} uses square lightstreaks`).not.toContain(bannedAnimationKey);
    }
  });
});
