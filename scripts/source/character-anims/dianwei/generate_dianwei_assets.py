#!/usr/bin/env python3
"""Generate candidate Dian Wei character assets.

The output is intentionally scoped to the Dian Wei-owned asset and work
directories so multiple agents can integrate roster metadata separately.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[4]
CHARACTER_DIR = ROOT / "public" / "assets" / "characters" / "dianwei"
ANIM_DIR = CHARACTER_DIR / "anim"
WORK_DIR = ROOT / "output" / "agent-work" / "dianwei"
WEB_DIR = ROOT / "output" / "web-game"

W = 192
H = 224
S = 4
SAFE_W = 128
SAFE_H = 149
PAD = 8
ALPHA_THRESHOLD = 8


def sc(value: float) -> int:
    return round(value * S)


def pts(values: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(sc(x), sc(y)) for x, y in values]


def box(values: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    left, top, right, bottom = values
    return (sc(left), sc(top), sc(right), sc(bottom))


def rgba(color: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return color


class Layer:
    def __init__(self, image: Image.Image):
        self.image = image
        self.draw = ImageDraw.Draw(image, "RGBA")

    def line(self, values: list[tuple[float, float]], fill: tuple[int, int, int, int], width: float) -> None:
        self.draw.line(pts(values), fill=rgba(fill), width=max(1, sc(width)), joint="curve")

    def polygon(self, values: list[tuple[float, float]], fill: tuple[int, int, int, int]) -> None:
        self.draw.polygon(pts(values), fill=rgba(fill))

    def ellipse(self, values: tuple[float, float, float, float], fill: tuple[int, int, int, int]) -> None:
        self.draw.ellipse(box(values), fill=rgba(fill))

    def rectangle(self, values: tuple[float, float, float, float], fill: tuple[int, int, int, int]) -> None:
        self.draw.rectangle(box(values), fill=rgba(fill))


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return alpha.getbbox()


def fit_to_safe_box(image: Image.Image, *, bias_x: float = 0, target_bottom: int = 197) -> Image.Image:
    bbox = alpha_bbox(image)
    if bbox is None:
        return image

    crop = image.crop(bbox)
    width, height = crop.size
    scale = min(1.0, SAFE_W / width, SAFE_H / height)
    if scale < 1.0:
        crop = crop.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.LANCZOS)
        width, height = crop.size

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    x = round(W / 2 + bias_x - width / 2)
    y = round(target_bottom - height)
    x = max(PAD, min(W - PAD - width, x))
    y = max(PAD, min(H - PAD - height, y))
    canvas.alpha_composite(crop, (x, y))
    return canvas


def downsample(raw: Image.Image, *, bias_x: float = 0) -> Image.Image:
    frame = raw.resize((W, H), Image.Resampling.LANCZOS)
    return fit_to_safe_box(frame, bias_x=bias_x)


def draw_glow_line(
    image: Image.Image,
    values: list[tuple[float, float]],
    *,
    color: tuple[int, int, int, int],
    core: tuple[int, int, int, int],
    width: float,
    blur: float = 2.0,
) -> None:
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gd = Layer(glow)
    gd.line(values, color, width + 5)
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(sc(blur))))
    ld = Layer(image)
    ld.line(values, color, width)
    ld.line(values, core, max(1.3, width * 0.35))


def bezier(points: list[tuple[float, float]], steps: int = 32) -> list[tuple[float, float]]:
    p0, p1, p2, p3 = points
    curve: list[tuple[float, float]] = []
    for step in range(steps + 1):
        t = step / steps
        inv = 1 - t
        x = inv**3 * p0[0] + 3 * inv**2 * t * p1[0] + 3 * inv * t**2 * p2[0] + t**3 * p3[0]
        y = inv**3 * p0[1] + 3 * inv**2 * t * p1[1] + 3 * inv * t**2 * p2[1] + t**3 * p3[1]
        curve.append((x, y))
    return curve


def arc_points(center: tuple[float, float], radius: tuple[float, float], start: float, end: float, steps: int = 34) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for step in range(steps + 1):
        t = step / steps
        deg = math.radians(start + (end - start) * t)
        points.append((center[0] + math.cos(deg) * radius[0], center[1] + math.sin(deg) * radius[1]))
    return points


def draw_weapon(
    layer: Layer,
    hand: tuple[float, float],
    angle: float,
    *,
    length: float = 45,
    heavy: float = 1.0,
    alpha: int = 255,
) -> None:
    rad = math.radians(angle)
    dx, dy = math.cos(rad), math.sin(rad)
    px, py = -dy, dx
    butt = (hand[0] - dx * 8, hand[1] - dy * 8)
    tip = (hand[0] + dx * length, hand[1] + dy * length)
    neck = (hand[0] + dx * (length - 11), hand[1] + dy * (length - 11))

    layer.line([butt, tip], (18, 22, 30, 230), 8.0)
    layer.line([butt, tip], (108, 80, 47, alpha), 5.0)
    layer.line([butt, tip], (225, 174, 82, round(alpha * 0.65)), 1.6)
    layer.ellipse((hand[0] - 5, hand[1] - 5, hand[0] + 5, hand[1] + 5), (238, 182, 77, alpha))
    layer.ellipse((butt[0] - 4, butt[1] - 4, butt[0] + 4, butt[1] + 4), (40, 46, 58, alpha))

    blade_a = [
        (neck[0] + px * 3, neck[1] + py * 3),
        (tip[0] + dx * 6 + px * 7, tip[1] + dy * 6 + py * 7),
        (tip[0] + px * 17 * heavy, tip[1] + py * 17 * heavy),
        (neck[0] - dx * 6 + px * 10 * heavy, neck[1] - dy * 6 + py * 10 * heavy),
    ]
    blade_b = [
        (neck[0] - px * 3, neck[1] - py * 3),
        (tip[0] + dx * 6 - px * 7, tip[1] + dy * 6 - py * 7),
        (tip[0] - px * 17 * heavy, tip[1] - py * 17 * heavy),
        (neck[0] - dx * 6 - px * 10 * heavy, neck[1] - dy * 6 - py * 10 * heavy),
    ]
    spike = [
        (tip[0] + dx * 13, tip[1] + dy * 13),
        (tip[0] - dx * 4 + px * 4, tip[1] - dy * 4 + py * 4),
        (tip[0] - dx * 4 - px * 4, tip[1] - dy * 4 - py * 4),
    ]
    for blade in (blade_a, blade_b, spike):
        outline = []
        cx = sum(x for x, _ in blade) / len(blade)
        cy = sum(y for _, y in blade) / len(blade)
        for x, y in blade:
            outline.append((cx + (x - cx) * 1.1, cy + (y - cy) * 1.1))
        layer.polygon(outline, (11, 16, 25, 230))
        layer.polygon(blade, (70, 94, 122, alpha))
    layer.line([neck, (tip[0] + dx * 10, tip[1] + dy * 10)], (214, 232, 247, round(alpha * 0.9)), 1.6)
    layer.line([(tip[0] + px * 13 * heavy, tip[1] + py * 13 * heavy), (tip[0] + dx * 6 + px * 5, tip[1] + dy * 6 + py * 5)], (30, 55, 94, alpha), 1.2)
    layer.line([(tip[0] - px * 13 * heavy, tip[1] - py * 13 * heavy), (tip[0] + dx * 6 - px * 5, tip[1] + dy * 6 - py * 5)], (30, 55, 94, alpha), 1.2)


def draw_rocks(layer: Layer, cx: float, cy: float, phase: float, alpha: int) -> None:
    offsets = [(-39, -4), (-25, 5), (26, 4), (40, -6), (-9, -8), (10, -7)]
    for index, (ox, oy) in enumerate(offsets):
        lift = math.sin(phase + index * 1.7) * 4
        x = cx + ox
        y = cy + oy + lift
        size = 3 + (index % 3)
        layer.polygon(
            [(x - size, y + 1), (x + size * 0.6, y - size), (x + size, y + size * 0.8), (x - size * 0.4, y + size)],
            (42, 50, 62, alpha),
        )
        layer.line([(x - size, y + 1), (x + size * 0.6, y - size)], (123, 154, 194, round(alpha * 0.8)), 1)


def draw_effects(raw: Image.Image, pose: dict[str, object], front: bool = False) -> None:
    effect = pose.get("effect")
    if effect is None:
        return

    phase = float(pose.get("phase", 0.0))
    side = float(pose.get("side", 1.0))
    blue = (25, 82, 156, 122)
    core = (160, 224, 255, 170)

    if effect == "idle_glint" and front:
        layer = Layer(raw)
        for x, y in [(71, 88), (121, 88), (98, 83)]:
            span = 4 + math.sin(phase + x) * 1.5
            layer.line([(x - span, y), (x + span, y)], (118, 198, 255, 130), 1.2)
            layer.line([(x, y - span), (x, y + span)], (221, 238, 255, 150), 0.8)
    elif effect == "run_streak" and not front:
        for row in range(3):
            y = 144 + row * 11 + math.sin(phase + row) * 2
            points = [(61 - row * 8, y), (87 - row * 5, y - 4), (107, y - 1)]
            draw_glow_line(raw, points, color=(31, 78, 143, 72), core=(156, 214, 255, 92), width=2.0, blur=1.1)
    elif effect == "left_cut" and front:
        curve = arc_points((94, 120), (48, 41), 212, 310, 34)
        draw_glow_line(raw, curve, color=(19, 80, 163, 132), core=(175, 225, 255, 188), width=5.3, blur=1.5)
        layer = Layer(raw)
        layer.line([(69, 151), (110, 131), (135, 100)], (15, 32, 60, 120), 2.0)
    elif effect == "right_cut" and front:
        curve = arc_points((98, 119), (48, 40), 230, 126, 34)
        draw_glow_line(raw, curve, color=(22, 77, 145, 136), core=(183, 235, 255, 188), width=5.0, blur=1.5)
        layer = Layer(raw)
        layer.line([(123, 151), (87, 128), (55, 102)], (15, 32, 60, 120), 2.0)
    elif effect == "cross_cut" and front:
        curve_a = arc_points((95, 119), (50, 38), 215, 307, 32)
        curve_b = arc_points((99, 121), (49, 37), 229, 132, 32)
        draw_glow_line(raw, curve_a, color=(19, 80, 163, 130), core=(177, 227, 255, 185), width=4.5, blur=1.4)
        draw_glow_line(raw, curve_b, color=(16, 58, 124, 115), core=(136, 205, 255, 160), width=3.8, blur=1.2)
    elif effect == "ground_crack" and front:
        layer = Layer(raw)
        base_y = 172
        layer.line([(58, base_y), (82, base_y + 3), (100, base_y + 1), (135, base_y + 4)], (21, 31, 47, 170), 2.0)
        layer.line([(79, base_y + 3), (70, base_y + 11)], (21, 31, 47, 150), 1.4)
        layer.line([(111, base_y + 2), (122, base_y + 13)], (21, 31, 47, 150), 1.4)
        draw_glow_line(raw, arc_points((96, 170), (45, 12), 194, 346, 30), color=(16, 61, 132, 112), core=(145, 215, 255, 156), width=3.0, blur=1.4)
    elif effect == "ultimate_charge" and not front:
        curve = arc_points((96, 122), (42, 46), 245, 485, 48)
        draw_glow_line(raw, curve, color=(12, 51, 120, 105), core=(101, 184, 255, 148), width=3.8, blur=1.8)
    elif effect == "ultimate_impact" and front:
        layer = Layer(raw)
        draw_glow_line(raw, arc_points((96, 169), (55, 16), 188, 352, 42), color=(8, 57, 137, 150), core=(147, 216, 255, 205), width=5.2, blur=1.8)
        draw_glow_line(raw, arc_points((96, 163), (39, 10), 192, 348, 36), color=(7, 32, 80, 112), core=(111, 180, 255, 180), width=3.4, blur=1.2)
        for crack in [
            [(96, 160), (82, 172), (72, 183)],
            [(96, 160), (110, 173), (122, 184)],
            [(91, 164), (58, 168), (48, 177)],
            [(101, 164), (132, 168), (143, 177)],
        ]:
            layer.line(crack, (15, 23, 36, 178), 2.0)
            layer.line(crack[:2], (74, 132, 208, 105), 0.9)
        draw_rocks(layer, 96, 168, phase, 210)
    elif effect == "ultimate_residue" and front:
        draw_glow_line(raw, arc_points((96, 170), (49, 13), 198, 342, 30), color=(12, 54, 123, 95), core=(141, 210, 255, 138), width=3.0, blur=1.2)
        layer = Layer(raw)
        draw_rocks(layer, 96, 172, phase + 1.7, 120)


def draw_dianwei_raw(pose: dict[str, object]) -> Image.Image:
    raw = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    back = Image.new("RGBA", raw.size, (0, 0, 0, 0))
    draw_effects(back, pose, front=False)
    raw.alpha_composite(back)

    layer = Layer(raw)
    dx = float(pose.get("dx", 0.0))
    dy = float(pose.get("dy", 0.0))
    crouch = float(pose.get("crouch", 0.0))
    cape = float(pose.get("cape", 0.0))
    head_shift = float(pose.get("head_shift", 0.0))
    shoulder = float(pose.get("shoulder", 0.0))

    # Anchor shadow.
    layer.ellipse((64 + dx, 187 + dy, 129 + dx, 199 + dy), (0, 0, 0, 55))

    # Cape sits behind armor and gives the Wei guard silhouette.
    layer.polygon(
        [
            (71 + dx, 91 + dy),
            (122 + dx, 92 + dy),
            (130 + dx + cape, 174 + dy),
            (105 + dx + cape * 0.25, 190 + dy),
            (66 + dx - cape * 0.45, 176 + dy),
        ],
        (17, 27, 55, 210),
    )
    layer.polygon(
        [(76 + dx, 100 + dy), (88 + dx, 184 + dy), (68 + dx - cape * 0.25, 176 + dy)],
        (47, 28, 39, 145),
    )
    layer.line([(122 + dx, 96 + dy), (127 + dx + cape, 169 + dy), (108 + dx + cape * 0.15, 187 + dy)], (65, 95, 148, 115), 2.0)

    # Boots and low guard stance.
    leg_y = 145 + dy + crouch
    layer.polygon([(82 + dx, leg_y), (94 + dx, leg_y), (91 + dx, 180 + dy), (75 + dx, 180 + dy)], (28, 38, 60, 245))
    layer.polygon([(101 + dx, leg_y), (115 + dx, leg_y), (120 + dx, 180 + dy), (103 + dx, 181 + dy)], (25, 35, 57, 245))
    layer.polygon([(72 + dx, 178 + dy), (93 + dx, 177 + dy), (98 + dx, 185 + dy), (75 + dx, 188 + dy)], (13, 17, 24, 245))
    layer.polygon([(101 + dx, 178 + dy), (124 + dx, 177 + dy), (130 + dx, 185 + dy), (106 + dx, 188 + dy)], (13, 17, 24, 245))
    layer.line([(79 + dx, leg_y + 4), (89 + dx, 178 + dy)], (203, 155, 78, 210), 2.0)
    layer.line([(108 + dx, leg_y + 4), (118 + dx, 178 + dy)], (203, 155, 78, 210), 2.0)

    # Torso armor.
    layer.polygon([(75 + dx, 101 + dy), (117 + dx, 100 + dy), (127 + dx, 142 + dy), (109 + dx, 158 + dy), (83 + dx, 157 + dy), (66 + dx, 141 + dy)], (15, 22, 39, 245))
    layer.polygon([(81 + dx, 106 + dy), (112 + dx, 105 + dy), (119 + dx, 139 + dy), (105 + dx, 150 + dy), (88 + dx, 151 + dy), (74 + dx, 139 + dy)], (32, 63, 112, 246))
    layer.line([(80 + dx, 109 + dy), (94 + dx, 150 + dy), (111 + dx, 107 + dy)], (220, 166, 72, 230), 2.0)
    layer.rectangle((75 + dx, 139 + dy, 118 + dx, 147 + dy), (121, 76, 43, 240))
    layer.line([(75 + dx, 139 + dy), (118 + dx, 139 + dy)], (242, 189, 91, 235), 2.2)
    layer.ellipse((90 + dx, 134 + dy, 103 + dx, 148 + dy), (226, 168, 74, 242))

    # Shoulders.
    layer.ellipse((56 + dx, 99 + dy + shoulder, 82 + dx, 126 + dy + shoulder), (17, 22, 31, 235))
    layer.ellipse((110 + dx, 99 + dy - shoulder, 136 + dx, 126 + dy - shoulder), (17, 22, 31, 235))
    layer.ellipse((59 + dx, 101 + dy + shoulder, 80 + dx, 122 + dy + shoulder), (177, 128, 58, 245))
    layer.ellipse((112 + dx, 101 + dy - shoulder, 133 + dx, 122 + dy - shoulder), (177, 128, 58, 245))
    layer.line([(60 + dx, 113 + dy + shoulder), (78 + dx, 104 + dy + shoulder)], (245, 193, 93, 220), 1.6)
    layer.line([(114 + dx, 104 + dy - shoulder), (132 + dx, 113 + dy - shoulder)], (245, 193, 93, 220), 1.6)

    left_hand = tuple(float(v) for v in pose.get("left_hand", (66 + dx, 125 + dy)))  # type: ignore[arg-type]
    right_hand = tuple(float(v) for v in pose.get("right_hand", (126 + dx, 125 + dy)))  # type: ignore[arg-type]

    # Arm travel is drawn independently from weapon travel.
    left_shoulder = (68 + dx, 114 + dy + shoulder)
    right_shoulder = (124 + dx, 114 + dy - shoulder)
    layer.line([left_shoulder, ((left_shoulder[0] + left_hand[0]) / 2 - 3, (left_shoulder[1] + left_hand[1]) / 2), left_hand], (16, 20, 30, 245), 11.0)
    layer.line([right_shoulder, ((right_shoulder[0] + right_hand[0]) / 2 + 3, (right_shoulder[1] + right_hand[1]) / 2), right_hand], (16, 20, 30, 245), 11.0)
    layer.line([left_shoulder, left_hand], (44, 69, 111, 245), 7.0)
    layer.line([right_shoulder, right_hand], (44, 69, 111, 245), 7.0)

    draw_weapon(layer, left_hand, float(pose.get("left_angle", -55.0)), length=float(pose.get("left_len", 45.0)), heavy=float(pose.get("left_heavy", 1.0)))
    draw_weapon(layer, right_hand, float(pose.get("right_angle", -125.0)), length=float(pose.get("right_len", 45.0)), heavy=float(pose.get("right_heavy", 1.0)))
    layer.ellipse((left_hand[0] - 5, left_hand[1] - 5, left_hand[0] + 5, left_hand[1] + 5), (226, 168, 91, 250))
    layer.ellipse((right_hand[0] - 5, right_hand[1] - 5, right_hand[0] + 5, right_hand[1] + 5), (226, 168, 91, 250))

    # Head, hair, helmet, face.
    head_x = 96 + dx + head_shift
    head_y = 68 + dy + crouch * 0.2
    layer.ellipse((68 + dx + head_shift, 43 + dy, 124 + dx + head_shift, 99 + dy), (18, 20, 27, 245))
    layer.polygon(
        [
            (70 + dx + head_shift, 63 + dy),
            (63 + dx + head_shift, 88 + dy),
            (75 + dx + head_shift, 82 + dy),
            (83 + dx + head_shift, 99 + dy),
            (96 + dx + head_shift, 88 + dy),
            (111 + dx + head_shift, 101 + dy),
            (122 + dx + head_shift, 82 + dy),
            (130 + dx + head_shift, 88 + dy),
            (122 + dx + head_shift, 60 + dy),
        ],
        (23, 24, 29, 250),
    )
    layer.ellipse((72 + dx + head_shift, 52 + dy, 120 + dx + head_shift, 98 + dy), (235, 185, 139, 255))
    layer.polygon([(71 + dx + head_shift, 52 + dy), (88 + dx + head_shift, 50 + dy), (79 + dx + head_shift, 70 + dy)], (23, 24, 29, 250))
    layer.polygon([(105 + dx + head_shift, 50 + dy), (124 + dx + head_shift, 57 + dy), (112 + dx + head_shift, 72 + dy)], (23, 24, 29, 250))
    layer.polygon([(82 + dx + head_shift, 45 + dy), (96 + dx + head_shift, 35 + dy), (111 + dx + head_shift, 46 + dy), (105 + dx + head_shift, 56 + dy), (88 + dx + head_shift, 56 + dy)], (32, 43, 72, 250))
    layer.line([(84 + dx + head_shift, 47 + dy), (96 + dx + head_shift, 38 + dy), (109 + dx + head_shift, 48 + dy)], (235, 181, 82, 235), 2.5)
    layer.polygon([(94 + dx + head_shift, 37 + dy), (99 + dx + head_shift, 24 + dy), (104 + dx + head_shift, 39 + dy)], (224, 170, 73, 245))
    layer.ellipse((84 + dx + head_shift, 71 + dy, 94 + dx + head_shift, 83 + dy), (18, 27, 38, 255))
    layer.ellipse((103 + dx + head_shift, 71 + dy, 113 + dx + head_shift, 83 + dy), (18, 27, 38, 255))
    layer.ellipse((88 + dx + head_shift, 73 + dy, 92 + dx + head_shift, 78 + dy), (108, 191, 244, 245))
    layer.ellipse((107 + dx + head_shift, 73 + dy, 111 + dx + head_shift, 78 + dy), (108, 191, 244, 245))
    layer.line([(82 + dx + head_shift, 68 + dy), (94 + dx + head_shift, 65 + dy)], (34, 25, 26, 235), 1.7)
    layer.line([(102 + dx + head_shift, 65 + dy), (115 + dx + head_shift, 68 + dy)], (34, 25, 26, 235), 1.7)
    layer.line([(91 + dx + head_shift, 89 + dy), (98 + dx + head_shift, 91 + dy), (105 + dx + head_shift, 88 + dy)], (105, 41, 43, 190), 1.2)
    layer.ellipse((77 + dx + head_shift, 85 + dy, 85 + dx + head_shift, 91 + dy), (241, 139, 128, 70))
    layer.ellipse((109 + dx + head_shift, 85 + dy, 117 + dx + head_shift, 91 + dy), (241, 139, 128, 70))

    front = Image.new("RGBA", raw.size, (0, 0, 0, 0))
    draw_effects(front, pose, front=True)
    raw.alpha_composite(front)
    return raw


IDLE_POSES = [
    {"phase": 0.0, "effect": "idle_glint", "dx": 0, "dy": 0, "cape": -2, "shoulder": 0, "left_hand": (69, 124), "right_hand": (123, 124), "left_angle": -18, "right_angle": -162, "left_len": 48, "right_len": 48, "left_heavy": 1.12, "right_heavy": 1.12},
    {"phase": 0.7, "effect": "idle_glint", "dx": 0, "dy": -1, "cape": 1, "shoulder": 1, "left_hand": (68, 123), "right_hand": (124, 125), "left_angle": -16, "right_angle": -164, "left_len": 48, "right_len": 48, "left_heavy": 1.12, "right_heavy": 1.12},
    {"phase": 1.4, "effect": "idle_glint", "dx": 0, "dy": -2, "cape": 3, "shoulder": 2, "left_hand": (70, 122), "right_hand": (122, 124), "left_angle": -14, "right_angle": -166, "left_len": 48, "right_len": 48, "left_heavy": 1.12, "right_heavy": 1.12},
    {"phase": 2.1, "effect": "idle_glint", "dx": 0, "dy": -1, "cape": 2, "shoulder": 1, "left_hand": (71, 123), "right_hand": (121, 123), "left_angle": -17, "right_angle": -163, "left_len": 48, "right_len": 48, "left_heavy": 1.12, "right_heavy": 1.12},
    {"phase": 2.8, "effect": "idle_glint", "dx": 0, "dy": 0, "cape": -1, "shoulder": 0, "left_hand": (69, 125), "right_hand": (123, 124), "left_angle": -20, "right_angle": -160, "left_len": 48, "right_len": 48, "left_heavy": 1.12, "right_heavy": 1.12},
    {"phase": 3.5, "effect": "idle_glint", "dx": 0, "dy": 1, "cape": -3, "shoulder": -1, "left_hand": (68, 126), "right_hand": (124, 125), "left_angle": -21, "right_angle": -159, "left_len": 48, "right_len": 48, "left_heavy": 1.12, "right_heavy": 1.12},
]

RUN_POSES = [
    {"phase": 0.0, "effect": "run_streak", "dx": -2, "dy": 0, "crouch": 4, "cape": 7, "head_shift": -2, "shoulder": 2, "left_hand": (63, 136), "right_hand": (119, 113), "left_angle": -12, "right_angle": -116},
    {"phase": 0.8, "effect": "run_streak", "dx": -4, "dy": 1, "crouch": 7, "cape": 10, "head_shift": -3, "shoulder": 3, "left_hand": (65, 119), "right_hand": (126, 137), "left_angle": -76, "right_angle": 14},
    {"phase": 1.6, "effect": "run_streak", "dx": -1, "dy": 0, "crouch": 5, "cape": 8, "head_shift": -2, "shoulder": 1, "left_hand": (59, 132), "right_hand": (123, 116), "left_angle": -24, "right_angle": -105},
    {"phase": 2.4, "effect": "run_streak", "dx": 2, "dy": 1, "crouch": 6, "cape": 5, "head_shift": -1, "shoulder": -2, "left_hand": (70, 118), "right_hand": (130, 134), "left_angle": -82, "right_angle": 8},
    {"phase": 3.2, "effect": "run_streak", "dx": 0, "dy": 0, "crouch": 4, "cape": 7, "head_shift": -2, "shoulder": 1, "left_hand": (63, 137), "right_hand": (122, 115), "left_angle": -8, "right_angle": -112},
    {"phase": 4.0, "effect": "run_streak", "dx": -3, "dy": 1, "crouch": 7, "cape": 11, "head_shift": -4, "shoulder": 3, "left_hand": (66, 120), "right_hand": (127, 138), "left_angle": -74, "right_angle": 16},
]

ATTACK_POSES = [
    {"phase": 0.0, "dx": 0, "dy": 0, "cape": -1, "shoulder": 0, "left_hand": (68, 124), "right_hand": (124, 124), "left_angle": -18, "right_angle": -162, "left_len": 48, "right_len": 48, "left_heavy": 1.12, "right_heavy": 1.12},
    {"phase": 0.8, "dx": -2, "dy": 0, "crouch": 2, "cape": 3, "shoulder": 2, "left_hand": (61, 112), "right_hand": (120, 131), "left_angle": -104, "right_angle": -14},
    {"phase": 1.6, "effect": "left_cut", "dx": -4, "dy": 1, "crouch": 5, "cape": 5, "head_shift": -1, "shoulder": 3, "left_hand": (63, 140), "right_hand": (119, 118), "left_angle": -18, "right_angle": -118},
    {"phase": 2.4, "effect": "right_cut", "dx": 4, "dy": 0, "crouch": 5, "cape": -1, "head_shift": 1, "shoulder": -2, "left_hand": (69, 120), "right_hand": (130, 141), "left_angle": -62, "right_angle": -162},
    {"phase": 3.2, "effect": "cross_cut", "dx": 0, "dy": 1, "crouch": 6, "cape": 2, "shoulder": 2, "left_hand": (62, 139), "right_hand": (130, 137), "left_angle": -24, "right_angle": -155},
    {"phase": 4.0, "effect": "ground_crack", "dx": 2, "dy": 1, "crouch": 3, "cape": -2, "shoulder": -1, "left_hand": (74, 130), "right_hand": (122, 132), "left_angle": -6, "right_angle": -176},
    {"phase": 4.8, "dx": 1, "dy": 0, "crouch": 1, "cape": -1, "shoulder": 0, "left_hand": (70, 125), "right_hand": (124, 126), "left_angle": -44, "right_angle": -135},
    {"phase": 5.6, "effect": "idle_glint", "dx": 0, "dy": 0, "cape": -2, "shoulder": 0, "left_hand": (69, 124), "right_hand": (123, 124), "left_angle": -18, "right_angle": -162, "left_len": 48, "right_len": 48, "left_heavy": 1.12, "right_heavy": 1.12},
]

ULTIMATE_POSES = [
    {"phase": 0.0, "dx": 0, "dy": 0, "cape": -2, "shoulder": 0, "left_hand": (68, 124), "right_hand": (124, 124), "left_angle": -18, "right_angle": -162, "left_len": 48, "right_len": 48, "left_heavy": 1.12, "right_heavy": 1.12},
    {"phase": 0.8, "effect": "ultimate_charge", "dx": 0, "dy": -1, "crouch": 1, "cape": 4, "shoulder": 2, "left_hand": (60, 110), "right_hand": (132, 111), "left_angle": -106, "right_angle": -74},
    {"phase": 1.6, "effect": "ultimate_charge", "dx": 0, "dy": -2, "crouch": 3, "cape": 7, "shoulder": 3, "left_hand": (57, 104), "right_hand": (135, 104), "left_angle": -122, "right_angle": -58},
    {"phase": 2.4, "effect": "ultimate_impact", "dx": 0, "dy": 1, "crouch": 8, "cape": -3, "head_shift": 0, "shoulder": -1, "left_hand": (72, 151), "right_hand": (120, 151), "left_angle": 4, "right_angle": 176},
    {"phase": 3.2, "effect": "ultimate_impact", "dx": 0, "dy": 2, "crouch": 7, "cape": -5, "shoulder": 0, "left_hand": (68, 147), "right_hand": (124, 147), "left_angle": -12, "right_angle": -168},
    {"phase": 4.0, "effect": "ultimate_residue", "dx": 2, "dy": 1, "crouch": 4, "cape": -3, "shoulder": -1, "left_hand": (72, 134), "right_hand": (122, 134), "left_angle": -20, "right_angle": -160},
    {"phase": 4.8, "effect": "ultimate_residue", "dx": 1, "dy": 0, "crouch": 2, "cape": -1, "shoulder": 0, "left_hand": (70, 128), "right_hand": (124, 128), "left_angle": -38, "right_angle": -142},
    {"phase": 5.6, "effect": "idle_glint", "dx": 0, "dy": 0, "cape": -2, "shoulder": 0, "left_hand": (69, 124), "right_hand": (123, 124), "left_angle": -18, "right_angle": -162, "left_len": 48, "right_len": 48, "left_heavy": 1.12, "right_heavy": 1.12},
]


def render_frame(pose: dict[str, object]) -> Image.Image:
    return downsample(draw_dianwei_raw(pose), bias_x=float(pose.get("bias_x", 0.0)))


def save_frames() -> dict[str, list[Path]]:
    for path in [CHARACTER_DIR, ANIM_DIR / "idle", ANIM_DIR / "run", ANIM_DIR / "attack", ANIM_DIR / "ultimate", WORK_DIR, WEB_DIR]:
        path.mkdir(parents=True, exist_ok=True)

    outputs: dict[str, list[Path]] = {}
    state_poses = {
        "idle": IDLE_POSES,
        "run": RUN_POSES,
        "attack": ATTACK_POSES,
        "ultimate": ULTIMATE_POSES,
    }
    for state, poses in state_poses.items():
        outputs[state] = []
        state_dir = ANIM_DIR / state
        for old in state_dir.glob("*.png"):
            old.unlink()
        for index, pose in enumerate(poses, start=1):
            frame = render_frame(pose)
            path = state_dir / f"{index:02d}.png"
            frame.save(path)
            outputs[state].append(path)

    idle = outputs["idle"][0]
    (CHARACTER_DIR / "battle-idle.png").write_bytes(idle.read_bytes())

    legacy_paths: list[Path] = []
    for index in range(4):
        src = outputs["attack"][index]
        dst = CHARACTER_DIR / f"attack-{index}.png"
        dst.write_bytes(src.read_bytes())
        legacy_paths.append(dst)
    strip = Image.new("RGBA", (W * 4, H), (0, 0, 0, 0))
    for index, path in enumerate(legacy_paths):
        strip.alpha_composite(Image.open(path).convert("RGBA"), (index * W, 0))
    strip.save(CHARACTER_DIR / "attack-strip.png")
    outputs["legacy"] = [CHARACTER_DIR / "battle-idle.png", *legacy_paths, CHARACTER_DIR / "attack-strip.png"]

    make_card()
    make_contact_sheet(outputs)
    write_asset_list(outputs)
    return outputs


def make_card() -> None:
    card = Image.new("RGBA", (1024, 1024), (10, 14, 27, 255))
    draw = ImageDraw.Draw(card, "RGBA")
    for radius, alpha in [(470, 70), (360, 90), (250, 95)]:
        draw.ellipse((512 - radius, 450 - radius, 512 + radius, 450 + radius), fill=(18, 66, 132, alpha))
    for angle in range(0, 360, 18):
        rad = math.radians(angle)
        x1 = 512 + math.cos(rad) * 70
        y1 = 534 + math.sin(rad) * 34
        x2 = 512 + math.cos(rad) * 470
        y2 = 534 + math.sin(rad) * 230
        draw.line((x1, y1, x2, y2), fill=(44, 93, 159, 48), width=8)
    for x in [108, 916]:
        draw.polygon([(x, 85), (x + (38 if x < 512 else -38), 172), (x, 865), (x + (58 if x < 512 else -58), 948)], fill=(191, 139, 58, 220))
        draw.line((x, 120, x, 900), fill=(245, 196, 91, 180), width=7)

    raw = draw_dianwei_raw({"phase": 2.4, "effect": "ultimate_impact", "dx": 0, "dy": 1, "crouch": 6, "cape": -4, "left_hand": (68, 147), "right_hand": (124, 147), "left_angle": -8, "right_angle": -172})
    crop_box = alpha_bbox(raw)
    if crop_box is None:
        return
    character = raw.crop(crop_box)
    target_h = 760
    target_w = round(character.width * target_h / character.height)
    character = character.resize((target_w, target_h), Image.Resampling.LANCZOS)
    card.alpha_composite(character, ((1024 - target_w) // 2, 190))

    overlay = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay, "RGBA")
    od.arc((206, 682, 818, 904), start=190, end=350, fill=(137, 211, 255, 180), width=14)
    od.arc((260, 726, 764, 892), start=196, end=344, fill=(30, 82, 164, 140), width=20)
    od.line((314, 780, 421, 852, 490, 814, 608, 870, 714, 790), fill=(9, 17, 32, 150), width=8)
    card.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(1)))
    card.save(CHARACTER_DIR / "card.png")


def make_contact_sheet(outputs: dict[str, list[Path]]) -> None:
    rows = [
        ("idle", outputs["idle"]),
        ("run", outputs["run"]),
        ("attack", outputs["attack"]),
        ("ultimate", outputs["ultimate"]),
    ]
    label_w = 112
    gap = 8
    sheet_w = label_w + W * 8 + gap * 9
    sheet_h = 48 + len(rows) * (H + gap)
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (24, 28, 38, 255))
    draw = ImageDraw.Draw(sheet, "RGBA")
    draw.text((14, 12), "dianwei candidate animation frames", fill=(232, 238, 248, 255))
    y = 40
    for state, paths in rows:
        draw.text((14, y + 96), state, fill=(232, 238, 248, 255))
        for index in range(8):
            x = label_w + gap + index * (W + gap)
            draw.rectangle((x - 1, y - 1, x + W, y + H), outline=(54, 64, 82, 255))
            if index < len(paths):
                img = Image.open(paths[index]).convert("RGBA")
                checker = Image.new("RGBA", (W, H), (42, 47, 58, 255))
                cd = ImageDraw.Draw(checker, "RGBA")
                for cy in range(0, H, 16):
                    for cx in range(0, W, 16):
                        if (cx // 16 + cy // 16) % 2 == 0:
                            cd.rectangle((cx, cy, cx + 15, cy + 15), fill=(35, 40, 50, 255))
                checker.alpha_composite(img)
                sheet.alpha_composite(checker, (x, y))
                draw.text((x + 6, y + 6), f"{index + 1:02d}", fill=(222, 230, 242, 230))
        y += H + gap
    sheet.save(WEB_DIR / "dianwei-contact-sheet.png")

    legacy_sheet = Image.new("RGBA", (W * 4, H), (0, 0, 0, 0))
    for index in range(4):
        legacy_sheet.alpha_composite(Image.open(CHARACTER_DIR / f"attack-{index}.png").convert("RGBA"), (index * W, 0))
    legacy_sheet.save(WEB_DIR / "dianwei-legacy-attack-strip-preview.png")


def write_asset_list(outputs: dict[str, list[Path]]) -> None:
    assets = {
        "character": "dianwei",
        "frameSize": [W, H],
        "safeBoxMax": [SAFE_W, SAFE_H],
        "paddingMin": PAD,
        "card": str((CHARACTER_DIR / "card.png").relative_to(ROOT)).replace("\\", "/"),
        "battleIdle": str((CHARACTER_DIR / "battle-idle.png").relative_to(ROOT)).replace("\\", "/"),
        "legacyAttacks": [str((CHARACTER_DIR / f"attack-{index}.png").relative_to(ROOT)).replace("\\", "/") for index in range(4)],
        "attackStrip": str((CHARACTER_DIR / "attack-strip.png").relative_to(ROOT)).replace("\\", "/"),
        "animations": {
            state: [str(path.relative_to(ROOT)).replace("\\", "/") for path in paths]
            for state, paths in outputs.items()
            if state in {"idle", "run", "attack", "ultimate"}
        },
        "previews": [
            str((WEB_DIR / "dianwei-contact-sheet.png").relative_to(ROOT)).replace("\\", "/"),
            str((WEB_DIR / "dianwei-legacy-attack-strip-preview.png").relative_to(ROOT)).replace("\\", "/"),
        ],
    }
    (WORK_DIR / "asset-list.json").write_text(json.dumps(assets, indent=2), encoding="utf-8")


def main() -> None:
    save_frames()


if __name__ == "__main__":
    main()
