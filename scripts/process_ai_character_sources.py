#!/usr/bin/env python3
"""Convert AI source card/sprite images into complete game character asset sets."""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "output" / "ai-character-sources"
CHARACTER_ROOT = ROOT / "public" / "assets" / "characters"

FRAME_WIDTH = 192
FRAME_HEIGHT = 224

PALETTES = {
    "liubei": "#8dffc0",
    "zhangfei": "#86ff9a",
    "zhugeliang": "#a7fff0",
    "xuchu": "#b8c8ff",
    "zhangliao": "#a7c6ff",
    "simayi": "#b8a6ff",
    "sunquan": "#ffb05f",
    "ganning": "#ffbb62",
    "taishici": "#ffca6d",
    "zhangjiao": "#c9a8ff",
    "yuanshao": "#e0bcff",
    "dongzhuo": "#d371ff",
    "huatuo": "#b6ffdd",
}


def rgba(hex_color: str, alpha: int) -> tuple[int, int, int, int]:
    value = hex_color.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def remove_chroma_key(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    key = (0, 255, 0)
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            green_distance = abs(r - key[0]) + abs(g - key[1]) + abs(b - key[2])
            green_dominance = g - max(r, b)
            if green_distance < 90 or (g > 150 and green_dominance > 65):
                pixels[x, y] = (r, g, b, 0)
            elif g > 120 and green_dominance > 35:
                alpha = max(0, min(a, round(a * (1 - green_dominance / 140))))
                pixels[x, y] = (r, max(r, b, g - 60), b, alpha)
    alpha = image.getchannel("A").filter(ImageFilter.MedianFilter(3))
    image.putalpha(alpha)
    return image


def fit_sprite(source: Image.Image, size: tuple[int, int], *, target_height_ratio: float = 0.955) -> Image.Image:
    source = remove_chroma_key(source)
    bbox = source.getchannel("A").getbbox()
    if bbox is None:
        return Image.new("RGBA", size, (0, 0, 0, 0))
    crop = source.crop(bbox)
    max_h = size[1] * target_height_ratio
    scale = max_h / crop.height
    resized = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = round((size[0] - resized.width) / 2)
    y = round(size[1] - resized.height - size[1] * 0.02)
    canvas.alpha_composite(resized, (x, y))
    return canvas


def sprite_to_anim_frame(sprite: Image.Image, frame_size: tuple[int, int] = (FRAME_WIDTH, FRAME_HEIGHT), dx: int = 0, dy: int = 0, scale: float = 1.0, rotate: float = 0.0, brightness: float = 1.0) -> Image.Image:
    bbox = sprite.getchannel("A").getbbox()
    crop = sprite.crop(bbox) if bbox else sprite
    if scale != 1.0:
        crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
    if rotate:
        crop = crop.rotate(rotate, resample=Image.Resampling.BICUBIC, expand=True)
    if brightness != 1.0:
        crop = ImageEnhance.Brightness(crop).enhance(brightness)
    canvas = Image.new("RGBA", frame_size, (0, 0, 0, 0))
    x = round((frame_size[0] - crop.width) / 2 + dx)
    y = round(frame_size[1] - crop.height - 8 + dy)
    canvas.alpha_composite(crop, (x, y))
    return canvas


def fit_frame_to_safe_bounds(frame: Image.Image, margin: int = 12) -> Image.Image:
    bbox = frame.getchannel("A").getbbox()
    if bbox is None:
        return Image.new("RGBA", frame.size, (0, 0, 0, 0))
    sprite = frame.crop(bbox)
    scale = min(1.0, (frame.width - margin * 2) / sprite.width, (frame.height - margin * 2) / sprite.height)
    if scale < 1.0:
        sprite = sprite.resize((max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))), Image.Resampling.LANCZOS)
    center_delta = ((bbox[0] + bbox[2]) / 2) - (frame.width / 2)
    x = round((frame.width - sprite.width) / 2 + center_delta * scale)
    x = max(margin, min(frame.width - margin - sprite.width, x))
    y = max(margin, frame.height - margin - sprite.height)
    canvas = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    canvas.alpha_composite(sprite, (x, y))
    return canvas


def make_strip(frames: list[Image.Image]) -> Image.Image:
    strip = Image.new("RGBA", (frames[0].width * len(frames), frames[0].height), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * frame.width, 0))
    return strip


def write_attack_assets(out: Path, hero_id: str, battle: Image.Image) -> None:
    battle_size = (FRAME_WIDTH, FRAME_HEIGHT)
    (out / "anim" / "attack").mkdir(parents=True, exist_ok=True)

    attack_specs = [
        (0, 0, 1.0, 0, 1.0),
        (-5, -2, 1.02, -7, 1.02),
        (8, -4, 1.03, 9, 1.06),
        (3, -1, 1.0, 4, 1.02),
    ]
    attack_frames = []
    for index, spec in enumerate(attack_specs):
        frame = fit_frame_to_safe_bounds(sprite_to_anim_frame(battle, battle_size, *spec))
        attack_frames.append(frame)
        frame.save(out / f"attack-{index}.png")
    make_strip(attack_frames).save(out / "attack-strip.png")

    attack_anim_specs = [
        (0, 0, 1, 0, 1),
        (-5, -2, 1.02, -7, 1.02),
        (-8, -4, 1.03, -10, 1.04),
        (7, -5, 1.05, 11, 1.08),
        (10, -3, 1.04, 8, 1.06),
        (4, -1, 1.01, 4, 1.02),
        (1, 0, 1, 1, 1),
        (0, 0, 1, 0, 1),
    ]
    for index, spec in enumerate(attack_anim_specs, start=1):
        frame = fit_frame_to_safe_bounds(sprite_to_anim_frame(battle, battle_size, *spec))
        frame.save(out / "anim" / "attack" / f"{index:02d}.png")


def create_assets(hero_id: str) -> None:
    card_source = SOURCE_ROOT / f"{hero_id}-card.png"
    sprite_source = SOURCE_ROOT / f"{hero_id}-sprite.png"
    if not card_source.exists() or not sprite_source.exists():
        missing = [str(path) for path in (card_source, sprite_source) if not path.exists()]
        raise SystemExit(f"Missing source image(s): {', '.join(missing)}")

    out = CHARACTER_ROOT / hero_id
    (out / "anim" / "idle").mkdir(parents=True, exist_ok=True)
    (out / "anim" / "run").mkdir(parents=True, exist_ok=True)
    (out / "anim" / "attack").mkdir(parents=True, exist_ok=True)

    card = Image.open(card_source).convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    card.save(out / "card.png")

    battle_size = (FRAME_WIDTH, FRAME_HEIGHT)
    battle = fit_sprite(Image.open(sprite_source), battle_size)
    battle.save(out / "battle-idle.png")

    idle_specs = [(0, 0, 1, 0, 1), (0, -1, 1.01, -1, 1), (0, -2, 1.01, 1, 1.02), (0, -1, 1, 0, 1), (0, 0, 1, -1, 1), (0, 1, 0.995, 0, 1)]
    run_specs = [(-3, 0, 1, -3, 1), (-7, -5, 1.02, -6, 1.03), (-3, -2, 1, -2, 1), (3, 0, 1, 3, 1), (7, -5, 1.02, 6, 1.03), (3, -2, 1, 2, 1)]

    for index, spec in enumerate(idle_specs, start=1):
        sprite_to_anim_frame(battle, (FRAME_WIDTH, FRAME_HEIGHT), *spec).save(out / "anim" / "idle" / f"{index:02d}.png")
    for index, spec in enumerate(run_specs, start=1):
        sprite_to_anim_frame(battle, (FRAME_WIDTH, FRAME_HEIGHT), *spec).save(out / "anim" / "run" / f"{index:02d}.png")
    write_attack_assets(out, hero_id, battle)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: process_ai_character_sources.py [--attack-only] <hero_id> [...]")
    attack_only = "--attack-only" in sys.argv[1:]
    hero_ids = [arg for arg in sys.argv[1:] if arg != "--attack-only"]
    for hero_id in hero_ids:
        if attack_only:
            out = CHARACTER_ROOT / hero_id
            battle_path = out / "battle-idle.png"
            if battle_path.exists():
                battle = Image.open(battle_path).convert("RGBA")
            else:
                sprite_source = SOURCE_ROOT / f"{hero_id}-sprite.png"
                if not sprite_source.exists():
                    raise SystemExit(f"Missing source image: {sprite_source}")
                battle = fit_sprite(Image.open(sprite_source), (FRAME_WIDTH, FRAME_HEIGHT))
            write_attack_assets(out, hero_id, battle)
            continue
        create_assets(hero_id)


if __name__ == "__main__":
    main()
