import { describe, expect, it } from "vitest";
import { defaultDisplaySettings, normalizeDisplaySettings } from "./settings";

describe("display settings", () => {
  it("uses defaults for missing or invalid values", () => {
    expect(normalizeDisplaySettings(null)).toEqual(defaultDisplaySettings);
    expect(normalizeDisplaySettings({ viewScale: Number.NaN })).toEqual(defaultDisplaySettings);
  });

  it("clamps view scale to supported range", () => {
    expect(normalizeDisplaySettings({ viewScale: 0.2 }).viewScale).toBe(1);
    expect(normalizeDisplaySettings({ viewScale: 1.35 }).viewScale).toBe(1.35);
    expect(normalizeDisplaySettings({ viewScale: 4 }).viewScale).toBe(1.6);
  });

  it("normalizes the rest of the presentation controls", () => {
    const normalized = normalizeDisplaySettings({
      uiScale: 2,
      effectsIntensity: 0.1,
      screenShake: -1,
      showDamageNumbers: false
    });

    expect(normalized.uiScale).toBe(1.15);
    expect(normalized.effectsIntensity).toBe(0.5);
    expect(normalized.screenShake).toBe(0);
    expect(normalized.showDamageNumbers).toBe(false);
  });
});
