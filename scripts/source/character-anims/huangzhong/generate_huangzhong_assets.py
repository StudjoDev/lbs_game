#!/usr/bin/env python3
"""Generate Huang Zhong candidate character assets.

This script is intentionally self-contained because shared registry/runtime
files are owned by the integration agent for this batch.
"""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[4]
HERO_ID = "huangzhong"

CHARACTER_DIR = ROOT / "public" / "assets" / "characters" / HERO_ID
SOURCE_DIR = ROOT / "scripts" / "source" / "character-anims" / HERO_ID
WEB_OUTPUT_DIR = ROOT / "output" / "web-game"
WORK_DIR = ROOT / "output" / "agent-work" / HERO_ID

FRAME_WIDTH = 192
FRAME_HEIGHT = 224
FRAME_SIZE = (FRAME_WIDTH, FRAME_HEIGHT)
SCALE = 4
DRAW_SIZE = (FRAME_WIDTH * SCALE, FRAME_HEIGHT * SCALE)
MIN_PADDING = 10
MAX_OCCUPANCY = 0.67
ALPHA_THRESHOLD = 8

SHU_GREEN = (35, 138, 78, 255)
SHU_DARK = (18, 67, 44, 255)
SHU_LIGHT = (82, 202, 115, 255)
GOLD = (244, 181, 58, 255)
GOLD_LIGHT = (255, 232, 132, 255)
SKIN = (249, 198, 148, 255)
BROWN = (96, 47, 28, 255)
WHITE = (242, 245, 237, 255)
ICE_WHITE = (236, 255, 238, 255)


def sp(value: float) -> int:
    return round(value * SCALE)


def sbox(box: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(sp(v) for v in box)  # type: ignore[return-value]


def spoints(points: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(sp(x), sp(y)) for x, y in points]


def swidth(width: float) -> int:
    return max(1, sp(width))


def draw_line(
    layer: Image.Image,
    points: list[tuple[float, float]] | tuple[float, float, float, float],
    fill: tuple[int, int, int, int],
    width: float,
    *,
    joint: str | None = "curve",
) -> None:
    draw = ImageDraw.Draw(layer)
    if isinstance(points, tuple):
        xy = tuple(sp(v) for v in points)
    else:
        xy = spoints(points)
    kwargs = {"fill": fill, "width": swidth(width)}
    if joint is not None:
        kwargs["joint"] = joint
    draw.line(xy, **kwargs)


def draw_glow_line(
    layer: Image.Image,
    points: list[tuple[float, float]] | tuple[float, float, float, float],
    color: tuple[int, int, int, int],
    highlight: tuple[int, int, int, int],
    width: float,
    *,
    glow_width: float = 7,
    blur: float = 1.5,
) -> None:
    glow = Image.new("RGBA", DRAW_SIZE, (0, 0, 0, 0))
    glow_color = (color[0], color[1], color[2], round(color[3] * 0.35))
    draw_line(glow, points, glow_color, width + glow_width)
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(sp(blur))))
    draw_line(layer, points, color, width)
    draw_line(layer, points, highlight, max(1.25, width * 0.35))


def draw_poly(layer: Image.Image, points: list[tuple[float, float]], fill: tuple[int, int, int, int]) -> None:
    ImageDraw.Draw(layer).polygon(spoints(points), fill=fill)


def draw_ellipse(
    layer: Image.Image,
    box: tuple[float, float, float, float],
    fill: tuple[int, int, int, int],
    *,
    outline: tuple[int, int, int, int] | None = None,
    width: float = 1,
) -> None:
    draw = ImageDraw.Draw(layer)
    draw.ellipse(sbox(box), fill=fill, outline=outline, width=swidth(width) if outline else 1)


def draw_rounded_rect(
    layer: Image.Image,
    box: tuple[float, float, float, float],
    radius: float,
    fill: tuple[int, int, int, int],
    *,
    outline: tuple[int, int, int, int] | None = None,
    width: float = 1,
) -> None:
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(sbox(box), radius=sp(radius), fill=fill, outline=outline, width=swidth(width) if outline else 1)


def curve_points(points: list[tuple[float, float]], steps: int = 32) -> list[tuple[float, float]]:
    if len(points) != 4:
        return points
    p0, p1, p2, p3 = points
    out: list[tuple[float, float]] = []
    for step in range(steps + 1):
        t = step / steps
        inv = 1 - t
        x = inv**3 * p0[0] + 3 * inv**2 * t * p1[0] + 3 * inv * t**2 * p2[0] + t**3 * p3[0]
        y = inv**3 * p0[1] + 3 * inv**2 * t * p1[1] + 3 * inv * t**2 * p2[1] + t**3 * p3[1]
        out.append((x, y))
    return out


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return alpha.getbbox()


def frame_delta(left: Image.Image, right: Image.Image) -> int:
    total = 0
    a = left.convert("RGBA").tobytes()
    b = right.convert("RGBA").tobytes()
    for index in range(0, min(len(a), len(b)), 4):
        total += abs(a[index + 3] - b[index + 3])
        total += abs(a[index] - b[index]) // 12
        total += abs(a[index + 1] - b[index + 1]) // 12
        total += abs(a[index + 2] - b[index + 2]) // 12
    return total


def fit_runtime(image: Image.Image, label: str) -> Image.Image:
    bbox = alpha_bbox(image)
    if bbox is None:
        raise ValueError(f"{label}: empty alpha")
    crop = image.crop(bbox)
    max_width = min(FRAME_WIDTH - MIN_PADDING * 2, math.floor(FRAME_WIDTH * MAX_OCCUPANCY))
    max_height = min(FRAME_HEIGHT - MIN_PADDING * 2, math.floor(FRAME_HEIGHT * MAX_OCCUPANCY))
    scale = min(1.0, max_width / crop.width, max_height / crop.height)
    if scale < 1.0:
        crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    x = round((FRAME_WIDTH - crop.width) / 2)
    y = FRAME_HEIGHT - MIN_PADDING - crop.height
    canvas.alpha_composite(crop, (x, y))
    return canvas


def downsample(layer: Image.Image) -> Image.Image:
    return layer.resize(FRAME_SIZE, Image.Resampling.LANCZOS)


def vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGBA", size, (0, 0, 0, 255))
    draw = ImageDraw.Draw(image)
    height = size[1]
    for y in range(height):
        t = y / max(1, height - 1)
        color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        draw.line((0, y, size[0], y), fill=(*color, 255))
    return image


def draw_spark(layer: Image.Image, x: float, y: float, radius: float, alpha: int = 170) -> None:
    draw_line(layer, (x - radius, y, x + radius, y), GOLD_LIGHT[:3] + (alpha,), 1)
    draw_line(layer, (x, y - radius, x, y + radius), GOLD_LIGHT[:3] + (alpha,), 1)


def draw_arrow(
    layer: Image.Image,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    alpha: int = 230,
    width: float = 3.0,
    glow: bool = True,
    feathers: bool = True,
) -> None:
    sx, sy = start
    ex, ey = end
    dx = ex - sx
    dy = ey - sy
    length = max(1.0, math.hypot(dx, dy))
    ux = dx / length
    uy = dy / length
    nx = -uy
    ny = ux
    shaft_color = (178, 94, 35, alpha)
    highlight = (255, 236, 138, min(255, alpha + 12))
    if glow:
        draw_glow_line(layer, [start, end], (255, 193, 52, round(alpha * 0.55)), highlight, width, glow_width=5, blur=1.0)
    else:
        draw_line(layer, [start, end], shaft_color, width)
        draw_line(layer, [start, end], highlight, max(1, width * 0.35))
    head_len = 10
    head_w = 5
    head = [
        (ex, ey),
        (ex - ux * head_len + nx * head_w, ey - uy * head_len + ny * head_w),
        (ex - ux * head_len - nx * head_w, ey - uy * head_len - ny * head_w),
    ]
    draw_poly(layer, head, (255, 219, 105, alpha))
    if feathers:
        tail = [
            (sx - ux * 1.5 + nx * 5, sy - uy * 1.5 + ny * 5),
            (sx + ux * 9, sy + uy * 9),
            (sx - ux * 1.5 - nx * 5, sy - uy * 1.5 - ny * 5),
        ]
        draw_poly(layer, tail, (92, 209, 105, min(220, alpha)))


def bow_points(grip: tuple[float, float], top_y: float, bottom_y: float, curve: float, lean: float) -> list[tuple[float, float]]:
    gx, gy = grip
    points: list[tuple[float, float]] = []
    for step in range(38):
        t = step / 37
        y = top_y * (1 - t) + bottom_y * t
        wave = math.sin(t * math.pi)
        x = gx + curve * wave + lean * (t - 0.5) - 3 * math.cos(t * math.pi)
        points.append((x, y))
    return points


def draw_bow(
    layer: Image.Image,
    grip: tuple[float, float],
    *,
    top_y: float,
    bottom_y: float,
    curve: float = 18,
    lean: float = 0,
    string_hand: tuple[float, float] | None = None,
    alpha: int = 255,
) -> tuple[tuple[float, float], tuple[float, float]]:
    points = bow_points(grip, top_y, bottom_y, curve, lean)
    top = points[0]
    bottom = points[-1]
    draw_line(layer, points, (83, 47, 24, alpha), 8)
    draw_line(layer, points, (217, 136, 40, alpha), 5.4)
    draw_line(layer, points, (255, 226, 108, alpha), 2.0)
    for t in (0.16, 0.5, 0.84):
        px, py = points[round(t * (len(points) - 1))]
        draw_ellipse(layer, (px - 4, py - 4, px + 4, py + 4), (42, 146, 78, min(240, alpha)), outline=GOLD_LIGHT, width=1)
    string_color = (244, 244, 210, min(230, alpha))
    if string_hand is None:
        draw_line(layer, [top, bottom], string_color, 1.25)
    else:
        draw_line(layer, [top, string_hand, bottom], string_color, 1.35)
    draw_ellipse(layer, (grip[0] - 5, grip[1] - 7, grip[0] + 5, grip[1] + 7), (91, 54, 26, alpha), outline=GOLD_LIGHT, width=1)
    return top, bottom


def draw_limb(
    layer: Image.Image,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    color: tuple[int, int, int, int],
    width: float = 9,
) -> None:
    draw_line(layer, [start, end], (23, 75, 47, color[3]), width + 3)
    draw_line(layer, [start, end], color, width)
    draw_line(layer, [start, end], (255, 224, 134, min(180, color[3])), max(1.4, width * 0.24))


def draw_banner(layer: Image.Image, x: float, y: float, angle: float, alpha: int = 130, scale: float = 1.0) -> None:
    length = 24 * scale
    dx = math.cos(angle) * length
    dy = math.sin(angle) * length
    draw_line(layer, (x, y, x + dx, y + dy), (105, 69, 25, alpha), 1.8 * scale)
    nx = -math.sin(angle)
    ny = math.cos(angle)
    p0 = (x + dx * 0.38, y + dy * 0.38)
    p1 = (p0[0] + nx * 13 * scale, p0[1] + ny * 13 * scale)
    p2 = (p0[0] + dx * 0.45 + nx * 7 * scale, p0[1] + dy * 0.45 + ny * 7 * scale)
    p3 = (p0[0] + dx * 0.44, p0[1] + dy * 0.44)
    draw_poly(layer, [p0, p1, p2, p3], (42, 150, 76, alpha))
    draw_line(layer, [p1, p2], (255, 226, 112, min(220, alpha + 30)), 1.2 * scale)


def draw_charge_ring(layer: Image.Image, center: tuple[float, float], radius: float, alpha: int, *, squash: float = 0.55) -> None:
    cx, cy = center
    glow = Image.new("RGBA", DRAW_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse(
        sbox((cx - radius, cy - radius * squash, cx + radius, cy + radius * squash)),
        outline=(255, 207, 70, round(alpha * 0.4)),
        width=swidth(5),
    )
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(sp(1.2))))
    ImageDraw.Draw(layer).ellipse(
        sbox((cx - radius, cy - radius * squash, cx + radius, cy + radius * squash)),
        outline=(255, 228, 115, alpha),
        width=swidth(2),
    )


def draw_arrow_gate(layer: Image.Image, frame_index: int, *, burst: bool) -> None:
    cx = 96
    cy = 137
    if burst:
        specs = [
            (-50, -72, 230),
            (-34, -88, 230),
            (-16, -94, 235),
            (0, -102, 245),
            (18, -94, 235),
            (36, -88, 230),
            (52, -72, 230),
            (-58, -36, 190),
            (58, -38, 190),
        ]
    else:
        specs = [(-36, -62, 160), (-14, -74, 170), (14, -74, 170), (36, -62, 160)]
    phase = frame_index * 0.7
    for index, (dx, dy, alpha) in enumerate(specs):
        start = (cx + math.sin(phase + index) * 6, cy + 8 + math.cos(phase + index) * 3)
        end = (cx + dx, cy + dy)
        draw_arrow(layer, start, end, alpha=alpha, width=2.2, glow=True, feathers=False)
    ring_radius = 42 if burst else 31
    draw_charge_ring(layer, (cx, cy - 19), ring_radius, 135 if burst else 96, squash=0.38)
    for index in range(3 if burst else 2):
        draw_banner(layer, cx - 34 + index * 34, cy - 26 - index * 3, -math.pi / 2 + (index - 1) * 0.22, alpha=130 if burst else 92, scale=0.78)


def draw_run_dust(layer: Image.Image, frame_index: int, body_dx: float) -> None:
    y = 191
    for index in range(3):
        x = 82 - body_dx * 0.4 - index * 14 + (frame_index % 2) * 5
        alpha = 95 - index * 22
        draw_ellipse(layer, (x - 6, y - 2 - index, x + 8, y + 4 + index), (181, 136, 72, alpha))


def draw_character(layer: Image.Image, pose: dict[str, float | tuple[float, float] | bool]) -> None:
    body_dx = float(pose.get("body_dx", 0))
    body_dy = float(pose.get("body_dy", 0))
    cape = float(pose.get("cape", 0))
    beard = float(pose.get("beard", 0))
    leg = float(pose.get("leg", 0))
    bow_grip = pose.get("bow_grip", (139.0, 128.0))
    string_hand = pose.get("string_hand", (105.0, 127.0))
    if not isinstance(bow_grip, tuple) or not isinstance(string_hand, tuple):
        raise TypeError("invalid pose bow coordinates")
    top_y = float(pose.get("bow_top", 69))
    bottom_y = float(pose.get("bow_bottom", 178))
    bow_curve = float(pose.get("bow_curve", 18))
    bow_lean = float(pose.get("bow_lean", 0))
    arrow_tip = pose.get("arrow_tip", (147.0, 124.0))
    arrow_ready = bool(pose.get("arrow_ready", True))

    cx = 94 + body_dx
    torso_y = 130 + body_dy
    head_cy = 97 + body_dy * 0.45

    # Back cape and scarf.
    draw_poly(
        layer,
        [
            (cx - 29, torso_y - 16),
            (cx - 48 - cape, torso_y + 42),
            (cx - 23 + cape * 0.3, torso_y + 62),
            (cx + 2, torso_y + 40),
            (cx + 33 + cape, torso_y + 61),
            (cx + 43 + cape * 0.4, torso_y + 14),
            (cx + 24, torso_y - 18),
        ],
        (15, 78, 47, 218),
    )
    draw_line(layer, [(cx - 32, torso_y - 8), (cx - 47 - cape, torso_y + 36), (cx - 26, torso_y + 59)], (85, 190, 96, 142), 2)
    draw_line(layer, [(cx + 22, torso_y - 10), (cx + 42 + cape, torso_y + 24), (cx + 31, torso_y + 56)], (255, 226, 112, 120), 2)

    # Bow sits behind the front hands but in front of the cape.
    draw_bow(
        layer,
        bow_grip,
        top_y=top_y,
        bottom_y=bottom_y,
        curve=bow_curve,
        lean=bow_lean,
        string_hand=string_hand,
    )

    # Legs and boots.
    left_foot = (cx - 13 - leg * 2.2, torso_y + 56 + abs(leg) * 0.4)
    right_foot = (cx + 15 + leg * 2.0, torso_y + 56 - abs(leg) * 0.25)
    draw_line(layer, [(cx - 8, torso_y + 30), left_foot], (37, 108, 67, 255), 8)
    draw_line(layer, [(cx + 9, torso_y + 29), right_foot], (37, 108, 67, 255), 8)
    draw_ellipse(layer, (left_foot[0] - 11, left_foot[1] - 4, left_foot[0] + 9, left_foot[1] + 6), (70, 42, 30, 255), outline=GOLD, width=1.2)
    draw_ellipse(layer, (right_foot[0] - 9, right_foot[1] - 4, right_foot[0] + 11, right_foot[1] + 6), (70, 42, 30, 255), outline=GOLD, width=1.2)

    # Torso armor.
    draw_rounded_rect(layer, (cx - 23, torso_y - 9, cx + 24, torso_y + 36), 10, SHU_GREEN, outline=GOLD, width=2)
    draw_poly(layer, [(cx - 19, torso_y + 27), (cx, torso_y + 48), (cx + 20, torso_y + 27), (cx + 12, torso_y + 55), (cx - 12, torso_y + 55)], (31, 121, 67, 255))
    for index in range(4):
        y = torso_y + index * 8 - 3
        draw_line(layer, [(cx - 15 + index * 2, y), (cx + 15 - index * 2, y)], (255, 219, 104, 185), 1.2)
    draw_ellipse(layer, (cx - 36, torso_y - 7, cx - 18, torso_y + 14), (38, 151, 75, 255), outline=GOLD, width=2)
    draw_ellipse(layer, (cx + 17, torso_y - 8, cx + 36, torso_y + 13), (38, 151, 75, 255), outline=GOLD, width=2)

    # Arms travel independently from body.
    left_shoulder = (cx - 23, torso_y + 3)
    right_shoulder = (cx + 24, torso_y + 2)
    draw_limb(layer, left_shoulder, string_hand, color=(35, 139, 77, 255), width=8.2)
    draw_limb(layer, right_shoulder, (bow_grip[0] - 3, bow_grip[1]), color=(35, 139, 77, 255), width=8.6)
    draw_ellipse(layer, (string_hand[0] - 5, string_hand[1] - 5, string_hand[0] + 5, string_hand[1] + 5), SKIN, outline=(104, 55, 30, 255), width=1)
    draw_ellipse(layer, (bow_grip[0] - 6, bow_grip[1] - 5, bow_grip[0] + 5, bow_grip[1] + 5), SKIN, outline=(104, 55, 30, 255), width=1)

    # Ready arrow lies on the drawn string.
    if arrow_ready and isinstance(arrow_tip, tuple):
        draw_arrow(layer, (string_hand[0] + 2, string_hand[1]), arrow_tip, alpha=232, width=2.4, glow=False, feathers=True)

    # Head, helm, old archer face.
    draw_ellipse(layer, (cx - 30, head_cy - 30, cx + 30, head_cy + 27), (72, 38, 24, 255))
    draw_ellipse(layer, (cx - 27, head_cy - 27, cx + 27, head_cy + 27), SKIN, outline=(112, 62, 36, 255), width=1.4)
    draw_poly(layer, [(cx - 27, head_cy - 18), (cx - 9, head_cy - 33), (cx + 11, head_cy - 33), (cx + 28, head_cy - 16), (cx + 16, head_cy - 23), (cx - 17, head_cy - 22)], (79, 48, 28, 255))
    draw_rounded_rect(layer, (cx - 25, head_cy - 32, cx + 25, head_cy - 17), 6, (41, 138, 75, 255), outline=GOLD, width=2)
    draw_poly(layer, [(cx - 5, head_cy - 37), (cx + 1, head_cy - 55), (cx + 8, head_cy - 36)], GOLD_LIGHT)
    draw_poly(layer, [(cx - 22, head_cy - 31), (cx - 34, head_cy - 43), (cx - 16, head_cy - 35)], GOLD)
    draw_poly(layer, [(cx + 22, head_cy - 31), (cx + 35, head_cy - 42), (cx + 16, head_cy - 35)], GOLD)
    draw_line(layer, [(cx + 2, head_cy - 43), (cx + 15, head_cy - 56), (cx + 28, head_cy - 49)], ICE_WHITE, 4)

    # Eyebrows, eyes, moustache, beard.
    draw_line(layer, [(cx - 18, head_cy - 5), (cx - 6, head_cy - 8)], WHITE, 3)
    draw_line(layer, [(cx + 7, head_cy - 8), (cx + 19, head_cy - 5)], WHITE, 3)
    draw_ellipse(layer, (cx - 19, head_cy - 2, cx - 7, head_cy + 11), (38, 25, 20, 255))
    draw_ellipse(layer, (cx + 7, head_cy - 2, cx + 19, head_cy + 11), (38, 25, 20, 255))
    draw_ellipse(layer, (cx - 14, head_cy + 1, cx - 10, head_cy + 5), (255, 244, 188, 255))
    draw_ellipse(layer, (cx + 12, head_cy + 1, cx + 16, head_cy + 5), (255, 244, 188, 255))
    draw_line(layer, [(cx - 16, head_cy + 16), (cx - 2 + beard, head_cy + 20)], WHITE, 5)
    draw_line(layer, [(cx + 16, head_cy + 16), (cx + 2 + beard, head_cy + 20)], WHITE, 5)
    draw_poly(layer, [(cx - 9, head_cy + 20), (cx + 10, head_cy + 20), (cx + 5 + beard, head_cy + 45), (cx - 6 + beard, head_cy + 45)], (235, 241, 230, 245))
    draw_line(layer, [(cx - 4, head_cy + 21), (cx - 1 + beard, head_cy + 42)], (202, 214, 201, 190), 1)
    draw_line(layer, [(cx + 5, head_cy + 21), (cx + 2 + beard, head_cy + 42)], (202, 214, 201, 190), 1)


def base_layer() -> Image.Image:
    return Image.new("RGBA", DRAW_SIZE, (0, 0, 0, 0))


def render_idle_frame(index: int) -> Image.Image:
    specs = [
        (0, 0, 0, 0, 106, 127, 139, 128, 0),
        (-1, -1, -2, 1, 102, 125, 138, 126, 1),
        (-2, -2, -4, 2, 98, 123, 138, 124, -1),
        (-1, -1, -1, 1.5, 101, 124, 139, 125, 1),
        (1, 0, 2, -1, 105, 126, 140, 127, -1),
        (0, 1, 3, -1.5, 108, 128, 140, 129, 0),
    ][index]
    body_dx, body_dy, cape, beard, hand_x, hand_y, grip_x, grip_y, leg = specs
    layer = base_layer()
    draw_charge_ring(layer, (126, 118), 19 + index % 3, 54 + index * 9, squash=0.5)
    draw_character(
        layer,
        {
            "body_dx": body_dx,
            "body_dy": body_dy,
            "cape": cape,
            "beard": beard,
            "leg": leg,
            "string_hand": (hand_x, hand_y),
            "bow_grip": (grip_x, grip_y),
            "bow_top": 67 + body_dy,
            "bow_bottom": 178 + body_dy,
            "bow_curve": 18 + math.sin(index) * 1.5,
            "arrow_tip": (148, 124 + body_dy),
            "arrow_ready": True,
        },
    )
    for spark_index in range(2):
        draw_spark(layer, 144 + spark_index * 7, 111 + math.sin(index + spark_index) * 8, 2.2, alpha=82)
    return fit_runtime(downsample(layer), f"idle {index + 1}")


def render_run_frame(index: int) -> Image.Image:
    specs = [
        (-6, 0, -4, -1, 112, 130, 134, 126, -1.6),
        (-12, -6, -8, 2, 115, 124, 131, 119, 2.4),
        (-5, -2, -3, 1, 110, 127, 136, 130, -0.8),
        (6, 0, 5, -2, 107, 131, 140, 130, 1.5),
        (12, -6, 8, 1.5, 104, 136, 143, 136, -2.3),
        (5, -2, 4, -1, 108, 130, 138, 129, 0.8),
    ][index]
    body_dx, body_dy, cape, beard, hand_x, hand_y, grip_x, grip_y, leg = specs
    layer = base_layer()
    draw_run_dust(layer, index, body_dx)
    draw_glow_line(layer, [(52, 159 + index % 2), (83, 151 - index % 2)], (255, 207, 90, 70), (255, 238, 150, 80), 2, glow_width=3, blur=0.8)
    draw_character(
        layer,
        {
            "body_dx": body_dx,
            "body_dy": body_dy,
            "cape": cape,
            "beard": beard,
            "leg": leg,
            "string_hand": (hand_x, hand_y),
            "bow_grip": (grip_x, grip_y),
            "bow_top": 69 + body_dy * 0.4,
            "bow_bottom": 178 + body_dy * 0.2,
            "bow_curve": 16 + (index % 2) * 4,
            "arrow_tip": (147, 126 + body_dy * 0.3),
            "arrow_ready": True,
        },
    )
    return fit_runtime(downsample(layer), f"run {index + 1}")


def draw_attack_effects(layer: Image.Image, index: int) -> None:
    if index == 1:
        draw_charge_ring(layer, (125, 119), 21, 112, squash=0.48)
    elif index == 2:
        draw_charge_ring(layer, (119, 117), 29, 160, squash=0.46)
        for spark in range(5):
            draw_spark(layer, 133 + math.cos(spark) * 12, 118 + math.sin(spark * 1.7) * 13, 2.4, alpha=132)
    elif index == 3:
        draw_arrow(layer, (105, 120), (164, 111), alpha=250, width=4.2, glow=True, feathers=True)
        draw_glow_line(layer, [(84, 132), (151, 119), (165, 114)], (255, 190, 40, 184), GOLD_LIGHT, 5.5, glow_width=9, blur=1.5)
        for offset in (-8, 7):
            draw_arrow(layer, (114, 123 + offset * 0.24), (158, 113 + offset), alpha=138, width=1.8, glow=True, feathers=False)
    elif index == 4:
        for lane, alpha in [(-13, 170), (0, 225), (13, 170)]:
            draw_arrow(layer, (93, 125 + lane * 0.2), (163, 113 + lane), alpha=alpha, width=2.8, glow=True, feathers=False)
        draw_banner(layer, 83, 130, -0.25, alpha=128, scale=0.65)
    elif index == 5:
        for lane, alpha in [(-9, 135), (5, 158), (17, 112)]:
            draw_arrow(layer, (91, 125 + lane * 0.15), (157, 116 + lane), alpha=alpha, width=2.1, glow=True, feathers=False)
        draw_charge_ring(layer, (111, 121), 26, 90, squash=0.42)
    elif index == 6:
        draw_glow_line(layer, [(100, 123), (143, 120), (155, 117)], (255, 202, 72, 90), GOLD_LIGHT, 2.4, glow_width=5, blur=1.0)
    elif index == 7:
        draw_charge_ring(layer, (128, 121), 18, 62, squash=0.48)


def render_attack_frame(index: int) -> Image.Image:
    specs = [
        (0, 0, -1, 0, 106, 127, 139, 128, 0, True, (148, 124)),
        (-2, -1, -3, 1, 96, 124, 139, 125, -1, True, (150, 122)),
        (-5, -2, -5, 2, 86, 121, 140, 123, -1.8, True, (151, 119)),
        (5, -3, 2, -1, 113, 124, 140, 124, 1.6, False, (151, 117)),
        (7, -2, 5, -1, 117, 127, 141, 127, 1.8, False, (151, 117)),
        (4, -1, 3, 1, 111, 128, 140, 129, 0.8, False, (148, 124)),
        (1, 0, 1, 0.5, 105, 127, 139, 128, 0.2, True, (147, 124)),
        (0, 0, 0, 0, 106, 127, 139, 128, 0, True, (148, 124)),
    ][index]
    body_dx, body_dy, cape, beard, hand_x, hand_y, grip_x, grip_y, leg, arrow_ready, arrow_tip = specs
    layer = base_layer()
    draw_attack_effects(layer, index)
    draw_character(
        layer,
        {
            "body_dx": body_dx,
            "body_dy": body_dy,
            "cape": cape,
            "beard": beard,
            "leg": leg,
            "string_hand": (hand_x, hand_y),
            "bow_grip": (grip_x, grip_y),
            "bow_top": 66 + body_dy,
            "bow_bottom": 179 + body_dy * 0.4,
            "bow_curve": 20 if index in (1, 2, 3) else 17,
            "bow_lean": -2 if index in (2, 3, 4) else 0,
            "arrow_tip": arrow_tip,
            "arrow_ready": arrow_ready,
        },
    )
    if index in (3, 4, 5):
        for spark in range(4):
            draw_spark(layer, 127 + spark * 7, 107 + math.sin(spark + index) * 8, 2.2, alpha=110)
    return fit_runtime(downsample(layer), f"attack {index + 1}")


def render_ultimate_frame(index: int) -> Image.Image:
    specs = [
        (0, 0, -1, 0, 104, 126, 139, 127, 0, False, True),
        (-2, -2, -4, 1, 94, 121, 139, 123, -1, False, True),
        (-4, -3, -6, 2, 86, 115, 140, 119, -1.5, True, True),
        (3, -5, 1, -1, 96, 112, 141, 116, 1.5, True, False),
        (6, -4, 4, -1, 108, 118, 141, 121, 1.2, True, False),
        (4, -2, 3, 0.5, 113, 124, 140, 126, 0.6, False, False),
        (1, -1, 2, 0.5, 108, 126, 139, 127, 0, False, True),
        (0, 0, 0, 0, 106, 127, 139, 128, 0, False, True),
    ][index]
    body_dx, body_dy, cape, beard, hand_x, hand_y, grip_x, grip_y, leg, burst, arrow_ready = specs
    layer = base_layer()
    if index >= 1:
        draw_arrow_gate(layer, index, burst=burst)
    if index in (2, 3, 4):
        for trail in range(5):
            y = 82 + trail * 11 + math.sin(index + trail) * 3
            draw_glow_line(layer, [(54, y + 24), (111, y - 5), (152, y - 22)], (255, 207, 73, 116), GOLD_LIGHT, 2.2, glow_width=5, blur=1.1)
    draw_character(
        layer,
        {
            "body_dx": body_dx,
            "body_dy": body_dy,
            "cape": cape,
            "beard": beard,
            "leg": leg,
            "string_hand": (hand_x, hand_y),
            "bow_grip": (grip_x, grip_y),
            "bow_top": 63 + body_dy,
            "bow_bottom": 178 + body_dy * 0.3,
            "bow_curve": 21 if index in (2, 3, 4) else 18,
            "bow_lean": -4 if index in (2, 3, 4) else 0,
            "arrow_tip": (151, 114 if index in (2, 3, 4) else 123),
            "arrow_ready": arrow_ready,
        },
    )
    if index in (3, 4):
        draw_arrow(layer, (82, 119), (162, 91), alpha=210, width=3.4, glow=True, feathers=False)
    if index == 5:
        draw_arrow(layer, (88, 128), (157, 108), alpha=142, width=2.6, glow=True, feathers=False)
    return fit_runtime(downsample(layer), f"ultimate {index + 1}")


def checker_tile(frame: Image.Image, label: str | None = None) -> Image.Image:
    tile = Image.new("RGBA", FRAME_SIZE, (36, 28, 36, 255))
    for y in range(0, FRAME_HEIGHT, 16):
        for x in range(0, FRAME_WIDTH, 16):
            if (x // 16 + y // 16) % 2 == 0:
                tile.alpha_composite(Image.new("RGBA", (16, 16), (48, 38, 48, 255)), (x, y))
    tile.alpha_composite(frame)
    if label:
        ImageDraw.Draw(tile).text((7, 7), label, fill=(255, 226, 142, 255))
    return tile


def write_preview(paths: list[Path], out_path: Path) -> None:
    sheet = Image.new("RGBA", (FRAME_WIDTH * len(paths), FRAME_HEIGHT), (28, 22, 30, 255))
    for index, path in enumerate(paths):
        frame = Image.open(path).convert("RGBA")
        sheet.alpha_composite(checker_tile(frame, f"{index + 1:02d}"), (index * FRAME_WIDTH, 0))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def write_frames(state: str, frames: list[Image.Image]) -> list[Path]:
    final_dir = CHARACTER_DIR / "anim" / state
    source_dir = SOURCE_DIR / state
    final_dir.mkdir(parents=True, exist_ok=True)
    source_dir.mkdir(parents=True, exist_ok=True)
    for path in final_dir.glob("*.png"):
        path.unlink()
    for path in source_dir.glob("*.png"):
        path.unlink()
    paths: list[Path] = []
    for index, frame in enumerate(frames, start=1):
        out_path = final_dir / f"{index:02d}.png"
        source_path = source_dir / f"{index:02d}.png"
        frame.save(out_path)
        frame.save(source_path)
        paths.append(out_path)
    write_preview(paths, source_dir / "preview.png")
    return paths


def write_legacy_attack(attack_paths: list[Path]) -> None:
    legacy_indices = [0, 2, 3, 5]
    frames: list[Image.Image] = []
    for output_index, source_index in enumerate(legacy_indices):
        frame = Image.open(attack_paths[source_index]).convert("RGBA")
        frame.save(CHARACTER_DIR / f"attack-{output_index}.png")
        frames.append(frame)
    strip = Image.new("RGBA", (FRAME_WIDTH * 4, FRAME_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_WIDTH, 0))
    strip.save(CHARACTER_DIR / "attack-strip.png")
    strip.save(WEB_OUTPUT_DIR / "huangzhong-attack-strip.png")


def write_card(battle_frame: Image.Image, ultimate_frame: Image.Image) -> Path:
    card = vertical_gradient((1024, 1024), (22, 76, 48), (12, 20, 24))
    overlay = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for radius, alpha in [(410, 44), (310, 50), (210, 64)]:
        draw.ellipse((512 - radius, 430 - radius, 512 + radius, 430 + radius), outline=(255, 213, 94, alpha), width=8)
    for index in range(12):
        angle = -math.pi * 0.86 + index * math.pi * 1.72 / 11
        start = (512, 510)
        end = (512 + math.cos(angle) * 430, 510 + math.sin(angle) * 430)
        draw.line((start[0], start[1], end[0], end[1]), fill=(255, 205, 72, 72), width=5)
    card.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(2)))

    # Large opaque card composition keeps the runtime costume and weapon.
    hero = ultimate_frame if alpha_bbox(ultimate_frame) else battle_frame
    hero_big = hero.resize((720, 840), Image.Resampling.LANCZOS)
    glow = Image.new("RGBA", hero_big.size, (255, 216, 86, 0))
    glow_alpha = hero_big.getchannel("A").filter(ImageFilter.GaussianBlur(24)).point(lambda value: min(150, round(value * 0.55)))
    glow.putalpha(glow_alpha)
    card.alpha_composite(glow, (152, 126))
    card.alpha_composite(hero_big, (152, 126))

    # Foreground arrow lanes, no text.
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    fgd = ImageDraw.Draw(fg)
    for lane in range(5):
        y = 610 + lane * 42
        fgd.line((210, y + 90, 870, y - 112), fill=(255, 212, 86, 72), width=7)
        fgd.polygon([(870, y - 112), (827, y - 90), (842, y - 126)], fill=(255, 230, 120, 90))
    card.alpha_composite(fg)
    out_path = CHARACTER_DIR / "card.png"
    card.convert("RGB").save(out_path)
    card.save(WEB_OUTPUT_DIR / "huangzhong-card-preview.png")
    return out_path


def audit_frames(generated: dict[str, list[Path]]) -> dict[str, object]:
    report: dict[str, object] = {"hero": HERO_ID, "states": {}, "passed": True}
    all_issues: list[str] = []
    for state, paths in generated.items():
        frames = [Image.open(path).convert("RGBA") for path in paths]
        state_report = {"count": len(frames), "frames": [], "deltas": []}
        for index, frame in enumerate(frames, start=1):
            bbox = alpha_bbox(frame)
            if frame.size != FRAME_SIZE:
                all_issues.append(f"{state}/{index:02d}: size {frame.size}")
                continue
            if bbox is None:
                all_issues.append(f"{state}/{index:02d}: empty alpha")
                continue
            left, top, right, bottom = bbox
            padding = min(left, top, FRAME_WIDTH - right, FRAME_HEIGHT - bottom)
            width_ratio = (right - left) / FRAME_WIDTH
            height_ratio = (bottom - top) / FRAME_HEIGHT
            if padding < 8:
                all_issues.append(f"{state}/{index:02d}: padding {padding}")
            if width_ratio > MAX_OCCUPANCY or height_ratio > MAX_OCCUPANCY:
                all_issues.append(f"{state}/{index:02d}: occupancy {width_ratio:.3f}x{height_ratio:.3f}")
            state_report["frames"].append(
                {
                    "frame": f"{index:02d}",
                    "bbox": [left, top, right, bottom],
                    "padding": padding,
                    "occupancy": [round(width_ratio, 3), round(height_ratio, 3)],
                }
            )
        if len(frames) > 1:
            deltas = [frame_delta(a, b) for a, b in zip(frames, frames[1:])]
            state_report["deltas"] = deltas
            if min(deltas) < 18000:
                all_issues.append(f"{state}: weak motion delta {min(deltas)}")
        report["states"][state] = state_report
    report["issues"] = all_issues
    report["passed"] = not all_issues
    out_path = WORK_DIR / "asset-audit.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    if all_issues:
        raise ValueError("asset audit failed:\n" + "\n".join(all_issues))
    return report


def write_contact_sheet(generated: dict[str, list[Path]]) -> Path:
    rows = [("idle", generated["idle"]), ("run", generated["run"]), ("attack", generated["attack"]), ("ultimate", generated["ultimate"])]
    label_w = 120
    max_count = max(len(paths) for _, paths in rows)
    sheet = Image.new("RGBA", (label_w + FRAME_WIDTH * max_count, FRAME_HEIGHT * len(rows)), (24, 18, 24, 255))
    draw = ImageDraw.Draw(sheet)
    for row_index, (label, paths) in enumerate(rows):
        y = row_index * FRAME_HEIGHT
        draw.rectangle((0, y, label_w, y + FRAME_HEIGHT), fill=(31, 43, 34, 255))
        draw.text((12, y + 16), label, fill=(255, 226, 142, 255))
        for index, path in enumerate(paths):
            tile = checker_tile(Image.open(path).convert("RGBA"), f"{index + 1:02d}")
            sheet.alpha_composite(tile, (label_w + index * FRAME_WIDTH, y))
    out_path = WEB_OUTPUT_DIR / "huangzhong-contact-sheet.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    return out_path


def write_motion_brief() -> Path:
    text = """# Huang Zhong Motion Brief

Character: huangzhong / 黃忠
Weapon: Shu elder sniper with a Dynasty-Warriors-inspired oversized war bow; tall curved golden bow, visible string, no stock, no crossbow limbs.
Existing similar warriors to avoid: Taishi Ci archer silhouette, Sun Shangxiang twin crossbows, Zhuge Liang staff/fan caster language.
Idle identity: bow already half drawn, beard and cape breathe, arrow nocked but not fired.
Run identity: side-on bow carry with bow arm bobbing high/low, robe and cape trailing behind the sprint.
Normal attack: 8 frames; frame 2-3 draw string back, frame 4 releases the main gold arrow, frame 5-6 leave consecutive arrow shadows, frame 7-8 recover.
Ultimate/Musou: 8 frames; Wan Jian Chuan Yun arrow gate opens behind him, frame 3-5 burst into a golden arrow array and old-general banner marks.
Effect grammar: narrow golden arrow tracks, compressed cloud-piercing lanes, small green command flags, no fire-feather fan and no crossbow fan spread.
Frame counts: idle 6, run 6, attack 8, ultimate 8.
Safe-box target: visible alpha <= 0.67 of 192x224, roughly 128x150.
Padding target: >= 8px hard minimum, generator targets 10px.
Independent limb/weapon movement: string hand, bow grip, bow curve, cape, beard, legs, arrow origin and projectile lanes all move per state.
Validation notes: generated via scripts/source/character-anims/huangzhong/generate_huangzhong_assets.py and audited by the skill audit script.
"""
    path = WORK_DIR / "motion-brief.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def write_integration_md(report: dict[str, object], contact_sheet: Path) -> Path:
    text = f"""# Huang Zhong Integration Memo

This worker only generated candidate assets and did not edit shared registry/runtime files.

## Generated Assets

- `public/assets/characters/huangzhong/card.png`
- `public/assets/characters/huangzhong/battle-idle.png`
- `public/assets/characters/huangzhong/attack-0.png` through `attack-3.png`
- `public/assets/characters/huangzhong/attack-strip.png`
- `public/assets/characters/huangzhong/anim/idle/01.png` through `06.png`
- `public/assets/characters/huangzhong/anim/run/01.png` through `06.png`
- `public/assets/characters/huangzhong/anim/attack/01.png` through `08.png`
- `public/assets/characters/huangzhong/anim/ultimate/01.png` through `08.png`
- `scripts/source/character-anims/huangzhong/generate_huangzhong_assets.py`
- `output/web-game/huangzhong-contact-sheet.png`
- `output/web-game/huangzhong-attack-strip.png`
- `output/web-game/huangzhong-card-preview.png`
- `output/agent-work/huangzhong/motion-brief.md`
- `output/agent-work/huangzhong/asset-audit.json`

Preview contact sheet: `{contact_sheet.relative_to(ROOT).as_posix()}`

## Audit

Internal generator audit passed: `{report["passed"]}`.
External command to rerun:

```powershell
python C:\\Users\\Boss\\.codex\\skills\\lbs-warrior-asset-pipeline\\scripts\\audit_lbs_character_motion.py --repo . --heroes huangzhong --states idle=6 run=6 attack=8 ultimate=8 --min-padding 8 --max-occupancy 0.67
```

## Shared Integration Snippets

Do not apply these from this worker if the main integration agent is coordinating shared files.

### `src/game/types.ts`

```ts
export type HeroId =
  | "liubei"
  | "guanyu"
  | "zhangfei"
  | "zhaoyun"
  | "machao"
  | "zhugeliang"
  | "huangzhong"
  // existing ids...
```

### `src/game/assets/manifest.ts`

```ts
const heroTextureIds = [
  "liubei",
  "guanyu",
  "zhangfei",
  "zhaoyun",
  "machao",
  "zhugeliang",
  "huangzhong",
  // existing ids...
] as const;
```

### `src/game/content/heroes.ts`

```ts
createHero({{
  id: "huangzhong",
  factionId: "shu",
  name: "黃忠",
  title: "定軍神射",
  role: "遠程狙擊",
  passiveName: "老當益壯",
  passiveText: "遠程箭矢穿透力高，距離越遠越能穩定削弱精英。",
  baseStats: {{ maxHp: 122, moveSpeed: 226, armor: 2, pickupRadius: 112 }},
  autoAbility: {{
    name: "穿雲老弓",
    description: "以大型戰弓射出高穿透金箭，優先狙擊前方長線敵軍。",
    cooldown: 0.92,
    range: 620,
    radius: 20,
    damage: 22,
    damageTags: ["arrow", "pierce"],
    vfxKey: "huangzhong_golden_arrow",
    effectId: "fan_bolts"
  }},
  manualAbility: {{
    name: "定軍狙射",
    description: "蓄力射出破空金箭，沿直線貫穿高威脅目標。",
    cooldown: 7.1,
    range: 720,
    radius: 32,
    damage: 58,
    damageTags: ["arrow", "pierce", "command"],
    vfxKey: "huangzhong_cloud_piercer",
    effectId: "phoenix_feathers"
  }}
}})
```

### `src/game/content/characterArt.ts`

```ts
createPlayableArt({{
  id: "huangzhong",
  assetId: "huangzhong",
  factionId: "shu",
  name: "黃忠",
  title: "定軍神射",
  rarityLabel: "SSR",
  stars: 5,
  role: "遠程狙擊",
  quote: "弓弦一響，雲外亦穿。",
  biography: "蜀陣營老將神射。以大型戰弓蓄力狙擊，金色箭軌與軍旗紋構成遠程壓制節奏。",
  bondIds: ["taoyuan"],
  palette: {{ primary: "#2fbd66", secondary: "#153b26", accent: "#ffd36a" }},
  animationFrameCounts: {{ idle: 6, run: 6, attack: 8, ultimate: 8 }}
}})
```

If `animationFrameCounts` currently defaults ultimate to 8, including `ultimate: 8` is optional.

### `src/game/content/ultimates.ts`

```ts
// ultimateBaseProfiles
{{
  heroId: "huangzhong",
  name: "萬箭穿雲",
  duration: 7.8,
  pulseEvery: 1.05,
  vfxKey: "huangzhong_arrow_gate",
  empoweredUnlockId: masteryUnlockId("huangzhong"),
  autoCooldownScale: 0.78,
  pulseAbility: ultimateAbility(
    "huangzhong",
    "huangzhong_ultimate_pulse",
    "穿雲連矢",
    660,
    28,
    28,
    ["arrow", "pierce", "command"],
    "huangzhong_arrow_gate",
    "fan_bolts"
  ),
  alternatePulseAbility: ultimateAbility(
    "huangzhong",
    "huangzhong_ultimate_arrow_rain",
    "老將箭陣",
    560,
    92,
    36,
    ["arrow", "pierce", "command"],
    "huangzhong_musou_arrowstorm",
    "arrow_rain"
  )
}}

// ultimateEnhancements
huangzhong: {{
  presentation: presentation("huangzhong_musou_arrowstorm", "huangzhong_musou_arrowstorm", "萬箭穿雲"),
  finisherVfxKey: "huangzhong_musou_arrowstorm",
  finisherAbility: ultimateAbility(
    "huangzhong",
    "huangzhong_ultimate_finisher",
    "萬箭穿雲",
    760,
    48,
    46,
    ["arrow", "pierce", "command"],
    "huangzhong_musou_arrowstorm",
    "arrow_rain"
  )
}}
```

### VFX registry note

The snippets above propose new VFX keys. The main agent can either map them to existing `crossbow_fan` / `arrow_rain` profiles initially, or add dedicated `huangzhong_*` profiles with gold arrow color `0xffd36a`, `presentationKind: "rangedProjectile"` for normal shots, and `presentationKind: "rain"` for the ultimate.
"""
    path = WORK_DIR / "integration.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def sync_work_copy() -> None:
    # Keep a copy of the generator under agent work for handoff readers.
    target = WORK_DIR / "generate_huangzhong_assets.py"
    shutil.copyfile(Path(__file__), target)


def main() -> None:
    CHARACTER_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    WEB_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    idle = [render_idle_frame(index) for index in range(6)]
    run = [render_run_frame(index) for index in range(6)]
    attack = [render_attack_frame(index) for index in range(8)]
    ultimate = [render_ultimate_frame(index) for index in range(8)]

    generated = {
        "idle": write_frames("idle", idle),
        "run": write_frames("run", run),
        "attack": write_frames("attack", attack),
        "ultimate": write_frames("ultimate", ultimate),
    }
    idle[0].save(CHARACTER_DIR / "battle-idle.png")
    write_legacy_attack(generated["attack"])
    write_card(idle[0], ultimate[3])

    contact_sheet = write_contact_sheet(generated)
    report = audit_frames(generated)
    write_motion_brief()
    integration = write_integration_md(report, contact_sheet)
    sync_work_copy()

    print(f"generated {HERO_ID} assets")
    print(f"contact sheet: {contact_sheet}")
    print(f"integration memo: {integration}")


if __name__ == "__main__":
    main()
