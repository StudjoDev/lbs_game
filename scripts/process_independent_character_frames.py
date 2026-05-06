#!/usr/bin/env python3
"""Convert independently generated character frame sources into game assets."""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
from statistics import median
from typing import Iterable

try:
    from PIL import Image, ImageFilter
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Pillow is required. Install it with: python -m pip install pillow") from exc


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_ROOT = ROOT / "output" / "ai-character-sources"
DEFAULT_OUTPUT_ROOT = ROOT / "public" / "assets" / "characters"

FRAME_WIDTH = 192
FRAME_HEIGHT = 224
CARD_SIZE = 1024
GRID_COLS = 4
GRID_ROWS = 3
PADDING = 12
ALPHA_THRESHOLD = 8
BASE_STATES = ("idle", "run", "attack")
OPTIONAL_STATES = ("ultimate",)
STATES = (*BASE_STATES, *OPTIONAL_STATES)
FRAME_COUNTS = {
    "idle": 4,
    "run": 4,
    "attack": 4,
    "ultimate": 8,
}
ULTIMATE_CONTACT_SHEET_PATH = ROOT / "output" / "web-game" / "ultimate-animation-contact-sheet.png"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Process per-character cards and independent animation frames into game-ready assets."
    )
    parser.add_argument("heroes", nargs="+", help="Hero id(s), for example: guanyu zhaoyun diaochan")
    parser.add_argument(
        "--input-root",
        type=Path,
        default=DEFAULT_INPUT_ROOT,
        help=f"Source image root. Default: {DEFAULT_INPUT_ROOT}",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=DEFAULT_OUTPUT_ROOT,
        help=f"Character asset output root. Default: {DEFAULT_OUTPUT_ROOT}",
    )
    return parser.parse_args()


def border_samples(image: Image.Image) -> list[tuple[int, int, int]]:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    samples: list[tuple[int, int, int]] = []

    for x in range(width):
        for y in (0, height - 1):
            r, g, b, a = pixels[x, y]
            if a >= 128:
                samples.append((r, g, b))
    for y in range(1, max(1, height - 1)):
        for x in (0, width - 1):
            r, g, b, a = pixels[x, y]
            if a >= 128:
                samples.append((r, g, b))

    return samples


def estimate_background(samples: Iterable[tuple[int, int, int]]) -> tuple[int, int, int]:
    values = list(samples)
    if not values:
        raise ValueError("cannot estimate chroma key background because the border has no opaque pixels")

    quantized = Counter((r // 8, g // 8, b // 8) for r, g, b in values)
    bucket, _ = quantized.most_common(1)[0]
    bucket_values = [
        (r, g, b)
        for r, g, b in values
        if (r // 8, g // 8, b // 8) == bucket
    ]
    if not bucket_values:
        bucket_values = values

    return tuple(round(median(channel)) for channel in zip(*bucket_values))  # type: ignore[return-value]


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return sum((left - right) ** 2 for left, right in zip(a, b)) ** 0.5


def despill_pixel(
    rgb: tuple[int, int, int],
    key: tuple[int, int, int],
    strength: float,
) -> tuple[int, int, int]:
    channels = list(rgb)
    max_key = max(key)
    dominant = [index for index, value in enumerate(key) if max_key - value <= 16 and max_key >= 180]
    if not dominant:
        return rgb

    other_values = [channels[index] for index in range(3) if index not in dominant]
    cap = max(other_values) if other_values else min(channels[index] for index in dominant)
    for index in dominant:
        if channels[index] > cap:
            channels[index] = round(channels[index] - (channels[index] - cap) * strength)
    return channels[0], channels[1], channels[2]


def remove_chroma_key(image: Image.Image) -> Image.Image:
    source = image.convert("RGBA")
    samples = border_samples(source)
    if not samples:
        return source

    key = estimate_background(samples)
    result = Image.new("RGBA", source.size, (0, 0, 0, 0))
    src = source.load()
    dst = result.load()
    width, height = source.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = src[x, y]
            if a == 0:
                continue

            distance = color_distance((r, g, b), key)
            if distance <= 38:
                alpha = 0
            elif distance <= 105:
                alpha = round(a * ((distance - 38) / 67))
            else:
                alpha = a

            if alpha == 0:
                dst[x, y] = (r, g, b, 0)
                continue

            spill_strength = 0.65 if distance <= 150 else 0.28
            clean_r, clean_g, clean_b = despill_pixel((r, g, b), key, spill_strength)
            dst[x, y] = (clean_r, clean_g, clean_b, alpha)

    alpha_channel = result.getchannel("A").filter(ImageFilter.MedianFilter(3))
    result.putalpha(alpha_channel)
    return result


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return alpha.getbbox()


def normalize_frame(source: Image.Image, label: str) -> Image.Image:
    keyed = remove_chroma_key(source)
    bbox = alpha_bbox(keyed)
    if bbox is None:
        raise ValueError(f"{label}: no foreground pixels found after chroma-key removal")

    crop = keyed.crop(bbox)
    max_width = FRAME_WIDTH - PADDING * 2
    max_height = FRAME_HEIGHT - PADDING * 2
    scale = min(max_width / crop.width, max_height / crop.height)
    if scale <= 0:
        raise ValueError(f"{label}: invalid source frame size {crop.size}")

    resized = crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    x = round((FRAME_WIDTH - resized.width) / 2)
    y = FRAME_HEIGHT - PADDING - resized.height
    x = max(0, min(FRAME_WIDTH - resized.width, x))
    y = max(0, min(FRAME_HEIGHT - resized.height, y))
    canvas.alpha_composite(resized, (x, y))
    return canvas


def split_animation_sheet(path: Path) -> dict[str, list[Image.Image]]:
    sheet = Image.open(path).convert("RGBA")
    cell_width = sheet.width / GRID_COLS
    cell_height = sheet.height / GRID_ROWS
    frames: dict[str, list[Image.Image]] = {state: [] for state in BASE_STATES}

    for row, state in enumerate(BASE_STATES):
        for col in range(GRID_COLS):
            box = (
                round(col * cell_width),
                round(row * cell_height),
                round((col + 1) * cell_width),
                round((row + 1) * cell_height),
            )
            frames[state].append(sheet.crop(box))

    return frames


def load_individual_frames(input_root: Path, hero_id: str) -> dict[str, list[Image.Image]]:
    frames: dict[str, list[Image.Image]] = {}
    missing: list[Path] = []
    for state in STATES:
        count = FRAME_COUNTS[state]
        state_paths = [input_root / f"{hero_id}-{state}-{index:02d}.png" for index in range(1, count + 1)]
        if state in OPTIONAL_STATES and not any(path.exists() for path in state_paths):
            continue
        state_frames: list[Image.Image] = []
        for path in state_paths:
            if not path.exists():
                missing.append(path)
                continue
            state_frames.append(Image.open(path).convert("RGBA"))
        frames[state] = state_frames

    if missing:
        formatted = "\n  ".join(str(path) for path in missing)
        raise FileNotFoundError(f"{hero_id}: missing required frame source(s):\n  {formatted}")

    return frames


def load_animation_sources(input_root: Path, hero_id: str) -> dict[str, list[Image.Image]]:
    individual_paths = [
        input_root / f"{hero_id}-{state}-{index:02d}.png"
        for state in BASE_STATES
        for index in range(1, FRAME_COUNTS[state] + 1)
    ]
    if all(path.exists() for path in individual_paths):
        return load_individual_frames(input_root, hero_id)

    sheet_path = input_root / f"{hero_id}-animation-sheet.png"
    if sheet_path.exists():
        return split_animation_sheet(sheet_path)
    return load_individual_frames(input_root, hero_id)


def save_card_if_present(input_root: Path, output_dir: Path, hero_id: str) -> None:
    card_path = input_root / f"{hero_id}-card.png"
    if not card_path.exists():
        return

    output_dir.mkdir(parents=True, exist_ok=True)
    card = Image.open(card_path).convert("RGBA").resize((CARD_SIZE, CARD_SIZE), Image.Resampling.LANCZOS)
    card.save(output_dir / "card.png")


def make_strip(frames: list[Image.Image]) -> Image.Image:
    strip = Image.new("RGBA", (FRAME_WIDTH * len(frames), FRAME_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_WIDTH, 0))
    return strip


def write_animation_assets(output_dir: Path, frames: dict[str, list[Image.Image]], hero_id: str) -> None:
    normalized: dict[str, list[Image.Image]] = {}

    for state in STATES:
        source_frames = frames.get(state, [])
        if state in OPTIONAL_STATES and not source_frames:
            continue
        frame_count = FRAME_COUNTS[state]
        if len(source_frames) < frame_count:
            raise ValueError(f"{hero_id}: expected at least {frame_count} {state} frames, found {len(source_frames)}")

        state_dir = output_dir / "anim" / state
        state_dir.mkdir(parents=True, exist_ok=True)
        normalized[state] = []
        for index, source in enumerate(source_frames[:frame_count], start=1):
            frame = normalize_frame(source, f"{hero_id} {state} {index:02d}")
            frame.save(state_dir / f"{index:02d}.png")
            normalized[state].append(frame)

    normalized["idle"][0].save(output_dir / "battle-idle.png")
    for index, frame in enumerate(normalized["attack"]):
        frame.save(output_dir / f"attack-{index}.png")
    make_strip(normalized["attack"]).save(output_dir / "attack-strip.png")


def validate_character_output(output_dir: Path, hero_id: str) -> None:
    card_path = output_dir / "card.png"
    if card_path.exists():
        with Image.open(card_path) as card:
            if card.width != card.height or card.width < CARD_SIZE:
                raise ValueError(
                    f"{hero_id}: card.png has size {card.size}, expected a square image at least {CARD_SIZE}px"
                )

    for state in STATES:
        state_dir = output_dir / "anim" / state
        if state in OPTIONAL_STATES and not state_dir.exists():
            continue
        paths = sorted(state_dir.glob("*.png"))
        frame_count = FRAME_COUNTS[state]
        if len(paths) < frame_count:
            raise ValueError(f"{hero_id}: validation failed for {state}; expected at least {frame_count} frames, found {len(paths)}")
        for path in paths[:frame_count]:
            with Image.open(path) as image:
                if image.size != (FRAME_WIDTH, FRAME_HEIGHT):
                    raise ValueError(f"{hero_id}: {path} has size {image.size}, expected {(FRAME_WIDTH, FRAME_HEIGHT)}")

    required = [
        output_dir / "battle-idle.png",
        output_dir / "attack-0.png",
        output_dir / "attack-1.png",
        output_dir / "attack-2.png",
        output_dir / "attack-3.png",
        output_dir / "attack-strip.png",
    ]
    for path in required:
        if not path.exists():
            raise ValueError(f"{hero_id}: validation failed; missing {path}")
        if path.name != "attack-strip.png":
            with Image.open(path) as image:
                if image.size != (FRAME_WIDTH, FRAME_HEIGHT):
                    raise ValueError(f"{hero_id}: {path} has size {image.size}, expected {(FRAME_WIDTH, FRAME_HEIGHT)}")

    with Image.open(output_dir / "attack-strip.png") as strip:
        expected = (FRAME_WIDTH * FRAME_COUNTS["attack"], FRAME_HEIGHT)
        if strip.size != expected:
            raise ValueError(f"{hero_id}: attack-strip.png has size {strip.size}, expected {expected}")


def write_ultimate_contact_sheet(output_root: Path, hero_ids: list[str]) -> None:
    rows: list[tuple[str, list[Path]]] = []
    for hero_id in hero_ids:
        state_dir = output_root / hero_id / "anim" / "ultimate"
        paths = [state_dir / f"{index:02d}.png" for index in range(1, FRAME_COUNTS["ultimate"] + 1)]
        if all(path.exists() for path in paths):
            rows.append((hero_id, paths))

    if not rows:
        return

    label_width = 132
    sheet = Image.new("RGBA", (label_width + FRAME_WIDTH * FRAME_COUNTS["ultimate"], FRAME_HEIGHT * len(rows)), (20, 14, 18, 255))
    for row_index, (hero_id, paths) in enumerate(rows):
        y = row_index * FRAME_HEIGHT
        label = Image.new("RGBA", (label_width, FRAME_HEIGHT), (30, 20, 28, 255))
        sheet.alpha_composite(label, (0, y))
        for index, path in enumerate(paths):
            tile = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (36, 24, 32, 255))
            for grid_y in range(0, FRAME_HEIGHT, 16):
                for grid_x in range(0, FRAME_WIDTH, 16):
                    if (grid_x // 16 + grid_y // 16) % 2 == 0:
                        tile.alpha_composite(Image.new("RGBA", (16, 16), (46, 30, 42, 255)), (grid_x, grid_y))
            tile.alpha_composite(Image.open(path).convert("RGBA"))
            sheet.alpha_composite(tile, (label_width + index * FRAME_WIDTH, y))
        # Tiny bitmap-free label marker: the hero id is encoded as folder order in the file name list.
        marker_alpha = 70 + (row_index % 5) * 28
        sheet.alpha_composite(Image.new("RGBA", (label_width - 20, 8), (255, 211, 106, marker_alpha)), (10, y + 16))

    ULTIMATE_CONTACT_SHEET_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(ULTIMATE_CONTACT_SHEET_PATH)


def process_hero(input_root: Path, output_root: Path, hero_id: str) -> None:
    output_dir = output_root / hero_id
    output_dir.mkdir(parents=True, exist_ok=True)
    save_card_if_present(input_root, output_dir, hero_id)
    frames = load_animation_sources(input_root, hero_id)
    write_animation_assets(output_dir, frames, hero_id)
    validate_character_output(output_dir, hero_id)


def main() -> None:
    args = parse_args()
    input_root = args.input_root.resolve()
    output_root = args.output_root.resolve()

    if not input_root.exists():
        raise SystemExit(f"Input root does not exist: {input_root}")

    for hero_id in args.heroes:
        try:
            process_hero(input_root, output_root, hero_id)
        except (FileNotFoundError, OSError, ValueError) as exc:
            raise SystemExit(str(exc)) from exc
        print(f"Processed {hero_id} -> {output_root / hero_id}")
    write_ultimate_contact_sheet(output_root, args.heroes)


if __name__ == "__main__":
    main()
