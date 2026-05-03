import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(root, "public", "assets", "characters");

const characters = [
  {
    id: "guanyu",
    primary: "#26805a",
    secondary: "#10291d",
    accent: "#e0b64f",
    glow: "#7cffb5",
    hair: "#26100d",
    eye: "#d7a642",
    weapon: "glaive",
    hairStyle: "long",
    attitude: "calm"
  },
  {
    id: "zhaoyun",
    primary: "#2c99a0",
    secondary: "#0e3139",
    accent: "#dfefff",
    glow: "#8eeeff",
    hair: "#ecf6ff",
    eye: "#5fe1ff",
    weapon: "spear",
    hairStyle: "wind",
    attitude: "bright"
  },
  {
    id: "caocao",
    primary: "#405fbb",
    secondary: "#12172f",
    accent: "#d8dff8",
    glow: "#9bb5ff",
    hair: "#17121b",
    eye: "#8ea7ff",
    weapon: "sword",
    hairStyle: "crown",
    attitude: "sharp"
  },
  {
    id: "xiahoudun",
    primary: "#344d88",
    secondary: "#141725",
    accent: "#dd514b",
    glow: "#ff756d",
    hair: "#20151a",
    eye: "#ff8a6d",
    weapon: "blade",
    hairStyle: "wild",
    attitude: "fierce"
  },
  {
    id: "zhouyu",
    primary: "#c24a3c",
    secondary: "#361111",
    accent: "#f2bb64",
    glow: "#ff9850",
    hair: "#241019",
    eye: "#ffbc65",
    weapon: "fan",
    hairStyle: "flow",
    attitude: "elegant"
  },
  {
    id: "sunshangxiang",
    primary: "#c74754",
    secondary: "#351018",
    accent: "#ffd078",
    glow: "#ffdf76",
    hair: "#3b1720",
    eye: "#ffc46c",
    weapon: "bow",
    hairStyle: "twin",
    attitude: "smile"
  },
  {
    id: "lubu",
    primary: "#68408b",
    secondary: "#170b20",
    accent: "#ff4b5f",
    glow: "#cb72ff",
    hair: "#160912",
    eye: "#ff3854",
    weapon: "halberd",
    hairStyle: "plume",
    attitude: "fierce"
  }
];

for (const character of characters) {
  const dir = join(outputRoot, character.id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "card.svg"), cardSvg(character), "utf8");
  await writeFile(join(dir, "battle-idle.svg"), battleSvg(character, 0), "utf8");
  for (let frame = 0; frame < 4; frame += 1) {
    await writeFile(join(dir, `attack-${frame}.svg`), battleSvg(character, frame), "utf8");
  }
  await writeFile(join(dir, "attack-strip.svg"), stripSvg(character), "utf8");
}

console.log(`Generated ${characters.length} anime-card character asset sets in ${outputRoot}`);

function cardSvg(character) {
  return svg(720, 1040, `
    <defs>
      ${defs(character)}
      <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${character.primary}"/>
        <stop offset="0.42" stop-color="${character.secondary}"/>
        <stop offset="1" stop-color="#0a070a"/>
      </linearGradient>
      <radialGradient id="stageGlow" cx="48%" cy="36%" r="64%">
        <stop offset="0" stop-color="${character.glow}" stop-opacity="0.72"/>
        <stop offset="0.34" stop-color="${character.primary}" stop-opacity="0.24"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <pattern id="foil" width="72" height="72" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
        <path d="M0 36 H72" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
        <path d="M0 54 H72" stroke="${character.accent}" stroke-opacity="0.13" stroke-width="1"/>
      </pattern>
      <filter id="cardShadow" x="-35%" y="-35%" width="170%" height="170%">
        <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#000" flood-opacity="0.58"/>
      </filter>
    </defs>
    <rect width="720" height="1040" rx="42" fill="url(#cardBg)"/>
    <rect width="720" height="1040" rx="42" fill="url(#foil)"/>
    <rect width="720" height="1040" rx="42" fill="url(#stageGlow)"/>
    <path d="M-30 690 L760 134 L760 316 L-30 872Z" fill="#ffffff" opacity="0.06"/>
    <path d="M-20 790 L740 250" stroke="${character.glow}" stroke-opacity="0.24" stroke-width="18"/>
    <path d="M68 156 C188 42 486 42 646 146 C558 170 492 232 438 322 C330 188 202 190 68 156Z" fill="#fff8d4" opacity="0.09"/>
    <g opacity="0.26" stroke="${character.accent}" stroke-width="4" fill="none">
      <path d="M74 786 C230 714 330 842 494 734 C564 688 606 692 656 662"/>
      <path d="M82 842 C260 770 318 910 526 792 C584 760 624 768 670 726"/>
      <path d="M106 232 L620 736"/>
    </g>
    ${sparkles(character.accent)}
    <g filter="url(#cardShadow)" transform="translate(360 606) scale(3.35)">
      ${animeFigure(character, 0, "card")}
    </g>
    <rect x="28" y="28" width="664" height="984" rx="34" fill="none" stroke="${character.accent}" stroke-opacity="0.88" stroke-width="5"/>
    <rect x="48" y="48" width="624" height="944" rx="24" fill="none" stroke="#fff8dc" stroke-opacity="0.24" stroke-width="2"/>
    <path d="M66 110 H184 M66 110 V228 M654 110 H536 M654 110 V228" stroke="${character.accent}" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
    <path d="M66 930 H184 M66 930 V812 M654 930 H536 M654 930 V812" stroke="${character.accent}" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
    <path d="M126 906 C248 954 486 954 604 902" stroke="${character.glow}" stroke-opacity="0.38" stroke-width="8" stroke-linecap="round"/>
  `);
}

function battleSvg(character, frame) {
  return svg(192, 224, `
    <defs>${defs(character)}</defs>
    <g transform="translate(96 139) scale(0.94)">
      <ellipse cx="0" cy="62" rx="45" ry="12" fill="#000" opacity="0.34"/>
      ${animeFigure(character, frame, "battle")}
    </g>
  `);
}

function stripSvg(character) {
  return svg(
    768,
    224,
    [0, 1, 2, 3]
      .map(
        (frame) => `
          <g transform="translate(${frame * 192} 0)">
            <rect width="192" height="224" fill="none"/>
            <defs>${defs(character, `-${frame}`)}</defs>
            <g transform="translate(96 139) scale(0.94)">
              <ellipse cx="0" cy="62" rx="45" ry="12" fill="#000" opacity="0.34"/>
              ${animeFigure(character, frame, "battle", `-${frame}`)}
            </g>
          </g>
        `
      )
      .join("")
  );
}

function svg(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${body}</svg>`;
}

function defs(character, suffix = "") {
  return `
    <linearGradient id="armor${suffix}" x1="0" y1="-80" x2="0" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${character.primary}"/>
      <stop offset="0.56" stop-color="${mix(character.primary, "#ffffff", 0.08)}"/>
      <stop offset="1" stop-color="${character.secondary}"/>
    </linearGradient>
    <linearGradient id="metal${suffix}" x1="-38" y1="-64" x2="50" y2="78" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff8dc"/>
      <stop offset="0.38" stop-color="${character.accent}"/>
      <stop offset="1" stop-color="#7d4a25"/>
    </linearGradient>
    <radialGradient id="aura${suffix}" cx="50%" cy="44%" r="62%">
      <stop offset="0" stop-color="${character.glow}" stop-opacity="0.46"/>
      <stop offset="1" stop-color="${character.glow}" stop-opacity="0"/>
    </radialGradient>
  `;
}

function animeFigure(character, frame, mode, suffix = "") {
  const pose = [
    { lean: -2, arm: -12, weapon: -8, slash: 0, step: 0 },
    { lean: -9, arm: -34, weapon: -32, slash: -18, step: -5 },
    { lean: 10, arm: 28, weapon: 38, slash: 22, step: 6 },
    { lean: 3, arm: 10, weapon: 16, slash: 10, step: 2 }
  ][frame];
  const cardMode = mode === "card";
  return `
    <g transform="rotate(${pose.lean})">
      <ellipse cx="0" cy="-10" rx="${cardMode ? 58 : 48}" ry="${cardMode ? 94 : 78}" fill="url(#aura${suffix})" opacity="${cardMode ? 0.76 : 0.32}"/>
      ${cape(character, cardMode)}
      ${weapon(character, pose.weapon, suffix)}
      ${slashTrail(character, pose.slash)}
      <path d="M-34 -24 C-48 12 -44 48 -24 70 C-10 82 12 82 27 70 C47 44 48 8 35 -25 C21 -40 -20 -40 -34 -24Z" fill="url(#armor${suffix})" stroke="#120c0a" stroke-width="3"/>
      <path d="M-42 -18 C-63 -5 -63 20 -45 34 C-33 28 -27 4 -27 -21Z" fill="url(#metal${suffix})" stroke="#fff4cc" stroke-opacity="0.38" stroke-width="2"/>
      <path d="M42 -18 C63 -5 63 20 45 34 C33 28 27 4 27 -21Z" fill="url(#metal${suffix})" stroke="#fff4cc" stroke-opacity="0.38" stroke-width="2"/>
      <g transform="rotate(${pose.arm})">
        <path d="M-26 -11 C-52 2 -63 22 -67 45" stroke="${skin(character)}" stroke-width="8" stroke-linecap="round"/>
        <path d="M28 -11 C53 2 63 22 67 44" stroke="${skin(character)}" stroke-width="8" stroke-linecap="round"/>
        <path d="M-29 -10 C-52 2 -60 17 -63 34" stroke="url(#metal${suffix})" stroke-width="4" stroke-linecap="round"/>
        <path d="M31 -10 C54 2 61 17 64 34" stroke="url(#metal${suffix})" stroke-width="4" stroke-linecap="round"/>
      </g>
      <path d="M-22 68 C-25 92 -34 106 -44 118" stroke="${character.secondary}" stroke-width="12" stroke-linecap="round"/>
      <path d="M22 68 C28 92 38 105 48 116" stroke="${character.secondary}" stroke-width="12" stroke-linecap="round"/>
      <path d="M-22 68 C-25 92 -34 106 -44 118" stroke="${character.accent}" stroke-width="3" stroke-linecap="round" opacity="0.72"/>
      <path d="M22 68 C28 92 38 105 48 116" stroke="${character.accent}" stroke-width="3" stroke-linecap="round" opacity="0.72"/>
      ${head(character, cardMode)}
      <path d="M-27 8 L-11 30 L0 62 L11 30 L27 8" stroke="url(#metal${suffix})" stroke-width="3.5" stroke-linecap="round" opacity="0.95"/>
      <path d="M-24 23 H24 M-19 39 H19 M-12 55 H12" stroke="#fff8dc" stroke-opacity="0.3" stroke-width="2"/>
      <path d="M-33 ${40 + pose.step} C-12 ${49 + pose.step} 14 ${49 - pose.step} 36 ${39 - pose.step}" stroke="${character.accent}" stroke-width="4" stroke-linecap="round" opacity="0.78"/>
    </g>
  `;
}

function head(character, cardMode) {
  const scale = cardMode ? 1.08 : 1;
  return `
    <g transform="translate(0 -52) scale(${scale})">
      ${hairBack(character)}
      <path d="M-22 -4 C-20 -27 19 -27 22 -4 C22 18 12 30 0 32 C-13 30 -23 18 -22 -4Z" fill="${skin(character)}" stroke="#21110c" stroke-width="3"/>
      ${hairFront(character)}
      ${animeEyes(character)}
      <path d="M-2 9 L3 13 L-3 15" stroke="#8b4b35" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${mouth(character)}
      <path d="M-18 -10 C-9 -18 10 -18 20 -10" stroke="#fff5d8" stroke-opacity="0.18" stroke-width="2" stroke-linecap="round"/>
      ${headOrnament(character)}
    </g>
  `;
}

function hairBack(character) {
  if (character.hairStyle === "long") {
    return `<path d="M-28 -8 C-54 14 -52 62 -36 88 C-20 64 -17 20 -18 -8Z" fill="${character.hair}"/><path d="M28 -8 C54 14 52 62 36 88 C20 64 17 20 18 -8Z" fill="${character.hair}"/>`;
  }
  if (character.hairStyle === "twin") {
    return `<path d="M-22 -8 C-64 -8 -62 36 -28 54" stroke="${character.hair}" stroke-width="14" stroke-linecap="round"/><path d="M22 -8 C64 -8 62 36 28 54" stroke="${character.hair}" stroke-width="14" stroke-linecap="round"/>`;
  }
  if (character.hairStyle === "flow") {
    return `<path d="M-28 -11 C-62 6 -56 54 -36 80 C-18 54 -15 18 -17 -8Z" fill="${character.hair}"/><path d="M26 -10 C62 8 56 53 36 80 C18 54 15 18 17 -8Z" fill="${character.hair}"/>`;
  }
  return `<path d="M-29 -10 C-33 -36 33 -37 30 -9 C14 -20 -14 -20 -29 -10Z" fill="${character.hair}"/>`;
}

function hairFront(character) {
  const shine = mix(character.hair, "#ffffff", 0.28);
  const common = `
    <path d="M-24 -6 C-16 -33 16 -34 25 -6 C9 -16 -10 -16 -24 -6Z" fill="${character.hair}"/>
    <path d="M-17 -5 C-10 -25 -2 -27 -4 2" fill="${shine}" opacity="0.28"/>
    <path d="M5 -4 C13 -26 23 -20 21 5" fill="${shine}" opacity="0.2"/>
  `;
  if (character.hairStyle === "plume") {
    return `${common}<path d="M-9 -24 C-38 -60 -12 -76 0 -36 C14 -78 42 -58 9 -23" fill="${character.accent}"/><path d="M-26 -5 C-7 -18 11 -18 29 -5" stroke="${character.accent}" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (character.hairStyle === "crown") {
    return `${common}<path d="M-24 -15 L-11 -35 L0 -17 L13 -36 L26 -15" fill="${character.accent}" opacity="0.94"/>`;
  }
  if (character.hairStyle === "wind") {
    return `${common}<path d="M-20 -8 C-50 -28 -34 -42 -8 -20" stroke="${character.hair}" stroke-width="8" stroke-linecap="round"/><path d="M14 -8 C52 -20 41 -38 12 -20" stroke="${character.hair}" stroke-width="8" stroke-linecap="round"/>`;
  }
  if (character.hairStyle === "wild") {
    return `${common}<path d="M-24 -9 L-38 -30 L-11 -20 L-3 -40 L9 -18 L33 -31 L23 -7" fill="${character.hair}"/>`;
  }
  return common;
}

function animeEyes(character) {
  const left = character.id === "xiahoudun" ? eyePatch() : eye(-9, character.eye);
  return `
    ${left}
    ${eye(10, character.eye)}
    <path d="M-15 -1 C-8 -5 -3 -5 1 -2" stroke="${character.hair}" stroke-width="3" stroke-linecap="round"/>
    <path d="M5 -2 C11 -6 17 -6 21 -2" stroke="${character.hair}" stroke-width="3" stroke-linecap="round"/>
  `;
}

function eye(x, color) {
  return `
    <path d="M${x - 6} 3 C${x - 4} -2 ${x + 4} -2 ${x + 6} 3 C${x + 3} 7 ${x - 3} 7 ${x - 6} 3Z" fill="#fff8ea" stroke="#21110e" stroke-width="2"/>
    <ellipse cx="${x}" cy="3" rx="2.6" ry="4.1" fill="${color}"/>
    <ellipse cx="${x}" cy="4" rx="1.25" ry="2.5" fill="#21110e"/>
    <circle cx="${x - 0.9}" cy="1" r="1" fill="#ffffff"/>
  `;
}

function eyePatch() {
  return `<path d="M-18 -1 C-12 -8 -3 -7 2 -1 C-4 8 -13 8 -18 -1Z" fill="#1b1110"/><path d="M-19 -7 L4 10" stroke="#0c0707" stroke-width="3" stroke-linecap="round"/>`;
}

function mouth(character) {
  if (character.attitude === "smile" || character.attitude === "bright") {
    return `<path d="M-8 20 C-2 25 6 25 12 19" stroke="#8a2f2b" stroke-width="3" stroke-linecap="round"/>`;
  }
  if (character.attitude === "fierce") {
    return `<path d="M-8 21 C-2 18 5 18 11 22" stroke="#7a2524" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `<path d="M-7 20 C-1 23 6 23 11 20" stroke="#7a3025" stroke-width="3" stroke-linecap="round"/>`;
}

function headOrnament(character) {
  if (character.hairStyle === "long") {
    return `<path d="M-11 27 C-5 40 6 40 12 27 C10 48 0 58 -12 42" fill="${character.hair}"/>`;
  }
  if (character.hairStyle === "twin") {
    return `<circle cx="-25" cy="-6" r="6" fill="${character.accent}"/><circle cx="25" cy="-6" r="6" fill="${character.accent}"/>`;
  }
  return "";
}

function cape(character, cardMode) {
  const opacity = cardMode ? 0.72 : 0.5;
  return `
    <path d="M-39 -30 C-90 4 -78 78 -24 116 C-11 80 10 80 28 116 C82 76 88 3 41 -30Z" fill="${character.primary}" opacity="${opacity}"/>
    <path d="M-48 -10 C-20 12 18 12 50 -10" stroke="${character.glow}" stroke-opacity="0.26" stroke-width="5"/>
  `;
}

function weapon(character, angle, suffix) {
  const stroke = `stroke="url(#metal${suffix})" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"`;
  const glow = `stroke="${character.glow}" stroke-width="15" stroke-linecap="round" opacity="0.18"`;
  const fill = `fill="url(#metal${suffix})"`;
  if (character.weapon === "glaive") {
    return `<g transform="rotate(${angle})"><path d="M-72 82 L70 -76" ${glow}/><path d="M-72 82 L70 -76" ${stroke}/><path d="M65 -84 C99 -74 96 -34 65 -20 C77 -45 66 -55 43 -64Z" ${fill}/></g>`;
  }
  if (character.weapon === "spear") {
    return `<g transform="rotate(${angle})"><path d="M-78 84 L78 -84" ${glow}/><path d="M-78 84 L78 -84" ${stroke}/><path d="M78 -84 L66 -45 L100 -64Z" ${fill}/></g>`;
  }
  if (character.weapon === "sword") {
    return `<g transform="rotate(${angle})"><path d="M-58 76 L66 -76" ${glow}/><path d="M-58 76 L66 -76" ${stroke}/><path d="M61 -84 L78 -94 L74 -70Z" ${fill}/><path d="M-20 28 L0 43" stroke="${character.accent}" stroke-width="10" stroke-linecap="round"/></g>`;
  }
  if (character.weapon === "blade") {
    return `<g transform="rotate(${angle})"><path d="M-62 76 L46 -58" ${glow}/><path d="M-62 76 L46 -58" ${stroke}/><path d="M36 -72 C76 -52 76 -12 38 8 C52 -25 40 -36 15 -48Z" fill="${character.accent}"/></g>`;
  }
  if (character.weapon === "fan") {
    return `<g transform="rotate(${angle})"><path d="M-58 48 C-12 -76 52 -70 82 42 C36 8 -10 10 -58 48Z" fill="${character.accent}" opacity="0.88"/><path d="M-44 38 L62 -24 M-24 20 L58 -50 M0 10 L42 -66 M22 13 L74 -12" stroke="#fff8dc" stroke-opacity="0.54" stroke-width="3"/></g>`;
  }
  if (character.weapon === "bow") {
    return `<g transform="rotate(${angle})"><path d="M46 -82 C104 -28 99 42 43 86" stroke="${character.accent}" stroke-width="9" stroke-linecap="round"/><path d="M46 -82 C64 -16 62 24 43 86" stroke="#fff8dc" stroke-width="2" opacity="0.75"/><path d="M-66 10 L90 -5" ${stroke}/><path d="M90 -5 L64 -18 L68 9Z" ${fill}/></g>`;
  }
  return `<g transform="rotate(${angle})"><path d="M-76 88 L70 -78" ${glow}/><path d="M-76 88 L70 -78" ${stroke}/><path d="M56 -92 L92 -98 L78 -64 L104 -48 L65 -44 L47 -16 L42 -50Z" fill="${character.accent}"/></g>`;
}

function slashTrail(character, angle) {
  if (angle === 0) {
    return "";
  }
  return `<g transform="rotate(${angle})"><path d="M-86 8 C-26 -34 46 -32 94 2" stroke="${character.glow}" stroke-width="9" stroke-linecap="round" opacity="0.2"/><path d="M-78 16 C-20 -18 42 -18 86 10" stroke="#fff8dc" stroke-width="3" stroke-linecap="round" opacity="0.34"/></g>`;
}

function sparkles(accent) {
  return Array.from({ length: 22 }, (_, index) => {
    const x = 78 + ((index * 157) % 560);
    const y = 110 + ((index * 251) % 760);
    const size = 4 + (index % 4) * 2;
    return `<path d="M${x} ${y - size} L${x + size} ${y} L${x} ${y + size} L${x - size} ${y}Z" fill="${accent}" opacity="${0.16 + (index % 3) * 0.06}"/>`;
  }).join("");
}

function skin(character) {
  return character.id === "lubu" ? "#d89168" : "#f0b07f";
}

function mix(hexA, hexB, amount) {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const mixed = a.map((value, index) => Math.round(value + (b[index] - value) * amount));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex) {
  return [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((part) => Number.parseInt(part, 16));
}
