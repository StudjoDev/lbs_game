#!/usr/bin/env python3
"""Generate first-pass character animation frames from approved battle sprites."""

from __future__ import annotations

import math
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from normalize_character_runtime_frames import normalize_hero

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
        "runLean": -6.4,
        "attackLean": -13.2,
        "safeMargin": 4,
        "attackSafeMargin": 4,
    },
    "zhenji": {
        "accent": (184, 232, 255, 150),
        "runLean": -4.8,
        "attackLean": -9.2,
        "safeMargin": 10,
        "attackSafeMargin": 12,
        "maxOccupancy": 0.66,
    },
    "xiaoqiao": {
        "accent": (255, 143, 165, 150),
        "runLean": -6.0,
        "attackLean": -12.0,
        "safeMargin": 10,
        "attackSafeMargin": 12,
        "maxOccupancy": 0.66,
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
    if scale_x != 1 or scale_y != 1:
        sprite = sprite.resize(
            (max(1, round(sprite.width * scale_x)), max(1, round(sprite.height * scale_y))),
            Image.Resampling.LANCZOS,
        )
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


def curve_points(points: list[tuple[float, float]], steps: int = 36) -> list[tuple[int, int]]:
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


def draw_ribbon_curve(
    layer: Image.Image,
    controls: list[tuple[float, float]],
    *,
    width: int,
    color: tuple[int, int, int, int],
    highlight: tuple[int, int, int, int],
) -> None:
    points = curve_points(controls)
    glow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.line(points, fill=(color[0], color[1], color[2], round(color[3] * 0.44)), width=width + 8, joint="curve")
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(1.9)))
    draw = ImageDraw.Draw(layer)
    draw.line(points, fill=color, width=width, joint="curve")
    draw.line(points, fill=highlight, width=max(2, width // 3), joint="curve")


def ribbon_composite(
    image: Image.Image,
    back_curves: list[list[tuple[float, float]]],
    front_curves: list[list[tuple[float, float]]] | None = None,
    *,
    width: int = 7,
    alpha: int = 178,
) -> Image.Image:
    front_curves = front_curves or []
    back = Image.new("RGBA", image.size, (0, 0, 0, 0))
    for curve in back_curves:
        draw_ribbon_curve(back, curve, width=width, color=(255, 96, 188, alpha), highlight=(255, 225, 142, round(alpha * 0.75)))
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(back)
    result.alpha_composite(image)
    front = Image.new("RGBA", image.size, (0, 0, 0, 0))
    for curve in front_curves:
        draw_ribbon_curve(front, curve, width=width, color=(255, 118, 205, min(230, alpha + 28)), highlight=(255, 240, 178, min(210, alpha + 8)))
    result.alpha_composite(front)
    return result


def draw_energy_curve(
    layer: Image.Image,
    controls: list[tuple[float, float]],
    *,
    width: int,
    color: tuple[int, int, int, int],
    highlight: tuple[int, int, int, int],
    blur: float = 1.8,
) -> None:
    points = curve_points(controls)
    glow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.line(points, fill=(color[0], color[1], color[2], round(color[3] * 0.45)), width=width + 9, joint="curve")
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(blur)))
    draw = ImageDraw.Draw(layer)
    draw.line(points, fill=color, width=width, joint="curve")
    draw.line(points, fill=highlight, width=max(2, width // 3), joint="curve")


def energy_composite(
    image: Image.Image,
    back_curves: list[list[tuple[float, float]]],
    front_curves: list[list[tuple[float, float]]] | None = None,
    *,
    width: int,
    alpha: int,
    color: tuple[int, int, int],
    highlight: tuple[int, int, int],
    blur: float = 1.8,
) -> Image.Image:
    front_curves = front_curves or []
    back = Image.new("RGBA", image.size, (0, 0, 0, 0))
    for curve in back_curves:
        draw_energy_curve(
            back,
            curve,
            width=width,
            color=(color[0], color[1], color[2], alpha),
            highlight=(highlight[0], highlight[1], highlight[2], round(alpha * 0.78)),
            blur=blur,
        )
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(back)
    result.alpha_composite(image)
    front = Image.new("RGBA", image.size, (0, 0, 0, 0))
    for curve in front_curves:
        draw_energy_curve(
            front,
            curve,
            width=width,
            color=(color[0], color[1], color[2], min(235, alpha + 24)),
            highlight=(highlight[0], highlight[1], highlight[2], min(225, alpha + 18)),
            blur=blur,
        )
    result.alpha_composite(front)
    return result


def draw_fan_burst(layer: Image.Image, center: tuple[float, float], angle: float, radius: float, alpha: int) -> None:
    draw = ImageDraw.Draw(layer)
    spread = 0.92
    rim_points: list[tuple[int, int]] = []
    for spoke_index in range(5):
        theta = angle - spread / 2 + spread * spoke_index / 4
        end = (round(center[0] + math.cos(theta) * radius), round(center[1] + math.sin(theta) * radius))
        rim_points.append(end)
        draw.line((round(center[0]), round(center[1]), end[0], end[1]), fill=(255, 236, 160, min(225, alpha)), width=2)
    draw.line(rim_points, fill=(255, 108, 74, min(230, alpha)), width=5, joint="curve")
    draw.line(rim_points, fill=(255, 226, 116, min(210, alpha)), width=2, joint="curve")


def draw_spark(draw: ImageDraw.ImageDraw, x: float, y: float, radius: int, color: tuple[int, int, int, int]) -> None:
    cx = round(x)
    cy = round(y)
    draw.line((cx - radius, cy, cx + radius, cy), fill=color, width=1)
    draw.line((cx, cy - radius, cx, cy + radius), fill=color, width=1)


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
    length: float = 78,
    width: int = 6,
    alpha: int = 220,
) -> None:
    dx = math.cos(angle) * length / 2
    dy = math.sin(angle) * length / 2
    start = (center[0] - dx, center[1] - dy)
    end = (center[0] + dx, center[1] + dy)
    draw = ImageDraw.Draw(layer)
    draw.line((round(start[0]), round(start[1]), round(end[0]), round(end[1])), fill=(42, 76, 132, alpha), width=width + 3)
    draw.line((round(start[0]), round(start[1]), round(end[0]), round(end[1])), fill=(215, 244, 255, min(240, alpha + 16)), width=width)
    hole_count = 5
    for index in range(hole_count):
        t = (index + 1) / (hole_count + 1)
        x = start[0] + (end[0] - start[0]) * t
        y = start[1] + (end[1] - start[1]) * t
        draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(27, 56, 108, min(230, alpha)))


def diaochan_dance_ribbons(image: Image.Image, phase: float, reach: float, lift: float, *, front: bool = False) -> Image.Image:
    cx = SOURCE_WIDTH / 2
    cy = SOURCE_HEIGHT - 106
    back_curves: list[list[tuple[float, float]]] = []
    front_curves: list[list[tuple[float, float]]] = []
    for sign in (-1, 1):
        angle = phase + sign * 0.75
        start = (cx + sign * 18, cy + 20)
        control_one = (cx + sign * (36 + reach * 0.26), cy - 34 - lift)
        control_two = (cx + math.cos(angle) * reach, cy - 78 + math.sin(angle) * 34 - lift)
        end = (cx + math.cos(angle + sign * 1.3) * (reach + 28), cy - 18 + math.sin(angle + sign * 1.3) * 58)
        (front_curves if front and sign > 0 else back_curves).append([start, control_one, control_two, end])
    return ribbon_composite(image, back_curves, front_curves, width=7, alpha=168)


def diaochan_attack_ribbons(image: Image.Image, frame_index: int) -> Image.Image:
    cx = SOURCE_WIDTH / 2
    cy = SOURCE_HEIGHT - 108
    patterns = [
        (
            [[(cx - 20, cy + 24), (72, cy - 30), (88, cy - 86), (cx + 38, cy - 58)]],
            [],
            6,
            148,
        ),
        (
            [[(cx + 22, cy + 18), (72, cy - 20), (62, cy - 92), (cx - 50, cy - 68)]],
            [[(cx - 16, cy + 26), (214, cy - 12), (220, cy - 74), (cx + 48, cy - 82)]],
            7,
            176,
        ),
        (
            [[(cx + 32, cy + 20), (236, cy - 26), (216, cy - 116), (70, cy - 92)]],
            [[(cx - 30, cy + 24), (70, cy - 12), (58, cy - 72), (226, cy - 58)]],
            8,
            196,
        ),
        (
            [[(62, cy + 10), (92, cy - 112), (214, cy - 116), (232, cy - 2)]],
            [[(226, cy + 18), (206, cy - 96), (86, cy - 112), (58, cy - 16)]],
            9,
            216,
        ),
        (
            [[(226, cy + 16), (210, cy - 82), (82, cy - 96), (54, cy - 4)]],
            [[(62, cy + 12), (106, cy - 118), (238, cy - 86), (cx + 30, cy + 18)]],
            9,
            210,
        ),
        (
            [[(cx + 26, cy + 22), (230, cy - 24), (210, cy - 82), (cx - 34, cy - 42)]],
            [[(cx - 24, cy + 22), (80, cy - 10), (72, cy - 64), (cx + 44, cy - 54)]],
            7,
            178,
        ),
        (
            [[(cx - 18, cy + 20), (76, cy - 18), (94, cy - 70), (cx + 30, cy - 40)]],
            [],
            6,
            142,
        ),
        (
            [[(cx + 18, cy + 18), (208, cy - 16), (190, cy - 62), (cx - 28, cy - 36)]],
            [],
            5,
            116,
        ),
    ]
    back, front, width, alpha = patterns[frame_index]
    return ribbon_composite(image, back, front, width=width, alpha=alpha)


def xiaoqiao_fan_trails(image: Image.Image, phase: float, reach: float, lift: float, *, front: bool = False) -> Image.Image:
    cx = SOURCE_WIDTH / 2
    cy = SOURCE_HEIGHT - 104
    torso = (cx, cy + 36)
    left_fan = (
        cx - 34 - math.sin(phase * 1.15) * 22,
        cy + 14 - lift * 0.35 - math.cos(phase * 0.9) * 18,
    )
    right_fan = (
        cx + 34 + math.cos(phase * 1.05) * 22,
        cy + 14 - lift * 0.35 + math.sin(phase * 0.9) * 18,
    )
    back_curves: list[list[tuple[float, float]]] = []
    front_curves: list[list[tuple[float, float]]] = []
    for sign in (-1, 1):
        angle = phase + sign * 0.62
        fan = left_fan if sign < 0 else right_fan
        start = fan
        control_one = (cx + sign * (38 + reach * 0.16), cy - 26 - lift)
        control_two = (cx + sign * (reach + 10), cy - 56 + math.sin(angle) * 22 - lift)
        end = (cx + sign * (reach + 30), cy + 14 + math.sin(angle + sign * 0.9) * 28)
        (front_curves if front and sign > 0 else back_curves).append([start, control_one, control_two, end])
    result = energy_composite(
        image,
        back_curves,
        front_curves,
        width=8,
        alpha=172,
        color=(255, 88, 58),
        highlight=(255, 226, 116),
        blur=2.0,
    )
    fan_layer = Image.new("RGBA", result.size, (0, 0, 0, 0))
    draw_limb_stroke(
        fan_layer,
        (torso[0] - 18, torso[1] - 6),
        left_fan,
        width=10,
        color=(255, 134, 142, 140),
        highlight=(255, 232, 198, 170),
    )
    draw_limb_stroke(
        fan_layer,
        (torso[0] + 18, torso[1] - 6),
        right_fan,
        width=10,
        color=(255, 134, 142, 140),
        highlight=(255, 232, 198, 170),
    )
    draw_fan_burst(fan_layer, left_fan, -2.55 + phase * 0.28, 33 + reach * 0.05, 184)
    draw_fan_burst(fan_layer, right_fan, -0.58 - phase * 0.24, 33 + reach * 0.05, 184)
    draw = ImageDraw.Draw(fan_layer)
    for index in range(5):
        spark_phase = phase + index * 1.08
        draw_spark(
            draw,
            cx + math.cos(spark_phase) * (reach * 0.7),
            cy - 34 + math.sin(spark_phase * 1.2) * 28,
            3,
            (255, 214, 128, 150),
        )
    result.alpha_composite(fan_layer)
    return result


def xiaoqiao_attack_flames(image: Image.Image, frame_index: int) -> Image.Image:
    cx = SOURCE_WIDTH / 2
    cy = SOURCE_HEIGHT - 104
    patterns = [
        (
            [[(cx - 26, cy + 24), (76, cy - 18), (92, cy - 72), (cx + 30, cy - 44)]],
            [],
            7,
            150,
        ),
        (
            [[(cx - 36, cy + 24), (66, cy - 44), (104, cy - 96), (cx + 54, cy - 68)]],
            [[(cx + 24, cy + 20), (214, cy - 18), (210, cy - 72), (cx - 32, cy - 54)]],
            8,
            178,
        ),
        (
            [[(58, cy + 18), (76, cy - 96), (202, cy - 112), (232, cy - 4)]],
            [[(226, cy + 26), (204, cy - 92), (82, cy - 96), (54, cy + 8)]],
            10,
            214,
        ),
        (
            [[(50, cy + 8), (102, cy - 126), (236, cy - 84), (226, cy + 26)]],
            [[(236, cy + 10), (172, cy - 120), (58, cy - 64), (58, cy + 34)]],
            11,
            228,
        ),
        (
            [[(232, cy + 16), (202, cy - 94), (78, cy - 110), (50, cy + 2)]],
            [[(54, cy + 20), (104, cy - 126), (236, cy - 78), (cx + 26, cy + 24)]],
            10,
            214,
        ),
        (
            [[(cx + 28, cy + 20), (224, cy - 24), (196, cy - 82), (cx - 34, cy - 46)]],
            [[(cx - 26, cy + 22), (82, cy - 18), (88, cy - 70), (cx + 42, cy - 48)]],
            8,
            180,
        ),
        (
            [[(cx - 18, cy + 20), (78, cy - 16), (96, cy - 66), (cx + 28, cy - 36)]],
            [],
            7,
            142,
        ),
        (
            [[(cx + 16, cy + 18), (206, cy - 14), (188, cy - 60), (cx - 24, cy - 32)]],
            [],
            6,
            116,
        ),
    ]
    back, front, width, alpha = patterns[frame_index]
    fan_specs = [
        ((cx - 32, cy + 22), -2.55, (cx + 32, cy + 22), -0.58),
        ((cx - 54, cy + 2), -2.95, (cx + 40, cy + 18), -0.76),
        ((cx - 66, cy - 34), -3.18, (cx + 58, cy - 4), -0.34),
        ((cx - 28, cy - 66), -1.95, (cx + 30, cy - 64), -1.15),
        ((cx + 54, cy - 30), -0.18, (cx - 54, cy - 8), -2.92),
        ((cx + 50, cy + 4), -0.35, (cx - 42, cy + 18), -2.78),
        ((cx - 28, cy + 16), -2.48, (cx + 34, cy + 18), -0.62),
        ((cx - 30, cy + 22), -2.55, (cx + 30, cy + 22), -0.58),
    ]
    result = energy_composite(
        image,
        back,
        front,
        width=width,
        alpha=alpha,
        color=(255, 78, 42),
        highlight=(255, 232, 118),
        blur=2.2,
    )
    fan_layer = Image.new("RGBA", result.size, (0, 0, 0, 0))
    left_fan, left_angle, right_fan, right_angle = fan_specs[frame_index]
    torso = (cx, cy + 38)
    draw_limb_stroke(
        fan_layer,
        (torso[0] - 18, torso[1] - 6),
        left_fan,
        width=11,
        color=(255, 118, 132, 158),
        highlight=(255, 232, 198, 190),
    )
    draw_limb_stroke(
        fan_layer,
        (torso[0] + 18, torso[1] - 6),
        right_fan,
        width=11,
        color=(255, 118, 132, 158),
        highlight=(255, 232, 198, 190),
    )
    draw_fan_burst(fan_layer, left_fan, left_angle, 40, min(235, alpha + 8))
    draw_fan_burst(fan_layer, right_fan, right_angle, 40, min(235, alpha + 8))
    result.alpha_composite(fan_layer)
    return result


def zhenji_flute_waves(image: Image.Image, phase: float, reach: float, lift: float, *, front: bool = False) -> Image.Image:
    cx = SOURCE_WIDTH / 2
    cy = SOURCE_HEIGHT - 118
    torso = (cx, cy + 48)
    flute_center = (
        cx + math.sin(phase * 1.12) * 18,
        cy + 18 - lift * 0.28 + math.cos(phase * 0.86) * 14,
    )
    flute_angle = -0.16 + math.sin(phase * 1.25) * 0.55
    back_curves: list[list[tuple[float, float]]] = []
    front_curves: list[list[tuple[float, float]]] = []
    for wave_index in range(3):
        span = reach + wave_index * 18
        offset_y = wave_index * 16
        controls = [
            (flute_center[0] - 18, flute_center[1] - 2),
            (cx - span * 0.38, cy - 22 - lift - offset_y),
            (cx + span * 0.46, cy - 62 - lift + math.sin(phase + wave_index) * 12),
            (cx + span, cy - 18 + offset_y * 0.2),
        ]
        (front_curves if front and wave_index == 1 else back_curves).append(controls)
    result = energy_composite(
        image,
        back_curves,
        front_curves,
        width=5,
        alpha=158,
        color=(94, 205, 255),
        highlight=(230, 252, 255),
        blur=1.7,
    )
    note_layer = Image.new("RGBA", result.size, (0, 0, 0, 0))
    draw_limb_stroke(
        note_layer,
        (torso[0] - 18, torso[1] - 4),
        (flute_center[0] - 28, flute_center[1] + 4),
        width=9,
        color=(104, 190, 255, 128),
        highlight=(226, 248, 255, 170),
    )
    draw_limb_stroke(
        note_layer,
        (torso[0] + 16, torso[1] - 6),
        (flute_center[0] + 26, flute_center[1] - 2),
        width=9,
        color=(104, 190, 255, 128),
        highlight=(226, 248, 255, 170),
    )
    draw_flute(note_layer, flute_center, flute_angle, length=82, width=6, alpha=214)
    draw = ImageDraw.Draw(note_layer)
    for index in range(6):
        note_phase = phase + index * 0.72
        x = cx + math.cos(note_phase) * (reach * 0.72)
        y = cy - 38 + math.sin(note_phase * 1.35) * 30
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(210, 246, 255, 96 + index * 8))
        draw_spark(draw, x + 8, y - 8, 3, (142, 228, 255, 140))
    result.alpha_composite(note_layer)
    return result


def zhenji_attack_waves(image: Image.Image, frame_index: int) -> Image.Image:
    cx = SOURCE_WIDTH / 2
    cy = SOURCE_HEIGHT - 116
    patterns = [
        (
            [[(cx - 18, cy + 14), (92, cy - 20), (116, cy - 56), (cx + 42, cy - 42)]],
            [],
            5,
            138,
        ),
        (
            [[(cx - 24, cy + 12), (68, cy - 36), (120, cy - 90), (cx + 70, cy - 56)]],
            [[(cx + 20, cy + 14), (208, cy - 24), (206, cy - 72), (cx - 24, cy - 48)]],
            6,
            168,
        ),
        (
            [[(54, cy + 8), (86, cy - 92), (206, cy - 108), (232, cy - 18)]],
            [[(232, cy + 8), (186, cy - 106), (76, cy - 96), (54, cy + 18)]],
            7,
            198,
        ),
        (
            [[(50, cy - 2), (96, cy - 126), (226, cy - 116), (240, cy - 12)]],
            [[(238, cy + 4), (184, cy - 132), (60, cy - 98), (52, cy + 28)]],
            8,
            218,
        ),
        (
            [[(236, cy + 10), (196, cy - 114), (74, cy - 120), (50, cy - 6)]],
            [[(58, cy + 18), (116, cy - 132), (234, cy - 84), (cx + 28, cy + 18)]],
            8,
            210,
        ),
        (
            [[(cx + 24, cy + 16), (218, cy - 28), (192, cy - 86), (cx - 34, cy - 42)]],
            [[(cx - 24, cy + 14), (82, cy - 14), (92, cy - 64), (cx + 44, cy - 46)]],
            6,
            176,
        ),
        (
            [[(cx - 18, cy + 14), (82, cy - 18), (102, cy - 58), (cx + 28, cy - 34)]],
            [],
            5,
            136,
        ),
        (
            [[(cx + 16, cy + 14), (204, cy - 12), (184, cy - 54), (cx - 24, cy - 30)]],
            [],
            4,
            112,
        ),
    ]
    back, front, width, alpha = patterns[frame_index]
    flute_specs = [
        ((cx - 8, cy + 20), -0.22),
        ((cx - 30, cy + 6), -0.58),
        ((cx - 46, cy - 22), -0.86),
        ((cx + 8, cy - 58), -0.05),
        ((cx + 44, cy - 28), 0.58),
        ((cx + 34, cy + 2), 0.36),
        ((cx + 8, cy + 14), -0.08),
        ((cx - 4, cy + 20), -0.2),
    ]
    result = energy_composite(
        image,
        back,
        front,
        width=width,
        alpha=alpha,
        color=(82, 205, 255),
        highlight=(238, 252, 255),
        blur=1.9,
    )
    ring_layer = Image.new("RGBA", result.size, (0, 0, 0, 0))
    flute_center, flute_angle = flute_specs[frame_index]
    torso = (cx, cy + 50)
    draw_limb_stroke(
        ring_layer,
        (torso[0] - 18, torso[1] - 4),
        (flute_center[0] - 30, flute_center[1] + 4),
        width=10,
        color=(92, 174, 255, 148),
        highlight=(226, 248, 255, 188),
    )
    draw_limb_stroke(
        ring_layer,
        (torso[0] + 16, torso[1] - 6),
        (flute_center[0] + 28, flute_center[1] - 2),
        width=10,
        color=(92, 174, 255, 148),
        highlight=(226, 248, 255, 188),
    )
    draw_flute(ring_layer, flute_center, flute_angle, length=86, width=6, alpha=min(236, alpha + 10))
    draw = ImageDraw.Draw(ring_layer)
    if frame_index in (2, 3, 4):
        radius = 28 + (frame_index - 2) * 10
        draw.ellipse((cx - radius, cy - 72 - radius * 0.45, cx + radius, cy - 72 + radius * 0.45), outline=(185, 244, 255, 168), width=3)
        draw.ellipse((cx - radius - 18, cy - 70 - radius * 0.36, cx + radius + 18, cy - 70 + radius * 0.36), outline=(96, 205, 255, 112), width=2)
    for index in range(7):
        angle = frame_index * 0.55 + index * 0.9
        draw_spark(draw, cx + math.cos(angle) * 76, cy - 58 + math.sin(angle) * 34, 3, (214, 250, 255, 150))
    result.alpha_composite(ring_layer)
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


def fit_frames_to_safe_bounds(frames: list[Image.Image], margin: int, max_occupancy: float = 1.0) -> list[Image.Image]:
    if margin <= 0 and max_occupancy >= 1.0:
        return frames
    boxes = [frame.getchannel("A").getbbox() for frame in frames]
    visible_boxes = [box for box in boxes if box is not None]
    if not visible_boxes:
        return frames
    max_width = max(box[2] - box[0] for box in visible_boxes)
    max_height = max(box[3] - box[1] for box in visible_boxes)
    safe_width = FRAME_WIDTH - margin * 2
    safe_height = FRAME_HEIGHT - margin * 2
    if max_occupancy < 1.0:
        safe_width = min(safe_width, FRAME_WIDTH * max_occupancy)
        safe_height = min(safe_height, FRAME_HEIGHT * max_occupancy)
    scale = min(1.0, safe_width / max_width, safe_height / max_height)
    fits = all(
        box[0] >= margin
        and box[1] >= margin
        and box[2] <= FRAME_WIDTH - margin
        and box[3] <= FRAME_HEIGHT - margin
        for box in visible_boxes
    )
    occupancy_fits = max_width <= safe_width and max_height <= safe_height
    if scale >= 1.0 and fits and occupancy_fits:
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


def diaochan_idle_frames(seed: Image.Image, accent: tuple[int, int, int, int]) -> list[Image.Image]:
    specs = [
        (0, 0, 1.0, 1.0, -4.0, 0.45, 54, 0),
        (-3, -3, 1.01, 1.02, -9.5, 1.15, 68, 6),
        (-6, -7, 1.03, 1.03, -16.0, 1.9, 82, 12),
        (4, -6, 1.03, 1.02, 13.5, 2.65, 82, 10),
        (7, -3, 1.01, 1.02, 8.0, 3.35, 68, 5),
        (0, 0, 1.0, 1.0, 2.5, 4.0, 54, 0),
    ]
    frames = []
    for dx, dy, sx, sy, rotate, phase, reach, lift in specs:
        frame = variant(seed, dx=dx, dy=dy, scale_x=sx, scale_y=sy, rotate=rotate, wave=1.2, phase=phase)
        frames.append(diaochan_dance_ribbons(frame, phase, reach, lift, front=phase > 2))
    return [add_smear(frame, accent, -3 if index < 3 else 3, 1, 1.6) if index in (2, 3) else frame for index, frame in enumerate(frames)]


def xiaoqiao_idle_frames(seed: Image.Image, accent: tuple[int, int, int, int]) -> list[Image.Image]:
    specs = [
        (0, 0, 1.0, 1.0, -3.0, 0.35, 52, 0),
        (-4, -3, 1.01, 1.02, -9.0, 1.05, 66, 5),
        (-7, -6, 1.03, 1.03, -15.0, 1.85, 82, 11),
        (5, -6, 1.03, 1.02, 13.0, 2.6, 84, 10),
        (8, -3, 1.01, 1.02, 8.0, 3.3, 68, 5),
        (0, 0, 1.0, 1.0, 2.0, 4.0, 54, 0),
    ]
    frames: list[Image.Image] = []
    for dx, dy, sx, sy, rotate, phase, reach, lift in specs:
        frame = variant(seed, dx=dx, dy=dy, scale_x=sx, scale_y=sy, rotate=rotate, wave=1.35, phase=phase, brightness=1.02)
        frames.append(xiaoqiao_fan_trails(frame, phase, reach, lift, front=phase > 2))
    return [add_smear(frame, accent, -4 if index < 3 else 4, 1, 1.7) if index in (2, 3) else frame for index, frame in enumerate(frames)]


def zhenji_idle_frames(seed: Image.Image, accent: tuple[int, int, int, int]) -> list[Image.Image]:
    specs = [
        (0, 0, 1.0, 1.0, -2.0, 0.3, 46, 0),
        (-3, -3, 1.01, 1.02, -6.0, 1.05, 58, 4),
        (-5, -7, 1.03, 1.04, -10.0, 1.8, 74, 10),
        (3, -6, 1.03, 1.03, 8.0, 2.55, 78, 10),
        (5, -3, 1.01, 1.02, 5.0, 3.25, 60, 4),
        (0, 0, 1.0, 1.0, 0.0, 4.0, 46, 0),
    ]
    frames: list[Image.Image] = []
    for dx, dy, sx, sy, rotate, phase, reach, lift in specs:
        frame = variant(seed, dx=dx, dy=dy, scale_x=sx, scale_y=sy, rotate=rotate, wave=1.05, phase=phase, brightness=1.015)
        frames.append(zhenji_flute_waves(frame, phase, reach, lift, front=phase > 2))
    return [add_smear(frame, accent, -3 if index < 3 else 3, 1, 1.5) if index in (2, 3) else frame for index, frame in enumerate(frames)]


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


def diaochan_run_frames(seed: Image.Image, accent: tuple[int, int, int, int], lean: float) -> list[Image.Image]:
    specs = [
        (-8, 0, 1.0, 1.0, lean * 0.8, 0.35, 68, 4),
        (-15, -8, 1.04, 1.02, lean * 1.65, 1.15, 90, 10),
        (-7, -3, 1.02, 1.0, lean * 0.35, 1.85, 74, 4),
        (8, 0, 1.0, 1.0, -lean * 0.55, 2.6, 68, 4),
        (15, -8, 1.04, 1.02, -lean * 1.35, 3.45, 90, 10),
        (6, -3, 1.02, 1.0, -lean * 0.25, 4.2, 74, 4),
    ]
    frames = []
    for dx, dy, sx, sy, rotate, phase, reach, lift in specs:
        frame = variant(seed, dx=dx, dy=dy, scale_x=sx, scale_y=sy, rotate=rotate, wave=1.8, phase=phase, brightness=1.02)
        frames.append(diaochan_dance_ribbons(frame, phase, reach, lift, front=True))
    return [add_smear(frame, accent, -7 if index < 3 else 7, 2, 2.0) if index in (1, 4) else frame for index, frame in enumerate(frames)]


def xiaoqiao_run_frames(seed: Image.Image, accent: tuple[int, int, int, int], lean: float) -> list[Image.Image]:
    specs = [
        (-8, 0, 1.0, 1.0, lean * 0.75, 0.35, 62, 3),
        (-16, -8, 1.04, 1.03, lean * 1.6, 1.1, 88, 10),
        (-7, -3, 1.02, 1.0, lean * 0.35, 1.85, 72, 4),
        (8, 0, 1.0, 1.0, -lean * 0.55, 2.55, 62, 3),
        (16, -8, 1.04, 1.03, -lean * 1.35, 3.35, 88, 10),
        (6, -3, 1.02, 1.0, -lean * 0.25, 4.1, 72, 4),
    ]
    frames: list[Image.Image] = []
    for dx, dy, sx, sy, rotate, phase, reach, lift in specs:
        frame = variant(seed, dx=dx, dy=dy, scale_x=sx, scale_y=sy, rotate=rotate, wave=1.9, phase=phase, brightness=1.025)
        frames.append(xiaoqiao_fan_trails(frame, phase, reach, lift, front=True))
    return [add_smear(frame, accent, -8 if index < 3 else 8, 2, 2.0) if index in (1, 4) else frame for index, frame in enumerate(frames)]


def zhenji_run_frames(seed: Image.Image, accent: tuple[int, int, int, int], lean: float) -> list[Image.Image]:
    specs = [
        (-6, 0, 1.0, 1.0, lean * 0.55, 0.35, 54, 2),
        (-12, -7, 1.03, 1.03, lean * 1.35, 1.1, 76, 8),
        (-5, -3, 1.02, 1.01, lean * 0.25, 1.85, 62, 3),
        (6, 0, 1.0, 1.0, -lean * 0.45, 2.55, 54, 2),
        (12, -7, 1.03, 1.03, -lean * 1.15, 3.35, 76, 8),
        (5, -3, 1.02, 1.01, -lean * 0.2, 4.1, 62, 3),
    ]
    frames: list[Image.Image] = []
    for dx, dy, sx, sy, rotate, phase, reach, lift in specs:
        frame = variant(seed, dx=dx, dy=dy, scale_x=sx, scale_y=sy, rotate=rotate, wave=1.55, phase=phase, brightness=1.02)
        frames.append(zhenji_flute_waves(frame, phase, reach, lift, front=True))
    return [add_smear(frame, accent, -6 if index < 3 else 6, 2, 1.9) if index in (1, 4) else frame for index, frame in enumerate(frames)]


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


def diaochan_attack_frames(hero_dir: Path, idle: Image.Image, accent: tuple[int, int, int, int], lean: float) -> list[Image.Image]:
    seed = remove_small_alpha_components(clear_edge_alpha(Image.open(hero_dir / "attack-0.png").convert("RGBA")))
    specs = [
        (-5, -1, 1.0, 1.0, lean * 0.35, 0.5, 1.0),
        (-13, -5, 1.03, 1.03, lean * 0.9, 1.0, 1.03),
        (-18, -9, 1.06, 1.04, lean * 1.45, 1.55, 1.06),
        (8, -11, 1.1, 1.03, -lean * 1.15, 2.2, 1.09),
        (19, -8, 1.08, 1.02, -lean * 1.5, 2.8, 1.08),
        (12, -4, 1.04, 1.01, -lean * 0.6, 3.35, 1.05),
        (4, -1, 1.01, 1.0, lean * 0.15, 3.85, 1.02),
        (0, 0, 1.0, 1.0, 0, 4.35, 1.0),
    ]
    frames: list[Image.Image] = []
    for index, (dx, dy, sx, sy, rotate, phase, brightness) in enumerate(specs):
        source = idle if index == 7 else seed
        frame = variant(source, dx=dx, dy=dy, scale_x=sx, scale_y=sy, rotate=rotate, wave=2.1, phase=phase, brightness=brightness)
        frame = diaochan_attack_ribbons(frame, index)
        if index in (2, 3, 4):
            frame = add_smear(frame, accent, -10 if index < 3 else 10, 2, 2.2)
        frames.append(frame)
    return frames


def xiaoqiao_attack_frames(hero_dir: Path, idle: Image.Image, accent: tuple[int, int, int, int], lean: float) -> list[Image.Image]:
    seed = remove_small_alpha_components(clear_edge_alpha(Image.open(hero_dir / "attack-0.png").convert("RGBA")))
    specs = [
        (-6, -1, 1.0, 1.0, lean * 0.35, 0.45, 1.0),
        (-14, -6, 1.03, 1.03, lean * 0.95, 1.0, 1.03),
        (-20, -10, 1.07, 1.04, lean * 1.55, 1.55, 1.06),
        (10, -12, 1.11, 1.03, -lean * 1.15, 2.2, 1.09),
        (22, -8, 1.1, 1.02, -lean * 1.55, 2.8, 1.08),
        (14, -4, 1.05, 1.01, -lean * 0.62, 3.35, 1.05),
        (5, -1, 1.02, 1.0, lean * 0.15, 3.85, 1.02),
        (0, 0, 1.0, 1.0, 0, 4.35, 1.0),
    ]
    frames: list[Image.Image] = []
    for index, (dx, dy, sx, sy, rotate, phase, brightness) in enumerate(specs):
        source = idle if index == 7 else seed
        frame = variant(source, dx=dx, dy=dy, scale_x=sx, scale_y=sy, rotate=rotate, wave=2.15, phase=phase, brightness=brightness)
        frame = xiaoqiao_attack_flames(frame, index)
        if index in (2, 3, 4):
            frame = add_smear(frame, accent, -11 if index < 3 else 11, 2, 2.3)
        frames.append(frame)
    return frames


def zhenji_attack_frames(hero_dir: Path, idle: Image.Image, accent: tuple[int, int, int, int], lean: float) -> list[Image.Image]:
    seed = remove_small_alpha_components(clear_edge_alpha(Image.open(hero_dir / "attack-0.png").convert("RGBA")))
    specs = [
        (-4, -1, 1.0, 1.0, lean * 0.35, 0.45, 1.0),
        (-10, -5, 1.03, 1.04, lean * 0.82, 1.0, 1.03),
        (-14, -9, 1.06, 1.05, lean * 1.25, 1.55, 1.06),
        (7, -12, 1.09, 1.04, -lean * 0.9, 2.15, 1.08),
        (16, -10, 1.09, 1.02, -lean * 1.2, 2.75, 1.07),
        (10, -5, 1.05, 1.02, -lean * 0.55, 3.35, 1.04),
        (3, -1, 1.02, 1.0, lean * 0.15, 3.85, 1.02),
        (0, 0, 1.0, 1.0, 0, 4.35, 1.0),
    ]
    frames: list[Image.Image] = []
    for index, (dx, dy, sx, sy, rotate, phase, brightness) in enumerate(specs):
        source = idle if index == 7 else seed
        frame = variant(source, dx=dx, dy=dy, scale_x=sx, scale_y=sy, rotate=rotate, wave=1.95, phase=phase, brightness=brightness)
        frame = zhenji_attack_waves(frame, index)
        if index in (2, 3, 4):
            frame = add_smear(frame, accent, -8 if index < 3 else 8, 2, 2.15)
        frames.append(frame)
    return frames


def write_animation(
    hero_id: str,
    animation: str,
    frames: list[Image.Image],
    anchor_path: Path,
    lock_frame1: bool = True,
    safe_margin: int = 0,
    max_occupancy: float = 1.0,
) -> list[Path]:
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
    final_frames = fit_frames_to_safe_bounds(final_frames, safe_margin, max_occupancy)
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
        max_occupancy = config.get("maxOccupancy", 1.0)
        if hero_id == "diaochan":
            idle_sequence = diaochan_idle_frames(idle_seed, config["accent"])
            run_sequence = diaochan_run_frames(idle_seed, config["accent"], config["runLean"])
            attack_sequence = diaochan_attack_frames(hero_dir, idle_seed, config["accent"], config["attackLean"])
        elif hero_id == "xiaoqiao":
            idle_sequence = xiaoqiao_idle_frames(idle_seed, config["accent"])
            run_sequence = xiaoqiao_run_frames(idle_seed, config["accent"], config["runLean"])
            attack_sequence = xiaoqiao_attack_frames(hero_dir, idle_seed, config["accent"], config["attackLean"])
        elif hero_id == "zhenji":
            idle_sequence = zhenji_idle_frames(idle_seed, config["accent"])
            run_sequence = zhenji_run_frames(idle_seed, config["accent"], config["runLean"])
            attack_sequence = zhenji_attack_frames(hero_dir, idle_seed, config["accent"], config["attackLean"])
        else:
            idle_sequence = idle_frames(idle_seed, config["accent"])
            run_sequence = run_frames(idle_seed, config["accent"], config["runLean"])
            attack_sequence = attack_frames(hero_id, hero_dir, idle_seed, config["accent"], config["attackLean"])
        write_animation(hero_id, "idle", idle_sequence, idle_seed_path, safe_margin=safe_margin, max_occupancy=max_occupancy)
        write_animation(hero_id, "run", run_sequence, idle_seed_path, safe_margin=safe_margin, max_occupancy=max_occupancy)
        attack_paths = write_animation(
            hero_id,
            "attack",
            attack_sequence,
            attack_seed_path,
            False,
            attack_safe_margin,
            max_occupancy,
        )
        write_legacy_attack_frames(hero_dir, attack_paths)
        normalize_hero(hero_dir)


if __name__ == "__main__":
    main()
