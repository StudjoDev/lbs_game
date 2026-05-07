#!/usr/bin/env python3
"""Generate candidate Da Qiao character assets.

This script intentionally writes only Da Qiao-owned paths:
- public/assets/characters/daqiao/**
- scripts/source/character-anims/daqiao/**
- output/web-game/daqiao-*.png
- output/agent-work/daqiao/**
"""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter


def find_repo_root(start: Path) -> Path:
    for path in [start, *start.parents]:
        if (path / "package.json").exists() and (path / "src" / "game").exists():
            return path
    raise RuntimeError("Could not find lbs_game repository root.")


ROOT = find_repo_root(Path(__file__).resolve().parent)
FRAME_W = 192
FRAME_H = 224
SCALE = 4
SAFE_W = 128
SAFE_H = 149
MIN_PADDING = 10
HERO_ID = "daqiao"
CHAR_DIR = ROOT / "public" / "assets" / "characters" / HERO_ID
SOURCE_DIR = ROOT / "scripts" / "source" / "character-anims" / HERO_ID
WORK_DIR = ROOT / "output" / "agent-work" / HERO_ID
WEB_DIR = ROOT / "output" / "web-game"


Color = tuple[int, int, int, int]
Point = tuple[float, float]


PALETTE = {
    "outline": (37, 63, 74, 230),
    "deep": (20, 64, 82, 238),
    "teal": (56, 180, 201, 230),
    "water": (84, 215, 235, 160),
    "water_hi": (224, 255, 250, 210),
    "jade": (137, 232, 207, 210),
    "gold": (245, 209, 111, 235),
    "skin": (255, 223, 203, 255),
    "blush": (247, 145, 155, 120),
    "hair": (24, 44, 60, 255),
    "hair_hi": (33, 114, 138, 210),
    "white": (239, 255, 249, 245),
    "sleeve": (198, 250, 246, 222),
    "dress": (62, 192, 207, 240),
    "dress_dark": (25, 104, 130, 238),
}


def s(value: float) -> int:
    return round(value * SCALE)


def scaled_box(box: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(s(v) for v in box)  # type: ignore[return-value]


def scaled_points(points: Iterable[Point]) -> list[tuple[int, int]]:
    return [(s(x), s(y)) for x, y in points]


def make_canvas() -> Image.Image:
    return Image.new("RGBA", (FRAME_W * SCALE, FRAME_H * SCALE), (0, 0, 0, 0))


def downsample(image: Image.Image) -> Image.Image:
    return image.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS)


def draw_ellipse(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], fill: Color, outline: Color | None = None, width: int = 1) -> None:
    draw.ellipse(scaled_box(box), fill=fill, outline=outline, width=s(width))


def draw_polygon(draw: ImageDraw.ImageDraw, points: list[Point], fill: Color, outline: Color | None = None, width: int = 1) -> None:
    draw.polygon(scaled_points(points), fill=fill)
    if outline:
        draw.line(scaled_points(points + [points[0]]), fill=outline, width=s(width), joint="curve")


def draw_line(draw: ImageDraw.ImageDraw, points: list[Point], fill: Color, width: int = 1) -> None:
    draw.line(scaled_points(points), fill=fill, width=s(width), joint="curve")


def draw_arc_line(draw: ImageDraw.ImageDraw, center: Point, rx: float, ry: float, start: float, end: float, fill: Color, width: int = 3, steps: int = 44) -> None:
    points = []
    if end < start:
        end += math.tau
    for index in range(steps + 1):
        t = start + (end - start) * index / steps
        points.append((center[0] + math.cos(t) * rx, center[1] + math.sin(t) * ry))
    draw_line(draw, points, fill, width)


def draw_spark(draw: ImageDraw.ImageDraw, x: float, y: float, size: float, fill: Color) -> None:
    draw_line(draw, [(x - size, y), (x + size, y)], fill, width=1)
    draw_line(draw, [(x, y - size), (x, y + size)], fill, width=1)
    draw_ellipse(draw, (x - size * 0.35, y - size * 0.35, x + size * 0.35, y + size * 0.35), fill)


def draw_lotus(draw: ImageDraw.ImageDraw, x: float, y: float, scale: float, alpha: int, angle: float = -math.pi / 2) -> None:
    petal = (210, 255, 246, alpha)
    petal_edge = (88, 218, 232, min(240, alpha + 28))
    for index in range(6):
        a = angle + (index - 2.5) * 0.34
        tip = (x + math.cos(a) * 16 * scale, y + math.sin(a) * 10 * scale)
        left = (x + math.cos(a + 1.55) * 5.0 * scale, y + math.sin(a + 1.55) * 4.0 * scale)
        right = (x + math.cos(a - 1.55) * 5.0 * scale, y + math.sin(a - 1.55) * 4.0 * scale)
        draw_polygon(draw, [left, tip, right, (x, y)], petal, petal_edge, width=1)
    draw_ellipse(draw, (x - 3.8 * scale, y - 2.4 * scale, x + 3.8 * scale, y + 2.4 * scale), PALETTE["gold"])


def draw_water_ribbons(draw: ImageDraw.ImageDraw, phase: float, strength: float, mode: str) -> None:
    if mode == "idle":
        draw_arc_line(draw, (96, 160), 44 + strength * 2, 11, math.radians(198), math.radians(350), (87, 220, 235, 78), width=2)
        draw_arc_line(draw, (96, 153), 32 + strength * 2, 8, math.radians(208), math.radians(336), (225, 255, 250, 92), width=1)
        for i in range(4):
            draw_spark(draw, 72 + i * 15 + math.sin(phase + i) * 3, 142 + math.cos(phase + i) * 4, 2.0, (198, 255, 247, 88))
    elif mode == "run":
        sign = -1 if int(phase) % 2 == 0 else 1
        draw_arc_line(draw, (96 - sign * 9, 156), 46, 13, math.radians(190), math.radians(335), (84, 213, 235, 88), width=2)
        draw_line(draw, [(69 - sign * 8, 148), (95 - sign * 3, 139), (124 + sign * 8, 145)], (226, 255, 249, 78), width=2)
    elif mode == "attack":
        push = strength
        cx = 82 + push * 10
        draw_arc_line(draw, (cx, 130 - push * 2), 37 + push * 5, 25 + push * 2, math.radians(205), math.radians(386), (65, 205, 232, 118 + int(push * 18)), width=3 + int(push))
        draw_arc_line(draw, (cx + 10, 121 - push), 32 + push * 5, 18 + push * 2, math.radians(218), math.radians(383), (232, 255, 250, 138 + int(push * 18)), width=2)
        draw_line(draw, [(72 + push * 10, 142), (101 + push * 12, 122), (139 + push * 7, 132)], (113, 227, 240, 98 + int(push * 12)), width=2)
        if push >= 2:
            draw_lotus(draw, 108 + push * 7, 112 - push, 0.65, 138)
    elif mode == "ultimate":
        cx = 96 + math.sin(phase * 0.6) * 3
        cy = 123
        rx = 39 + strength * 8
        ry = 27 + strength * 5
        draw_arc_line(draw, (cx, cy), rx, ry, math.radians(0), math.radians(352), (55, 203, 232, 120 + int(strength * 16)), width=3 + int(strength))
        draw_arc_line(draw, (cx, cy - 4), rx - 8, ry - 8, math.radians(24), math.radians(326), (234, 255, 250, 150 + int(strength * 16)), width=2)
        draw_arc_line(draw, (cx + 10, cy + 13), rx - 12, 13 + strength * 2, math.radians(190), math.radians(370), (96, 225, 236, 112), width=2)
        draw_lotus(draw, cx + 20, cy - 9, 0.78 + strength * 0.06, 142 + int(strength * 15))
        draw_lotus(draw, cx - 22, cy + 4, 0.58 + strength * 0.05, 112 + int(strength * 12), angle=-1.2)


def fan_points(x: float, y: float, angle: float, radius: float, spread: float) -> list[Point]:
    points: list[Point] = [(x, y)]
    for i in range(8):
        t = -spread / 2 + spread * i / 7
        r = radius * (0.96 + 0.06 * math.sin(i * 1.7))
        points.append((x + math.cos(angle + t) * r, y + math.sin(angle + t) * r))
    return points


def draw_fan(draw: ImageDraw.ImageDraw, x: float, y: float, angle: float, radius: float, spread: float = 1.35, alpha: int = 228) -> None:
    body = (203, 255, 247, alpha)
    shade = (91, 211, 225, min(230, alpha))
    edge = PALETTE["gold"]
    pts = fan_points(x, y, angle, radius, spread)
    draw_polygon(draw, pts, body, PALETTE["deep"], width=1)
    for i in range(1, len(pts)):
        rib = pts[i]
        rib_color = edge if i in (1, len(pts) - 1, 4) else (83, 187, 204, 190)
        draw_line(draw, [(x, y), rib], rib_color, width=1)
    for i in range(1, len(pts) - 1):
        mid = ((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2)
        draw_line(draw, [(x, y), mid], (236, 255, 250, 118), width=1)
    outer = pts[1:]
    draw_line(draw, outer, edge, width=2)
    for i in range(3):
        t = angle - spread * 0.25 + i * spread * 0.25
        draw_arc_line(
            draw,
            (x + math.cos(t) * radius * 0.42, y + math.sin(t) * radius * 0.42),
            8 + i * 2,
            3 + i,
            t + 1.8,
            t + 4.0,
            shade,
            width=1,
            steps=12,
        )
    draw_ellipse(draw, (x - 3.4, y - 3.4, x + 3.4, y + 3.4), (247, 224, 142, alpha), PALETTE["deep"], width=1)


def draw_hair_ribbon(draw: ImageDraw.ImageDraw, root: Point, phase: float, side: int, alpha: int = 190) -> None:
    x, y = root
    points = [
        (x, y),
        (x + side * (13 + math.sin(phase) * 3), y + 14),
        (x + side * (17 + math.cos(phase) * 4), y + 33),
        (x + side * (8 + math.sin(phase * 1.4) * 4), y + 50),
    ]
    draw_line(draw, points, (47, 151, 174, alpha), width=5)
    draw_line(draw, points, (201, 255, 247, min(210, alpha)), width=2)


def draw_character(draw: ImageDraw.ImageDraw, pose: dict[str, float]) -> None:
    cx = 96 + pose.get("dx", 0)
    base = 190 + pose.get("dy", 0)
    lean = pose.get("lean", 0)
    phase = pose.get("phase", 0)
    head_x = cx + lean * 0.12
    head_y = base - 111 + pose.get("headbob", 0)
    shoulder_y = base - 77
    torso_y = base - 66
    left_fan = (
        cx + pose.get("lfx", -35),
        base + pose.get("lfy", -74),
        pose.get("lfa", -2.45),
        pose.get("lfr", 24),
    )
    right_fan = (
        cx + pose.get("rfx", 35),
        base + pose.get("rfy", -74),
        pose.get("rfa", -0.70),
        pose.get("rfr", 24),
    )

    draw_ellipse(draw, (cx - 34, base - 8, cx + 34, base + 4), (10, 50, 66, 35))

    # Hair and trailing ornaments behind the body.
    draw_hair_ribbon(draw, (head_x - 20, head_y + 20), phase, -1)
    draw_hair_ribbon(draw, (head_x + 20, head_y + 19), phase + 1.2, 1)
    draw_polygon(
        draw,
        [(head_x - 25, head_y + 5), (head_x - 39, head_y + 47), (head_x - 24, head_y + 61), (head_x - 12, head_y + 21)],
        PALETTE["hair"],
        (15, 35, 48, 220),
        width=1,
    )
    draw_polygon(
        draw,
        [(head_x + 24, head_y + 4), (head_x + 40, head_y + 46), (head_x + 24, head_y + 62), (head_x + 11, head_y + 22)],
        PALETTE["hair"],
        (15, 35, 48, 220),
        width=1,
    )
    draw_line(draw, [(head_x - 20, head_y + 11), (head_x - 33, head_y + 45), (head_x - 27, head_y + 67)], PALETTE["hair_hi"], width=2)
    draw_line(draw, [(head_x + 18, head_y + 13), (head_x + 34, head_y + 44), (head_x + 27, head_y + 66)], PALETTE["hair_hi"], width=2)

    # Legs and layered skirt.
    draw_ellipse(draw, (cx - 22, base - 7, cx - 6, base + 6), (250, 224, 177, 245), PALETTE["deep"], width=1)
    draw_ellipse(draw, (cx + 7, base - 7, cx + 23, base + 6), (250, 224, 177, 245), PALETTE["deep"], width=1)
    draw_polygon(draw, [(cx - 31, torso_y + 23), (cx + 29, torso_y + 23), (cx + 21, base - 8), (cx - 22, base - 8)], PALETTE["dress"], PALETTE["deep"], width=1)
    draw_polygon(draw, [(cx - 25, torso_y + 27), (cx - 4, torso_y + 20), (cx - 8, base - 3), (cx - 31, base - 8)], (224, 255, 250, 218), PALETTE["teal"], width=1)
    draw_polygon(draw, [(cx + 25, torso_y + 27), (cx + 4, torso_y + 20), (cx + 8, base - 3), (cx + 31, base - 8)], (174, 239, 239, 220), PALETTE["teal"], width=1)
    draw_line(draw, [(cx - 22, base - 19), (cx - 7, base - 3), (cx + 7, base - 3), (cx + 22, base - 19)], PALETTE["gold"], width=2)

    # Torso.
    draw_polygon(
        draw,
        [(cx - 22, shoulder_y + 7), (cx + 21, shoulder_y + 7), (cx + 28, torso_y + 31), (cx + 10, torso_y + 48), (cx - 11, torso_y + 48), (cx - 29, torso_y + 31)],
        PALETTE["dress_dark"],
        PALETTE["outline"],
        width=1,
    )
    draw_polygon(draw, [(cx - 13, shoulder_y + 11), (cx + 14, shoulder_y + 11), (cx + 8, torso_y + 44), (cx - 8, torso_y + 44)], PALETTE["white"], PALETTE["gold"], width=1)
    draw_ellipse(draw, (cx - 7, torso_y + 26, cx + 7, torso_y + 40), (103, 224, 221, 238), PALETTE["gold"], width=1)

    # Arms, sleeves, and fans.
    left_hand = (left_fan[0], left_fan[1])
    right_hand = (right_fan[0], right_fan[1])
    left_shoulder = (cx - 18, shoulder_y + 13)
    right_shoulder = (cx + 18, shoulder_y + 13)
    draw_line(draw, [left_shoulder, ((left_shoulder[0] + left_hand[0]) / 2 - 5, (left_shoulder[1] + left_hand[1]) / 2), left_hand], PALETTE["sleeve"], width=9)
    draw_line(draw, [right_shoulder, ((right_shoulder[0] + right_hand[0]) / 2 + 5, (right_shoulder[1] + right_hand[1]) / 2), right_hand], PALETTE["sleeve"], width=9)
    draw_line(draw, [left_shoulder, left_hand], (82, 194, 209, 170), width=3)
    draw_line(draw, [right_shoulder, right_hand], (82, 194, 209, 170), width=3)
    draw_fan(draw, *left_fan)
    draw_fan(draw, *right_fan)

    # Head, face, and ornaments.
    draw_ellipse(draw, (head_x - 29, head_y - 32, head_x + 29, head_y + 28), PALETTE["hair"], (14, 34, 48, 245), width=2)
    draw_ellipse(draw, (head_x - 24, head_y - 24, head_x + 24, head_y + 26), PALETTE["skin"], PALETTE["outline"], width=1)
    draw_polygon(
        draw,
        [(head_x - 26, head_y - 19), (head_x - 9, head_y - 31), (head_x + 5, head_y - 25), (head_x + 27, head_y - 17), (head_x + 21, head_y - 1), (head_x - 24, head_y - 4)],
        PALETTE["hair"],
        None,
    )
    draw_line(draw, [(head_x - 15, head_y - 18), (head_x - 4, head_y - 25), (head_x + 14, head_y - 15)], PALETTE["hair_hi"], width=2)
    for side in (-1, 1):
        draw_ellipse(draw, (head_x + side * 23 - 7, head_y - 25, head_x + side * 23 + 7, head_y - 11), PALETTE["hair"], PALETTE["gold"], width=1)
        draw_lotus(draw, head_x + side * 24, head_y - 22, 0.35, 220, angle=-1.6 if side < 0 else -1.2)
    eye_y = head_y + 2
    for side in (-1, 1):
        ex = head_x + side * 9
        draw_ellipse(draw, (ex - 5, eye_y - 6, ex + 5, eye_y + 7), (16, 86, 119, 255), (9, 42, 66, 230), width=1)
        draw_ellipse(draw, (ex - 2, eye_y - 4, ex + 3, eye_y + 3), (80, 218, 238, 245))
        draw_ellipse(draw, (ex - 2, eye_y - 5, ex + 1, eye_y - 2), (248, 255, 255, 245))
    draw_ellipse(draw, (head_x - 18, head_y + 9, head_x - 10, head_y + 15), PALETTE["blush"])
    draw_ellipse(draw, (head_x + 10, head_y + 9, head_x + 18, head_y + 15), PALETTE["blush"])
    draw_arc_line(draw, (head_x, head_y + 14), 5, 3, math.radians(28), math.radians(152), (102, 48, 60, 210), width=1, steps=10)


def fit_alpha(image: Image.Image, target_center_x: float = 96, target_bottom: float = 198) -> Image.Image:
    alpha = image.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    bbox = alpha.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    scale = min(1.0, SAFE_W / width, SAFE_H / height, (FRAME_W - MIN_PADDING * 2) / width, (FRAME_H - MIN_PADDING * 2) / height)
    sprite = image.crop(bbox)
    if scale < 1.0:
        sprite = sprite.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.LANCZOS)
    center_delta = ((left + right) / 2 - 96) * scale
    x = round(target_center_x + center_delta - sprite.width / 2)
    y = round(target_bottom - sprite.height)
    x = max(MIN_PADDING, min(FRAME_W - MIN_PADDING - sprite.width, x))
    y = max(MIN_PADDING, min(FRAME_H - MIN_PADDING - sprite.height, y))
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    out.alpha_composite(sprite, (x, y))
    return out


def render_frame(pose: dict[str, float], effects: list[dict[str, float]], target_center_x: float = 96) -> Image.Image:
    canvas = make_canvas()
    draw = ImageDraw.Draw(canvas)
    for effect in effects:
        if effect.get("layer", 0) <= 0:
            draw_water_ribbons(draw, effect.get("phase", 0), effect.get("strength", 1), effect.get("mode", "idle"))
    draw_character(draw, pose)
    for effect in effects:
        if effect.get("layer", 0) > 0:
            draw_water_ribbons(draw, effect.get("phase", 0), effect.get("strength", 1), effect.get("mode", "idle"))
    return fit_alpha(downsample(canvas), target_center_x=target_center_x)


def idle_frames() -> list[Image.Image]:
    specs = [
        {"dx": 0, "dy": 0, "lean": -1.0, "phase": 0.2, "lfx": -36, "lfy": -75, "lfa": -2.55, "rfx": 36, "rfy": -75, "rfa": -0.58},
        {"dx": -2, "dy": -1, "lean": -2.5, "phase": 0.9, "lfx": -40, "lfy": -79, "lfa": -2.72, "rfx": 33, "rfy": -72, "rfa": -0.48},
        {"dx": -3, "dy": -3, "lean": -4.0, "phase": 1.6, "lfx": -42, "lfy": -84, "lfa": -2.82, "rfx": 30, "rfy": -70, "rfa": -0.40},
        {"dx": 3, "dy": -3, "lean": 3.2, "phase": 2.5, "lfx": -33, "lfy": -70, "lfa": -2.45, "rfx": 42, "rfy": -84, "rfa": -0.72},
        {"dx": 2, "dy": -1, "lean": 2.0, "phase": 3.2, "lfx": -31, "lfy": -72, "lfa": -2.32, "rfx": 40, "rfy": -79, "rfa": -0.84},
        {"dx": 0, "dy": 0, "lean": 0.8, "phase": 4.0, "lfx": -35, "lfy": -75, "lfa": -2.48, "rfx": 35, "rfy": -75, "rfa": -0.66},
    ]
    return [
        render_frame(spec, [{"mode": "idle", "phase": i + 0.4, "strength": 1 + (i % 3) * 0.55, "layer": 1}], target_center_x=96 + spec["dx"] * 0.25)
        for i, spec in enumerate(specs)
    ]


def run_frames() -> list[Image.Image]:
    specs = [
        {"dx": -5, "dy": 0, "lean": -5.0, "phase": 0.3, "lfx": -43, "lfy": -84, "lfa": -2.92, "rfx": 29, "rfy": -62, "rfa": -0.28},
        {"dx": -11, "dy": -5, "lean": -9.0, "phase": 1.0, "lfx": -47, "lfy": -90, "lfa": -3.04, "rfx": 25, "rfy": -58, "rfa": -0.14},
        {"dx": -5, "dy": -2, "lean": -3.0, "phase": 1.7, "lfx": -36, "lfy": -73, "lfa": -2.54, "rfx": 39, "rfy": -79, "rfa": -0.84},
        {"dx": 5, "dy": 0, "lean": 4.5, "phase": 2.5, "lfx": -29, "lfy": -62, "lfa": -2.86, "rfx": 43, "rfy": -84, "rfa": -0.45},
        {"dx": 11, "dy": -5, "lean": 8.0, "phase": 3.2, "lfx": -25, "lfy": -58, "lfa": -3.08, "rfx": 47, "rfy": -90, "rfa": -0.58},
        {"dx": 5, "dy": -2, "lean": 2.5, "phase": 4.0, "lfx": -39, "lfy": -79, "lfa": -2.35, "rfx": 36, "rfy": -73, "rfa": -0.62},
    ]
    return [
        render_frame(spec, [{"mode": "run", "phase": i, "strength": 1.2, "layer": -1}], target_center_x=96 + spec["dx"] * 0.35)
        for i, spec in enumerate(specs)
    ]


def attack_frames() -> list[Image.Image]:
    specs = [
        ({"dx": -1, "dy": 0, "lean": -1.0, "phase": 0.2, "lfx": -34, "lfy": -75, "lfa": -2.50, "rfx": 34, "rfy": -75, "rfa": -0.64}, 0.3, 0),
        ({"dx": -8, "dy": -3, "lean": -8.0, "phase": 0.9, "lfx": -49, "lfy": -88, "lfa": -3.05, "rfx": 20, "rfy": -62, "rfa": -0.10}, 0.8, -2),
        ({"dx": -12, "dy": -7, "lean": -12.0, "phase": 1.6, "lfx": -44, "lfy": -92, "lfa": -2.94, "rfx": 29, "rfy": -89, "rfa": -0.34}, 1.7, -1),
        ({"dx": 4, "dy": -8, "lean": 8.0, "phase": 2.3, "lfx": -19, "lfy": -86, "lfa": -1.93, "rfx": 50, "rfy": -86, "rfa": -0.08, "lfr": 27, "rfr": 27}, 2.8, 3),
        ({"dx": 10, "dy": -5, "lean": 11.0, "phase": 2.9, "lfx": -10, "lfy": -78, "lfa": -1.55, "rfx": 51, "rfy": -76, "rfa": 0.04, "lfr": 27, "rfr": 27}, 3.6, 5),
        ({"dx": 7, "dy": -2, "lean": 4.0, "phase": 3.5, "lfx": -24, "lfy": -71, "lfa": -2.05, "rfx": 44, "rfy": -70, "rfa": -0.36}, 2.1, 3),
        ({"dx": 2, "dy": -1, "lean": 1.5, "phase": 4.1, "lfx": -31, "lfy": -73, "lfa": -2.38, "rfx": 39, "rfy": -73, "rfa": -0.58}, 1.0, 1),
        ({"dx": 0, "dy": 0, "lean": -0.5, "phase": 4.8, "lfx": -35, "lfy": -75, "lfa": -2.48, "rfx": 35, "rfy": -75, "rfa": -0.66}, 0.4, 0),
    ]
    frames: list[Image.Image] = []
    for spec, strength, center_shift in specs:
        effects = [{"mode": "attack", "phase": spec["phase"], "strength": strength, "layer": 1}]
        if strength > 1.4:
            effects.insert(0, {"mode": "idle", "phase": spec["phase"], "strength": 1.5, "layer": -1})
        frames.append(render_frame(spec, effects, target_center_x=96 + center_shift))
    return frames


def ultimate_frames() -> list[Image.Image]:
    specs = [
        ({"dx": 0, "dy": 0, "lean": -1.0, "phase": 0.2, "lfx": -37, "lfy": -76, "lfa": -2.60, "rfx": 37, "rfy": -76, "rfa": -0.54}, 0.5, 0),
        ({"dx": -2, "dy": -3, "lean": -4.0, "phase": 0.9, "lfx": -44, "lfy": -86, "lfa": -2.92, "rfx": 42, "rfy": -83, "rfa": -0.34}, 1.2, 0),
        ({"dx": -4, "dy": -7, "lean": -7.0, "phase": 1.6, "lfx": -49, "lfy": -91, "lfa": -3.05, "rfx": 46, "rfy": -91, "rfa": -0.12, "lfr": 27, "rfr": 27}, 2.0, -1),
        ({"dx": 2, "dy": -9, "lean": 1.0, "phase": 2.4, "lfx": -50, "lfy": -88, "lfa": -2.90, "rfx": 50, "rfy": -88, "rfa": -0.24, "lfr": 29, "rfr": 29}, 3.2, 0),
        ({"dx": 6, "dy": -6, "lean": 6.0, "phase": 3.1, "lfx": -34, "lfy": -82, "lfa": -2.05, "rfx": 51, "rfy": -80, "rfa": 0.05, "lfr": 28, "rfr": 28}, 3.0, 2),
        ({"dx": 4, "dy": -3, "lean": 4.0, "phase": 3.8, "lfx": -27, "lfy": -74, "lfa": -2.20, "rfx": 44, "rfy": -74, "rfa": -0.40}, 1.8, 1),
        ({"dx": 1, "dy": -1, "lean": 1.5, "phase": 4.5, "lfx": -32, "lfy": -73, "lfa": -2.42, "rfx": 39, "rfy": -73, "rfa": -0.62}, 1.0, 0),
        ({"dx": 0, "dy": 0, "lean": -0.5, "phase": 5.2, "lfx": -35, "lfy": -75, "lfa": -2.48, "rfx": 35, "rfy": -75, "rfa": -0.66}, 0.45, 0),
    ]
    frames: list[Image.Image] = []
    for spec, strength, center_shift in specs:
        effects = [
            {"mode": "ultimate", "phase": spec["phase"], "strength": strength, "layer": -1},
            {"mode": "ultimate", "phase": spec["phase"] + 0.4, "strength": max(0.4, strength - 0.5), "layer": 1},
        ]
        frames.append(render_frame(spec, effects, target_center_x=96 + center_shift))
    return frames


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()


def frame_delta(a: Image.Image, b: Image.Image) -> int:
    total = 0
    left = a.tobytes()
    right = b.tobytes()
    for index in range(0, len(left), 4):
        total += abs(left[index + 3] - right[index + 3])
        total += abs(left[index] - right[index]) // 12
        total += abs(left[index + 1] - right[index + 1]) // 12
        total += abs(left[index + 2] - right[index + 2]) // 12
    return total


def write_state(state: str, frames: list[Image.Image]) -> None:
    final_dir = CHAR_DIR / "anim" / state
    raw_dir = SOURCE_DIR / state / "raw"
    final_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)
    for stale in final_dir.glob("*.png"):
        stale.unlink()
    for stale in raw_dir.glob("*.png"):
        stale.unlink()
    for index, frame in enumerate(frames, start=1):
        frame.save(final_dir / f"{index:02d}.png")
        frame.save(raw_dir / f"{index:02d}.png")
    make_strip(frames, SOURCE_DIR / state / "reference-action.png", gutter=18)
    make_state_preview(frames, SOURCE_DIR / state / "preview.png")


def make_strip(frames: list[Image.Image], path: Path, gutter: int = 0) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    strip = Image.new("RGBA", (FRAME_W * len(frames) + gutter * (len(frames) - 1), FRAME_H), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * (FRAME_W + gutter), 0))
    strip.save(path)


def checkerboard(size: tuple[int, int], dark: tuple[int, int, int, int] = (31, 49, 55, 255)) -> Image.Image:
    image = Image.new("RGBA", size, dark)
    draw = ImageDraw.Draw(image)
    step = 16
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2 == 0:
                draw.rectangle((x, y, x + step - 1, y + step - 1), fill=(44, 70, 76, 255))
    return image


def make_state_preview(frames: list[Image.Image], path: Path) -> None:
    bg = checkerboard((FRAME_W * len(frames), FRAME_H))
    for index, frame in enumerate(frames):
        bg.alpha_composite(frame, (index * FRAME_W, 0))
    bg.save(path)


def make_contact_sheet(states: dict[str, list[Image.Image]]) -> None:
    cols = 8
    rows = len(states)
    header = 28
    sheet = checkerboard((FRAME_W * cols, header + FRAME_H * rows), dark=(24, 40, 47, 255))
    draw = ImageDraw.Draw(sheet)
    for row, (state, frames) in enumerate(states.items()):
        y = header + row * FRAME_H
        draw.rectangle((0, y - 24, FRAME_W * cols, y), fill=(14, 63, 75, 255))
        draw.text((10, y - 20), f"daqiao {state}", fill=(229, 255, 249, 255))
        for col, frame in enumerate(frames):
            tile = checkerboard((FRAME_W, FRAME_H))
            tile.alpha_composite(frame)
            sheet.alpha_composite(tile, (col * FRAME_W, y))
            draw.rectangle((col * FRAME_W, y, col * FRAME_W + FRAME_W - 1, y + FRAME_H - 1), outline=(80, 135, 145, 190), width=1)
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(WEB_DIR / "daqiao-contact-sheet.png")


def make_card(idle: Image.Image) -> Image.Image:
    size = 1024
    card = Image.new("RGBA", (size, size), (12, 42, 52, 255))
    draw = ImageDraw.Draw(card)
    for y in range(size):
        ratio = y / (size - 1)
        color = (
            round(14 + ratio * 16),
            round(61 + ratio * 70),
            round(74 + ratio * 88),
            255,
        )
        draw.line([(0, y), (size, y)], fill=color)
    for i in range(18):
        cx = 130 + (i * 197) % 790
        cy = 110 + (i * 113) % 710
        rx = 90 + (i % 4) * 30
        ry = 24 + (i % 3) * 10
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), outline=(92, 218, 232, 38 + (i % 4) * 9), width=4)
    for i in range(12):
        draw_lotus_scaled(draw, 145 + (i * 71) % 730, 180 + (i * 131) % 640, 1.1 + (i % 3) * 0.22, 65)
    for r in (310, 430):
        draw.ellipse((size / 2 - r, 520 - r * 0.72, size / 2 + r, 520 + r * 0.72), outline=(210, 255, 250, 42), width=8)
    sprite = idle.resize((614, 717), Image.Resampling.LANCZOS)
    glow = Image.new("RGBA", sprite.size, (0, 0, 0, 0))
    glow.putalpha(sprite.getchannel("A").filter(ImageFilter.GaussianBlur(18)))
    glow_colored = Image.new("RGBA", sprite.size, (82, 226, 235, 76))
    glow_colored.putalpha(glow.getchannel("A"))
    card.alpha_composite(glow_colored, (207, 210))
    card.alpha_composite(sprite, (205, 230))
    draw = ImageDraw.Draw(card)
    draw.arc((122, 112, 902, 890), 202, 338, fill=(231, 255, 249, 132), width=9)
    draw.arc((168, 158, 856, 844), 198, 348, fill=(80, 222, 235, 118), width=6)
    return card


def draw_lotus_scaled(draw: ImageDraw.ImageDraw, x: float, y: float, scale: float, alpha: int) -> None:
    petal = (212, 255, 248, alpha)
    edge = (105, 230, 238, min(120, alpha + 28))
    for index in range(7):
        a = -math.pi / 2 + (index - 3) * 0.24
        tip = (x + math.cos(a) * 42 * scale, y + math.sin(a) * 32 * scale)
        left = (x + math.cos(a + 1.55) * 15 * scale, y + math.sin(a + 1.55) * 12 * scale)
        right = (x + math.cos(a - 1.55) * 15 * scale, y + math.sin(a - 1.55) * 12 * scale)
        draw.polygon([left, tip, right, (x, y)], fill=petal, outline=edge)


def summarize(states: dict[str, list[Image.Image]]) -> dict[str, object]:
    result: dict[str, object] = {"states": {}}
    for state, frames in states.items():
        state_rows = []
        for index, frame in enumerate(frames, start=1):
            bbox = alpha_bbox(frame)
            if not bbox:
                state_rows.append({"frame": index, "empty": True})
                continue
            left, top, right, bottom = bbox
            state_rows.append(
                {
                    "frame": index,
                    "bbox": [left, top, right, bottom],
                    "padding": min(left, top, FRAME_W - right, FRAME_H - bottom),
                    "occupancy": [round((right - left) / FRAME_W, 3), round((bottom - top) / FRAME_H, 3)],
                }
            )
        deltas = [frame_delta(a, b) for a, b in zip(frames, frames[1:])]
        result["states"][state] = {"frames": state_rows, "deltas": deltas, "minDelta": min(deltas) if deltas else None}
    return result


def main() -> None:
    CHAR_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    WEB_DIR.mkdir(parents=True, exist_ok=True)

    states = {
        "idle": idle_frames(),
        "run": run_frames(),
        "attack": attack_frames(),
        "ultimate": ultimate_frames(),
    }
    for state, frames in states.items():
        write_state(state, frames)

    states["idle"][0].save(CHAR_DIR / "battle-idle.png")
    legacy_attack = [states["attack"][0], states["attack"][2], states["attack"][3], states["attack"][5]]
    for index, frame in enumerate(legacy_attack):
        frame.save(CHAR_DIR / f"attack-{index}.png")
    make_strip(legacy_attack, CHAR_DIR / "attack-strip.png")
    make_card(states["idle"][0]).save(CHAR_DIR / "card.png")
    make_contact_sheet(states)

    with (WORK_DIR / "audit-summary.json").open("w", encoding="utf-8") as handle:
        json.dump(summarize(states), handle, indent=2, ensure_ascii=False)

    # Keep a copy of the generator with the source references for handoff.
    shutil.copy2(Path(__file__), SOURCE_DIR / "generate_daqiao_assets.py")
    print("Generated Da Qiao assets.")


if __name__ == "__main__":
    main()
