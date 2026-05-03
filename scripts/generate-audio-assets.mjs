import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 44100;
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(root, "public", "assets", "audio");
const sourceRoot = join(root, "scripts", "source", "audio");
let noiseSeed = 0x5eed1234;

const musicFiles = [
  ["music-menu.wav", renderMenuMusic],
  ["music-battle.wav", renderBattleMusic],
  ["music-boss.wav", renderBossMusic]
];

const sourcedMusicFiles = [
  ["menu_chill.wav", "music-menu.wav"],
  ["determined_pursuit_loop.wav", "music-battle.wav"],
  ["boss_battle_9_metal_loop.wav", "music-boss.wav"]
];

const sfxFiles = [
  ["sfx-hit.wav", renderHit],
  ["sfx-crit.wav", renderCrit],
  ["sfx-kill.wav", renderKill],
  ["sfx-level-up.wav", renderLevelUp],
  ["sfx-manual.wav", renderManual],
  ["sfx-evolution.wav", renderEvolution],
  ["sfx-morale.wav", renderMorale],
  ["sfx-boss.wav", renderBossCue],
  ["sfx-player-hit.wav", renderPlayerHit],
  ["sfx-victory.wav", renderVictory],
  ["sfx-defeat.wav", renderDefeat],
  ["sfx-ui-select.wav", renderUiSelect],
  ["sfx-ui-confirm.wav", renderUiConfirm]
];

await mkdir(outputRoot, { recursive: true });

for (const [fileName, render] of [...musicFiles, ...sfxFiles]) {
  await writeFile(join(outputRoot, fileName), encodeWav(render()));
}

for (const [sourceFile, outputFile] of sourcedMusicFiles) {
  await copyFile(join(sourceRoot, sourceFile), join(outputRoot, outputFile));
}

console.log(`Generated ${sfxFiles.length} SFX and copied ${sourcedMusicFiles.length} sourced music assets in ${outputRoot}`);

function renderMenuMusic() {
  const buffer = createBuffer(24);
  addBreathingPad(buffer, 146.83, 0, 24, 0.085, [1, 1.5, 2, 2.25], -0.12);
  addBreathingPad(buffer, 220, 0, 24, 0.048, [1, 1.25, 1.5, 2], 0.18);
  addShimmerBed(buffer, 0, 24, 0.04);

  const melody = [0, 3, 5, 7, 10, 12, 10, 7, 5, 7, 3, 0, 0, 5, 7, 12];
  melody.forEach((step, index) => {
    const t = index * 0.72;
    const pan = index % 2 === 0 ? -0.24 : 0.24;
    addPluck(buffer, t, 1.1, midiToHz(57 + step), 0.18, pan);
    if (index % 4 === 2) {
      addBell(buffer, t + 0.28, 1.35, midiToHz(69 + step), 0.08, -pan);
    }
  });

  for (let bar = 0; bar < 4; bar += 1) {
    addKotoRoll(buffer, bar * 5.76 + 4.2, 0.86, [midiToHz(69), midiToHz(72), midiToHz(76), midiToHz(79)], 0.07, bar % 2 ? 0.35 : -0.35);
  }

  addWrappedDelay(buffer, 0.32, 0.22, 0.33);
  addWrappedDelay(buffer, 0.47, 0.14, 0.18);
  addReverb(buffer, 0.055, true);
  master(buffer, 0.82);
  return buffer;
}

function renderBattleMusic() {
  const buffer = createBuffer(24);
  addBreathingPad(buffer, 55, 0, 24, 0.072, [1, 1.5, 2, 2.5, 3], -0.08);
  addBreathingPad(buffer, 82.41, 0, 24, 0.05, [1, 2, 3], 0.12);
  addBattleAir(buffer, 0, 24, 0.045);

  for (let beat = 0; beat < 96; beat += 1) {
    const t = beat * 0.25;
    const quarter = beat % 4 === 0;
    const downbeat = beat % 16 === 0;
    const offbeat = beat % 4 === 2;
    if (quarter) {
      addTaiko(buffer, t, downbeat ? 0.9 : 0.56, downbeat ? -0.08 : 0.08);
      addBassThump(buffer, t + 0.01, 0.18, downbeat ? 0.34 : 0.2);
    }
    if (offbeat) {
      addTaikoRim(buffer, t + 0.015, 0.28, beat % 8 === 2 ? 0.34 : -0.34);
    }
    if (beat % 2 === 1) {
      addMetalTick(buffer, t + 0.01, 0.11, beat % 8 < 4 ? 0.45 : -0.45);
    }
    if (beat % 16 === 14) {
      addWarFill(buffer, t - 0.22, 0.34, beat % 32 === 14 ? -0.28 : 0.28);
    }
    const bassSteps = [0, 0, 3, 0, 5, 3, 0, -2, 0, 0, 5, 7, 10, 7, 5, 3];
    addBassPluck(buffer, t, 0.24, midiToHz(33 + bassSteps[beat % bassSteps.length]), quarter ? 0.22 : 0.14, -0.03);
  }

  const battleHook = [0, 3, 5, 7, 10, 12, 10, 7, 5, 7, 10, 15, 14, 10, 7, 5];
  battleHook.forEach((step, index) => {
    const t = index * 0.375 + 0.04;
    addLead(buffer, t, 0.34, midiToHz(57 + step), 0.18, index % 2 ? 0.3 : -0.3);
    if (index % 4 === 0) {
      addBrassHit(buffer, t, 0.36, midiToHz(45 + step), 0.12, index % 8 === 0 ? -0.18 : 0.18);
    }
  });
  battleHook.forEach((step, index) => {
    const t = 6 + index * 0.375 + 0.04;
    addLead(buffer, t, 0.34, midiToHz(60 + step), 0.19, index % 2 ? -0.32 : 0.32);
    addPluck(buffer, t + 0.06, 0.46, midiToHz(72 + step), 0.07, index % 2 ? 0.42 : -0.42);
  });
  battleHook.forEach((step, index) => {
    const t = 12 + index * 0.375 + 0.02;
    addBrassHit(buffer, t, 0.38, midiToHz(45 + step), 0.16, index % 2 ? 0.18 : -0.18);
    addLead(buffer, t + 0.04, 0.34, midiToHz(60 + step), 0.14, index % 2 ? -0.26 : 0.26);
  });
  battleHook.forEach((step, index) => {
    const t = 18 + index * 0.375 + 0.04;
    addLead(buffer, t, 0.34, midiToHz(64 + step), 0.2, index % 2 ? 0.38 : -0.38);
    if (index % 4 === 3) {
      addWhoosh(buffer, t + 0.02, 0.34, 0.1, index % 8 === 3 ? -0.45 : 0.45);
    }
  });

  addWrappedDelay(buffer, 0.1875, 0.13, 0.18);
  addWrappedDelay(buffer, 0.375, 0.1, 0.16);
  addReverb(buffer, 0.03, true);
  master(buffer, 0.88);
  return buffer;
}

function renderBossMusic() {
  const buffer = createBuffer(24);
  addBreathingPad(buffer, 49, 0, 24, 0.105, [1, 1.01, 1.5, 2, 2.01], 0);
  addBreathingPad(buffer, 73.42, 0, 24, 0.055, [1, 1.5, 2.5], -0.18);

  for (let beat = 0; beat < 36; beat += 1) {
    const t = beat * (2 / 3);
    addTaiko(buffer, t, beat % 3 === 0 ? 0.82 : 0.48, beat % 2 ? 0.12 : -0.12);
    addBassPluck(buffer, t + 0.05, 0.62, beat % 6 < 3 ? 61.74 : 65.41, 0.34, 0);
    if (beat % 3 === 2) {
      addNoiseBurst(buffer, t + 0.24, 0.24, 0.16, 520, 0.35);
    }
  }

  const motif = [0, 1, 3, 6, 3, 1, 0, -2, 0, 3, 6, 8];
  motif.forEach((step, index) => {
    const t = index * 0.92 + 0.14;
    addBrassHit(buffer, t, 0.62, midiToHz(40 + step), 0.21, index % 2 ? 0.26 : -0.26);
    addLead(buffer, t + 0.08, 0.5, midiToHz(52 + step), 0.09, index % 2 ? -0.22 : 0.22);
  });

  addWrappedDelay(buffer, 0.333, 0.15, 0.2);
  addReverb(buffer, 0.06, true);
  master(buffer, 0.86);
  return buffer;
}

function renderHit() {
  const buffer = createBuffer(0.42);
  addBladeTransient(buffer, 0, 0.26, 0.42, -0.18);
  addBassThump(buffer, 0.012, 0.18, 0.24);
  addReverb(buffer, 0.025, false);
  master(buffer, 0.84);
  return buffer;
}

function renderCrit() {
  const buffer = createBuffer(0.72);
  addBladeTransient(buffer, 0, 0.34, 0.36, -0.22);
  addPitchSweep(buffer, 0.015, 0.36, 620, 1880, 0.34, "sine", 0.22);
  addBell(buffer, 0.16, 0.48, 1864.66, 0.16, 0.34);
  addSparkle(buffer, 0.12, 0.38, 0.07);
  addReverb(buffer, 0.05, false);
  master(buffer, 0.88);
  return buffer;
}

function renderKill() {
  const buffer = createBuffer(0.78);
  addTaiko(buffer, 0, 0.72, -0.04);
  addBladeTransient(buffer, 0.05, 0.38, 0.24, 0.18);
  addBell(buffer, 0.16, 0.52, 987.77, 0.12, 0.24);
  addNoiseBurst(buffer, 0.16, 0.28, 0.08, 900, 0.22);
  addReverb(buffer, 0.04, false);
  master(buffer, 0.88);
  return buffer;
}

function renderLevelUp() {
  const buffer = createBuffer(1.35);
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
    addBell(buffer, index * 0.13, 1.0, freq, 0.16, index % 2 ? 0.35 : -0.35);
    addPluck(buffer, index * 0.13 + 0.03, 0.7, freq / 2, 0.08, index % 2 ? -0.2 : 0.2);
  });
  addShimmerBed(buffer, 0.26, 0.92, 0.08);
  addReverb(buffer, 0.075, false);
  master(buffer, 0.86);
  return buffer;
}

function renderManual() {
  const buffer = createBuffer(0.9);
  addWhoosh(buffer, 0, 0.42, 0.24, -0.32);
  addPitchSweep(buffer, 0.06, 0.38, 210, 780, 0.28, "saw", 0.18);
  addBladeTransient(buffer, 0.3, 0.36, 0.32, 0.28);
  addTaikoRim(buffer, 0.34, 0.28, 0);
  addReverb(buffer, 0.04, false);
  master(buffer, 0.86);
  return buffer;
}

function renderEvolution() {
  const buffer = createBuffer(1.9);
  addBreathingPad(buffer, 130.81, 0, 1.9, 0.12, [1, 1.5, 2, 3], 0);
  addPitchSweep(buffer, 0.05, 1.12, 146.83, 880, 0.34, "saw", -0.14);
  [261.63, 392, 523.25, 783.99, 1046.5].forEach((freq, index) => {
    addBell(buffer, 0.48 + index * 0.12, 0.92, freq, 0.15, index % 2 ? 0.38 : -0.38);
  });
  addSparkle(buffer, 0.74, 0.82, 0.11);
  addTaiko(buffer, 1.08, 0.56, 0);
  addReverb(buffer, 0.085, false);
  master(buffer, 0.9);
  return buffer;
}

function renderMorale() {
  const buffer = createBuffer(1.2);
  for (let index = 0; index < 6; index += 1) {
    addTaikoRim(buffer, index * 0.09, 0.2, index % 2 ? 0.28 : -0.28);
  }
  [220, 330, 440, 660, 880].forEach((freq, index) => {
    addBrassHit(buffer, 0.42 + index * 0.05, 0.42, freq, 0.12, index % 2 ? 0.18 : -0.18);
  });
  addShimmerBed(buffer, 0.44, 0.62, 0.06);
  addReverb(buffer, 0.05, false);
  master(buffer, 0.88);
  return buffer;
}

function renderBossCue() {
  const buffer = createBuffer(1.45);
  addPitchSweep(buffer, 0, 1.1, 146.83, 46.25, 0.5, "saw", 0);
  addTaiko(buffer, 0.22, 0.82, -0.06);
  addNoiseBurst(buffer, 0.18, 0.62, 0.18, 420, 0.48);
  addBrassHit(buffer, 0.62, 0.54, 73.42, 0.24, 0.08);
  addReverb(buffer, 0.075, false);
  master(buffer, 0.88);
  return buffer;
}

function renderPlayerHit() {
  const buffer = createBuffer(0.58);
  addBassThump(buffer, 0, 0.28, 0.5);
  addNoiseBurst(buffer, 0.02, 0.2, 0.14, 640, 0.22);
  addPitchSweep(buffer, 0.02, 0.18, 240, 90, 0.22, "triangle", -0.1);
  addReverb(buffer, 0.025, false);
  master(buffer, 0.86);
  return buffer;
}

function renderVictory() {
  const buffer = createBuffer(2.05);
  [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, index) => {
    addBell(buffer, index * 0.16, 1.1, freq, 0.16, index % 2 ? 0.32 : -0.32);
  });
  [261.63, 329.63, 392, 523.25].forEach((freq) => addBrassHit(buffer, 0.88, 0.92, freq, 0.14, 0));
  addShimmerBed(buffer, 0.86, 0.9, 0.08);
  addReverb(buffer, 0.08, false);
  master(buffer, 0.88);
  return buffer;
}

function renderDefeat() {
  const buffer = createBuffer(1.85);
  [392, 329.63, 261.63, 196, 146.83].forEach((freq, index) => {
    addLead(buffer, index * 0.22, 0.7, freq, 0.13, index % 2 ? 0.12 : -0.12);
  });
  addBreathingPad(buffer, 98, 0, 1.85, 0.08, [1, 1.5, 2], 0);
  addBassThump(buffer, 0.86, 0.55, 0.28);
  addReverb(buffer, 0.07, false);
  master(buffer, 0.82);
  return buffer;
}

function renderUiSelect() {
  const buffer = createBuffer(0.22);
  addBell(buffer, 0, 0.18, 1174.66, 0.15, -0.22);
  addBell(buffer, 0.035, 0.18, 1760, 0.08, 0.22);
  addReverb(buffer, 0.035, false);
  master(buffer, 0.72);
  return buffer;
}

function renderUiConfirm() {
  const buffer = createBuffer(0.38);
  addBell(buffer, 0, 0.3, 880, 0.16, -0.2);
  addBell(buffer, 0.08, 0.28, 1320, 0.13, 0.24);
  addBassThump(buffer, 0.02, 0.12, 0.16);
  addReverb(buffer, 0.035, false);
  master(buffer, 0.78);
  return buffer;
}

function createBuffer(seconds) {
  const length = Math.ceil(seconds * sampleRate);
  return {
    left: new Float32Array(length),
    right: new Float32Array(length),
    seconds
  };
}

function addBreathingPad(buffer, baseFreq, start, duration, amp, ratios, pan) {
  const startIndex = toIndex(start);
  const endIndex = Math.min(buffer.left.length, toIndex(start + duration));
  for (let i = startIndex; i < endIndex; i += 1) {
    const t = i / sampleRate - start;
    const env = Math.min(1, t / 1.6, (duration - t) / 1.6);
    let value = 0;
    ratios.forEach((ratio, index) => {
      const drift = Math.sin((t + index) * 0.19) * 0.0035;
      value += osc("triangle", baseFreq * ratio * (1 + drift), t + index * 0.017) / ratios.length;
      value += osc("sine", baseFreq * ratio * 0.5, t + index * 0.011) / (ratios.length * 2);
    });
    writeStereo(buffer, i, value * amp * Math.max(0, env), pan + Math.sin(t * 0.27) * 0.12);
  }
}

function addShimmerBed(buffer, start, duration, amp) {
  for (let pulse = 0; pulse < duration * 1.5; pulse += 1) {
    const t = start + pulse * 0.66 + nextNoise() * 0.08;
    const freq = midiToHz(76 + [0, 2, 5, 7, 10, 12][pulse % 6]);
    addBell(buffer, t, 1.15, freq, amp * (0.65 + nextNoise() * 0.35), nextNoise() * 1.2 - 0.6);
  }
}

function addPluck(buffer, start, duration, freq, amp, pan) {
  addTone(buffer, start, duration, freq, amp, "triangle", pan, 0.006, duration * 0.24);
  addTone(buffer, start, duration * 0.62, freq * 2.01, amp * 0.28, "sine", pan * -0.8, 0.004, duration * 0.18);
  addNoiseBurst(buffer, start, Math.min(0.08, duration), amp * 0.08, 3200, 0.04, pan);
}

function addKotoRoll(buffer, start, spacing, freqs, amp, pan) {
  freqs.forEach((freq, index) => {
    const localPan = pan + (index / Math.max(1, freqs.length - 1) - 0.5) * 0.42;
    addPluck(buffer, start + index * spacing * 0.16, 0.82, freq, amp * (1 - index * 0.08), localPan);
  });
}

function addBell(buffer, start, duration, freq, amp, pan) {
  addTone(buffer, start, duration, freq, amp, "sine", pan, 0.004, duration * 0.36);
  addTone(buffer, start, duration * 0.88, freq * 2.01, amp * 0.38, "sine", -pan * 0.6, 0.002, duration * 0.22);
  addTone(buffer, start, duration * 0.62, freq * 3.02, amp * 0.12, "triangle", pan * 0.4, 0.001, duration * 0.18);
}

function addLead(buffer, start, duration, freq, amp, pan) {
  addTone(buffer, start, duration, freq, amp, "triangle", pan, 0.03, duration * 0.52, 0.012);
  addTone(buffer, start + 0.012, duration * 0.82, freq * 2, amp * 0.18, "sine", pan * -0.6, 0.02, duration * 0.4, 0.008);
}

function addBrassHit(buffer, start, duration, freq, amp, pan) {
  addTone(buffer, start, duration, freq, amp, "saw", pan, 0.035, duration * 0.42);
  addTone(buffer, start, duration, freq * 1.5, amp * 0.24, "triangle", -pan * 0.5, 0.025, duration * 0.35);
  addNoiseBurst(buffer, start, 0.08, amp * 0.08, 1200, 0.08, pan);
}

function addBassPluck(buffer, start, duration, freq, amp, pan) {
  addTone(buffer, start, duration, freq, amp, "sine", pan, 0.005, duration * 0.18);
  addTone(buffer, start, duration * 0.45, freq * 2, amp * 0.18, "triangle", pan, 0.003, duration * 0.14);
}

function addTaiko(buffer, start, amp, pan) {
  const duration = 0.42;
  const startIndex = toIndex(start);
  const endIndex = Math.min(buffer.left.length, toIndex(start + duration));
  let phase = 0;
  for (let i = startIndex; i < endIndex; i += 1) {
    const t = i / sampleRate - start;
    const p = t / duration;
    const freq = 155 * (1 - p) + 48 * p;
    phase += freq / sampleRate;
    const body = Math.sin(phase * Math.PI * 2) * Math.exp(-p * 5.4);
    const skin = (nextNoise() * 2 - 1) * Math.exp(-p * 24) * 0.36;
    writeStereo(buffer, i, (body + skin) * amp, pan);
  }
}

function addTaikoRim(buffer, start, amp, pan) {
  addNoiseBurst(buffer, start, 0.12, amp, 2100, 0.05, pan);
  addTone(buffer, start, 0.16, 760, amp * 0.45, "triangle", pan, 0.002, 0.045);
}

function addWarFill(buffer, start, amp, pan) {
  for (let hit = 0; hit < 4; hit += 1) {
    addTaikoRim(buffer, start + hit * 0.075, amp * (0.62 + hit * 0.14), pan * (hit % 2 === 0 ? 1 : -1));
  }
  addWhoosh(buffer, start, 0.34, amp * 0.18, pan);
}

function addBattleAir(buffer, start, duration, amp) {
  for (let pulse = 0; pulse < duration * 4; pulse += 1) {
    const t = start + pulse * 0.25 + 0.02;
    const pan = pulse % 2 === 0 ? -0.56 : 0.56;
    addNoiseBurst(buffer, t, 0.055, amp * (pulse % 4 === 0 ? 0.8 : 0.5), 5200, 0.035, pan);
  }
}

function addMetalTick(buffer, start, amp, pan) {
  addBell(buffer, start, 0.22, 2200, amp * 0.7, pan);
  addNoiseBurst(buffer, start, 0.05, amp * 0.18, 3600, 0.04, pan);
}

function addBladeTransient(buffer, start, duration, amp, pan) {
  addNoiseBurst(buffer, start, duration * 0.34, amp * 0.7, 3600, 0.06, pan);
  addPitchSweep(buffer, start, duration, 980, 2200, amp * 0.36, "triangle", -pan);
}

function addWhoosh(buffer, start, duration, amp, pan) {
  const startIndex = toIndex(start);
  const endIndex = Math.min(buffer.left.length, toIndex(start + duration));
  let held = 0;
  for (let i = startIndex; i < endIndex; i += 1) {
    const t = i / sampleRate - start;
    const p = t / duration;
    if (i % 12 === 0) {
      held = nextNoise() * 2 - 1;
    }
    const env = Math.sin(Math.PI * p) * Math.sin(Math.PI * p);
    writeStereo(buffer, i, held * amp * env, pan + (p - 0.5) * 0.7);
  }
}

function addSparkle(buffer, start, duration, amp) {
  for (let i = 0; i < 20; i += 1) {
    addBell(buffer, start + nextNoise() * duration, 0.34 + nextNoise() * 0.3, midiToHz(82 + Math.floor(nextNoise() * 14)), amp, nextNoise() * 1.4 - 0.7);
  }
}

function addBassThump(buffer, start, duration, amp) {
  addPitchSweep(buffer, start, duration, 150, 54, amp, "sine", 0);
  addNoiseBurst(buffer, start, Math.min(0.08, duration), amp * 0.18, 420, 0.04, 0);
}

function addTone(buffer, start, duration, freq, amp, wave, pan, attack = 0.01, decay = duration * 0.6, vibrato = 0) {
  const startIndex = toIndex(start);
  const endIndex = Math.min(buffer.left.length, toIndex(start + duration));
  for (let i = startIndex; i < endIndex; i += 1) {
    const t = i / sampleRate - start;
    const vib = vibrato ? 1 + Math.sin(t * Math.PI * 7.2) * vibrato : 1;
    const value = osc(wave, freq * vib, t) * amp * envelope(t, duration, attack, decay);
    writeStereo(buffer, i, value, pan);
  }
}

function addPitchSweep(buffer, start, duration, fromFreq, toFreq, amp, wave, pan) {
  const startIndex = toIndex(start);
  const endIndex = Math.min(buffer.left.length, toIndex(start + duration));
  let phase = 0;
  for (let i = startIndex; i < endIndex; i += 1) {
    const t = i / sampleRate - start;
    const p = t / duration;
    const freq = fromFreq + (toFreq - fromFreq) * easeOutCubic(p);
    phase += freq / sampleRate;
    writeStereo(buffer, i, oscPhase(wave, phase) * amp * envelope(t, duration, 0.006, duration * 0.52), pan);
  }
}

function addNoiseBurst(buffer, start, duration, amp, toneHz, decay, pan = 0) {
  const startIndex = toIndex(start);
  const endIndex = Math.min(buffer.left.length, toIndex(start + duration));
  let held = 0;
  let holdTime = 0;
  for (let i = startIndex; i < endIndex; i += 1) {
    const t = i / sampleRate - start;
    if (holdTime <= 0) {
      held = nextNoise() * 2 - 1;
      holdTime = Math.max(1, Math.floor(sampleRate / toneHz));
    }
    holdTime -= 1;
    writeStereo(buffer, i, held * amp * envelope(t, duration, 0.002, decay), pan);
  }
}

function addWrappedDelay(buffer, seconds, feedback, mix) {
  const delay = Math.max(1, toIndex(seconds));
  for (let i = 0; i < buffer.left.length; i += 1) {
    const source = (i - delay + buffer.left.length) % buffer.left.length;
    buffer.left[i] += buffer.right[source] * mix;
    buffer.right[i] += buffer.left[source] * mix;
    buffer.left[source] += buffer.left[i] * feedback * 0.15;
    buffer.right[source] += buffer.right[i] * feedback * 0.15;
  }
}

function addReverb(buffer, mix, wrap) {
  const taps = [0.061, 0.097, 0.149, 0.211, 0.283, 0.347].map((seconds) => toIndex(seconds));
  for (let i = 0; i < buffer.left.length; i += 1) {
    let wetL = 0;
    let wetR = 0;
    taps.forEach((tap, index) => {
      const source = wrap ? (i - tap + buffer.left.length) % buffer.left.length : i - tap;
      if (source >= 0) {
        const gain = 0.34 / (index + 1);
        wetL += buffer[index % 2 ? "right" : "left"][source] * gain;
        wetR += buffer[index % 2 ? "left" : "right"][source] * gain;
      }
    });
    buffer.left[i] += wetL * mix;
    buffer.right[i] += wetR * mix;
  }
}

function master(buffer, peak) {
  removeDc(buffer);
  saturate(buffer, 1.35);
  normalize(buffer, peak);
  gentleFadeEdges(buffer);
}

function removeDc(buffer) {
  const avgL = average(buffer.left);
  const avgR = average(buffer.right);
  for (let i = 0; i < buffer.left.length; i += 1) {
    buffer.left[i] -= avgL;
    buffer.right[i] -= avgR;
  }
}

function saturate(buffer, drive) {
  for (let i = 0; i < buffer.left.length; i += 1) {
    buffer.left[i] = Math.tanh(buffer.left[i] * drive) / Math.tanh(drive);
    buffer.right[i] = Math.tanh(buffer.right[i] * drive) / Math.tanh(drive);
  }
}

function normalize(buffer, peak = 0.9) {
  let max = 0;
  for (let i = 0; i < buffer.left.length; i += 1) {
    max = Math.max(max, Math.abs(buffer.left[i]), Math.abs(buffer.right[i]));
  }
  if (max <= 0) {
    return;
  }
  const scale = peak / max;
  for (let i = 0; i < buffer.left.length; i += 1) {
    buffer.left[i] *= scale;
    buffer.right[i] *= scale;
  }
}

function gentleFadeEdges(buffer) {
  const fade = Math.min(toIndex(0.012), Math.floor(buffer.left.length / 4));
  for (let i = 0; i < fade; i += 1) {
    const startGain = i / fade;
    const endGain = (fade - i) / fade;
    const end = buffer.left.length - 1 - i;
    buffer.left[i] *= startGain;
    buffer.right[i] *= startGain;
    buffer.left[end] *= endGain;
    buffer.right[end] *= endGain;
  }
}

function average(samples) {
  let sum = 0;
  for (const sample of samples) {
    sum += sample;
  }
  return sum / samples.length;
}

function writeStereo(buffer, index, value, pan) {
  const clampedPan = Math.max(-1, Math.min(1, pan));
  const angle = (clampedPan + 1) * (Math.PI / 4);
  buffer.left[index] += value * Math.cos(angle);
  buffer.right[index] += value * Math.sin(angle);
}

function envelope(t, duration, attack, decay) {
  if (t < 0 || t > duration) {
    return 0;
  }
  const attackPart = Math.min(1, t / Math.max(0.001, attack));
  const decayPart = Math.exp(-Math.max(0, t - attack) / Math.max(0.001, decay));
  const release = Math.min(1, (duration - t) / Math.max(0.001, duration * 0.18));
  return attackPart * decayPart * release;
}

function osc(wave, freq, t) {
  return oscPhase(wave, freq * t);
}

function oscPhase(wave, phase) {
  const p = phase - Math.floor(phase);
  if (wave === "square") {
    return p < 0.5 ? 1 : -1;
  }
  if (wave === "saw") {
    return p * 2 - 1;
  }
  if (wave === "triangle") {
    return 1 - Math.abs(p * 4 - 2);
  }
  return Math.sin(p * Math.PI * 2);
}

function nextNoise() {
  noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
  return noiseSeed / 0x100000000;
}

function midiToHz(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function toIndex(seconds) {
  return Math.floor(seconds * sampleRate);
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function encodeWav(buffer) {
  const dataSize = buffer.left.length * 4;
  const output = Buffer.alloc(44 + dataSize);
  output.write("RIFF", 0, "ascii");
  output.writeUInt32LE(36 + dataSize, 4);
  output.write("WAVE", 8, "ascii");
  output.write("fmt ", 12, "ascii");
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(2, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 4, 28);
  output.writeUInt16LE(4, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36, "ascii");
  output.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < buffer.left.length; i += 1) {
    output.writeInt16LE(floatToInt16(buffer.left[i]), 44 + i * 4);
    output.writeInt16LE(floatToInt16(buffer.right[i]), 44 + i * 4 + 2);
  }
  return output;
}

function floatToInt16(sample) {
  return Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
}
