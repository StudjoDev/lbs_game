#!/usr/bin/env python3
"""Generate Yueying candidate character assets.

The script intentionally stays self-contained so the integration agent can rerun
or adapt it without touching shared runtime registries.
"""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[4]
HERO_ID = "yueying"
HERO_ROOT = ROOT / "public" / "assets" / "characters" / HERO_ID
SOURCE_ROOT = ROOT / "scripts" / "source" / "character-anims" / HERO_ID
AGENT_ROOT = ROOT / "output" / "agent-work" / HERO_ID
WEB_ROOT = ROOT / "output" / "web-game"

FRAME_W = 192
FRAME_H = 224
SCALE = 4
SAFE_MARGIN = 10
MAX_OCCUPANCY = 0.66
ALPHA_THRESHOLD = 8

CARD_SIZE = 1024

PALETTE = {
    "outline": (42, 29, 28, 255),
    "hair": (35, 44, 48, 255),
    "hair_hi": (70, 94, 88, 255),
    "skin": (255, 217, 176, 255),
    "skin_shadow": (226, 159, 126, 255),
    "eye": (36, 112, 104, 255),
    "robe": (46, 148, 116, 255),
    "robe_dark": (21, 94, 82, 255),
    "jade": (87, 226, 190, 230),
    "jade_light": (198, 255, 228, 230),
    "gold": (238, 178, 74, 255),
    "gold_light": (255, 232, 146, 255),
    "wood": (135, 84, 44, 255),
    "wood_light": (185, 126, 62, 255),
    "wood_dark": (82, 49, 31, 255),
    "metal": (126, 156, 140, 255),
    "metal_light": (216, 241, 210, 255),
    "teal_fx": (60, 236, 194, 178),
    "teal_glow": (84, 255, 205, 96),
}


def sp(value: float) -> int:
    return round(value * SCALE)


def sbox(box: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = box
    left, right = sorted((x0, x1))
    top, bottom = sorted((y0, y1))
    return (sp(left), sp(top), sp(right), sp(bottom))


def spoints(points: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(sp(x), sp(y)) for x, y in points]


def new_layer(width: int = FRAME_W, height: int = FRAME_H) -> Image.Image:
    return Image.new("RGBA", (width * SCALE, height * SCALE), (0, 0, 0, 0))


def draw_line(
    layer: Image.Image,
    points: list[tuple[float, float]],
    fill: tuple[int, int, int, int],
    width: float,
    joint: str = "curve",
) -> None:
    ImageDraw.Draw(layer).line(spoints(points), fill=fill, width=max(1, sp(width)), joint=joint)


def draw_ellipse(
    layer: Image.Image,
    box: tuple[float, float, float, float],
    fill: tuple[int, int, int, int] | None = None,
    outline: tuple[int, int, int, int] | None = None,
    width: float = 1,
) -> None:
    ImageDraw.Draw(layer).ellipse(sbox(box), fill=fill, outline=outline, width=max(1, sp(width)))


def draw_rect(
    layer: Image.Image,
    box: tuple[float, float, float, float],
    fill: tuple[int, int, int, int] | None = None,
    outline: tuple[int, int, int, int] | None = None,
    width: float = 1,
    radius: float = 0,
) -> None:
    draw = ImageDraw.Draw(layer)
    if radius:
        draw.rounded_rectangle(sbox(box), radius=sp(radius), fill=fill, outline=outline, width=max(1, sp(width)))
    else:
        draw.rectangle(sbox(box), fill=fill, outline=outline, width=max(1, sp(width)))


def draw_polygon(
    layer: Image.Image,
    points: list[tuple[float, float]],
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
) -> None:
    ImageDraw.Draw(layer).polygon(spoints(points), fill=fill, outline=outline)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return alpha.getbbox()


def fit_to_safe_box(image: Image.Image) -> Image.Image:
    bbox = alpha_bbox(image)
    if bbox is None:
        raise ValueError("frame has no visible alpha")
    crop = image.crop(bbox)
    max_w = min(FRAME_W - SAFE_MARGIN * 2, FRAME_W * MAX_OCCUPANCY)
    max_h = min(FRAME_H - SAFE_MARGIN * 2, FRAME_H * MAX_OCCUPANCY)
    scale = min(1.0, max_w / crop.width, max_h / crop.height)
    if scale < 1.0:
        crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    old_cx = (bbox[0] + bbox[2]) / 2
    center_delta = (old_cx - FRAME_W / 2) * scale
    x = round((FRAME_W - crop.width) / 2 + center_delta)
    x = max(SAFE_MARGIN, min(FRAME_W - SAFE_MARGIN - crop.width, x))
    y = FRAME_H - SAFE_MARGIN - crop.height
    y = max(SAFE_MARGIN, y)
    canvas.alpha_composite(crop, (x, y))
    return canvas


def hi_to_frame(layer: Image.Image) -> Image.Image:
    frame = layer.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS)
    return fit_to_safe_box(frame)


def glow_line(
    layer: Image.Image,
    points: list[tuple[float, float]],
    color: tuple[int, int, int, int],
    width: float,
    blur: float = 2.0,
) -> None:
    glow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    draw_line(glow, points, (color[0], color[1], color[2], round(color[3] * 0.42)), width + 9)
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(sp(blur))))
    draw_line(layer, points, color, width)
    draw_line(layer, points, PALETTE["jade_light"], max(1.5, width * 0.32))


def bezier_points(points: list[tuple[float, float]], steps: int = 36) -> list[tuple[float, float]]:
    if len(points) != 4:
        return points
    p0, p1, p2, p3 = points
    result: list[tuple[float, float]] = []
    for step in range(steps + 1):
        t = step / steps
        inv = 1 - t
        x = inv**3 * p0[0] + 3 * inv**2 * t * p1[0] + 3 * inv * t**2 * p2[0] + t**3 * p3[0]
        y = inv**3 * p0[1] + 3 * inv**2 * t * p1[1] + 3 * inv * t**2 * p2[1] + t**3 * p3[1]
        result.append((x, y))
    return result


def draw_curve(
    layer: Image.Image,
    controls: list[tuple[float, float]],
    color: tuple[int, int, int, int],
    width: float,
    blur: float = 1.9,
) -> None:
    glow_line(layer, bezier_points(controls), color, width, blur)


def rotated_points(
    center: tuple[float, float],
    length: float,
    width: float,
    angle: float,
) -> list[tuple[float, float]]:
    rad = math.radians(angle)
    ux, uy = math.cos(rad), math.sin(rad)
    px, py = -uy, ux
    cx, cy = center
    half_l = length / 2
    half_w = width / 2
    return [
        (cx - ux * half_l - px * half_w, cy - uy * half_l - py * half_w),
        (cx + ux * half_l - px * half_w, cy + uy * half_l - py * half_w),
        (cx + ux * half_l + px * half_w, cy + uy * half_l + py * half_w),
        (cx - ux * half_l + px * half_w, cy - uy * half_l + py * half_w),
    ]


def draw_gear(
    layer: Image.Image,
    cx: float,
    cy: float,
    radius: float,
    teeth: int,
    angle: float,
    fill: tuple[int, int, int, int],
    alpha_scale: float = 1.0,
) -> None:
    points: list[tuple[float, float]] = []
    for index in range(teeth * 2):
        theta = math.radians(angle) + index * math.pi / teeth
        r = radius if index % 2 == 0 else radius * 0.78
        points.append((cx + math.cos(theta) * r, cy + math.sin(theta) * r))
    color = (fill[0], fill[1], fill[2], round(fill[3] * alpha_scale))
    draw_polygon(layer, points, color, PALETTE["outline"])
    draw_ellipse(layer, (cx - radius * 0.46, cy - radius * 0.46, cx + radius * 0.46, cy + radius * 0.46), None, PALETTE["gold_light"], 1.4)
    draw_ellipse(layer, (cx - radius * 0.18, cy - radius * 0.18, cx + radius * 0.18, cy + radius * 0.18), fill=(42, 31, 22, round(150 * alpha_scale)))


def draw_bagua_ground(layer: Image.Image, cx: float, cy: float, phase: float, intensity: float) -> None:
    alpha = round(165 * intensity)
    if alpha <= 0:
        return
    ring = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(ring)
    for radius, width, color in (
        (48, 3, (52, 238, 194, alpha)),
        (36, 2, (255, 221, 118, round(alpha * 0.72))),
        (22, 2, (87, 226, 190, round(alpha * 0.62))),
    ):
        draw.ellipse(sbox((cx - radius, cy - radius * 0.36, cx + radius, cy + radius * 0.36)), outline=color, width=sp(width))
    layer.alpha_composite(ring.filter(ImageFilter.GaussianBlur(sp(0.5))))
    draw = ImageDraw.Draw(layer)
    for index in range(8):
        theta = phase + index * math.pi / 4
        x0 = cx + math.cos(theta) * 20
        y0 = cy + math.sin(theta) * 8
        x1 = cx + math.cos(theta) * 48
        y1 = cy + math.sin(theta) * 18
        draw.line((sp(x0), sp(y0), sp(x1), sp(y1)), fill=(60, 236, 194, alpha), width=sp(1.6))
        tx = cx + math.cos(theta) * 56
        ty = cy + math.sin(theta) * 21
        for bar in range(3):
            off = (bar - 1) * 3.6
            draw.line((sp(tx - 4), sp(ty + off), sp(tx + 4), sp(ty + off)), fill=(255, 232, 146, round(alpha * 0.75)), width=sp(1))


def draw_wooden_ox(layer: Image.Image, x: float, y: float, open_amount: float, gear_angle: float, facing: int = 1) -> None:
    wing = 9 + 16 * open_amount
    if open_amount > 0.05:
        rear = x - facing * 6
        draw_polygon(
            layer,
            [(rear, y - 10), (rear + facing * (11 + wing), y - 26 - wing * 0.18), (rear + facing * (17 + wing), y - 17), (rear + facing * 5, y - 5)],
            (103, 74, 46, 220),
            PALETTE["outline"],
        )
        draw_line(layer, [(rear + facing * 2, y - 8), (rear + facing * (14 + wing), y - 22)], PALETTE["gold_light"], 1.1)
    draw_rect(layer, (x - 16, y - 14, x + 18, y + 5), PALETTE["wood"], PALETTE["outline"], 1.4, radius=4)
    draw_rect(layer, (x - 12, y - 10, x + 9, y - 2), PALETTE["wood_light"], None, 1, radius=2)
    head_x = x + facing * 21
    draw_rect(layer, (head_x - 8, y - 19, head_x + 9, y - 6), PALETTE["wood_light"], PALETTE["outline"], 1.2, radius=4)
    draw_polygon(layer, [(head_x + facing * 5, y - 20), (head_x + facing * 11, y - 29), (head_x + facing * 10, y - 18)], PALETTE["gold_light"], PALETTE["outline"])
    for lx in (-9, 8):
        draw_line(layer, [(x + lx, y + 3), (x + lx + facing * 4, y + 14)], PALETTE["wood_dark"], 3.0)
        draw_ellipse(layer, (x + lx + facing * 1, y + 11, x + lx + facing * 10, y + 17), PALETTE["wood_dark"], None)
    draw_gear(layer, x - facing * 17, y - 2, 8.3, 8, gear_angle, PALETTE["gold"], 0.95)
    draw_ellipse(layer, (x + facing * 14, y - 14, x + facing * 18, y - 10), fill=PALETTE["jade_light"])


def draw_halberd(layer: Image.Image, hand: tuple[float, float], angle: float, length: float = 79, back: float = 23, glow: bool = False) -> None:
    rad = math.radians(angle)
    ux, uy = math.cos(rad), math.sin(rad)
    px, py = -uy, ux
    hx, hy = hand
    tip = (hx + ux * length, hy + uy * length)
    butt = (hx - ux * back, hy - uy * back)
    if glow:
        glow_line(layer, [butt, tip], PALETTE["teal_glow"], 7.0, 2.3)
    draw_line(layer, [butt, tip], PALETTE["outline"], 5.6)
    draw_line(layer, [butt, tip], PALETTE["wood_dark"], 3.8)
    draw_line(layer, [butt, tip], PALETTE["gold_light"], 1.2)
    base = (tip[0] - ux * 12, tip[1] - uy * 12)
    spike = (tip[0] + ux * 10, tip[1] + uy * 10)
    side_one = (base[0] + px * 20, base[1] + py * 20)
    side_two = (base[0] + px * 11 - ux * 13, base[1] + py * 11 - uy * 13)
    hook_tip = (base[0] - px * 13 - ux * 9, base[1] - py * 13 - uy * 9)
    blade_points = [spike, side_one, side_two, base, hook_tip, (base[0] - px * 3, base[1] - py * 3)]
    draw_polygon(layer, blade_points, PALETTE["metal_light"], PALETTE["outline"])
    draw_line(layer, [base, side_one], PALETTE["jade"], 2.2)
    pommel = (butt[0] - ux * 2, butt[1] - uy * 2)
    draw_ellipse(layer, (pommel[0] - 4, pommel[1] - 4, pommel[0] + 4, pommel[1] + 4), PALETTE["gold_light"], PALETTE["outline"], 1)


def draw_face(layer: Image.Image, cx: float, cy: float) -> None:
    draw_ellipse(layer, (cx - 28, cy - 31, cx + 28, cy + 30), PALETTE["skin"], PALETTE["outline"], 1.6)
    draw_ellipse(layer, (cx - 18, cy - 5, cx - 7, cy + 9), PALETTE["eye"], PALETTE["outline"], 0.8)
    draw_ellipse(layer, (cx + 7, cy - 5, cx + 18, cy + 9), PALETTE["eye"], PALETTE["outline"], 0.8)
    draw_ellipse(layer, (cx - 14, cy - 2, cx - 10, cy + 2), (235, 255, 238, 245))
    draw_ellipse(layer, (cx + 11, cy - 2, cx + 15, cy + 2), (235, 255, 238, 245))
    draw_line(layer, [(cx - 5, cy + 15), (cx, cy + 18), (cx + 7, cy + 14)], (126, 58, 62, 230), 1.3)
    draw_ellipse(layer, (cx - 25, cy + 8, cx - 18, cy + 15), (248, 138, 138, 78))
    draw_ellipse(layer, (cx + 18, cy + 8, cx + 25, cy + 15), (248, 138, 138, 78))


def draw_character(
    layer: Image.Image,
    cx: float,
    base_y: float,
    lean: float,
    bob: float,
    weapon_angle: float,
    arm_phase: float,
    state: str,
    frame_index: int,
) -> tuple[float, float]:
    shoulder_y = base_y - 74 + bob
    head_cx = cx + lean * 0.18
    head_cy = base_y - 104 + bob
    hand = (cx + 11 + math.sin(arm_phase) * 6 + lean * 0.18, shoulder_y + 9 + math.cos(arm_phase) * 6)
    offhand = (cx - 15 - math.cos(arm_phase * 0.8) * 5, shoulder_y + 17 + math.sin(arm_phase) * 3)

    # Back hair and gear hairpin.
    draw_ellipse(layer, (head_cx - 32, head_cy - 34, head_cx + 31, head_cy + 34), PALETTE["hair"], None)
    draw_polygon(layer, [(head_cx - 25, head_cy + 15), (head_cx - 45, head_cy + 61), (head_cx - 13, head_cy + 41)], PALETTE["hair"], PALETTE["outline"])
    draw_polygon(layer, [(head_cx + 22, head_cy + 13), (head_cx + 41, head_cy + 55), (head_cx + 9, head_cy + 40)], PALETTE["hair"], PALETTE["outline"])
    draw_gear(layer, head_cx + 24, head_cy - 24, 8, 8, frame_index * 18, PALETTE["gold"], 0.96)
    draw_polygon(layer, [(head_cx - 5, head_cy - 37), (head_cx + 11, head_cy - 48), (head_cx + 22, head_cy - 31)], PALETTE["jade"], PALETTE["outline"])

    draw_face(layer, head_cx, head_cy)
    draw_line(layer, [(head_cx - 24, head_cy - 18), (head_cx - 6, head_cy - 26), (head_cx + 21, head_cy - 17)], PALETTE["hair_hi"], 5)

    # Legs and robe panels.
    foot_lift = math.sin(arm_phase * 1.2) * (4 if state == "run" else 1.5)
    draw_line(layer, [(cx - 13, base_y - 28 + bob), (cx - 18, base_y - 4 + foot_lift)], PALETTE["robe_dark"], 9)
    draw_line(layer, [(cx + 13, base_y - 27 + bob), (cx + 20, base_y - 3 - foot_lift)], PALETTE["robe"], 9)
    draw_ellipse(layer, (cx - 27, base_y - 7 + foot_lift, cx - 8, base_y + 2 + foot_lift), PALETTE["wood_dark"], None)
    draw_ellipse(layer, (cx + 10, base_y - 7 - foot_lift, cx + 31, base_y + 2 - foot_lift), PALETTE["wood_dark"], None)
    draw_polygon(layer, [(cx - 27, base_y - 57 + bob), (cx + 26, base_y - 57 + bob), (cx + 17, base_y - 12 + bob), (cx - 18, base_y - 12 + bob)], PALETTE["robe_dark"], PALETTE["outline"])
    draw_polygon(layer, [(cx - 8, base_y - 57 + bob), (cx + 10, base_y - 57 + bob), (cx + 16, base_y - 12 + bob), (cx - 15, base_y - 12 + bob)], PALETTE["robe"], None)
    draw_line(layer, [(cx - 20, base_y - 45 + bob), (cx + 21, base_y - 45 + bob)], PALETTE["gold_light"], 3)
    draw_rect(layer, (cx - 20, base_y - 72 + bob, cx + 22, base_y - 43 + bob), PALETTE["robe"], PALETTE["outline"], 1.4, radius=8)
    draw_rect(layer, (cx - 13, base_y - 68 + bob, cx + 14, base_y - 48 + bob), (39, 118, 101, 255), PALETTE["gold"], 1.1, radius=4)
    draw_gear(layer, cx, base_y - 54 + bob, 7, 8, -frame_index * 16, PALETTE["gold"], 0.95)

    # Arms and sleeves.
    left_shoulder = (cx - 19, shoulder_y + 2)
    right_shoulder = (cx + 18, shoulder_y + 1)
    draw_line(layer, [left_shoulder, offhand], PALETTE["robe_dark"], 10)
    draw_line(layer, [right_shoulder, hand], PALETTE["robe"], 10)
    draw_ellipse(layer, (offhand[0] - 4, offhand[1] - 4, offhand[0] + 4, offhand[1] + 4), PALETTE["skin"], PALETTE["outline"], 0.8)
    draw_halberd(layer, hand, weapon_angle, glow=state in ("attack", "ultimate") and frame_index in (2, 3, 4))
    draw_ellipse(layer, (hand[0] - 5, hand[1] - 5, hand[0] + 5, hand[1] + 5), PALETTE["skin"], PALETTE["outline"], 0.8)
    return hand


def draw_attack_effect(layer: Image.Image, frame_index: int, cx: float, cy: float) -> None:
    specs = [
        None,
        ((66, 137), 8, 120),
        ((51, 119), 11, 150),
        ((106, 105), 15, 205),
        ((138, 130), 13, 192),
        ((124, 158), 10, 142),
        ((108, 149), 7, 90),
        None,
    ]
    spec = specs[frame_index]
    if spec is None:
        return
    (gx, gy), radius, alpha = spec
    draw_gear(layer, gx, gy, radius, 10, frame_index * 34, PALETTE["wood_light"], alpha / 225)
    if frame_index in (2, 3, 4, 5):
        curves = [
            [(cx - 45, cy - 58), (cx - 50, cy - 112), (cx + 45, cy - 116), (cx + 65, cy - 42)],
            [(cx + 54, cy - 44), (cx + 76, cy - 9), (cx - 36, cy - 8), (cx - 49, cy - 49)],
        ]
        draw_curve(layer, curves[0], (62, 235, 193, min(220, alpha)), 5.5)
        if frame_index in (3, 4):
            draw_curve(layer, curves[1], (255, 212, 108, round(alpha * 0.72)), 3.8)


def draw_run_wings(layer: Image.Image, cx: float, base_y: float, phase: float) -> None:
    for sign in (-1, 1):
        root = (cx + sign * 22, base_y - 84)
        tip = (root[0] + sign * (18 + math.sin(phase) * 5), root[1] + 13 + math.cos(phase) * 4)
        draw_polygon(layer, [root, tip, (root[0] + sign * 6, root[1] + 22)], (94, 70, 48, 168), PALETTE["outline"])
        draw_line(layer, [root, tip], PALETTE["gold_light"], 1.2)


def render_raw_state(state: str, frame_index: int) -> Image.Image:
    layer = new_layer()
    cx = 93
    base_y = 209
    idle_angles = [-63, -60, -58, -60, -64, -67]
    run_angles = [44, 56, 49, 28, 18, 31]
    attack_angles = [-64, -118, -165, -18, 31, 72, 18, -58]
    ultimate_angles = [-58, -82, -124, -24, 22, 58, 18, -55]

    if state == "idle":
        phase = frame_index / 6 * math.tau
        bob = math.sin(phase) * 2.0
        lean = math.sin(phase + 0.4) * 4.0
        draw_wooden_ox(layer, 135, 188 + math.sin(phase + 0.7) * 2, 0.25 + 0.55 * (0.5 + math.sin(phase) * 0.5), frame_index * 24, 1)
        draw_character(layer, cx, base_y, lean, bob, idle_angles[frame_index], phase, state, frame_index)
        draw_gear(layer, 126, 158, 6, 8, frame_index * 20, PALETTE["gold"], 0.72)
    elif state == "run":
        phase = frame_index / 6 * math.tau
        bob = -2.0 + abs(math.sin(phase)) * -5.0
        lean = -9 + math.sin(phase) * 4.0
        cx += [-7, -13, -5, 7, 13, 5][frame_index]
        draw_run_wings(layer, cx, base_y, phase)
        draw_wooden_ox(layer, 129 - math.cos(phase) * 5, 190 - abs(math.sin(phase)) * 4, 0.45 + 0.35 * abs(math.sin(phase)), frame_index * 38, 1)
        draw_character(layer, cx, base_y, lean, bob, run_angles[frame_index], phase, state, frame_index)
        if frame_index in (1, 4):
            draw_curve(layer, [(cx - 42, 168), (cx - 63, 157), (cx - 56, 191), (cx - 22, 194)], PALETTE["teal_fx"], 3.8)
    elif state == "attack":
        phase = frame_index / 8 * math.tau
        offsets = [0, -8, -14, 7, 15, 10, 3, 0]
        bob = [0, -3, -8, -9, -6, -3, -1, 0][frame_index]
        lean = [-2, -9, -15, 10, 16, 9, 3, 0][frame_index]
        cx += offsets[frame_index]
        draw_attack_effect(layer, frame_index, cx, base_y)
        ox_open = [0.22, 0.4, 0.72, 1.0, 0.88, 0.5, 0.24, 0.16][frame_index]
        draw_wooden_ox(layer, 135 + min(8, offsets[frame_index] * 0.3), 190 + max(-4, bob * 0.25), ox_open, frame_index * 42, 1)
        draw_character(layer, cx, base_y, lean, bob, attack_angles[frame_index], phase + 0.6, state, frame_index)
    elif state == "ultimate":
        phase = frame_index / 8 * math.tau
        intensities = [0.15, 0.35, 0.68, 1.0, 0.95, 0.7, 0.4, 0.22]
        bob = [0, -3, -7, -10, -8, -4, -1, 0][frame_index]
        lean = [-2, -6, -11, 6, 12, 8, 3, 0][frame_index]
        draw_bagua_ground(layer, 96, 190, phase, intensities[frame_index])
        if frame_index in (2, 3, 4, 5):
            for offset, direction in ((-34, 1), (34, -1)):
                draw_wooden_ox(layer, 96 + offset, 187 + abs(offset) * 0.04, 0.95, frame_index * 48 + offset, direction)
        else:
            draw_wooden_ox(layer, 134, 190, 0.45, frame_index * 32, 1)
        for bolt_index in range(max(0, frame_index - 1)):
            if bolt_index > 4:
                break
            y = 134 + bolt_index * 10 - frame_index * 1.5
            x0 = 55 + bolt_index * 7
            x1 = x0 + 52 + frame_index * 3
            draw_curve(layer, [(x0, y), (x0 + 12, y - 10), (x1 - 18, y + 4), (x1, y - 5)], (70, 241, 196, 140), 2.8, 1.2)
            draw_polygon(layer, [(x1, y - 5), (x1 - 8, y - 10), (x1 - 5, y - 2)], PALETTE["metal_light"], PALETTE["outline"])
        draw_character(layer, cx, base_y, lean, bob, ultimate_angles[frame_index], phase + 1.2, state, frame_index)
        if frame_index in (3, 4):
            draw_gear(layer, 96, 130, 18, 12, frame_index * 28, PALETTE["gold"], 0.82)
            draw_curve(layer, [(51, 153), (67, 99), (125, 94), (147, 153)], PALETTE["teal_fx"], 4.2)
    else:
        raise ValueError(f"unknown state: {state}")
    return layer


def render_state_frame(state: str, frame_index: int) -> Image.Image:
    return hi_to_frame(render_raw_state(state, frame_index))


def check_frame(path: Path) -> dict[str, object]:
    image = Image.open(path).convert("RGBA")
    if image.size != (FRAME_W, FRAME_H):
        raise ValueError(f"{path}: expected {(FRAME_W, FRAME_H)}, found {image.size}")
    bbox = alpha_bbox(image)
    if bbox is None:
        raise ValueError(f"{path}: empty alpha")
    left, top, right, bottom = bbox
    padding = min(left, top, FRAME_W - right, FRAME_H - bottom)
    width = right - left
    height = bottom - top
    if padding < SAFE_MARGIN:
        raise ValueError(f"{path}: padding {padding}px < {SAFE_MARGIN}px")
    if width / FRAME_W > MAX_OCCUPANCY + 0.01 or height / FRAME_H > MAX_OCCUPANCY + 0.01:
        raise ValueError(f"{path}: bbox {(width, height)} exceeds safe occupancy")
    return {
        "path": str(path.relative_to(ROOT)).replace("\\", "/"),
        "bbox": [left, top, right, bottom],
        "padding": padding,
        "occupancy": [round(width / FRAME_W, 3), round(height / FRAME_H, 3)],
    }


def make_checkered_tile(frame: Image.Image, label: str | None = None) -> Image.Image:
    tile = Image.new("RGBA", (FRAME_W, FRAME_H), (34, 27, 30, 255))
    for y in range(0, FRAME_H, 16):
        for x in range(0, FRAME_W, 16):
            if (x // 16 + y // 16) % 2 == 0:
                tile.alpha_composite(Image.new("RGBA", (16, 16), (47, 40, 42, 255)), (x, y))
    tile.alpha_composite(frame)
    if label:
        draw = ImageDraw.Draw(tile)
        draw.rectangle((0, 0, 54, 15), fill=(20, 14, 16, 220))
        draw.text((4, 2), label, fill=(255, 232, 146, 255))
    return tile


def write_preview(paths: list[Path], out_path: Path, label_prefix: str) -> None:
    sheet = Image.new("RGBA", (FRAME_W * len(paths), FRAME_H), (20, 14, 18, 255))
    for index, path in enumerate(paths):
        frame = Image.open(path).convert("RGBA")
        sheet.alpha_composite(make_checkered_tile(frame, f"{label_prefix}{index + 1:02d}"), (index * FRAME_W, 0))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def write_contact_sheet(states: dict[str, list[Path]], out_path: Path) -> None:
    label_w = 116
    max_count = max(len(paths) for paths in states.values())
    sheet = Image.new("RGBA", (label_w + FRAME_W * max_count, FRAME_H * len(states)), (18, 14, 18, 255))
    draw = ImageDraw.Draw(sheet)
    for row, (state, paths) in enumerate(states.items()):
        y = row * FRAME_H
        draw.rectangle((0, y, label_w, y + FRAME_H), fill=(32, 23, 28, 255))
        draw.text((12, y + 18), state, fill=(255, 232, 146, 255))
        for index, path in enumerate(paths):
            frame = Image.open(path).convert("RGBA")
            sheet.alpha_composite(make_checkered_tile(frame, f"{index + 1:02d}"), (label_w + index * FRAME_W, y))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def make_card() -> Image.Image:
    card = Image.new("RGBA", (CARD_SIZE, CARD_SIZE), (18, 31, 31, 255))
    px = card.load()
    for y in range(CARD_SIZE):
        for x in range(CARD_SIZE):
            t = y / CARD_SIZE
            cx = (x - CARD_SIZE * 0.5) / CARD_SIZE
            glow = max(0.0, 1.0 - (cx * cx * 7.5 + (t - 0.46) ** 2 * 3.5))
            px[x, y] = (
                round(19 + 38 * glow + 24 * (1 - t)),
                round(40 + 102 * glow + 30 * (1 - t)),
                round(42 + 82 * glow),
                255,
            )
    draw = ImageDraw.Draw(card)
    for radius in (330, 245, 165):
        draw.ellipse(
            (CARD_SIZE / 2 - radius, 210 - radius * 0.38, CARD_SIZE / 2 + radius, 210 + radius * 0.38),
            outline=(73, 231, 190, 54),
            width=7,
        )
    for index in range(16):
        theta = index * math.tau / 16
        x0 = CARD_SIZE / 2 + math.cos(theta) * 160
        y0 = 216 + math.sin(theta) * 58
        x1 = CARD_SIZE / 2 + math.cos(theta) * 330
        y1 = 216 + math.sin(theta) * 126
        draw.line((x0, y0, x1, y1), fill=(238, 178, 74, 60), width=5)
    high = render_raw_state("ultimate", 3)
    bbox = high.getchannel("A").getbbox()
    assert bbox is not None
    sprite = high.crop(bbox)
    target_h = 760
    target_w = round(sprite.width * target_h / sprite.height)
    sprite = sprite.resize((target_w, target_h), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", sprite.size, (0, 0, 0, 0))
    shadow.putalpha(sprite.getchannel("A").filter(ImageFilter.GaussianBlur(18)))
    card.alpha_composite(Image.new("RGBA", shadow.size, (0, 0, 0, 150)), ((CARD_SIZE - target_w) // 2 + 8, 222))
    card.alpha_composite(sprite, ((CARD_SIZE - target_w) // 2, 180))
    draw = ImageDraw.Draw(card)
    for index in range(7):
        x = 182 + index * 114
        y = 800 + math.sin(index) * 34
        draw.line((x - 55, y + 14, x + 60, y - 23), fill=(74, 242, 196, 108), width=5)
        draw.polygon([(x + 60, y - 23), (x + 38, y - 31), (x + 45, y - 11)], fill=(218, 241, 208, 180))
    return card


def write_assets() -> None:
    HERO_ROOT.mkdir(parents=True, exist_ok=True)
    SOURCE_ROOT.mkdir(parents=True, exist_ok=True)
    AGENT_ROOT.mkdir(parents=True, exist_ok=True)
    WEB_ROOT.mkdir(parents=True, exist_ok=True)

    state_counts = {"idle": 6, "run": 6, "attack": 8, "ultimate": 8}
    output: dict[str, list[Path]] = {}
    audit_rows: list[dict[str, object]] = []
    for state, count in state_counts.items():
        final_dir = HERO_ROOT / "anim" / state
        source_dir = SOURCE_ROOT / state
        raw_dir = source_dir / "raw"
        if final_dir.exists():
            for old in final_dir.glob("*.png"):
                old.unlink()
        if source_dir.exists():
            shutil.rmtree(source_dir)
        final_dir.mkdir(parents=True, exist_ok=True)
        raw_dir.mkdir(parents=True, exist_ok=True)
        paths: list[Path] = []
        for index in range(count):
            raw_hi = render_raw_state(state, index)
            raw_hi.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS).save(raw_dir / f"{index + 1:02d}.png")
            frame = hi_to_frame(raw_hi)
            out_path = final_dir / f"{index + 1:02d}.png"
            frame.save(out_path)
            audit_rows.append(check_frame(out_path))
            paths.append(out_path)
        output[state] = paths
        write_preview(paths, source_dir / "preview.png", state[0])
        write_preview(paths, source_dir / "reference-action.png", state[0])

    Image.open(output["idle"][0]).save(HERO_ROOT / "battle-idle.png")
    legacy_indices = [0, 2, 3, 5]
    legacy_frames: list[Image.Image] = []
    for out_index, frame_index in enumerate(legacy_indices):
        frame = Image.open(output["attack"][frame_index]).convert("RGBA")
        frame.save(HERO_ROOT / f"attack-{out_index}.png")
        legacy_frames.append(frame)
    strip = Image.new("RGBA", (FRAME_W * len(legacy_frames), FRAME_H), (0, 0, 0, 0))
    for index, frame in enumerate(legacy_frames):
        strip.alpha_composite(frame, (index * FRAME_W, 0))
    strip.save(HERO_ROOT / "attack-strip.png")
    make_card().save(HERO_ROOT / "card.png")

    write_contact_sheet(output, WEB_ROOT / "yueying-contact-sheet.png")
    write_preview(output["attack"], WEB_ROOT / "yueying-attack-strip-preview.png", "a")
    (AGENT_ROOT / "asset-audit.json").write_text(json.dumps(audit_rows, indent=2), encoding="utf-8")
    (AGENT_ROOT / "asset-list.json").write_text(
        json.dumps(
            {
                "heroId": HERO_ID,
                "root": str(HERO_ROOT.relative_to(ROOT)).replace("\\", "/"),
                "required": {
                    "card": "card.png",
                    "battleIdle": "battle-idle.png",
                    "legacyAttack": [f"attack-{index}.png" for index in range(4)],
                    "attackStrip": "attack-strip.png",
                    "animations": {state: [f"anim/{state}/{index + 1:02d}.png" for index in range(count)] for state, count in state_counts.items()},
                },
                "contactSheet": "output/web-game/yueying-contact-sheet.png",
            },
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    write_assets()
    print(f"generated Yueying candidate assets under {HERO_ROOT}")
