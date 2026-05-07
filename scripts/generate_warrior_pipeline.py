#!/usr/bin/env python3
"""One-entry warrior generation pipeline.

The script deliberately treats image generation as a real provider contract.
It can consume pre-generated raster sources through `sourceImages` or a source
directory, or it can invoke an external imagegen command. If neither is
available, the run fails after writing a prompt pack and failure report; it
never creates placeholder warrior art or promotes partial output.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageOps

from normalize_character_runtime_frames import (
    FRAME_HEIGHT,
    FRAME_WIDTH,
    MAX_OCCUPANCY,
    MIN_PADDING,
    PRESERVE_OVERLAY_MARKER,
    alpha_bbox,
    normalize_hero,
    normalize_image,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = ROOT / "output" / "warrior-generation"
WEB_GAME_OUTPUT_ROOT = ROOT / "output" / "web-game"
PUBLIC_CHARACTER_ROOT = ROOT / "public" / "assets" / "characters"
SOURCE_ANIM_ROOT = ROOT / "scripts" / "source" / "character-anims"
PROMPT_CATALOG_PATH = ROOT / "scripts" / "character-art-prompts.json"
TYPES_PATH = ROOT / "src" / "game" / "types.ts"
HEROES_PATH = ROOT / "src" / "game" / "content" / "heroes.ts"
CHARACTER_ART_PATH = ROOT / "src" / "game" / "content" / "characterArt.ts"
ULTIMATES_PATH = ROOT / "src" / "game" / "content" / "ultimates.ts"
MANIFEST_PATH = ROOT / "src" / "game" / "assets" / "manifest.ts"

FRAME_COUNTS = {"idle": 6, "run": 6, "attack": 8, "ultimate": 8}
REQUIRED_OVERLAY_STATES = tuple(FRAME_COUNTS.keys())
MIN_MOTION_DELTA = 18000
ALLOWED_FACTIONS = {"shu", "wei", "wu", "qun"}
ALLOWED_DAMAGE_TAGS = {"blade", "pierce", "fire", "command", "shock", "arrow", "charm"}
REQUIRED_CONSTRAINTS = (
    "forbidSquareEffects",
    "forbidBakedEffects",
    "forbidRecolorOnly",
    "requireCenteredRuntimeFrames",
    "requireSeparateEffectOverlays",
    "requireTruePerFrameRasterPoses",
)
BANNED_EFFECT_TEXT = re.compile(
    r"(brackeysLightstreaksAnimationKey|lightstreaks-6x5\.png|lightstreak|"
    r"\bsquare\b|\brectangle\b|\brectangular\b|\bbox\b|panel[- ]like|"
    r"方形框|矩形框|方形特效|矩形特效|框線|面板式)",
    re.IGNORECASE,
)
HERO_ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class PipelineError(Exception):
    """Expected pipeline failure that should block promotion."""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def dump_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def ts_string_array(values: list[str]) -> str:
    return "[" + ", ".join(ts_string(value) for value in values) + "]"


def ts_number(value: int | float) -> str:
    if isinstance(value, bool):
        raise PipelineError("boolean is not a valid numeric field")
    if isinstance(value, int):
        return str(value)
    return f"{value:.4f}".rstrip("0").rstrip(".")


def resolve_path(value: str, spec_path: Path) -> Path:
    raw = Path(value)
    if raw.is_absolute():
        return raw
    root_relative = ROOT / raw
    if root_relative.exists():
        return root_relative
    return spec_path.parent / raw


def as_dict(value: Any, path: str, errors: list[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return {}
    return value


def require_string(obj: dict[str, Any], key: str, path: str, errors: list[str], *, allow_empty: bool = False) -> str:
    value = obj.get(key)
    if not isinstance(value, str) or (not allow_empty and not value.strip()):
        errors.append(f"{path}.{key} must be a non-empty string")
        return ""
    return value


def require_number(obj: dict[str, Any], key: str, path: str, errors: list[str], *, minimum: float | None = None) -> int | float:
    value = obj.get(key)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        errors.append(f"{path}.{key} must be a number")
        return 0
    if minimum is not None and value < minimum:
        errors.append(f"{path}.{key} must be >= {minimum}")
    return value


def require_string_list(obj: dict[str, Any], key: str, path: str, errors: list[str], *, minimum: int = 1) -> list[str]:
    value = obj.get(key)
    if not isinstance(value, list) or not all(isinstance(item, str) and item.strip() for item in value) or len(value) < minimum:
        errors.append(f"{path}.{key} must be a list of at least {minimum} non-empty strings")
        return []
    return value


def object_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def scan_banned_text(value: Any, path: str, errors: list[str]) -> None:
    text = object_text(value)
    match = BANNED_EFFECT_TEXT.search(text)
    if match:
        errors.append(f"{path} contains banned square/panel effect language: {match.group(0)}")


def hero_id_block_match(text: str) -> re.Match[str]:
    match = re.search(
        r"(?P<header>export type HeroId =\n)(?P<body>[\s\S]*?);(?P<suffix>\nexport type CharacterId = HeroId;)",
        text,
    )
    if not match:
        raise PipelineError("could not find HeroId union block")
    return match


def hero_id_values_from_text(text: str) -> list[str]:
    return re.findall(r'\|\s*"([^"]+)"', hero_id_block_match(text).group("body"))


def existing_hero_ids() -> set[str]:
    return set(hero_id_values_from_text(read_text(TYPES_PATH)))


def existing_bond_ids() -> set[str]:
    return set(re.findall(r'\bid:\s*"([^"]+)"', read_text(CHARACTER_ART_PATH)))


def vfx_profiles_body() -> str:
    text = read_text(MANIFEST_PATH)
    start = text.index("export const vfxProfiles:")
    end = text.index("\n};\n\nexport const enemyVisualProfiles", start)
    return text[start:end]


def existing_vfx_keys() -> set[str]:
    body = vfx_profiles_body()
    return set(re.findall(r"^\s{2}([A-Za-z_][A-Za-z0-9_]*):", body, flags=re.MULTILINE))


def existing_particle_keys() -> set[str]:
    return set(re.findall(r'\{\s*key:\s*"([^"]+)"', read_text(MANIFEST_PATH)))


def validate_ability(
    ability: dict[str, Any],
    path: str,
    errors: list[str],
    available_vfx_keys: set[str],
    *,
    require_description: bool = True,
) -> None:
    require_string(ability, "name", path, errors)
    if require_description:
        require_string(ability, "description", path, errors)
    require_number(ability, "cooldown", path, errors, minimum=0)
    require_number(ability, "range", path, errors, minimum=1)
    require_number(ability, "radius", path, errors, minimum=1)
    require_number(ability, "damage", path, errors, minimum=0)
    tags = require_string_list(ability, "damageTags", path, errors)
    for tag in tags:
        if tag not in ALLOWED_DAMAGE_TAGS:
            errors.append(f"{path}.damageTags contains unsupported tag {tag}")
    vfx_key = require_string(ability, "vfxKey", path, errors)
    if vfx_key and vfx_key not in available_vfx_keys:
        errors.append(f"{path}.vfxKey {vfx_key} is not defined in vfxProfiles or spec.vfxProfiles")
    require_string(ability, "effectId", path, errors)


def validate_vfx_profile(profile: dict[str, Any], path: str, errors: list[str]) -> str:
    key = require_string(profile, "key", path, errors)
    if key and not HERO_ID_RE.match(key):
        errors.append(f"{path}.key must be lowercase snake_case")
    require_string(profile, "textureKey", path, errors)
    color = require_string(profile, "color", path, errors)
    if color and not HEX_COLOR_RE.match(color):
        errors.append(f"{path}.color must be #RRGGBB")
    if profile.get("blendMode", "add") not in ("add", "normal"):
        errors.append(f"{path}.blendMode must be add or normal")
    require_number(profile, "scale", path, errors, minimum=0.1)
    require_number(profile, "lifetime", path, errors, minimum=0.05)
    particle_key = profile.get("particleKey")
    if particle_key is not None and not isinstance(particle_key, str):
        errors.append(f"{path}.particleKey must be a string when present")
    scan_banned_text(profile, path, errors)
    return key


def validate_spec(
    spec: dict[str, Any],
    spec_path: Path,
    *,
    validate_sources: bool = False,
    require_source_animation_frames: bool = True,
) -> None:
    errors: list[str] = []
    hero_id = require_string(spec, "id", "spec", errors)
    if hero_id and not HERO_ID_RE.match(hero_id):
        errors.append("spec.id must be lowercase snake_case and start with a letter")
    if hero_id in existing_hero_ids() or (PUBLIC_CHARACTER_ROOT / hero_id).exists():
        errors.append(f"duplicate hero id {hero_id}")

    faction_id = require_string(spec, "factionId", "spec", errors)
    if faction_id and faction_id not in ALLOWED_FACTIONS:
        errors.append(f"spec.factionId must be one of {sorted(ALLOWED_FACTIONS)}")

    for key in ("name", "title", "rarityLabel", "role", "quote", "biography"):
        require_string(spec, key, "spec", errors)
    require_number(spec, "stars", "spec", errors, minimum=1)

    bond_ids = require_string_list(spec, "bondIds", "spec", errors)
    known_bonds = existing_bond_ids()
    for bond_id in bond_ids:
        if bond_id not in known_bonds:
            errors.append(f"missing bond {bond_id}")

    passive = as_dict(spec.get("passive"), "spec.passive", errors)
    require_string(passive, "name", "spec.passive", errors)
    require_string(passive, "text", "spec.passive", errors)

    stats = as_dict(spec.get("baseStats"), "spec.baseStats", errors)
    for key in ("maxHp", "moveSpeed", "armor", "pickupRadius"):
        require_number(stats, key, "spec.baseStats", errors, minimum=0)

    vfx_profiles = spec.get("vfxProfiles", [])
    if vfx_profiles is None:
        vfx_profiles = []
    if not isinstance(vfx_profiles, list):
        errors.append("spec.vfxProfiles must be a list when present")
        vfx_profiles = []
    spec_vfx_keys = {validate_vfx_profile(as_dict(profile, f"spec.vfxProfiles[{index}]", errors), f"spec.vfxProfiles[{index}]", errors) for index, profile in enumerate(vfx_profiles)}
    available_vfx_keys = existing_vfx_keys() | {key for key in spec_vfx_keys if key}

    abilities = as_dict(spec.get("abilities"), "spec.abilities", errors)
    validate_ability(as_dict(abilities.get("auto"), "spec.abilities.auto", errors), "spec.abilities.auto", errors, available_vfx_keys)
    validate_ability(as_dict(abilities.get("manual"), "spec.abilities.manual", errors), "spec.abilities.manual", errors, available_vfx_keys)

    ultimate = as_dict(spec.get("ultimate"), "spec.ultimate", errors)
    require_string(ultimate, "name", "spec.ultimate", errors)
    require_number(ultimate, "duration", "spec.ultimate", errors, minimum=1)
    require_number(ultimate, "pulseEvery", "spec.ultimate", errors, minimum=0.1)
    for key in ("vfxKey", "finisherVfxKey"):
        vfx_key = require_string(ultimate, key, "spec.ultimate", errors)
        if vfx_key and vfx_key not in available_vfx_keys:
            errors.append(f"spec.ultimate.{key} {vfx_key} is not defined in vfxProfiles or spec.vfxProfiles")
    require_string(ultimate, "shortLabel", "spec.ultimate", errors)
    validate_ability(as_dict(ultimate.get("pulseAbility"), "spec.ultimate.pulseAbility", errors), "spec.ultimate.pulseAbility", errors, available_vfx_keys, require_description=False)
    validate_ability(
        as_dict(ultimate.get("finisherAbility"), "spec.ultimate.finisherAbility", errors),
        "spec.ultimate.finisherAbility",
        errors,
        available_vfx_keys,
        require_description=False,
    )

    visual = as_dict(spec.get("visual"), "spec.visual", errors)
    for key in ("weaponSilhouette", "costumeKeywords", "cardPrompt", "battlePrompt"):
        require_string(visual, key, "spec.visual", errors)
    palette = as_dict(visual.get("palette"), "spec.visual.palette", errors)
    for key in ("primary", "secondary", "accent"):
        color = require_string(palette, key, "spec.visual.palette", errors)
        if color and not HEX_COLOR_RE.match(color):
            errors.append(f"spec.visual.palette.{key} must be #RRGGBB")
    scan_banned_text(visual, "spec.visual", errors)

    motion = as_dict(spec.get("motion"), "spec.motion", errors)
    for state in FRAME_COUNTS:
        state_motion = as_dict(motion.get(state), f"spec.motion.{state}", errors)
        require_string(state_motion, "grammar", f"spec.motion.{state}", errors)
        require_string(state_motion, "style", f"spec.motion.{state}", errors)
        minimum_layers = 2 if state in ("attack", "ultimate") else 1
        require_string_list(state_motion, "layers", f"spec.motion.{state}", errors, minimum=minimum_layers)
    scan_banned_text(motion, "spec.motion", errors)
    if not require_string_list(spec, "avoidSimilarTo", "spec", errors):
        errors.append("spec.avoidSimilarTo must identify existing warriors to compare against")

    effects = as_dict(spec.get("effects"), "spec.effects", errors)
    effect_palette = require_string_list(effects, "palette", "spec.effects", errors)
    for color in effect_palette:
        if not HEX_COLOR_RE.match(color):
            errors.append(f"spec.effects.palette contains invalid color {color}")
    for state in FRAME_COUNTS:
        effect = as_dict(effects.get(state), f"spec.effects.{state}", errors)
        for key in ("shape", "origin", "path", "rhythm", "purpose"):
            require_string(effect, key, f"spec.effects.{state}", errors)
    scan_banned_text(effects, "spec.effects", errors)

    constraints = as_dict(spec.get("constraints"), "spec.constraints", errors)
    for key in REQUIRED_CONSTRAINTS:
        if constraints.get(key) is not True:
            errors.append(f"spec.constraints.{key} must be true")

    source_images = spec.get("sourceImages", {})
    if source_images is not None and not isinstance(source_images, dict):
        errors.append("spec.sourceImages must be an object when present")
    if isinstance(source_images, dict):
        animation_frames = source_images.get("animationFrames")
        if animation_frames is not None:
            if not isinstance(animation_frames, dict):
                errors.append("spec.sourceImages.animationFrames must be an object when present")
            else:
                for state, count in FRAME_COUNTS.items():
                    values = animation_frames.get(state)
                    if not isinstance(values, list) or len(values) != count:
                        errors.append(f"spec.sourceImages.animationFrames.{state} must list exactly {count} PNG paths")
                        continue
                    for index, value in enumerate(values):
                        if not isinstance(value, str):
                            errors.append(f"spec.sourceImages.animationFrames.{state}[{index}] must be a PNG path string")
        elif require_source_animation_frames:
            errors.append("spec.sourceImages.animationFrames is required unless an imagegen provider writes anim/<state>/<NN>.png into WARRIOR_SOURCE_DIR")
    if validate_sources and isinstance(source_images, dict):
        for key in ("card", "battle"):
            value = source_images.get(key)
            if value is not None and not resolve_path(value, spec_path).exists():
                errors.append(f"spec.sourceImages.{key} does not exist: {value}")
        animation_frames = source_images.get("animationFrames")
        if isinstance(animation_frames, dict):
            for state, values in animation_frames.items():
                if isinstance(values, list):
                    for index, value in enumerate(values):
                        if isinstance(value, str) and not resolve_path(value, spec_path).exists():
                            errors.append(f"spec.sourceImages.animationFrames.{state}[{index}] does not exist: {value}")

    manifest_text = read_text(MANIFEST_PATH)
    banned_manifest = BANNED_EFFECT_TEXT.search(manifest_text)
    if banned_manifest:
        errors.append(f"runtime manifest contains banned square/panel effect reference: {banned_manifest.group(0)}")

    if errors:
        raise PipelineError("\n".join(f"- {error}" for error in errors))


def build_prompt_pack(spec: dict[str, Any]) -> dict[str, Any]:
    style = ""
    if PROMPT_CATALOG_PATH.exists():
        try:
            style = load_json(PROMPT_CATALOG_PATH).get("style", "")
        except json.JSONDecodeError:
            style = ""
    visual = spec["visual"]
    motion = spec["motion"]
    effects = spec["effects"]
    safety = (
        "Transparent background for battle/action sources. Character body, clothing, hair, and weapon only. "
        "Do not bake glow, aura, trails, slash rectangles, square panels, text, logo, or watermark into base frames. "
        "Keep the active body centered in the frame with head and feet balanced around the center."
    )
    animation_prompts = {
        state: [
            (
                f"{motion[state]['grammar']}\n"
                f"Frame {index + 1} of {FRAME_COUNTS[state]} for {state}. "
                "Redraw the complete chibi warrior as a true independent transparent raster pose. "
                "Hands, feet, weapon, cloth, and hair must visibly change from neighboring frames. "
                "Do not cut, paste, mesh-warp, liquify, smear, or deform an existing sprite. "
                "Base character, costume, physical weapon, and physical props only; no baked glow, shadow, trail, aura, or impact flash."
            )
            for index in range(FRAME_COUNTS[state])
        ]
        for state in FRAME_COUNTS
    }
    return {
        "heroId": spec["id"],
        "createdAt": utc_now(),
        "providerContract": {
            "requiredFiles": ["card.png", "battle.png"]
            + [f"anim/{state}/{index + 1:02d}.png" for state, count in FRAME_COUNTS.items() for index in range(count)],
            "optionalFiles": ["attack-reference.png", "ultimate-reference.png"],
            "sourceDirectoryEnv": "WARRIOR_SOURCE_DIR",
            "promptPackEnv": "WARRIOR_PROMPT_PACK",
            "frameRule": "animation frames must be true redrawn raster poses, not cut/paste or mesh-warp derivatives",
        },
        "prompts": {
            "card": f"{style}\n{visual['cardPrompt']}\nNo text. No logo. No watermark.",
            "battle": f"{style}\n{visual['battlePrompt']}\n{safety}",
            "attackReference": f"{motion['attack']['grammar']}\nEffect grammar: {json.dumps(effects['attack'], ensure_ascii=False)}\n{safety}",
            "ultimateReference": f"{motion['ultimate']['grammar']}\nEffect grammar: {json.dumps(effects['ultimate'], ensure_ascii=False)}\n{safety}",
            "animationFrames": animation_prompts,
        },
    }


def animation_frame_key(state: str, index: int) -> str:
    return f"animationFrames.{state}.{index + 1:02d}"


def animation_frame_source_value(source_images: dict[str, Any], state: str, index: int) -> str | None:
    animation_frames = source_images.get("animationFrames")
    if not isinstance(animation_frames, dict):
        return None
    state_frames = animation_frames.get(state)
    if not isinstance(state_frames, list) or index >= len(state_frames):
        return None
    value = state_frames[index]
    return value if isinstance(value, str) else None


def source_image_paths(spec: dict[str, Any], spec_path: Path, source_root: Path) -> dict[str, Path]:
    source_images = spec.get("sourceImages") or {}
    paths: dict[str, Path] = {}
    for key in ("card", "battle", "attackReference", "ultimateReference"):
        if key in source_images:
            paths[key] = resolve_path(source_images[key], spec_path)
            continue
        default_name = {
            "card": "card.png",
            "battle": "battle.png",
            "attackReference": "attack-reference.png",
            "ultimateReference": "ultimate-reference.png",
        }[key]
        paths[key] = source_root / default_name
    for state, count in FRAME_COUNTS.items():
        for index in range(count):
            key = animation_frame_key(state, index)
            value = animation_frame_source_value(source_images, state, index)
            paths[key] = resolve_path(value, spec_path) if value else source_root / "anim" / state / f"{index + 1:02d}.png"
    return paths


def run_imagegen_command(command: str, spec_path: Path, prompt_pack_path: Path, source_root: Path) -> None:
    source_root.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.update(
        {
            "WARRIOR_SPEC_PATH": str(spec_path),
            "WARRIOR_PROMPT_PACK": str(prompt_pack_path),
            "WARRIOR_SOURCE_DIR": str(source_root),
        }
    )
    result = subprocess.run(command, cwd=ROOT, env=env, shell=True)
    if result.returncode != 0:
        raise PipelineError(f"image generation provider command failed with exit code {result.returncode}")


def ensure_source_images(
    spec: dict[str, Any],
    spec_path: Path,
    candidate_dir: Path,
    source_root: Path,
    imagegen_command: str | None,
) -> dict[str, Path]:
    prompt_pack = build_prompt_pack(spec)
    prompt_pack_path = candidate_dir / "prompt-pack.json"
    dump_json(prompt_pack_path, prompt_pack)

    paths = source_image_paths(spec, spec_path, source_root)
    required_keys = ["card", "battle"] + [animation_frame_key(state, index) for state, count in FRAME_COUNTS.items() for index in range(count)]
    missing = [key for key in required_keys if not paths[key].exists()]
    if missing and imagegen_command:
        run_imagegen_command(imagegen_command, spec_path, prompt_pack_path, source_root)
        paths = source_image_paths(spec, spec_path, source_root)
        missing = [key for key in required_keys if not paths[key].exists()]
    if missing:
        raise PipelineError(
            "image generation provider unavailable or did not write required true per-frame raster sources: "
            + ", ".join(missing)
            + f". Prompt pack written to {prompt_pack_path}"
        )
    return paths


def require_png_rgba(path: Path, purpose: str) -> Image.Image:
    if path.suffix.lower() != ".png":
        raise PipelineError(f"{purpose} must be a PNG: {path}")
    with path.open("rb") as handle:
        if handle.read(8).hex() != "89504e470d0a1a0a":
            raise PipelineError(f"{purpose} is not a valid PNG: {path}")
    image = Image.open(path).convert("RGBA")
    return image


def has_corner_alpha(image: Image.Image) -> bool:
    alpha = image.getchannel("A")
    corners = [alpha.getpixel((0, 0)), alpha.getpixel((image.width - 1, 0)), alpha.getpixel((0, image.height - 1)), alpha.getpixel((image.width - 1, image.height - 1))]
    return any(value > 8 for value in corners)


def alpha_metrics(image: Image.Image) -> dict[str, float] | None:
    bbox = alpha_bbox(image)
    if bbox is None:
        return None
    left, top, right, bottom = bbox
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "centerOffsetX": abs((left + right) / 2 - FRAME_WIDTH / 2),
        "centerOffsetY": abs((top + bottom) / 2 - FRAME_HEIGHT / 2),
        "padding": min(left, top, FRAME_WIDTH - right, FRAME_HEIGHT - bottom),
        "occupancy": max((right - left) / FRAME_WIDTH, (bottom - top) / FRAME_HEIGHT),
    }


def parse_hex_color(value: str, alpha: int = 210) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def line_points_for_arc(center: tuple[float, float], radius_x: float, radius_y: float, start: float, end: float, steps: int) -> list[tuple[float, float]]:
    return [
        (
            center[0] + math.cos(math.radians(start + (end - start) * step / max(1, steps - 1))) * radius_x,
            center[1] + math.sin(math.radians(start + (end - start) * step / max(1, steps - 1))) * radius_y,
        )
        for step in range(steps)
    ]


def draw_glow_line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], color: tuple[int, int, int, int], width: int) -> None:
    draw.line(points, fill=color, width=width, joint="curve")


def effect_frame(spec: dict[str, Any], state: str, index: int, count: int) -> Image.Image:
    effect = spec["effects"][state]
    style = spec["motion"][state]["style"]
    colors = [parse_hex_color(color) for color in spec["effects"]["palette"]]
    primary = colors[index % len(colors)]
    secondary = colors[(index + 1) % len(colors)]
    phase = index / count
    alpha_scale = math.sin((phase + 0.08) * math.pi)
    alpha = max(58, min(235, round(180 * abs(alpha_scale))))
    primary = (*primary[:3], alpha)
    secondary = (*secondary[:3], max(45, alpha - 55))

    image = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")
    center = (FRAME_WIDTH / 2, FRAME_HEIGHT / 2)
    shape = effect["shape"].lower()

    if state == "idle":
        for dot in range(3):
            angle = phase * 360 + dot * 120
            x = center[0] + math.cos(math.radians(angle)) * (28 + dot * 5)
            y = center[1] - 38 + math.sin(math.radians(angle)) * (10 + dot * 2)
            draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=secondary)
    elif state == "run":
        for dot in range(5):
            drift = dot * 11 + phase * 18
            x = center[0] - 38 + drift
            y = center[1] + 42 + math.sin(phase * math.tau + dot) * 4
            draw.ellipse((x - 2, y - 1, x + 3, y + 2), fill=(*secondary[:3], max(40, alpha - dot * 22)))
    elif state == "attack":
        if "thrust" in shape or style in ("thrust", "pierce", "ranged"):
            length = 34 + 58 * math.sin(min(1, phase * 1.3) * math.pi)
            y = center[1] - 10 + math.sin(phase * math.tau) * 8
            draw_glow_line(draw, [(center[0] - 18, y), (center[0] + length, y - 10)], primary, 5)
            draw_glow_line(draw, [(center[0] - 8, y + 7), (center[0] + length * 0.8, y + 1)], secondary, 3)
        else:
            start = -160 + phase * 120
            end = start + 128
            points = line_points_for_arc((center[0] + 8, center[1] - 6), 58, 36, start, end, 16)
            draw_glow_line(draw, points, primary, 5)
            inner = line_points_for_arc((center[0] + 3, center[1] - 2), 42, 26, start + 14, end - 10, 12)
            draw_glow_line(draw, inner, secondary, 3)
    else:
        if "shard" in shape or "rune" in shape:
            for shard in range(7):
                angle = phase * 260 + shard * 51
                radius = 28 + 36 * math.sin(min(1, phase + 0.15) * math.pi)
                x = center[0] + math.cos(math.radians(angle)) * radius
                y = center[1] + math.sin(math.radians(angle)) * radius * 0.62
                draw.polygon(
                    [(x, y - 5), (x + 4, y + 2), (x - 2, y + 5)],
                    fill=(*primary[:3], max(50, alpha - shard * 12)),
                )
        else:
            start = phase * 360 - 90
            for ring in range(3):
                points = line_points_for_arc(
                    (center[0], center[1] - 2),
                    34 + ring * 15,
                    22 + ring * 11,
                    start + ring * 34,
                    start + 210 + ring * 24,
                    22,
                )
                draw_glow_line(draw, points, primary if ring == 1 else secondary, 4 if ring == 1 else 3)
            for spark in range(6):
                angle = start + spark * 60
                x = center[0] + math.cos(math.radians(angle)) * 54
                y = center[1] + math.sin(math.radians(angle)) * 38
                draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=secondary)

    glow = image.filter(ImageFilter.GaussianBlur(2.2))
    glow.alpha_composite(image)
    return glow


def write_animation_frames(spec: dict[str, Any], source_paths: dict[str, Path], candidate_dir: Path) -> None:
    anim_root = candidate_dir / "anim"
    for state, count in FRAME_COUNTS.items():
        state_dir = anim_root / state
        effect_dir = state_dir / "effect"
        effect_dir.mkdir(parents=True, exist_ok=True)
        for index in range(count):
            frame_path = source_paths[animation_frame_key(state, index)]
            frame = require_png_rgba(frame_path, f"{state} frame {index + 1}")
            if has_corner_alpha(frame):
                raise PipelineError(f"{state} frame {index + 1} must be a transparent cutout; opaque corners suggest baked background/effects")
            frame.save(state_dir / f"{index + 1:02d}.png")
            effect_frame(spec, state, index, count).save(effect_dir / f"{index + 1:02d}.png")


def process_sources(spec: dict[str, Any], source_paths: dict[str, Path], candidate_dir: Path) -> None:
    card = require_png_rgba(source_paths["card"], "card source")
    battle = require_png_rgba(source_paths["battle"], "battle source")
    if has_corner_alpha(battle):
        raise PipelineError("battle source must be a transparent cutout; opaque corner pixels suggest baked background/effects")

    ImageOps.fit(card, (1024, 1024), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)).save(candidate_dir / "card.png")
    base = normalize_image(battle)
    if alpha_bbox(base) is None:
        raise PipelineError("battle source has no visible alpha content")
    base.save(candidate_dir / "battle-idle.png")
    write_animation_frames(spec, source_paths, candidate_dir)

    marker = candidate_dir / PRESERVE_OVERLAY_MARKER
    marker.write_text("generated overlays are already separated\n", encoding="utf-8")
    normalize_hero(candidate_dir)
    marker.unlink(missing_ok=True)


def effect_like_score(image: Image.Image) -> float:
    image = image.convert("RGBA")
    pixels = image.load()
    active = 0
    effect_like = 0
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a <= 8:
                continue
            active += 1
            chroma = max(r, g, b) - min(r, g, b)
            luma = (r * 299 + g * 587 + b * 114) / 1000
            if a < 170 and chroma > 58 and luma > 90:
                effect_like += 1
    return effect_like / active if active else 0


def frame_delta(left: Image.Image, right: Image.Image) -> int:
    total = 0
    left_bytes = left.convert("RGBA").tobytes()
    right_bytes = right.convert("RGBA").tobytes()
    for offset in range(0, min(len(left_bytes), len(right_bytes)), 4):
        total += abs(left_bytes[offset + 3] - right_bytes[offset + 3])
        total += abs(left_bytes[offset] - right_bytes[offset]) // 12
        total += abs(left_bytes[offset + 1] - right_bytes[offset + 1]) // 12
        total += abs(left_bytes[offset + 2] - right_bytes[offset + 2]) // 12
    return total


def regional_frame_delta(left: Image.Image, right: Image.Image, region: str) -> int:
    total = 0
    left = left.convert("RGBA")
    right = right.convert("RGBA")
    bbox = alpha_bbox(left) or alpha_bbox(right)
    if bbox is None:
        return 0
    box_left, box_top, box_right, box_bottom = bbox
    width = max(1, box_right - box_left)
    height = max(1, box_bottom - box_top)
    left_px = left.load()
    right_px = right.load()
    for y in range(box_top, box_bottom):
        ny = (y - box_top) / height
        for x in range(box_left, box_right):
            nx = (x - box_left) / width
            include = False
            if region == "upper_outer":
                include = 0.14 <= ny <= 0.76 and (nx <= 0.43 or nx >= 0.57)
            elif region == "lower_split":
                include = ny >= 0.55 and (nx <= 0.48 or nx >= 0.52)
            if not include:
                continue
            lr, lg, lb, la = left_px[x, y]
            rr, rg, rb, ra = right_px[x, y]
            total += abs(la - ra)
            total += abs(lr - rr) // 12
            total += abs(lg - rg) // 12
            total += abs(lb - rb) // 12
    return total


def articulation_metrics(frames: list[Image.Image]) -> dict[str, int]:
    if len(frames) < 2:
        return {"upperOuterDelta": 0, "lowerSplitDelta": 0}
    upper = [regional_frame_delta(left, right, "upper_outer") for left, right in zip(frames, frames[1:])]
    lower = [regional_frame_delta(left, right, "lower_split") for left, right in zip(frames, frames[1:])]
    return {"upperOuterDelta": max(upper), "lowerSplitDelta": max(lower)}


def articulation_thresholds(state: str) -> dict[str, int]:
    if state == "idle":
        return {"upperOuterDelta": 9000, "lowerSplitDelta": 2200}
    if state == "run":
        return {"upperOuterDelta": 18000, "lowerSplitDelta": 18000}
    if state == "attack":
        return {"upperOuterDelta": 22000, "lowerSplitDelta": 7000}
    return {"upperOuterDelta": 22000, "lowerSplitDelta": 7000}


def looks_square_or_panel_like(image: Image.Image) -> bool:
    alpha = image.convert("RGBA").getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return False
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    if width < 44 or height < 44:
        return False
    ratio = width / height
    if ratio < 0.62 or ratio > 1.62:
        return False
    px = alpha.load()
    active = 0
    long_rows = 0
    long_cols = 0
    for y in range(top, bottom):
        row = sum(1 for x in range(left, right) if px[x, y] > 18)
        active += row
        if row / width > 0.72:
            long_rows += 1
    for x in range(left, right):
        col = sum(1 for y in range(top, bottom) if px[x, y] > 18)
        if col / height > 0.72:
            long_cols += 1
    density = active / (width * height)
    return density > 0.18 and (long_rows / height > 0.28 or long_cols / width > 0.28)


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        header = handle.read(24)
    if header[:8].hex() != "89504e470d0a1a0a":
        raise PipelineError(f"not a PNG: {path}")
    return (int.from_bytes(header[16:20], "big"), int.from_bytes(header[20:24], "big"))


def audit_candidate(candidate_dir: Path) -> list[dict[str, Any]]:
    gates: list[dict[str, Any]] = []

    def pass_gate(name: str, details: Any = None) -> None:
        gates.append({"name": name, "status": "passed", "details": details})

    def fail_gate(name: str, message: str, details: Any = None) -> None:
        gates.append({"name": name, "status": "failed", "message": message, "details": details})

    if png_size(candidate_dir / "card.png") == (1024, 1024):
        pass_gate("card-size", "1024x1024")
    else:
        fail_gate("card-size", "card.png must be 1024x1024")

    for state, count in FRAME_COUNTS.items():
        state_dir = candidate_dir / "anim" / state
        effect_dir = state_dir / "effect"
        frame_paths = sorted(path for path in state_dir.glob("*.png") if path.stem.isdigit())
        overlay_paths = sorted(path for path in effect_dir.glob("*.png") if path.stem.isdigit())
        frame_images: list[Image.Image] = []
        if len(frame_paths) != count:
            fail_gate(f"{state}-frame-count", f"{state} must have {count} base frames", len(frame_paths))
            continue
        pass_gate(f"{state}-frame-count", count)
        if state in REQUIRED_OVERLAY_STATES and len(overlay_paths) != count:
            fail_gate(f"{state}-overlay-count", f"{state} must have {count} effect overlay frames", len(overlay_paths))
        else:
            pass_gate(f"{state}-overlay-count", count)

        for frame_path in frame_paths:
            if png_size(frame_path) != (FRAME_WIDTH, FRAME_HEIGHT):
                fail_gate("frame-size", f"{frame_path} must be {FRAME_WIDTH}x{FRAME_HEIGHT}")
                continue
            image = Image.open(frame_path).convert("RGBA")
            frame_images.append(image)
            metrics = alpha_metrics(image)
            if metrics is None:
                fail_gate("frame-alpha", f"{frame_path} has no visible character pixels")
                continue
            if metrics["padding"] < MIN_PADDING:
                fail_gate("frame-padding", f"{frame_path} padding below {MIN_PADDING}", metrics)
            if metrics["occupancy"] > MAX_OCCUPANCY:
                fail_gate("frame-occupancy", f"{frame_path} occupancy above {MAX_OCCUPANCY}", metrics)
            if metrics["centerOffsetX"] > 18 or metrics["centerOffsetY"] > 16:
                fail_gate("frame-centering", f"{frame_path} is not centered on (96,112)", metrics)
            score = effect_like_score(image)
            if score > 0.16:
                fail_gate("baked-effects", f"{frame_path} appears to include baked glow/trail pixels", {"score": round(score, 4)})

        for overlay_path in overlay_paths:
            if png_size(overlay_path) != (FRAME_WIDTH, FRAME_HEIGHT):
                fail_gate("overlay-size", f"{overlay_path} must be {FRAME_WIDTH}x{FRAME_HEIGHT}")
                continue
            overlay = Image.open(overlay_path).convert("RGBA")
            if alpha_bbox(overlay) is None:
                fail_gate("overlay-alpha", f"{overlay_path} is blank; every state must wire a real overlay layer")
            if looks_square_or_panel_like(overlay):
                fail_gate("square-overlay", f"{overlay_path} looks square/panel-like")

        if len(frame_images) == count:
            deltas = [frame_delta(left, right) for left, right in zip(frame_images, frame_images[1:])]
            min_delta = min(deltas) if deltas else 0
            if min_delta < MIN_MOTION_DELTA:
                fail_gate(
                    f"{state}-motion-delta",
                    f"{state} base frames are too similar after normalization",
                    {"minDelta": min_delta, "required": MIN_MOTION_DELTA},
                )
            else:
                pass_gate(f"{state}-motion-delta", {"minDelta": min_delta})
            regional = articulation_metrics(frame_images)
            thresholds = articulation_thresholds(state)
            failed_regions = {
                key: {"actual": regional[key], "required": required}
                for key, required in thresholds.items()
                if regional[key] < required
            }
            if failed_regions:
                fail_gate(
                    f"{state}-articulation",
                    f"{state} lacks visible hand/weapon or foot-region motion",
                    {"metrics": regional, "failed": failed_regions},
                )
            else:
                pass_gate(f"{state}-articulation", regional)

    legacy_attack = [candidate_dir / f"attack-{index}.png" for index in range(4)]
    if all(path.exists() and png_size(path) == (FRAME_WIDTH, FRAME_HEIGHT) for path in legacy_attack):
        pass_gate("legacy-attack-frames", 4)
    else:
        fail_gate("legacy-attack-frames", "attack-0..3.png must exist as 192x224 PNGs")
    if (candidate_dir / "attack-strip.png").exists() and png_size(candidate_dir / "attack-strip.png") == (FRAME_WIDTH * 4, FRAME_HEIGHT):
        pass_gate("legacy-attack-strip", f"{FRAME_WIDTH * 4}x{FRAME_HEIGHT}")
    else:
        fail_gate("legacy-attack-strip", "attack-strip.png must be 768x224")
    if list(candidate_dir.rglob("*.svg")):
        fail_gate("no-svg", "candidate contains SVG files")
    else:
        pass_gate("no-svg")
    return gates


def audit_passed(gates: list[dict[str, Any]]) -> bool:
    return all(gate["status"] == "passed" for gate in gates)


def create_contact_sheet(hero_id: str, candidate_dir: Path, output_path: Path) -> None:
    roster_dirs = sorted(path for path in PUBLIC_CHARACTER_ROOT.iterdir() if path.is_dir())
    rows = [(path.name, path) for path in roster_dirs] + [(f"{hero_id} candidate", candidate_dir)]
    thumb_w, thumb_h = 72, 84
    label_w = 170
    row_h = thumb_h * 2 + 30
    width = label_w + thumb_w * 8 + 24
    height = 34 + row_h * len(rows)
    sheet = Image.new("RGBA", (width, height), (18, 18, 24, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 10), "Full roster attack / ultimate contact sheet", fill=(232, 236, 245, 255))

    y = 34
    for label, root in rows:
        draw.text((12, y + 4), label, fill=(232, 236, 245, 255))
        for state_index, state in enumerate(("attack", "ultimate")):
            state_dir = root / "anim" / state
            for index in range(8):
                frame = state_dir / f"{index + 1:02d}.png"
                overlay_frame = state_dir / "effect" / f"{index + 1:02d}.png"
                x = label_w + index * thumb_w
                yy = y + state_index * thumb_h + state_index * 10
                if frame.exists():
                    image = Image.open(frame).convert("RGBA")
                    if overlay_frame.exists():
                        image.alpha_composite(Image.open(overlay_frame).convert("RGBA"))
                    image = image.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                    sheet.alpha_composite(image, (x, yy))
                draw.rectangle((x, yy, x + thumb_w - 1, yy + thumb_h - 1), outline=(52, 58, 74, 255))
        y += row_h
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)


def motion_brief(spec: dict[str, Any], contact_sheet_path: Path) -> str:
    lines = [
        f"# {spec['id']} motion brief",
        "",
        f"- Weapon silhouette: {spec['visual']['weaponSilhouette']}",
        f"- Avoid similar to: {', '.join(spec['avoidSimilarTo'])}",
        f"- Contact sheet: {contact_sheet_path}",
        "",
        "## Motion Grammar",
    ]
    for state in FRAME_COUNTS:
        motion = spec["motion"][state]
        effect = spec["effects"][state]
        lines.extend(
            [
                f"- {state}: {motion['grammar']}",
                f"  - layers: {', '.join(motion['layers'])}",
                f"  - effect: {effect['shape']} from {effect['origin']} along {effect['path']} ({effect['rhythm']})",
            ]
        )
    return "\n".join(lines) + "\n"


def report_data(
    spec: dict[str, Any],
    status: str,
    candidate_dir: Path,
    spec_path: Path,
    source_paths: dict[str, Path] | None,
    gates: list[dict[str, Any]],
    contact_sheet_path: Path | None,
    attempts: int,
    promoted: bool,
    message: str | None = None,
) -> dict[str, Any]:
    return {
        "heroId": spec.get("id"),
        "status": status,
        "message": message,
        "generatedAt": utc_now(),
        "specPath": str(spec_path),
        "candidateDir": str(candidate_dir),
        "promoted": promoted,
        "attempts": attempts,
        "retries": max(0, attempts - 1),
        "maxRetries": 3,
        "sourceImages": {key: str(path) for key, path in (source_paths or {}).items()},
        "promptPack": str(candidate_dir / "prompt-pack.json"),
        "motionBrief": str(candidate_dir / "motion-brief.md"),
        "contactSheet": str(contact_sheet_path) if contact_sheet_path else None,
        "qualityGates": gates,
    }


def write_failure_report(spec: dict[str, Any], candidate_dir: Path, spec_path: Path, message: str, attempts: int = 0) -> None:
    dump_json(candidate_dir / "generation-report.json", report_data(spec, "failed", candidate_dir, spec_path, None, [], None, attempts, False, message))


def append_before_marker(text: str, marker: str, entry: str) -> str:
    index = text.index(marker)
    prefix = text[:index].rstrip()
    if not prefix.endswith("[") and not prefix.endswith("{"):
        prefix += ","
    return prefix + "\n" + entry + text[index:]


def insert_hero_id_type(text: str, hero_id: str) -> str:
    ids = hero_id_values_from_text(text)
    if hero_id in ids:
        return text
    ids.append(hero_id)
    lines = ["export type HeroId ="]
    for index, value in enumerate(ids):
        suffix = ";" if index == len(ids) - 1 else ""
        lines.append(f'  | "{value}"{suffix}')
    match = hero_id_block_match(text)
    return text[: match.start()] + "\n".join(lines) + match.group("suffix") + text[match.end() :]


def append_to_string_array_const(text: str, const_name: str, hero_id: str) -> str:
    start = text.index(f"const {const_name} = [")
    end = text.index("] as const;", start)
    body = text[start:end]
    if f'"{hero_id}"' in body:
        return text
    new_body = body.rstrip() + f',\n  "{hero_id}"\n'
    return text[:start] + new_body + text[end:]


def add_hero_to_bond(text: str, bond_id: str, hero_id: str) -> str:
    pattern = re.compile(r'(\{\n    id: "' + re.escape(bond_id) + r'",[\s\S]*?characterIds: \[)([^\]]*)(\])')
    match = pattern.search(text)
    if not match:
        raise PipelineError(f"could not find bond {bond_id}")
    ids = re.findall(r'"([^"]+)"', match.group(2))
    if hero_id in ids:
        return text
    ids.append(hero_id)
    replacement = match.group(1) + ", ".join(ts_string(item) for item in ids) + match.group(3)
    return text[: match.start()] + replacement + text[match.end() :]


def ability_object_literal(ability: dict[str, Any], indent: str) -> str:
    return "\n".join(
        [
            f"{indent}{{",
            f"{indent}  name: {ts_string(ability['name'])},",
            f"{indent}  description: {ts_string(ability['description'])},",
            f"{indent}  cooldown: {ts_number(ability['cooldown'])},",
            f"{indent}  range: {ts_number(ability['range'])},",
            f"{indent}  radius: {ts_number(ability['radius'])},",
            f"{indent}  damage: {ts_number(ability['damage'])},",
            f"{indent}  damageTags: {ts_string_array(ability['damageTags'])},",
            f"{indent}  vfxKey: {ts_string(ability['vfxKey'])},",
            f"{indent}  effectId: {ts_string(ability['effectId'])}",
            f"{indent}}}",
        ]
    )


def hero_entry(spec: dict[str, Any]) -> str:
    return "\n".join(
        [
            "  createHero({",
            f"    id: {ts_string(spec['id'])},",
            f"    factionId: {ts_string(spec['factionId'])},",
            f"    name: {ts_string(spec['name'])},",
            f"    title: {ts_string(spec['title'])},",
            f"    role: {ts_string(spec['role'])},",
            f"    passiveName: {ts_string(spec['passive']['name'])},",
            f"    passiveText: {ts_string(spec['passive']['text'])},",
            "    baseStats: "
            + "{ "
            + f"maxHp: {ts_number(spec['baseStats']['maxHp'])}, "
            + f"moveSpeed: {ts_number(spec['baseStats']['moveSpeed'])}, "
            + f"armor: {ts_number(spec['baseStats']['armor'])}, "
            + f"pickupRadius: {ts_number(spec['baseStats']['pickupRadius'])}"
            + " },",
            "    autoAbility: " + ability_object_literal(spec["abilities"]["auto"], "    ").lstrip() + ",",
            "    manualAbility: " + ability_object_literal(spec["abilities"]["manual"], "    ").lstrip(),
            "  })",
        ]
    )


def character_art_entry(spec: dict[str, Any]) -> str:
    palette = spec["visual"]["palette"]
    return "\n".join(
        [
            "  createPlayableArt({",
            f"    id: {ts_string(spec['id'])},",
            f"    assetId: {ts_string(spec['id'])},",
            f"    factionId: {ts_string(spec['factionId'])},",
            f"    name: {ts_string(spec['name'])},",
            f"    title: {ts_string(spec['title'])},",
            f"    rarityLabel: {ts_string(spec['rarityLabel'])},",
            f"    stars: {ts_number(spec['stars'])},",
            f"    role: {ts_string(spec['role'])},",
            f"    quote: {ts_string(spec['quote'])},",
            f"    biography: {ts_string(spec['biography'])},",
            f"    bondIds: {ts_string_array(spec['bondIds'])},",
            f"    palette: {{ primary: {ts_string(palette['primary'])}, secondary: {ts_string(palette['secondary'])}, accent: {ts_string(palette['accent'])} }},",
            "    animationFrameCounts: { idle: 6, run: 6, attack: 8, ultimate: 8 },",
            "    animationEffectOverlays: { idle: true, run: true, attack: true, ultimate: true }",
            "  })",
        ]
    )


def ultimate_call(hero_id: str, ability: dict[str, Any], default_suffix: str) -> str:
    ability_id = ability.get("id") or f"{hero_id}_ultimate_{default_suffix}"
    return (
        f"ultimateAbility({ts_string(hero_id)}, {ts_string(ability_id)}, {ts_string(ability['name'])}, "
        f"{ts_number(ability['range'])}, {ts_number(ability['radius'])}, {ts_number(ability['damage'])}, "
        f"{ts_string_array(ability['damageTags'])}, {ts_string(ability['vfxKey'])}, {ts_string(ability['effectId'])})"
    )


def ultimate_base_entry(spec: dict[str, Any]) -> str:
    hero_id = spec["id"]
    ultimate = spec["ultimate"]
    return "\n".join(
        [
            "  {",
            f"    heroId: {ts_string(hero_id)},",
            f"    name: {ts_string(ultimate['name'])},",
            f"    duration: {ts_number(ultimate['duration'])},",
            f"    pulseEvery: {ts_number(ultimate['pulseEvery'])},",
            f"    vfxKey: {ts_string(ultimate['vfxKey'])},",
            f"    empoweredUnlockId: masteryUnlockId({ts_string(hero_id)}),",
            f"    pulseAbility: {ultimate_call(hero_id, ultimate['pulseAbility'], 'pulse')}",
            "  }",
        ]
    )


def ultimate_enhancement_entry(spec: dict[str, Any]) -> str:
    hero_id = spec["id"]
    ultimate = spec["ultimate"]
    start_vfx = ultimate.get("presentationStartVfxKey", ultimate["vfxKey"])
    return "\n".join(
        [
            f"  {hero_id}: {{",
            f"    presentation: presentation({ts_string(start_vfx)}, {ts_string(ultimate['finisherVfxKey'])}, {ts_string(ultimate['shortLabel'])}),",
            f"    finisherVfxKey: {ts_string(ultimate['finisherVfxKey'])},",
            f"    finisherAbility: {ultimate_call(hero_id, ultimate['finisherAbility'], 'finisher')}",
            "  }",
        ]
    )


def vfx_profile_entry(profile: dict[str, Any]) -> str:
    lines = [
        f"  {profile['key']}: {{",
        f"    textureKey: {ts_string(profile['textureKey'])},",
        f"    color: 0x{profile['color'].lstrip('#').lower()},",
        f"    blendMode: {ts_string(profile.get('blendMode', 'add'))},",
        f"    scale: {ts_number(profile['scale'])},",
        f"    lifetime: {ts_number(profile['lifetime'])},",
    ]
    optional_string_fields = ("particleKey", "telegraphShape", "presentationKind", "originMode", "motionStyle")
    for key in optional_string_fields:
        if key in profile:
            lines.append(f"    {key}: {ts_string(profile[key])},")
    if "arcDegrees" in profile:
        lines.append(f"    arcDegrees: {ts_number(profile['arcDegrees'])},")
    if "followPlayer" in profile:
        lines.append(f"    followPlayer: {'true' if profile['followPlayer'] else 'false'},")
    if lines[-1].endswith(","):
        lines[-1] = lines[-1][:-1]
    lines.append("  }")
    return "\n".join(lines)


def update_prompt_catalog(spec: dict[str, Any]) -> None:
    if not PROMPT_CATALOG_PATH.exists():
        return
    catalog = load_json(PROMPT_CATALOG_PATH)
    characters = catalog.setdefault("characters", [])
    if any(character.get("id") == spec["id"] for character in characters):
        return
    characters.append(
        {
            "id": spec["id"],
            "cardPrompt": spec["visual"]["cardPrompt"],
            "battlePrompt": spec["visual"]["battlePrompt"],
            "attackPrompt": spec["motion"]["attack"]["grammar"],
            "ultimatePrompt": spec["motion"]["ultimate"]["grammar"],
        }
    )
    dump_json(PROMPT_CATALOG_PATH, catalog)


def prepare_content_updates(spec: dict[str, Any]) -> dict[Path, str]:
    hero_id = spec["id"]
    updates: dict[Path, str] = {}

    updates[TYPES_PATH] = insert_hero_id_type(read_text(TYPES_PATH), hero_id)
    updates[MANIFEST_PATH] = append_to_string_array_const(read_text(MANIFEST_PATH), "heroTextureIds", hero_id)
    for profile in spec.get("vfxProfiles", []) or []:
        if profile["key"] not in existing_vfx_keys():
            updates[MANIFEST_PATH] = append_before_marker(
                updates[MANIFEST_PATH],
                "\n};\n\nexport const enemyVisualProfiles",
                vfx_profile_entry(profile),
            )

    updates[HEROES_PATH] = append_before_marker(read_text(HEROES_PATH), "\n];\n\nexport const heroById", hero_entry(spec))

    character_art_text = read_text(CHARACTER_ART_PATH)
    for bond_id in spec["bondIds"]:
        character_art_text = add_hero_to_bond(character_art_text, bond_id, hero_id)
    updates[CHARACTER_ART_PATH] = append_before_marker(character_art_text, "\n];\n\nexport const characterArtById", character_art_entry(spec))

    ultimates_text = read_text(ULTIMATES_PATH)
    ultimates_text = append_before_marker(ultimates_text, "\n];\n\nconst ultimateEnhancements", ultimate_base_entry(spec))
    ultimates_text = append_before_marker(ultimates_text, "\n};\n\nexport const ultimateProfiles", ultimate_enhancement_entry(spec))
    updates[ULTIMATES_PATH] = ultimates_text

    verify_content_updates(spec, updates)
    return updates


def verify_content_updates(spec: dict[str, Any], updates: dict[Path, str]) -> None:
    hero_id = spec["id"]
    if hero_id not in hero_id_values_from_text(updates[TYPES_PATH]):
        raise PipelineError(f"content update failed to add {hero_id} to HeroId union")
    if f'id: {ts_string(hero_id)}' not in updates[HEROES_PATH]:
        raise PipelineError(f"content update failed to add {hero_id} to heroes.ts")
    if f'id: {ts_string(hero_id)}' not in updates[CHARACTER_ART_PATH]:
        raise PipelineError(f"content update failed to add {hero_id} to characterArt.ts")
    if f"  {hero_id}: " not in updates[ULTIMATES_PATH]:
        raise PipelineError(f"content update failed to add {hero_id} ultimate enhancement")


def copy_candidate_assets(candidate_dir: Path, destination_dir: Path) -> None:
    if destination_dir.exists():
        raise PipelineError(f"destination character asset directory already exists: {destination_dir}")
    temp_dir = destination_dir.with_name(destination_dir.name + ".__promoting")
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True)
    for name in ("card.png", "battle-idle.png", "attack-strip.png", "attack-0.png", "attack-1.png", "attack-2.png", "attack-3.png"):
        shutil.copy2(candidate_dir / name, temp_dir / name)
    shutil.copytree(candidate_dir / "anim", temp_dir / "anim")
    temp_dir.rename(destination_dir)


def promote(spec: dict[str, Any], candidate_dir: Path, report: dict[str, Any], contact_sheet_path: Path) -> None:
    hero_id = spec["id"]
    content_updates = prepare_content_updates(spec)
    destination_dir = PUBLIC_CHARACTER_ROOT / hero_id
    try:
        copy_candidate_assets(candidate_dir, destination_dir)
        for path, text in content_updates.items():
            write_text(path, text)
        update_prompt_catalog(spec)
        source_dir = SOURCE_ANIM_ROOT / hero_id
        source_dir.mkdir(parents=True, exist_ok=True)
        dump_json(source_dir / "generation-report.json", report)
        write_text(source_dir / "motion-brief.md", motion_brief(spec, contact_sheet_path))
        shutil.copy2(candidate_dir / "prompt-pack.json", source_dir / "prompt-pack.json")
    except Exception:
        if destination_dir.exists():
            shutil.rmtree(destination_dir)
        raise


def run_pipeline(args: argparse.Namespace) -> int:
    spec_path = Path(args.spec).resolve()
    spec = load_json(spec_path)
    if not isinstance(spec, dict):
        raise PipelineError("spec root must be an object")
    validate_spec(
        spec,
        spec_path,
        validate_sources=args.validate_sources,
        require_source_animation_frames=not bool(args.imagegen_command),
    )
    if args.validate_only:
        print(f"validated {spec['id']}")
        return 0

    output_root = Path(args.output_root).resolve()
    candidate_dir = output_root / spec["id"] / "candidate"
    source_root = Path(args.source_root).resolve() if args.source_root else output_root / spec["id"] / "sources"
    if candidate_dir.exists():
        shutil.rmtree(candidate_dir)
    candidate_dir.mkdir(parents=True, exist_ok=True)

    source_paths: dict[str, Path] | None = None
    gates: list[dict[str, Any]] = []
    contact_sheet_path: Path | None = None
    attempts = 0
    max_retries = max(0, args.max_retries)
    imagegen_command = args.imagegen_command or os.environ.get("WARRIOR_IMAGEGEN_COMMAND")

    try:
        for attempt in range(max_retries + 1):
            attempts = attempt + 1
            if attempt > 0 and candidate_dir.exists():
                shutil.rmtree(candidate_dir)
                candidate_dir.mkdir(parents=True, exist_ok=True)
            source_paths = ensure_source_images(spec, spec_path, candidate_dir, source_root, imagegen_command)
            process_sources(spec, source_paths, candidate_dir)
            contact_sheet_path = candidate_dir / "contact-sheet.png"
            create_contact_sheet(spec["id"], candidate_dir, contact_sheet_path)
            WEB_GAME_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
            create_contact_sheet(spec["id"], candidate_dir, WEB_GAME_OUTPUT_ROOT / f"{spec['id']}-attack-ultimate-contact-sheet.png")
            write_text(candidate_dir / "motion-brief.md", motion_brief(spec, contact_sheet_path))
            gates = audit_candidate(candidate_dir)
            if audit_passed(gates):
                break
            if not imagegen_command:
                break
        status = "passed" if audit_passed(gates) else "failed"
        message = None if status == "passed" else "quality gates failed"
        report = report_data(spec, status, candidate_dir, spec_path, source_paths, gates, contact_sheet_path, attempts, False, message)
        dump_json(candidate_dir / "generation-report.json", report)
        if status != "passed":
            return 2
        if args.dry_run:
            print(f"dry-run passed {spec['id']}: {candidate_dir}")
            return 0
        report["promoted"] = True
        promote(spec, candidate_dir, report, contact_sheet_path or candidate_dir / "contact-sheet.png")
        dump_json(candidate_dir / "generation-report.json", report)
        print(f"promoted {spec['id']}")
        return 0
    except PipelineError as error:
        write_failure_report(spec, candidate_dir, spec_path, str(error), attempts)
        raise


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate and promote a complete warrior from one spec.")
    parser.add_argument("--spec", required=True, help="Path to scripts/warrior-generation/specs/<heroId>.json")
    parser.add_argument("--source-root", help="Directory containing card.png and battle.png raster sources")
    parser.add_argument("--output-root", default=str(OUTPUT_ROOT), help="Candidate output root")
    parser.add_argument("--imagegen-command", help="External provider command that writes required source PNGs")
    parser.add_argument("--max-retries", type=int, default=3, help="Provider retry count when gates fail")
    parser.add_argument("--validate-only", action="store_true", help="Validate spec and references without generating assets")
    parser.add_argument("--validate-sources", action="store_true", help="Require sourceImages paths to exist during validation")
    parser.add_argument("--dry-run", action="store_true", help="Generate candidate and reports without promoting to roster/content")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    try:
        return run_pipeline(parse_args(argv))
    except PipelineError as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
