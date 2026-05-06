#!/usr/bin/env python3
"""Generate first-pass character animation frames from approved battle sprites."""

from __future__ import annotations

import math
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
CHARACTER_ROOT = ROOT / "public" / "assets" / "characters"
SOURCE_ROOT = ROOT / "scripts" / "source" / "character-anims"
FRAME_WIDTH = 192
FRAME_HEIGHT = 224
SOURCE_WIDTH = 288
SOURCE_HEIGHT = 320

HEROES = {
    "guanyu": {
        "accent": (117, 240, 170, 165),
        "runLean": -4.0,
        "attackLean": -7.0,
    },
    "diaochan": {
        "accent": (255, 154, 203, 150),
        "runLean": -2.2,
        "attackLean": -5.2,
    },
    "sunshangxiang": {
        "accent": (255, 204, 90, 155),
        "runLean": -3.0,
        "attackLean": -4.2,
    },
    "zhaoyun": {
        "accent": (116, 206, 255, 160),
        "runLean": -3.8,
        "attackLean": -7.8,
        "safeMargin": 4,
    },
    "caocao": {
        "accent": (190, 92, 255, 155),
        "runLean": -2.8,
        "attackLean": -5.8,
        "safeMargin": 4,
    },
    "xiahoudun": {
        "accent": (92, 176, 255, 160),
        "runLean": -2.4,
        "attackLean": -4.8,
        "safeMargin": 4,
    },
    "zhouyu": {
        "accent": (255, 96, 72, 160),
        "runLean": -2.0,
        "attackLean": -4.2,
        "safeMargin": 4,
    },
    "lubu": {
        "accent": (255, 72, 54, 170),
        "runLean": -3.6,
        "attackLean": -8.4,
        "safeMargin": 6,
    },
}


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return (0, 0, image.width, image.height)
    return bbox


def clear_edge_alpha(image: Image.Image, border: int = 8) -> Image.Image:
    cleaned = image.copy()
    alpha = cleaned.getchannel("A")
    for x in range(image.width):
        for y in range(border):
            alpha.putpixel((x, y), 0)
            alpha.putpixel((x, image.height - 1 - y), 0)
    for y in range(image.height):
        for x in range(border):
            alpha.putpixel((x, y), 0)
            alpha.putpixel((image.width - 1 - x, y), 0)
    cleaned.putalpha(alpha)
    return cleaned


def remove_small_alpha_components(image: Image.Image, min_area: int = 220) -> Image.Image:
    cleaned = image.copy()
    alpha = cleaned.getchannel("A")
    width, height = image.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    remove_pixels: list[tuple[int, int]] = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] <= 8:
                continue
            stack = [(x, y)]
            component: list[tuple[int, int]] = []
            visited[index] = 1
            while stack:
                px, py = stack.pop()
                component.append((px, py))
                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nindex = ny * width + nx
                    if visited[nindex] or pixels[nx, ny] <= 8:
                        continue
                    visited[nindex] = 1
                    stack.append((nx, ny))
            if len(component) < min_area:
                remove_pixels.extend(component)
    for x, y in remove_pixels:
        pixels[x, y] = 0
    cleaned.putalpha(alpha)
    return cleaned


def paste_center_bottom(canvas: Image.Image, sprite: Image.Image, dx: float = 0, dy: float = 0) -> None:
    x = round((canvas.width - sprite.width) / 2 + dx)
    y = round(canvas.height - sprite.height + dy)
    canvas.alpha_composite(sprite, (x, y))


def wave_image(image: Image.Image, amplitude: float, phase: float) -> Image.Image:
    if amplitude == 0:
        return image
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    for y in range(image.height):
        upper_weight = max(0, 1 - y / (image.height * 0.92))
        offset = round(math.sin(y / 18 + phase) * amplitude * upper_weight)
        row = image.crop((0, y, image.width, y + 1))
        result.alpha_composite(row, (offset, y))
    return result


def variant(
    image: Image.Image,
    *,
    dx: float = 0,
    dy: float = 0,
    scale_x: float = 1,
    scale_y: float = 1,
    rotate: float = 0,
    wave: float = 0,
    phase: float = 0,
    brightness: float = 1,
) -> Image.Image:
    bbox = alpha_bbox(image)
    crop = image.crop(bbox)
    sprite = crop
    if rotate:
        sprite = sprite.rotate(rotate, resample=Image.Resampling.BICUBIC, expand=True)
    if brightness != 1:
        sprite = ImageEnhance.Brightness(sprite).enhance(brightness)
    canvas = Image.new("RGBA", (SOURCE_WIDTH, SOURCE_HEIGHT), (0, 0, 0, 0))
    paste_center_bottom(canvas, sprite, dx, dy)
    return wave_image(canvas, wave, phase)

def offset_no_wrap(image: Image.Image, dx: int, dy: int) -> Image.Image:
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    src_left = max(0, -dx)
    src_top = max(0, -dy)
    src_right = min(image.width, image.width - dx) if dx >= 0 else image.width
    src_bottom = min(image.height, image.height - dy) if dy >= 0 else image.height
    if src_right <= src_left or src_bottom <= src_top:
        return result
    dest_x = max(0, dx)
    dest_y = max(0, dy)
    result.alpha_composite(image.crop((src_left, src_top, src_right, src_bottom)), (dest_x, dest_y))
    return result


def add_smear(image: Image.Image, color: tuple[int, int, int, int], offset_x: int, offset_y: int, blur: float = 2.0) -> Image.Image:
    alpha = image.getchannel("A").filter(ImageFilter.GaussianBlur(blur))
    smear = Image.new("RGBA", image.size, color)
    smear.putalpha(alpha.point(lambda value: round(value * color[3] / 255)))
    shifted = offset_no_wrap(smear, offset_x, offset_y)
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(shifted)
    result.alpha_composite(image)
    return result


def make_action_reference(frames: list[Image.Image], gutter: int = 28) -> Image.Image:
    strip = Image.new("RGBA", (SOURCE_WIDTH * len(frames) + gutter * (len(frames) - 1), SOURCE_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * (SOURCE_WIDTH + gutter), 0))
    return strip


def make_edit_canvas(seed: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (SOURCE_WIDTH, SOURCE_HEIGHT), (0, 0, 0, 0))
    paste_center_bottom(canvas, seed)
    return canvas


def make_preview(frames: list[Path], out_path: Path) -> None:
    cell_w = FRAME_WIDTH
    cell_h = FRAME_HEIGHT
    preview = Image.new("RGBA", (cell_w * len(frames), cell_h), (22, 14, 18, 255))
    for index, frame_path in enumerate(frames):
        tile = Image.open(frame_path).convert("RGBA")
        bg = Image.new("RGBA", (cell_w, cell_h), (38, 24, 34, 255))
        for y in range(0, cell_h, 16):
            for x in range(0, cell_w, 16):
                if (x // 16 + y // 16) % 2 == 0:
                    block = Image.new("RGBA", (16, 16), (48, 30, 42, 255))
                    bg.alpha_composite(block, (x, y))
        bg.alpha_composite(tile)
        preview.alpha_composite(bg, (index * cell_w, 0))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    preview.save(out_path)


def game_frame_from_source(frame: Image.Image) -> Image.Image:
    left = (frame.width - FRAME_WIDTH) // 2
    top = frame.height - FRAME_HEIGHT
    return frame.crop((left, top, left + FRAME_WIDTH, top + FRAME_HEIGHT))


def fit_source_frame_to_game_bounds(frame: Image.Image, margin: int) -> Image.Image:
    if margin <= 0:
        return frame
    box = frame.getchannel("A").getbbox()
    if box is None:
        return frame
    game_left = (frame.width - FRAME_WIDTH) // 2
    game_top = frame.height - FRAME_HEIGHT
    max_width = FRAME_WIDTH - margin * 2
    max_height = FRAME_HEIGHT - margin * 2
    sprite = frame.crop(box)
    scale = min(1.0, max_width / sprite.width, max_height / sprite.height)
    if scale < 1.0:
        sprite = sprite.resize(
            (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
            Image.Resampling.LANCZOS,
        )
    source_center = game_left + FRAME_WIDTH / 2
    center_delta = ((box[0] + box[2]) / 2) - source_center
    x = round(game_left + (FRAME_WIDTH - sprite.width) / 2 + center_delta * scale)
    x = max(game_left + margin, min(game_left + FRAME_WIDTH - margin - sprite.width, x))
    y = game_top + max(margin, FRAME_HEIGHT - margin - sprite.height)
    canvas = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    canvas.alpha_composite(sprite, (x, y))
    return canvas


def fit_frames_to_safe_bounds(frames: list[Image.Image], margin: int) -> list[Image.Image]:
    if margin <= 0:
        return frames
    boxes = [frame.getchannel("A").getbbox() for frame in frames]
    visible_boxes = [box for box in boxes if box is not None]
    if not visible_boxes:
        return frames
    max_width = max(box[2] - box[0] for box in visible_boxes)
    max_height = max(box[3] - box[1] for box in visible_boxes)
    scale = min(1.0, (FRAME_WIDTH - margin * 2) / max_width, (FRAME_HEIGHT - margin * 2) / max_height)
    fits = all(
        box[0] >= margin
        and box[1] >= margin
        and box[2] <= FRAME_WIDTH - margin
        and box[3] <= FRAME_HEIGHT - margin
        for box in visible_boxes
    )
    if scale >= 1.0 and fits:
        return frames
    fitted: list[Image.Image] = []
    for frame, box in zip(frames, boxes):
        canvas = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        if box is None:
            fitted.append(canvas)
            continue
        sprite = frame.crop(box)
        if scale < 1.0:
            sprite = sprite.resize(
                (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
                Image.Resampling.LANCZOS,
            )
        center_delta = ((box[0] + box[2]) / 2) - (FRAME_WIDTH / 2)
        x = round((FRAME_WIDTH - sprite.width) / 2 + center_delta * scale)
        x = max(margin, min(FRAME_WIDTH - margin - sprite.width, x))
        y = max(margin, FRAME_HEIGHT - margin - sprite.height)
        canvas.alpha_composite(sprite, (x, y))
        fitted.append(canvas)
    return fitted


def idle_frames(seed: Image.Image, accent: tuple[int, int, int, int]) -> list[Image.Image]:
    poses = [
        seed,
        variant(seed, dy=-1, wave=0.65, phase=0.4),
        variant(seed, dy=-2, wave=1.05, phase=1.0, brightness=1.02),
        variant(seed, dy=-1, wave=0.75, phase=1.8),
        variant(seed, dy=0, scale_y=1, wave=0.35, phase=2.4),
        variant(seed, dy=1, wave=0.45, phase=3.0),
    ]
    return [add_smear(frame, accent, -1 if index % 2 else 1, 0, 1.2) if index in (2, 4) else frame for index, frame in enumerate(poses)]


def run_frames(seed: Image.Image, accent: tuple[int, int, int, int], lean: float) -> list[Image.Image]:
    phases = [
        (-3, 0, 1, 1, lean * 0.45, 0.7),
        (-6, -5, 1, 1, lean, 1.4),
        (-3, -2, 1.0, 1.0, lean * 0.35, 0.8),
        (3, 0, 1, 1, -lean * 0.25, 0.7),
        (6, -5, 1, 1, -lean * 0.7, 1.4),
        (3, -2, 1.0, 1.0, -lean * 0.15, 0.8),
    ]
    frames = [
        variant(seed, dx=dx, dy=dy, scale_x=sx, scale_y=sy, rotate=rot, wave=wave, phase=index * 0.8)
        for index, (dx, dy, sx, sy, rot, wave) in enumerate(phases)
    ]
    return [add_smear(frame, accent, -4 if index < 3 else 4, 1, 1.8) if index in (1, 4) else frame for index, frame in enumerate(frames)]


def attack_frames(hero_id: str, hero_dir: Path, idle: Image.Image, accent: tuple[int, int, int, int], lean: float) -> list[Image.Image]:
    seed = remove_small_alpha_components(clear_edge_alpha(Image.open(hero_dir / "attack-0.png").convert("RGBA")))
    windup = variant(seed, dx=-3, dy=-2, rotate=lean * 0.55, wave=0.7, phase=0.4)
    strike_base = variant(seed, dx=5, dy=-3, rotate=-lean * 0.95, wave=1.1, phase=1.7, brightness=1.04)
    strike_follow = variant(seed, dx=9, dy=-2, rotate=-lean * 1.15, wave=1.0, phase=2.2, brightness=1.06)
    return [
        seed,
        windup,
        variant(seed, dx=-6, dy=-3, rotate=lean, wave=0.9, phase=1.1),
        strike_base,
        strike_follow,
        variant(seed, dx=3, dy=-1, rotate=-lean * 0.35, wave=0.65, phase=2.9),
        variant(seed, dx=1, dy=0, rotate=lean * 0.2, wave=0.45, phase=3.4),
        variant(idle, dx=0, dy=0, wave=0.25, phase=4.0),
    ]


def write_animation(hero_id: str, animation: str, frames: list[Image.Image], anchor_path: Path, lock_frame1: bool = True, safe_margin: int = 0) -> list[Path]:
    hero_source_dir = SOURCE_ROOT / hero_id
    source_dir = hero_source_dir / animation
    final_dir = CHARACTER_ROOT / hero_id / "anim" / animation
    for stale in (hero_source_dir / f"{animation}-raw-strip.png", hero_source_dir / f"{animation}-edit-canvas.png", hero_source_dir / f"{animation}-preview.png"):
        stale.unlink(missing_ok=True)
    if source_dir.exists():
        shutil.rmtree(source_dir)
    source_dir.mkdir(parents=True, exist_ok=True)
    raw_dir = source_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_paths: list[Path] = []
    for index, frame in enumerate(frames, start=1):
        raw_path = raw_dir / f"{index:02d}.png"
        frame.save(raw_path)
        raw_paths.append(raw_path)
    make_action_reference(frames).save(source_dir / "reference-action.png")
    make_edit_canvas(frames[0]).save(source_dir / "edit-canvas.png")
    final_dir.mkdir(parents=True, exist_ok=True)
    for stale_frame in final_dir.glob("*.png"):
        stale_frame.unlink()
    final_frames: list[Image.Image] = []
    for index, raw_path in enumerate(raw_paths, start=1):
        source_frame = Image.open(raw_path).convert("RGBA")
        source_frame = fit_source_frame_to_game_bounds(source_frame, safe_margin)
        frame = game_frame_from_source(source_frame)
        if index == 1 and lock_frame1:
            frame = Image.open(anchor_path).convert("RGBA")
        final_frames.append(frame)
    final_frames = fit_frames_to_safe_bounds(final_frames, safe_margin)
    output_frames: list[Path] = []
    for index, frame in enumerate(final_frames, start=1):
        out_path = final_dir / f"{index:02d}.png"
        frame.save(out_path)
        output_frames.append(out_path)
    make_preview(output_frames, source_dir / "preview.png")
    return output_frames


def write_legacy_attack_frames(hero_dir: Path, attack_paths: list[Path]) -> None:
    legacy_indices = [0, 2, 3, 5]
    frames: list[Image.Image] = []
    for output_index, frame_index in enumerate(legacy_indices):
        frame = Image.open(attack_paths[frame_index]).convert("RGBA")
        frame.save(hero_dir / f"attack-{output_index}.png")
        frames.append(frame)
    strip = Image.new("RGBA", (FRAME_WIDTH * len(frames), FRAME_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_WIDTH, 0))
    strip.save(hero_dir / "attack-strip.png")


def main() -> None:
    requested_heroes = sys.argv[1:] or list(HEROES)
    unknown_heroes = [hero_id for hero_id in requested_heroes if hero_id not in HEROES]
    if unknown_heroes:
        raise SystemExit(f"Unknown hero id(s): {', '.join(unknown_heroes)}")
    for hero_id in requested_heroes:
        config = HEROES[hero_id]
        hero_dir = CHARACTER_ROOT / hero_id
        idle_seed_path = hero_dir / "battle-idle.png"
        attack_seed_path = hero_dir / "attack-0.png"
        idle_seed = Image.open(idle_seed_path).convert("RGBA")
        safe_margin = config.get("safeMargin", 0)
        attack_safe_margin = config.get("attackSafeMargin", max(safe_margin, 12))
        write_animation(hero_id, "idle", idle_frames(idle_seed, config["accent"]), idle_seed_path, safe_margin=safe_margin)
        write_animation(hero_id, "run", run_frames(idle_seed, config["accent"], config["runLean"]), idle_seed_path, safe_margin=safe_margin)
        attack_paths = write_animation(
            hero_id,
            "attack",
            attack_frames(hero_id, hero_dir, idle_seed, config["accent"], config["attackLean"]),
            attack_seed_path,
            False,
            attack_safe_margin,
        )
        write_legacy_attack_frames(hero_dir, attack_paths)


if __name__ == "__main__":
    main()
