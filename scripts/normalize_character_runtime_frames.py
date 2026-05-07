#!/usr/bin/env python3
"""Normalize active character runtime frames and split visible VFX to overlays.

The game runtime expects character animation PNGs to carry only the body,
equipment, cloth, and weapon pose. Glow, trails, aura, cast shadow, and similar
action VFX should live in matching `effect/NN.png` overlay frames.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
CHARACTER_ROOT = ROOT / "public" / "assets" / "characters"
FRAME_WIDTH = 192
FRAME_HEIGHT = 224
TARGET_CENTER = (FRAME_WIDTH / 2, FRAME_HEIGHT / 2)
MAX_OCCUPANCY = 0.67
NORMALIZE_TARGET_OCCUPANCY = 0.64
MIN_PADDING = 8
PROTECTED_ALPHA = 172
AUDIT_ALPHA_THRESHOLD = 8
STRUCTURED_OVERLAY_HEROES = {"yueying"}
PRESERVE_OVERLAY_MARKER = ".preserve-effect-overlays"


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def audit_alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value > AUDIT_ALPHA_THRESHOLD else 0)
    return alpha.getbbox()


def scaled_size(size: tuple[int, int], scale: float) -> tuple[int, int]:
    return (max(1, round(size[0] * scale)), max(1, round(size[1] * scale)))


def paste_clipped(canvas: Image.Image, image: Image.Image, x: int, y: int) -> None:
    src_left = max(0, -x)
    src_top = max(0, -y)
    src_right = min(image.width, canvas.width - x)
    src_bottom = min(image.height, canvas.height - y)
    if src_right <= src_left or src_bottom <= src_top:
        return
    canvas.alpha_composite(image.crop((src_left, src_top, src_right, src_bottom)), (max(0, x), max(0, y)))


def shift_image(image: Image.Image, dx: int, dy: int) -> Image.Image:
    if dx == 0 and dy == 0:
        return image
    canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    paste_clipped(canvas, image, dx, dy)
    return canvas


def audit_center_adjustment(image: Image.Image) -> tuple[int, int]:
    bbox = audit_alpha_bbox(image)
    if bbox is None:
        return (0, 0)
    center_x = (bbox[0] + bbox[2]) / 2
    center_y = (bbox[1] + bbox[3]) / 2
    return (round(TARGET_CENTER[0] - center_x), round(TARGET_CENTER[1] - center_y))


def recenter_for_audit(image: Image.Image) -> Image.Image:
    dx, dy = audit_center_adjustment(image)
    return shift_image(image, dx, dy)


def transform_with_base_bbox(image: Image.Image, base_bbox: tuple[int, int, int, int], scale: float) -> Image.Image:
    scaled = image.resize(scaled_size(image.size, scale), Image.Resampling.LANCZOS) if scale != 1 else image
    center_x = ((base_bbox[0] + base_bbox[2]) / 2) * scale
    center_y = ((base_bbox[1] + base_bbox[3]) / 2) * scale
    x = round(TARGET_CENTER[0] - center_x)
    y = round(TARGET_CENTER[1] - center_y)
    canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    paste_clipped(canvas, scaled, x, y)
    return canvas


def normalize_image(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    bbox = alpha_bbox(image)
    if bbox is None:
        return Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    max_width = min(FRAME_WIDTH - MIN_PADDING * 2, FRAME_WIDTH * NORMALIZE_TARGET_OCCUPANCY)
    max_height = min(FRAME_HEIGHT - MIN_PADDING * 2, FRAME_HEIGHT * NORMALIZE_TARGET_OCCUPANCY)
    scale = min(1.0, max_width / width, max_height / height)
    return recenter_for_audit(transform_with_base_bbox(image, bbox, scale))


def large_alpha_component_mask(alpha: Image.Image, threshold: int, min_area: int) -> Image.Image:
    width, height = alpha.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    mask = Image.new("L", alpha.size, 0)
    mask_px = mask.load()
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] < threshold:
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
                    if visited[nindex] or pixels[nx, ny] < threshold:
                        continue
                    visited[nindex] = 1
                    stack.append((nx, ny))
            if len(component) >= min_area:
                for px, py in component:
                    mask_px[px, py] = 255
    return mask


def split_effect_overlay(image: Image.Image) -> tuple[Image.Image, Image.Image]:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    protected = (
        alpha.point(lambda value: 255 if value >= PROTECTED_ALPHA else 0)
        .filter(ImageFilter.MinFilter(5))
        .filter(ImageFilter.MaxFilter(13))
    )

    base = image.copy()
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    base_px = base.load()
    overlay_px = overlay.load()
    image_px = image.load()
    alpha_px = alpha.load()
    protected_px = protected.load()

    for y in range(image.height):
        for x in range(image.width):
            a = alpha_px[x, y]
            if a <= 6 or protected_px[x, y] > 0:
                continue
            r, g, b, _ = image_px[x, y]
            chroma = max(r, g, b) - min(r, g, b)
            luma = (r * 299 + g * 587 + b * 114) / 1000
            saturated_effect = chroma >= 28
            soft_light_or_shadow = a <= 165 and (luma >= 48 or chroma >= 18)
            if not saturated_effect and not soft_light_or_shadow:
                continue
            overlay_px[x, y] = image_px[x, y]
            base_px[x, y] = (r, g, b, 0)

    return base, overlay


def normalize_action_frame(
    image: Image.Image,
    existing_overlay: Image.Image | None = None,
    *,
    preserve_existing_overlay: bool = False,
) -> tuple[Image.Image, Image.Image]:
    if existing_overlay is not None and preserve_existing_overlay:
        base = image.convert("RGBA")
        overlay = existing_overlay.convert("RGBA")
    else:
        source = image.convert("RGBA")
        if existing_overlay is not None:
            source.alpha_composite(existing_overlay.convert("RGBA"))
        base, overlay = split_effect_overlay(source)
    bbox = alpha_bbox(base) or alpha_bbox(image)
    if bbox is None:
        blank = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
        return blank, blank.copy()
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    max_width = min(FRAME_WIDTH - MIN_PADDING * 2, FRAME_WIDTH * NORMALIZE_TARGET_OCCUPANCY)
    max_height = min(FRAME_HEIGHT - MIN_PADDING * 2, FRAME_HEIGHT * NORMALIZE_TARGET_OCCUPANCY)
    scale = min(1.0, max_width / width, max_height / height)
    normalized_base = transform_with_base_bbox(base, bbox, scale)
    normalized_overlay = transform_with_base_bbox(overlay, bbox, scale)
    dx, dy = audit_center_adjustment(normalized_base)
    return shift_image(normalized_base, dx, dy), shift_image(normalized_overlay, dx, dy)


def frame_paths(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(path for path in directory.glob("*.png") if path.stem.isdigit())


def write_attack_strip(hero_dir: Path) -> None:
    frames = [Image.open(hero_dir / f"attack-{index}.png").convert("RGBA") for index in range(4)]
    strip = Image.new("RGBA", (FRAME_WIDTH * len(frames), FRAME_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_WIDTH, 0))
    strip.save(hero_dir / "attack-strip.png")


def normalize_hero(hero_dir: Path) -> None:
    battle_path = hero_dir / "battle-idle.png"
    if battle_path.exists():
        normalize_image(Image.open(battle_path)).save(battle_path)

    anim_root = hero_dir / "anim"
    attack_frames_for_legacy: list[Path] = []
    for state in ("idle", "run", "attack", "ultimate"):
        state_dir = anim_root / state
        paths = frame_paths(state_dir)
        if not paths:
            continue
        effect_dir = state_dir / "effect"
        existing_effect_paths = {path.name: path for path in frame_paths(effect_dir)}
        effect_dir.mkdir(parents=True, exist_ok=True)
        for stale in effect_dir.glob("*.png"):
            if stale.name not in {path.name for path in paths}:
                stale.unlink()
        preserve_existing_overlay = hero_dir.name in STRUCTURED_OVERLAY_HEROES or (hero_dir / PRESERVE_OVERLAY_MARKER).exists()
        for path in paths:
            existing_overlay = Image.open(existing_effect_paths[path.name]).convert("RGBA") if path.name in existing_effect_paths else None
            base, overlay = normalize_action_frame(
                Image.open(path),
                existing_overlay,
                preserve_existing_overlay=preserve_existing_overlay,
            )
            base.save(path)
            overlay.save(effect_dir / path.name)
        if state == "attack":
            attack_frames_for_legacy = paths

    if len(attack_frames_for_legacy) >= 6:
        for output_index, frame_index in enumerate((0, 2, 3, 5)):
            Image.open(attack_frames_for_legacy[frame_index]).convert("RGBA").save(hero_dir / f"attack-{output_index}.png")
        write_attack_strip(hero_dir)
    else:
        for index in range(4):
            path = hero_dir / f"attack-{index}.png"
            if path.exists():
                base, _overlay = normalize_action_frame(Image.open(path))
                base.save(path)
        if all((hero_dir / f"attack-{index}.png").exists() for index in range(4)):
            write_attack_strip(hero_dir)


def main() -> None:
    hero_dirs = sorted(path for path in CHARACTER_ROOT.iterdir() if path.is_dir())
    for hero_dir in hero_dirs:
        normalize_hero(hero_dir)
        print(f"normalized {hero_dir.name}")


if __name__ == "__main__":
    main()
