#!/usr/bin/env python3
"""Normalize character animation frames into fixed-size transparent PNGs."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Sequence

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Pillow is required. Use the bundled Codex Python runtime or install pillow.") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize a transparent character animation strip or frame directory.")
    parser.add_argument("--input", required=True, help="Path to the raw horizontal strip PNG.")
    parser.add_argument("--out-dir", required=True, help="Directory to write 01.png, 02.png, ...")
    parser.add_argument("--frames", type=int, required=True, help="Number of equal-width slots in the strip.")
    parser.add_argument("--frame-width", type=int, default=192, help="Output frame width. Default: 192.")
    parser.add_argument("--frame-height", type=int, default=224, help="Output frame height. Default: 224.")
    parser.add_argument("--anchor", help="Optional anchor frame used for stable scale and frame 01 lockback.")
    parser.add_argument("--lock-frame1", action="store_true", help="Replace frame 01 with the anchor frame after normalization.")
    parser.add_argument("--alpha-threshold", type=int, default=8, help="Alpha threshold for sprite bounds. Default: 8.")
    return parser.parse_args()


def threshold_bbox(image: Image.Image, alpha_threshold: int) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value > alpha_threshold else 0)
    return alpha.getbbox()


def crop_to_content(image: Image.Image, alpha_threshold: int) -> Image.Image | None:
    bbox = threshold_bbox(image, alpha_threshold)
    if bbox is None:
        return None
    return image.crop(bbox)


def split_strip(strip: Image.Image, frames: int) -> list[Image.Image]:
    step = strip.width / frames
    return [strip.crop((round(index * step), 0, round((index + 1) * step), strip.height)) for index in range(frames)]


def max_content_size(images: Iterable[Image.Image | None]) -> tuple[int, int]:
    sizes = [(image.width, image.height) for image in images if image is not None]
    if not sizes:
        raise SystemExit("No sprite content was detected in the strip.")
    return max(width for width, _ in sizes), max(height for _, height in sizes)


def compose_frame(image: Image.Image | None, frame_width: int, frame_height: int, scale: float, margin_bottom: int = 0) -> Image.Image:
    canvas = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
    if image is None:
        return canvas
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    resized = image.resize((width, height), Image.Resampling.LANCZOS)
    offset_x = (frame_width - width) // 2
    offset_y = frame_height - margin_bottom - height
    canvas.alpha_composite(resized, (offset_x, offset_y))
    return canvas


def normalize_images(
    images: Sequence[Image.Image],
    out_dir: Path,
    frame_width: int = 192,
    frame_height: int = 224,
    anchor_path: Path | None = None,
    lock_frame1: bool = False,
    alpha_threshold: int = 8,
    margin_x: int = 8,
    margin_top: int = 6,
    margin_bottom: int = 0,
) -> list[Path]:
    if lock_frame1 and anchor_path is None:
        raise SystemExit("--lock-frame1 requires --anchor.")

    contents = [crop_to_content(image, alpha_threshold) for image in images]
    anchor_image: Image.Image | None = None
    anchor_content: Image.Image | None = None
    if anchor_path is not None:
        anchor_image = Image.open(anchor_path).convert("RGBA")
        anchor_content = crop_to_content(anchor_image, alpha_threshold)

    max_width, max_height = max_content_size([*contents, anchor_content])
    scale = min(
        1,
        max(1, frame_width - margin_x * 2) / max_width,
        max(1, frame_height - margin_top - margin_bottom) / max_height,
    )

    out_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for index, content in enumerate(contents, start=1):
        if index == 1 and lock_frame1 and anchor_image is not None:
            frame = anchor_image if anchor_image.size == (frame_width, frame_height) else compose_frame(anchor_content, frame_width, frame_height, scale, margin_bottom)
        else:
            frame = compose_frame(content, frame_width, frame_height, scale, margin_bottom)
        path = out_dir / f"{index:02d}.png"
        frame.save(path)
        paths.append(path)
    return paths


def normalize_frames(
    input_paths: Sequence[Path],
    out_dir: Path,
    frame_width: int = 192,
    frame_height: int = 224,
    anchor_path: Path | None = None,
    lock_frame1: bool = False,
    alpha_threshold: int = 8,
) -> list[Path]:
    images = [Image.open(path).convert("RGBA") for path in input_paths]
    return normalize_images(images, out_dir, frame_width, frame_height, anchor_path, lock_frame1, alpha_threshold)


def normalize_strip(
    input_path: Path,
    out_dir: Path,
    frames: int,
    frame_width: int = 192,
    frame_height: int = 224,
    anchor_path: Path | None = None,
    lock_frame1: bool = False,
    alpha_threshold: int = 8,
) -> list[Path]:
    if frames < 1:
        raise SystemExit("--frames must be at least 1.")
    if lock_frame1 and anchor_path is None:
        raise SystemExit("--lock-frame1 requires --anchor.")

    strip = Image.open(input_path).convert("RGBA")
    slots = split_strip(strip, frames)
    return normalize_images(slots, out_dir, frame_width, frame_height, anchor_path, lock_frame1, alpha_threshold, margin_x=8, margin_top=6)


def main() -> None:
    args = parse_args()
    normalize_strip(
        Path(args.input),
        Path(args.out_dir),
        args.frames,
        args.frame_width,
        args.frame_height,
        Path(args.anchor) if args.anchor else None,
        args.lock_frame1,
        args.alpha_threshold,
    )


if __name__ == "__main__":
    main()
