#!/usr/bin/env python3
"""Audit enemy runtime PNG frames against the warrior sprite safety rules."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ENEMY_ROOT = ROOT / "public" / "assets" / "enemies"
CONTACT_SHEET_PATH = ROOT / "output" / "web-game" / "enemy-animation-contact-sheet.png"

FRAME_WIDTH = 192
FRAME_HEIGHT = 224
FRAME_CENTER_X = FRAME_WIDTH / 2
FRAME_CENTER_Y = FRAME_HEIGHT / 2
ALPHA_THRESHOLD = 12

ENEMY_ACTION_COUNTS = {
    "walk": 4,
    "hit": 4,
    "death": 5,
}

ENEMY_IDS = ("infantry", "archer", "shield", "cavalry", "captain", "lubu")


@dataclass(frozen=True)
class FrameStats:
    path: Path
    width: int
    height: int
    bbox: tuple[int, int, int, int] | None

    @property
    def alpha_width(self) -> int:
        if self.bbox is None:
            return 0
        return self.bbox[2] - self.bbox[0]

    @property
    def alpha_height(self) -> int:
        if self.bbox is None:
            return 0
        return self.bbox[3] - self.bbox[1]

    @property
    def padding(self) -> tuple[int, int, int, int]:
        if self.bbox is None:
            return (self.width, self.height, self.width, self.height)
        left, top, right, bottom = self.bbox
        return (left, top, self.width - right, self.height - bottom)

    @property
    def center_offset(self) -> tuple[float, float]:
        if self.bbox is None:
            return (0, 0)
        left, top, right, bottom = self.bbox
        return (((left + right) / 2) - FRAME_CENTER_X, ((top + bottom) / 2) - FRAME_CENTER_Y)

    @property
    def occupancy(self) -> float:
        if self.width == 0 or self.height == 0:
            return 1
        return max(self.alpha_width / self.width, self.alpha_height / self.height)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return mask.getbbox()


def frame_stats(path: Path) -> FrameStats:
    image = Image.open(path).convert("RGBA")
    return FrameStats(path=path, width=image.width, height=image.height, bbox=alpha_bbox(image))


def iter_expected_frames() -> list[Path]:
    paths: list[Path] = []
    for enemy_id in ENEMY_IDS:
        for action, count in ENEMY_ACTION_COUNTS.items():
            for index in range(1, count + 1):
                paths.append(ENEMY_ROOT / enemy_id / action / f"{index:02d}.png")
    return paths


def audit(args: argparse.Namespace) -> list[str]:
    failures: list[str] = []
    for path in iter_expected_frames():
        if not path.exists():
            failures.append(f"missing frame {path.relative_to(ROOT)}")
            continue

        stats = frame_stats(path)
        label = str(path.relative_to(ROOT))
        if (stats.width, stats.height) != (FRAME_WIDTH, FRAME_HEIGHT):
            failures.append(f"{label}: expected {FRAME_WIDTH}x{FRAME_HEIGHT}, got {stats.width}x{stats.height}")
        if stats.bbox is None:
            failures.append(f"{label}: no visible alpha")
            continue

        padding = stats.padding
        min_padding = min(padding)
        if min_padding < args.min_padding:
            failures.append(f"{label}: padding {padding} below {args.min_padding}")
        if stats.occupancy > args.max_occupancy:
            failures.append(
                f"{label}: occupancy {stats.occupancy:.3f} exceeds {args.max_occupancy:.3f} "
                f"(bbox {stats.alpha_width}x{stats.alpha_height})"
            )
        offset_x, offset_y = stats.center_offset
        if abs(offset_x) > args.max_center_offset_x or abs(offset_y) > args.max_center_offset_y:
            failures.append(
                f"{label}: center offset ({offset_x:.1f}, {offset_y:.1f}) exceeds "
                f"({args.max_center_offset_x}, {args.max_center_offset_y})"
            )
    return failures


def checker_tile() -> Image.Image:
    tile = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (38, 24, 34, 255))
    draw = ImageDraw.Draw(tile)
    for y in range(0, FRAME_HEIGHT, 16):
        for x in range(0, FRAME_WIDTH, 16):
            if (x // 16 + y // 16) % 2 == 0:
                draw.rectangle((x, y, x + 15, y + 15), fill=(49, 32, 44, 255))
    draw.rectangle((32, 37, 160, 186), outline=(255, 211, 106, 90), width=1)
    draw.line((FRAME_CENTER_X - 6, FRAME_CENTER_Y, FRAME_CENTER_X + 6, FRAME_CENTER_Y), fill=(126, 244, 255, 110), width=1)
    draw.line((FRAME_CENTER_X, FRAME_CENTER_Y - 6, FRAME_CENTER_X, FRAME_CENTER_Y + 6), fill=(126, 244, 255, 110), width=1)
    return tile


def write_contact_sheet(path: Path) -> None:
    gutter = 12
    header = 28
    label_height = 20
    columns = max(ENEMY_ACTION_COUNTS.values())
    rows = len(ENEMY_IDS) * len(ENEMY_ACTION_COUNTS)
    width = columns * FRAME_WIDTH + (columns - 1) * gutter
    height = rows * (FRAME_HEIGHT + label_height) + (rows - 1) * gutter + header
    sheet = Image.new("RGBA", (width, height), (20, 13, 18, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((6, 6), "Enemy animation contact sheet: centered 192x224 frames, safe box shown", fill=(255, 232, 183, 255), font=font)

    tile_base = checker_tile()
    row = 0
    for enemy_id in ENEMY_IDS:
        for action, count in ENEMY_ACTION_COUNTS.items():
            y = header + row * (FRAME_HEIGHT + label_height + gutter)
            draw.text((6, y), f"{enemy_id}/{action}", fill=(255, 232, 183, 255), font=font)
            for index in range(1, count + 1):
                x = index - 1
                tile = tile_base.copy()
                frame = Image.open(ENEMY_ROOT / enemy_id / action / f"{index:02d}.png").convert("RGBA")
                tile.alpha_composite(frame)
                sheet.alpha_composite(tile, (x * (FRAME_WIDTH + gutter), y + label_height))
            row += 1

    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-padding", type=int, default=8)
    parser.add_argument("--max-occupancy", type=float, default=0.67)
    parser.add_argument("--max-center-offset-x", type=float, default=18)
    parser.add_argument("--max-center-offset-y", type=float, default=16)
    parser.add_argument("--contact-sheet", type=Path, default=CONTACT_SHEET_PATH)
    parser.add_argument("--no-contact-sheet", action="store_true")
    args = parser.parse_args()

    failures = audit(args)
    if not args.no_contact_sheet:
        write_contact_sheet(args.contact_sheet)
        print(f"wrote {args.contact_sheet.relative_to(ROOT)}")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        raise SystemExit(1)

    print(f"audited {len(iter_expected_frames())} enemy frames")


if __name__ == "__main__":
    main()
