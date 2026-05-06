#!/usr/bin/env python3
"""Generate in-battle ultimate animation frames from existing character sprites."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
CHARACTER_ROOT = ROOT / "public" / "assets" / "characters"
SOURCE_ROOT = ROOT / "output" / "ai-character-sources"
CONTACT_SHEET_PATH = ROOT / "output" / "web-game" / "ultimate-animation-contact-sheet.png"

FRAME_WIDTH = 192
FRAME_HEIGHT = 224
FRAME_COUNT = 8
PADDING = 12
ALPHA_THRESHOLD = 8

HERO_CONFIGS = {
    "liubei": {"style": "command", "accent": (255, 211, 106, 96), "lean": -3.2},
    "guanyu": {"style": "slash", "accent": (95, 255, 159, 112), "lean": -7.4},
    "zhangfei": {"style": "roar", "accent": (255, 98, 72, 118), "lean": -5.4},
    "zhaoyun": {"style": "dash", "accent": (155, 243, 255, 104), "lean": -8.4},
    "machao": {"style": "dash", "accent": (116, 207, 255, 106), "lean": -7.6},
    "zhugeliang": {"style": "caster", "accent": (191, 248, 255, 94), "lean": -2.6},
    "caocao": {"style": "command", "accent": (168, 184, 255, 100), "lean": -3.8},
    "xiahoudun": {"style": "cleave", "accent": (255, 105, 92, 112), "lean": -6.4},
    "xuchu": {"style": "guard", "accent": (255, 177, 92, 112), "lean": -4.8},
    "zhangliao": {"style": "dash", "accent": (125, 166, 255, 104), "lean": -7.2},
    "simayi": {"style": "caster", "accent": (201, 168, 255, 100), "lean": -3.4},
    "sunquan": {"style": "command", "accent": (255, 187, 112, 100), "lean": -3.0},
    "zhouyu": {"style": "caster", "accent": (255, 90, 50, 108), "lean": -3.0},
    "sunshangxiang": {"style": "ranged", "accent": (255, 207, 100, 102), "lean": -4.4},
    "ganning": {"style": "slash", "accent": (217, 225, 255, 98), "lean": -6.8},
    "taishici": {"style": "ranged", "accent": (255, 138, 79, 104), "lean": -4.8},
    "diaochan": {"style": "dance", "accent": (255, 154, 203, 108), "lean": -5.2},
    "zhangjiao": {"style": "caster", "accent": (231, 196, 95, 104), "lean": -3.6},
    "yuanshao": {"style": "command", "accent": (213, 162, 255, 98), "lean": -3.2},
    "dongzhuo": {"style": "roar", "accent": (255, 78, 116, 124), "lean": -4.2},
    "huatuo": {"style": "caster", "accent": (159, 247, 198, 92), "lean": -2.4},
}

STYLE_MOTIONS = {
    "command": [
        ("idle", 0, -1.5, 1.0, 1.0, -3, 0, 0.3),
        ("idle", 1, -2.8, 1.02, 1.0, -5, -3, 0.7),
        ("attack", 0, -4.4, 1.03, 1.02, -7, -5, 1.0),
        ("attack", 1, 3.0, 1.06, 0.98, 7, -7, 1.0),
        ("idle", 2, 2.2, 1.04, 1.0, 5, -6, 0.8),
        ("attack", 2, -2.0, 1.06, 1.02, -4, -4, 1.0),
        ("attack", 3, 4.2, 1.03, 1.0, 8, -2, 0.7),
        ("idle", 3, 0.0, 1.02, 1.0, 0, 0, 0.25),
    ],
    "slash": [
        ("idle", 0, -2.0, 1.0, 1.0, -4, 0, 0.25),
        ("attack", 0, -7.2, 1.03, 1.02, -8, -2, 0.9),
        ("attack", 1, -10.0, 1.06, 1.01, -11, -5, 1.0),
        ("attack", 2, 8.4, 1.08, 0.99, 13, -8, 1.0),
        ("attack", 3, 11.0, 1.05, 1.0, 15, -5, 0.9),
        ("attack", 1, -5.4, 1.04, 1.02, -8, -3, 0.7),
        ("attack", 2, 5.8, 1.04, 1.0, 10, -2, 0.55),
        ("idle", 1, 0.0, 1.01, 1.0, 0, 0, 0.2),
    ],
    "cleave": [
        ("idle", 0, -1.2, 1.0, 1.0, -3, 1, 0.25),
        ("attack", 0, -7.8, 1.04, 1.02, -8, -1, 0.85),
        ("attack", 1, -11.0, 1.07, 1.02, -12, -4, 1.0),
        ("attack", 2, 9.0, 1.1, 0.98, 14, -7, 1.0),
        ("attack", 3, 12.0, 1.08, 0.96, 16, -4, 0.9),
        ("attack", 2, 5.0, 1.05, 0.99, 10, -2, 0.6),
        ("idle", 2, -2.4, 1.03, 1.02, -4, 0, 0.35),
        ("idle", 3, 0.0, 1.0, 1.0, 0, 0, 0.2),
    ],
    "dash": [
        ("run", 0, -5.0, 1.02, 1.02, -8, -1, 0.55),
        ("run", 1, -8.5, 1.05, 1.0, -13, -3, 0.95),
        ("attack", 0, -10.0, 1.08, 0.98, -16, -5, 1.0),
        ("attack", 1, -4.0, 1.1, 0.98, 16, -7, 1.0),
        ("run", 2, 5.0, 1.06, 1.0, 13, -5, 0.85),
        ("attack", 2, 8.5, 1.08, 0.99, 16, -4, 0.9),
        ("attack", 3, -2.0, 1.04, 1.01, -5, -2, 0.55),
        ("idle", 1, 0.0, 1.01, 1.0, 0, 0, 0.2),
    ],
    "caster": [
        ("idle", 0, -1.0, 1.0, 1.0, -2, 0, 0.2),
        ("idle", 1, -2.4, 1.02, 1.02, -4, -4, 0.55),
        ("idle", 2, -4.0, 1.04, 1.04, -6, -8, 0.8),
        ("attack", 0, -2.4, 1.05, 1.04, -5, -10, 1.0),
        ("attack", 1, 2.8, 1.06, 1.04, 6, -11, 1.0),
        ("attack", 2, 4.2, 1.04, 1.03, 7, -8, 0.78),
        ("idle", 3, 1.8, 1.02, 1.02, 4, -4, 0.5),
        ("idle", 0, 0.0, 1.0, 1.0, 0, 0, 0.18),
    ],
    "ranged": [
        ("idle", 0, -1.2, 1.0, 1.0, -2, 0, 0.2),
        ("attack", 0, -4.0, 1.02, 1.0, -7, -2, 0.6),
        ("attack", 1, -6.8, 1.04, 0.99, -10, -4, 0.95),
        ("attack", 2, 4.0, 1.06, 0.98, 10, -5, 1.0),
        ("attack", 3, 7.2, 1.04, 0.99, 14, -3, 0.9),
        ("attack", 1, -5.0, 1.03, 1.0, -9, -3, 0.7),
        ("attack", 2, 4.5, 1.03, 1.0, 9, -2, 0.55),
        ("idle", 1, 0.0, 1.0, 1.0, 0, 0, 0.18),
    ],
    "dance": [
        ("idle", 0, -2.0, 1.0, 1.0, -4, -1, 0.25),
        ("attack", 0, -6.0, 1.03, 1.02, -8, -5, 0.75),
        ("attack", 1, -11.0, 1.04, 1.02, -12, -8, 1.0),
        ("attack", 2, 9.5, 1.06, 1.01, 12, -9, 1.0),
        ("attack", 3, 13.5, 1.05, 1.0, 15, -6, 0.92),
        ("run", 2, 7.0, 1.04, 1.02, 10, -4, 0.7),
        ("attack", 1, -4.2, 1.03, 1.02, -6, -2, 0.5),
        ("idle", 2, 0.0, 1.0, 1.0, 0, 0, 0.2),
    ],
    "roar": [
        ("idle", 0, -1.0, 1.02, 0.98, -2, 2, 0.25),
        ("attack", 0, -4.8, 1.05, 0.98, -6, 1, 0.7),
        ("attack", 1, -7.0, 1.08, 0.96, -9, -2, 1.0),
        ("attack", 2, 6.4, 1.12, 0.95, 10, -5, 1.0),
        ("attack", 3, 8.8, 1.1, 0.96, 13, -3, 0.95),
        ("idle", 2, 3.0, 1.08, 0.97, 5, -1, 0.65),
        ("attack", 2, -3.6, 1.06, 0.98, -6, 0, 0.48),
        ("idle", 1, 0.0, 1.02, 1.0, 0, 0, 0.2),
    ],
    "guard": [
        ("idle", 0, -1.0, 1.01, 0.99, -2, 2, 0.2),
        ("idle", 1, -2.5, 1.04, 0.98, -4, 0, 0.55),
        ("attack", 0, -4.8, 1.07, 0.96, -7, -2, 0.85),
        ("attack", 1, -6.0, 1.1, 0.95, -8, -4, 1.0),
        ("attack", 2, 5.5, 1.12, 0.94, 8, -5, 1.0),
        ("attack", 3, 6.8, 1.1, 0.95, 9, -3, 0.8),
        ("idle", 2, 2.0, 1.05, 0.98, 3, 0, 0.45),
        ("idle", 3, 0.0, 1.02, 1.0, 0, 1, 0.18),
    ],
}


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return alpha.getbbox()


def load_frame(path: Path) -> Image.Image | None:
    if not path.exists():
        return None
    return Image.open(path).convert("RGBA")


def fallback_frame(frames: list[Image.Image], index: int) -> Image.Image:
    if not frames:
        raise ValueError("frame source list is empty")
    return frames[min(index, len(frames) - 1)]


def load_sources(hero_dir: Path) -> dict[str, list[Image.Image]]:
    idle = [load_frame(hero_dir / "battle-idle.png")]
    idle.extend(load_frame(hero_dir / "anim" / "idle" / f"{index:02d}.png") for index in range(1, 5))
    attack = [load_frame(hero_dir / "anim" / "attack" / f"{index:02d}.png") for index in range(1, 5)]
    run = [load_frame(hero_dir / "anim" / "run" / f"{index:02d}.png") for index in range(1, 5)]

    sources = {
        "idle": [frame for frame in idle if frame is not None],
        "attack": [frame for frame in attack if frame is not None],
        "run": [frame for frame in run if frame is not None],
    }
    if not sources["attack"]:
        sources["attack"] = sources["idle"]
    if not sources["run"]:
        sources["run"] = sources["idle"]
    return sources


def wave_image(image: Image.Image, amplitude: float, phase: float) -> Image.Image:
    if amplitude == 0:
        return image
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    for y in range(image.height):
        upper_weight = max(0, 1 - y / (image.height * 0.94))
        offset = round(__import__("math").sin(y / 18 + phase) * amplitude * upper_weight)
        result.alpha_composite(image.crop((0, y, image.width, y + 1)), (offset, y))
    return result


def fit_to_frame(image: Image.Image, label: str) -> Image.Image:
    bbox = alpha_bbox(image)
    if bbox is None:
        raise ValueError(f"{label}: no visible pixels")
    crop = image.crop(bbox)
    max_width = FRAME_WIDTH - PADDING * 2
    max_height = FRAME_HEIGHT - PADDING * 2
    scale = min(1, max_width / crop.width, max_height / crop.height)
    if scale < 1:
        crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    x = round((FRAME_WIDTH - crop.width) / 2)
    y = FRAME_HEIGHT - PADDING - crop.height
    canvas.alpha_composite(crop, (x, y))
    return canvas


def transform_frame(
    source: Image.Image,
    *,
    rotate: float,
    scale_x: float,
    scale_y: float,
    dx: int,
    dy: int,
    lean: float,
    accent: tuple[int, int, int, int],
    smear_strength: float,
    frame_index: int,
) -> Image.Image:
    bbox = alpha_bbox(source)
    if bbox is None:
        raise ValueError("source frame has no visible pixels")
    sprite = source.crop(bbox)
    sprite = wave_image(sprite, abs(lean) * 0.05 * smear_strength, frame_index * 0.85)
    sprite = sprite.resize((max(1, round(sprite.width * scale_x)), max(1, round(sprite.height * scale_y))), Image.Resampling.LANCZOS)
    sprite = sprite.rotate(rotate + lean * 0.22, resample=Image.Resampling.BICUBIC, expand=True)
    sprite = ImageEnhance.Brightness(sprite).enhance(1 + smear_strength * 0.04)

    canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    x = round((FRAME_WIDTH - sprite.width) / 2 + dx)
    y = round(FRAME_HEIGHT - PADDING - sprite.height + dy)

    if smear_strength > 0.35:
        alpha = sprite.getchannel("A").filter(ImageFilter.GaussianBlur(2.2))
        smear = Image.new("RGBA", sprite.size, accent)
        smear.putalpha(alpha.point(lambda value: round(value * smear_strength * 0.42)))
        canvas.alpha_composite(smear, (x - round(dx * 0.55), y + 2))

    canvas.alpha_composite(sprite, (x, y))
    return fit_to_frame(canvas, f"ultimate frame {frame_index + 1}")


def validate_frame(path: Path) -> None:
    with Image.open(path).convert("RGBA") as image:
        if image.size != (FRAME_WIDTH, FRAME_HEIGHT):
            raise ValueError(f"{path}: expected {(FRAME_WIDTH, FRAME_HEIGHT)}, found {image.size}")
        bbox = alpha_bbox(image)
        if bbox is None:
            raise ValueError(f"{path}: no visible alpha")
        left, top, right, bottom = bbox
        min_padding = min(left, top, FRAME_WIDTH - right, FRAME_HEIGHT - bottom)
        if min_padding < 8:
            raise ValueError(f"{path}: foreground padding is too tight ({min_padding}px)")


def generate_hero(hero_id: str, config: dict[str, object]) -> list[Path]:
    hero_dir = CHARACTER_ROOT / hero_id
    if not hero_dir.exists():
        raise ValueError(f"missing character directory: {hero_dir}")
    sources = load_sources(hero_dir)
    motions = STYLE_MOTIONS[str(config["style"])]
    accent = config["accent"]  # type: ignore[assignment]
    lean = float(config["lean"])
    output_dir = hero_dir / "anim" / "ultimate"
    output_dir.mkdir(parents=True, exist_ok=True)
    SOURCE_ROOT.mkdir(parents=True, exist_ok=True)

    output_paths: list[Path] = []
    for index, (source_group, source_index, rotate, scale_x, scale_y, dx, dy, smear_strength) in enumerate(motions):
        clean_group = "run" if source_group == "attack" and sources["run"] else source_group
        source = fallback_frame(sources[clean_group], source_index)
        frame = transform_frame(
            source,
            rotate=rotate,
            scale_x=scale_x,
            scale_y=scale_y,
            dx=dx,
            dy=dy,
            lean=lean,
            accent=accent,  # type: ignore[arg-type]
            smear_strength=smear_strength,
            frame_index=index,
        )
        output_path = output_dir / f"{index + 1:02d}.png"
        frame.save(output_path)
        frame.save(SOURCE_ROOT / f"{hero_id}-ultimate-{index + 1:02d}.png")
        validate_frame(output_path)
        output_paths.append(output_path)
    return output_paths


def write_contact_sheet(generated: dict[str, list[Path]]) -> None:
    label_width = 144
    width = label_width + FRAME_WIDTH * FRAME_COUNT
    height = FRAME_HEIGHT * len(generated)
    sheet = Image.new("RGBA", (width, height), (20, 14, 18, 255))
    draw = ImageDraw.Draw(sheet)
    for row, (hero_id, paths) in enumerate(generated.items()):
        y = row * FRAME_HEIGHT
        draw.rectangle((0, y, label_width, y + FRAME_HEIGHT), fill=(30, 20, 28, 255))
        draw.text((12, y + 18), hero_id, fill=(255, 211, 106, 255))
        for index, path in enumerate(paths):
            tile = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (36, 24, 32, 255))
            for grid_y in range(0, FRAME_HEIGHT, 16):
                for grid_x in range(0, FRAME_WIDTH, 16):
                    if (grid_x // 16 + grid_y // 16) % 2 == 0:
                        tile.alpha_composite(Image.new("RGBA", (16, 16), (46, 30, 42, 255)), (grid_x, grid_y))
            tile.alpha_composite(Image.open(path).convert("RGBA"))
            sheet.alpha_composite(tile, (label_width + index * FRAME_WIDTH, y))
    CONTACT_SHEET_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET_PATH)


def main() -> None:
    generated: dict[str, list[Path]] = {}
    for hero_id, config in HERO_CONFIGS.items():
        generated[hero_id] = generate_hero(hero_id, config)
        print(f"generated ultimate frames for {hero_id}")
    write_contact_sheet(generated)
    print(f"contact sheet: {CONTACT_SHEET_PATH}")


if __name__ == "__main__":
    main()
