#!/usr/bin/env python3
"""Generate in-battle ultimate animation frames from existing character sprites."""

from __future__ import annotations

import sys
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from normalize_character_runtime_frames import normalize_hero


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
    "liubei": {"style": "slash", "accent": (255, 211, 106, 96), "lean": -4.8},
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
    "zhenji": {
        "style": "flute_caster",
        "accent": (184, 232, 255, 120),
        "lean": -5.0,
        "fluteWaves": True,
        "maxOccupancy": 0.66,
    },
    "sunquan": {"style": "command", "accent": (255, 187, 112, 100), "lean": -3.0},
    "zhouyu": {"style": "caster", "accent": (255, 90, 50, 108), "lean": -3.0},
    "sunshangxiang": {"style": "ranged", "accent": (255, 207, 100, 102), "lean": -4.4},
    "ganning": {"style": "slash", "accent": (217, 225, 255, 98), "lean": -6.8},
    "taishici": {"style": "ranged", "accent": (255, 138, 79, 104), "lean": -4.8},
    "xiaoqiao": {
        "style": "fan_dance",
        "accent": (255, 143, 165, 122),
        "lean": -8.0,
        "fanTrails": True,
        "maxOccupancy": 0.66,
    },
    "diaochan": {"style": "ribbon_dance", "accent": (255, 154, 203, 126), "lean": -9.2, "ribbonTrails": True},
    "zhangjiao": {"style": "caster", "accent": (231, 196, 95, 104), "lean": -3.6},
    "yuanshao": {"style": "command", "accent": (213, 162, 255, 98), "lean": -3.2},
    "dongzhuo": {"style": "roar", "accent": (255, 78, 116, 124), "lean": -4.2},
    "huatuo": {"style": "caster", "accent": (159, 247, 198, 92), "lean": -2.4},
    "lubu": {"style": "cleave", "accent": (255, 78, 116, 128), "lean": -8.0},
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
    "fan_dance": [
        ("idle", 0, -6.0, 1.02, 1.02, -6, -2, 0.65),
        ("run", 1, -14.0, 1.06, 1.03, -16, -8, 1.0),
        ("attack", 1, -22.0, 1.09, 1.04, -16, -13, 1.0),
        ("attack", 2, 18.0, 1.12, 1.02, 14, -15, 1.0),
        ("attack", 3, 27.0, 1.1, 1.0, 22, -10, 0.95),
        ("run", 4, 13.0, 1.06, 1.03, 16, -8, 0.8),
        ("attack", 5, -9.0, 1.04, 1.02, -8, -5, 0.6),
        ("idle", 5, 3.0, 1.02, 1.02, 2, -1, 0.3),
    ],
    "flute_caster": [
        ("idle", 0, -4.0, 1.01, 1.02, -4, -2, 0.55),
        ("idle", 1, -10.0, 1.03, 1.04, -8, -8, 0.9),
        ("attack", 1, -15.0, 1.06, 1.05, -10, -13, 1.0),
        ("attack", 2, 8.0, 1.08, 1.04, 9, -16, 1.0),
        ("attack", 3, 15.0, 1.08, 1.02, 14, -12, 0.92),
        ("run", 4, 8.0, 1.05, 1.03, 10, -8, 0.72),
        ("attack", 5, -6.0, 1.04, 1.03, -5, -5, 0.55),
        ("idle", 5, 0.0, 1.02, 1.02, 0, -2, 0.28),
    ],
    "ribbon_dance": [
        ("idle", 0, -7.0, 1.02, 1.02, -8, -2, 0.72),
        ("run", 1, -16.0, 1.06, 1.04, -20, -9, 1.0),
        ("attack", 1, -24.0, 1.09, 1.04, -18, -14, 1.0),
        ("attack", 2, 18.0, 1.13, 1.02, 16, -16, 1.0),
        ("attack", 3, 28.0, 1.1, 1.0, 24, -11, 0.95),
        ("run", 4, 15.0, 1.07, 1.03, 18, -8, 0.82),
        ("attack", 5, -10.0, 1.05, 1.03, -10, -5, 0.62),
        ("idle", 5, 4.0, 1.02, 1.02, 3, -1, 0.32),
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


def curve_points(points: list[tuple[float, float]], steps: int = 34) -> list[tuple[int, int]]:
    if len(points) != 4:
        return [(round(x), round(y)) for x, y in points]
    p0, p1, p2, p3 = points
    curve: list[tuple[int, int]] = []
    for step in range(steps + 1):
        t = step / steps
        inv = 1 - t
        x = inv**3 * p0[0] + 3 * inv**2 * t * p1[0] + 3 * inv * t**2 * p2[0] + t**3 * p3[0]
        y = inv**3 * p0[1] + 3 * inv**2 * t * p1[1] + 3 * inv * t**2 * p2[1] + t**3 * p3[1]
        curve.append((round(x), round(y)))
    return curve


def draw_ribbon_curve(layer: Image.Image, controls: list[tuple[float, float]], width: int, alpha: int) -> None:
    points = curve_points(controls)
    glow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.line(points, fill=(255, 86, 188, round(alpha * 0.42)), width=width + 8, joint="curve")
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(1.8)))
    draw = ImageDraw.Draw(layer)
    draw.line(points, fill=(255, 96, 198, alpha), width=width, joint="curve")
    draw.line(points, fill=(255, 232, 154, min(220, alpha)), width=max(2, width // 3), joint="curve")


def ribbon_ultimate_layer(frame_index: int, front: bool = False) -> Image.Image:
    layer = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    cx = FRAME_WIDTH / 2
    cy = FRAME_HEIGHT - 86
    phase = frame_index / 8 * 6.28318
    if frame_index in (2, 3, 4):
        back = [
            [(20, cy + 18), (28, cy - 92), (164, cy - 100), (174, cy + 4)],
            [(172, cy + 24), (154, cy - 112), (32, cy - 76), (24, cy + 18)],
        ]
        front_curves = [
            [(cx - 28, cy + 34), (48, cy - 24), (148, cy - 68), (cx + 30, cy + 26)],
        ]
        curves = front_curves if front else back
        width = 8
        alpha = 208
    else:
        curves = []
        for sign in (-1, 1):
            angle = phase + sign * 0.82
            start = (cx + sign * 18, cy + 22)
            control_one = (cx + sign * 54, cy - 24)
            control_two = (cx + math.cos(angle) * 72, cy - 76 + math.sin(angle) * 28)
            end = (cx + math.cos(angle + sign * 1.35) * 76, cy - 10 + math.sin(angle + sign * 1.35) * 42)
            if (front and sign > 0) or (not front and sign < 0):
                curves.append([start, control_one, control_two, end])
        width = 7
        alpha = 170
    for curve in curves:
        draw_ribbon_curve(layer, curve, width, alpha)
    return layer


def draw_colored_curve(
    layer: Image.Image,
    controls: list[tuple[float, float]],
    width: int,
    alpha: int,
    color: tuple[int, int, int],
    highlight: tuple[int, int, int],
) -> None:
    points = curve_points(controls)
    glow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.line(points, fill=(color[0], color[1], color[2], round(alpha * 0.42)), width=width + 8, joint="curve")
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(1.8)))
    draw = ImageDraw.Draw(layer)
    draw.line(points, fill=(color[0], color[1], color[2], alpha), width=width, joint="curve")
    draw.line(points, fill=(highlight[0], highlight[1], highlight[2], min(225, alpha)), width=max(2, width // 3), joint="curve")


def draw_fan_burst(layer: Image.Image, center: tuple[float, float], angle: float, radius: float, alpha: int) -> None:
    draw = ImageDraw.Draw(layer)
    spread = 0.95
    rim_points: list[tuple[int, int]] = []
    for spoke_index in range(5):
        theta = angle - spread / 2 + spread * spoke_index / 4
        end = (round(center[0] + math.cos(theta) * radius), round(center[1] + math.sin(theta) * radius))
        rim_points.append(end)
        draw.line((round(center[0]), round(center[1]), end[0], end[1]), fill=(255, 236, 156, min(220, alpha)), width=2)
    draw.line(rim_points, fill=(255, 98, 64, min(230, alpha)), width=5, joint="curve")
    draw.line(rim_points, fill=(255, 222, 112, min(215, alpha)), width=2, joint="curve")


def draw_limb_stroke(
    layer: Image.Image,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    width: int,
    color: tuple[int, int, int, int],
    highlight: tuple[int, int, int, int],
) -> None:
    draw = ImageDraw.Draw(layer)
    draw.line((round(start[0]), round(start[1]), round(end[0]), round(end[1])), fill=color, width=width)
    draw.line(
        (round(start[0]), round(start[1]), round(end[0]), round(end[1])),
        fill=highlight,
        width=max(2, width // 3),
    )
    radius = max(2, width // 2)
    draw.ellipse((end[0] - radius, end[1] - radius, end[0] + radius, end[1] + radius), fill=highlight)


def draw_flute(
    layer: Image.Image,
    center: tuple[float, float],
    angle: float,
    *,
    length: float = 64,
    width: int = 5,
    alpha: int = 220,
) -> None:
    dx = math.cos(angle) * length / 2
    dy = math.sin(angle) * length / 2
    start = (center[0] - dx, center[1] - dy)
    end = (center[0] + dx, center[1] + dy)
    draw = ImageDraw.Draw(layer)
    draw.line((round(start[0]), round(start[1]), round(end[0]), round(end[1])), fill=(42, 76, 132, alpha), width=width + 3)
    draw.line((round(start[0]), round(start[1]), round(end[0]), round(end[1])), fill=(215, 244, 255, min(240, alpha + 16)), width=width)
    for index in range(5):
        t = (index + 1) / 6
        x = start[0] + (end[0] - start[0]) * t
        y = start[1] + (end[1] - start[1]) * t
        draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(27, 56, 108, min(230, alpha)))


def fan_ultimate_layer(frame_index: int, front: bool = False) -> Image.Image:
    layer = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    cx = FRAME_WIDTH / 2
    cy = FRAME_HEIGHT - 82
    phase = frame_index / FRAME_COUNT * 6.28318
    if frame_index in (2, 3, 4):
        back = [
            [(18, cy + 18), (26, cy - 96), (164, cy - 108), (176, cy + 4)],
            [(174, cy + 24), (150, cy - 116), (28, cy - 82), (22, cy + 18)],
        ]
        front_curves = [
            [(cx - 30, cy + 32), (42, cy - 30), (150, cy - 72), (cx + 32, cy + 24)],
        ]
        curves = front_curves if front else back
        width = 9
        alpha = 214
    else:
        curves = []
        for sign in (-1, 1):
            start = (cx + sign * 16, cy + 22)
            control_one = (cx + sign * 48, cy - 24)
            control_two = (cx + sign * 74, cy - 72 + math.sin(phase) * 18)
            end = (cx + sign * 78, cy - 2 + math.sin(phase + sign) * 28)
            if (front and sign > 0) or (not front and sign < 0):
                curves.append([start, control_one, control_two, end])
        width = 8
        alpha = 176
    for curve in curves:
        draw_colored_curve(layer, curve, width, alpha, (255, 74, 42), (255, 232, 116))
    if front:
        fan_specs = [
            ((cx - 24, cy + 18), -2.55, (cx + 26, cy + 18), -0.58),
            ((cx - 44, cy + 2), -2.95, (cx + 34, cy + 14), -0.76),
            ((cx - 52, cy - 24), -3.14, (cx + 48, cy - 6), -0.32),
            ((cx - 22, cy - 52), -1.94, (cx + 24, cy - 50), -1.14),
            ((cx + 44, cy - 24), -0.18, (cx - 44, cy - 6), -2.92),
            ((cx + 38, cy + 2), -0.38, (cx - 34, cy + 16), -2.76),
            ((cx - 22, cy + 14), -2.48, (cx + 28, cy + 16), -0.62),
            ((cx - 24, cy + 18), -2.55, (cx + 24, cy + 18), -0.58),
        ]
        left_fan, left_angle, right_fan, right_angle = fan_specs[frame_index]
        torso = (cx, cy + 34)
        draw_limb_stroke(
            layer,
            (torso[0] - 14, torso[1] - 4),
            left_fan,
            width=8,
            color=(255, 118, 132, 146),
            highlight=(255, 232, 198, 184),
        )
        draw_limb_stroke(
            layer,
            (torso[0] + 14, torso[1] - 4),
            right_fan,
            width=8,
            color=(255, 118, 132, 146),
            highlight=(255, 232, 198, 184),
        )
        draw_fan_burst(layer, left_fan, left_angle, 30, 188)
        draw_fan_burst(layer, right_fan, right_angle, 30, 188)
    return layer


def flute_ultimate_layer(frame_index: int, front: bool = False) -> Image.Image:
    layer = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    cx = FRAME_WIDTH / 2
    cy = FRAME_HEIGHT - 94
    phase = frame_index / FRAME_COUNT * 6.28318
    if frame_index in (2, 3, 4):
        back = [
            [(22, cy + 10), (48, cy - 92), (150, cy - 106), (174, cy - 12)],
            [(176, cy + 4), (144, cy - 116), (44, cy - 96), (20, cy + 18)],
        ]
        front_curves = [
            [(cx - 32, cy + 26), (52, cy - 42), (140, cy - 72), (cx + 34, cy + 18)],
        ]
        curves = front_curves if front else back
        width = 7
        alpha = 210
    else:
        curves = []
        for wave_index in range(2):
            span = 58 + wave_index * 18
            start = (cx - 12, cy + 14)
            control_one = (cx - span * 0.5, cy - 22 - wave_index * 14)
            control_two = (cx + span * 0.55, cy - 64 + math.sin(phase + wave_index) * 14)
            end = (cx + span, cy - 16 + wave_index * 6)
            if (front and wave_index == 1) or (not front and wave_index == 0):
                curves.append([start, control_one, control_two, end])
        width = 5
        alpha = 168
    for curve in curves:
        draw_colored_curve(layer, curve, width, alpha, (82, 205, 255), (238, 252, 255))
    draw = ImageDraw.Draw(layer)
    if frame_index in (2, 3, 4):
        radius = 22 + (frame_index - 2) * 8
        draw.ellipse((cx - radius, cy - 58 - radius * 0.42, cx + radius, cy - 58 + radius * 0.42), outline=(185, 244, 255, 150), width=3)
    if front:
        flute_specs = [
            ((cx - 6, cy + 18), -0.22),
            ((cx - 24, cy + 4), -0.58),
            ((cx - 36, cy - 18), -0.86),
            ((cx + 6, cy - 48), -0.05),
            ((cx + 34, cy - 22), 0.58),
            ((cx + 28, cy + 0), 0.36),
            ((cx + 6, cy + 12), -0.08),
            ((cx - 4, cy + 18), -0.2),
        ]
        flute_center, flute_angle = flute_specs[frame_index]
        torso = (cx, cy + 40)
        draw_limb_stroke(
            layer,
            (torso[0] - 14, torso[1] - 4),
            (flute_center[0] - 24, flute_center[1] + 3),
            width=8,
            color=(92, 174, 255, 136),
            highlight=(226, 248, 255, 180),
        )
        draw_limb_stroke(
            layer,
            (torso[0] + 12, torso[1] - 5),
            (flute_center[0] + 24, flute_center[1] - 2),
            width=8,
            color=(92, 174, 255, 136),
            highlight=(226, 248, 255, 180),
        )
        draw_flute(layer, flute_center, flute_angle, length=68, width=5, alpha=224)
        for index in range(6):
            angle = phase + index * 0.85
            x = cx + math.cos(angle) * 62
            y = cy - 42 + math.sin(angle * 1.25) * 28
            draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(220, 248, 255, 138))
    return layer


def fit_to_frame(image: Image.Image, label: str, max_occupancy: float = 1.0) -> Image.Image:
    bbox = alpha_bbox(image)
    if bbox is None:
        raise ValueError(f"{label}: no visible pixels")
    crop = image.crop(bbox)
    max_width = FRAME_WIDTH - PADDING * 2
    max_height = FRAME_HEIGHT - PADDING * 2
    if max_occupancy < 1.0:
        max_width = min(max_width, FRAME_WIDTH * max_occupancy)
        max_height = min(max_height, FRAME_HEIGHT * max_occupancy)
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
    ribbon_trails: bool = False,
    fan_trails: bool = False,
    flute_waves: bool = False,
    max_occupancy: float = 1.0,
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

    if ribbon_trails:
        canvas.alpha_composite(ribbon_ultimate_layer(frame_index, front=False))
    if fan_trails:
        canvas.alpha_composite(fan_ultimate_layer(frame_index, front=False))
    if flute_waves:
        canvas.alpha_composite(flute_ultimate_layer(frame_index, front=False))
    canvas.alpha_composite(sprite, (x, y))
    if ribbon_trails:
        canvas.alpha_composite(ribbon_ultimate_layer(frame_index, front=True))
    if fan_trails:
        canvas.alpha_composite(fan_ultimate_layer(frame_index, front=True))
    if flute_waves:
        canvas.alpha_composite(flute_ultimate_layer(frame_index, front=True))
    return fit_to_frame(canvas, f"ultimate frame {frame_index + 1}", max_occupancy)


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
    ribbon_trails = bool(config.get("ribbonTrails", False))
    fan_trails = bool(config.get("fanTrails", False))
    flute_waves = bool(config.get("fluteWaves", False))
    max_occupancy = float(config.get("maxOccupancy", 1.0))
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
            ribbon_trails=ribbon_trails,
            fan_trails=fan_trails,
            flute_waves=flute_waves,
            max_occupancy=max_occupancy,
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
    requested = sys.argv[1:]
    if requested:
        unknown = [hero_id for hero_id in requested if hero_id not in HERO_CONFIGS]
        if unknown:
            raise SystemExit(f"Unknown hero id(s): {', '.join(unknown)}")
        hero_ids = requested
    else:
        hero_ids = list(HERO_CONFIGS)
    for hero_id in hero_ids:
        config = HERO_CONFIGS[hero_id]
        generated[hero_id] = generate_hero(hero_id, config)
        normalize_hero(CHARACTER_ROOT / hero_id)
        print(f"generated ultimate frames for {hero_id}")
    write_contact_sheet(generated)
    print(f"contact sheet: {CONTACT_SHEET_PATH}")


if __name__ == "__main__":
    main()
