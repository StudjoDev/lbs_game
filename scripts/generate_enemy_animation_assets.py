#!/usr/bin/env python3
"""Generate deterministic chibi enemy animation frames.

The output is dedicated enemy art, not cropped hero art. It mirrors the
project's chibi-card rendering language with simpler troop silhouettes and
produces transparent PNG frames plus per-frame raw source PNGs and
preview/reference sheets used by BattleScene.
"""

from __future__ import annotations

import math
import sys
from collections import deque
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / "public" / "assets" / "enemies"
SOURCE_ROOT = ROOT / "scripts" / "source" / "enemy-anims"
AI_SHEET_PATH = SOURCE_ROOT / "ai-minion-sheet.png"
FRAME_WIDTH = 192
FRAME_HEIGHT = 224
FRAME_SIZE = FRAME_WIDTH
FRAME_CENTER_X = FRAME_WIDTH // 2
FRAME_CENTER_Y = FRAME_HEIGHT // 2
SAFE_BOX_WIDTH = 122
SAFE_BOX_HEIGHT = 144
SCALE = 4
CANVAS_WIDTH = FRAME_WIDTH * SCALE
CANVAS_HEIGHT = FRAME_HEIGHT * SCALE


Color = tuple[int, int, int, int]


@dataclass(frozen=True)
class EnemyLook:
    enemy_id: str
    role: str
    primary: str
    accent: str
    size: int
    eye: str
    skin: str
    shadow_scale: float


ENEMIES: tuple[EnemyLook, ...] = (
    EnemyLook("infantry", "infantry", "#835344", "#ffd58a", 82, "#6a392e", "#f4bd91", 0.82),
    EnemyLook("archer", "archer", "#5f7d4b", "#ffe08a", 78, "#4e5b2d", "#f4bd91", 0.78),
    EnemyLook("shield", "shield", "#586274", "#dfe9ff", 88, "#36425d", "#f4bd91", 0.96),
    EnemyLook("cavalry", "cavalry", "#834c36", "#ffc76d", 88, "#6a392e", "#f4bd91", 1.12),
    EnemyLook("captain", "captain", "#833f50", "#ffd36a", 98, "#692532", "#f4bd91", 1.22),
    EnemyLook("lubu", "boss", "#4b2c66", "#ff536f", 128, "#ff5f9e", "#4b2c66", 1.72),
)

ACTIONS: dict[str, int] = {
    "walk": 4,
    "hit": 4,
    "death": 5,
}

AI_SHEET_LAYOUT: dict[str, tuple[int, int]] = {
    "infantry": (0, 0),
    "archer": (1, 0),
    "shield": (2, 0),
    "cavalry": (0, 1),
    "captain": (1, 1),
    "lubu": (2, 1),
}

AI_TARGET_HEIGHT: dict[str, int] = {
    "infantry": 110,
    "archer": 108,
    "shield": 112,
    "cavalry": 116,
    "captain": 122,
    "lubu": 138,
}

AI_TARGET_WIDTH: dict[str, int] = {
    "infantry": 102,
    "archer": 112,
    "shield": 112,
    "cavalry": 126,
    "captain": 118,
    "lubu": 124,
}


def hex_to_rgba(value: str, alpha: int = 255) -> Color:
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def with_alpha(value: str, alpha: int) -> Color:
    return (*hex_to_rgba(value)[:3], alpha)


def scaled(points: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(round(x * SCALE), round(y * SCALE)) for x, y in points]


def ellipse(draw: ImageDraw.ImageDraw, bbox: tuple[float, float, float, float], fill: Color | str, outline: Color | str | None = None, width: float = 1) -> None:
    draw.ellipse(tuple(round(v * SCALE) for v in bbox), fill=fill, outline=outline, width=max(1, round(width * SCALE)))


def line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill: Color | str, width: float, joint: str = "curve") -> None:
    draw.line(scaled(points), fill=fill, width=max(1, round(width * SCALE)), joint=joint)


def polygon(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill: Color | str, outline: Color | str | None = None) -> None:
    draw.polygon(scaled(points), fill=fill, outline=outline)


def rounded_rect(draw: ImageDraw.ImageDraw, bbox: tuple[float, float, float, float], radius: float, fill: Color | str, outline: Color | str | None = None, width: float = 1) -> None:
    draw.rounded_rectangle(tuple(round(v * SCALE) for v in bbox), radius=round(radius * SCALE), fill=fill, outline=outline, width=max(1, round(width * SCALE)))


def remove_chroma_green(image: Image.Image) -> Image.Image:
    """Remove the generated sheet's flat green background while preserving dark green armor."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            dominant_green = green > 165 and green - max(red, blue) > 48
            if dominant_green:
                pixels[x, y] = (red, green, blue, 0)
    return rgba


def keep_largest_alpha_component(image: Image.Image) -> Image.Image:
    width, height = image.size
    alpha = image.getchannel("A")
    alpha_pixels = alpha.load()
    visited = bytearray(width * height)
    best_component: list[int] = []

    for start_y in range(height):
        for start_x in range(width):
            start_index = start_y * width + start_x
            if visited[start_index] or alpha_pixels[start_x, start_y] <= 12:
                continue
            visited[start_index] = 1
            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            component: list[int] = [start_index]
            while queue:
                x, y = queue.popleft()
                for nx in (x - 1, x, x + 1):
                    for ny in (y - 1, y, y + 1):
                        if nx == x and ny == y:
                            continue
                        if nx < 0 or ny < 0 or nx >= width or ny >= height:
                            continue
                        index = ny * width + nx
                        if visited[index] or alpha_pixels[nx, ny] <= 12:
                            continue
                        visited[index] = 1
                        queue.append((nx, ny))
                        component.append(index)
            if len(component) > len(best_component):
                best_component = component

    if not best_component:
        return image

    keep = bytearray(width * height)
    for index in best_component:
        keep[index] = 1

    result = image.copy()
    result_pixels = result.load()
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if not keep[index]:
                red, green, blue, _ = result_pixels[x, y]
                result_pixels[x, y] = (red, green, blue, 0)
    return result


def normalize_source_sprite(sprite: Image.Image, enemy_id: str) -> Image.Image:
    alpha_bbox = sprite.getchannel("A").getbbox()
    if alpha_bbox is None:
        return Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))

    left, top, right, bottom = alpha_bbox
    pad = 8
    cropped = sprite.crop((max(0, left - pad), max(0, top - pad), min(sprite.width, right + pad), min(sprite.height, bottom + pad)))
    target_height = AI_TARGET_HEIGHT[enemy_id]
    target_width = AI_TARGET_WIDTH[enemy_id]
    scale = min(target_width / cropped.width, target_height / cropped.height)
    resized = cropped.resize((max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    x = round((FRAME_WIDTH - resized.width) / 2)
    y = round((FRAME_HEIGHT - resized.height) / 2)
    canvas.alpha_composite(resized, (x, y))
    return canvas


def normalize_runtime_frame(frame: Image.Image) -> Image.Image:
    """Center enemy alpha in the same runtime frame used by warrior sprites."""
    rgba = frame.convert("RGBA")
    alpha_bbox = rgba.getchannel("A").getbbox()
    if alpha_bbox is None:
        return Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))

    left, top, right, bottom = alpha_bbox
    cropped = rgba.crop((left, top, right, bottom))
    bbox_width = right - left
    bbox_height = bottom - top
    scale = min(1, SAFE_BOX_WIDTH / bbox_width, SAFE_BOX_HEIGHT / bbox_height)
    if scale < 1:
        cropped = cropped.resize(
            (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
            Image.Resampling.LANCZOS,
        )

    canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    x = round(FRAME_CENTER_X - cropped.width / 2)
    y = round(FRAME_CENTER_Y - cropped.height / 2)
    canvas.alpha_composite(cropped, (x, y))
    return canvas


@lru_cache(maxsize=None)
def load_ai_source_sprite(enemy_id: str) -> Image.Image | None:
    if not AI_SHEET_PATH.exists() or enemy_id not in AI_SHEET_LAYOUT:
        return None

    sheet = Image.open(AI_SHEET_PATH).convert("RGBA")
    columns = 3
    rows = 2
    cell_w = sheet.width // columns
    cell_h = sheet.height // rows
    column, row = AI_SHEET_LAYOUT[enemy_id]
    cell = sheet.crop((column * cell_w, row * cell_h, (column + 1) * cell_w, (row + 1) * cell_h))
    source = keep_largest_alpha_component(remove_chroma_green(cell))
    return normalize_source_sprite(source, enemy_id)


def draw_shadow(draw: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float) -> None:
    ellipse(draw, (cx - rx, cy - ry, cx + rx, cy + ry), (0, 0, 0, 78))


def draw_eye(draw: ImageDraw.ImageDraw, cx: float, cy: float, radius: float, color: str) -> None:
    ellipse(draw, (cx - radius * 0.84, cy - radius, cx + radius * 0.84, cy + radius * 1.08), (255, 248, 235, 250))
    ellipse(draw, (cx - radius * 0.48, cy - radius * 0.52, cx + radius * 0.48, cy + radius * 0.82), color)
    ellipse(draw, (cx - radius * 0.18, cy - radius * 0.18, cx + radius * 0.3, cy + radius * 0.58), (35, 15, 20, 242))
    ellipse(draw, (cx - radius * 0.34, cy - radius * 0.5, cx, cy - radius * 0.16), (255, 255, 255, 235))


def add_sprite_finish(image: Image.Image, accent: str) -> Image.Image:
    alpha = image.getchannel("A")
    outline_alpha = alpha.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(0.45 * SCALE))
    outline = Image.new("RGBA", image.size, (38, 17, 24, 220))
    outline.putalpha(outline_alpha.point(lambda value: round(value * 0.7)))
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(outline)
    result.alpha_composite(image)
    return ImageEnhance.Contrast(ImageEnhance.Color(result).enhance(1.12)).enhance(1.08)


def draw_armor_detail(draw: ImageDraw.ImageDraw, look: EnemyLook, mid: float, base_y: float, size: float, lean: float, alpha: int) -> None:
    accent = with_alpha(look.accent, round(alpha * 0.82))
    shine = with_alpha("#fff4d2", round(alpha * 0.38))
    dark = with_alpha("#24131a", round(alpha * 0.42))
    shoulder_y = base_y - size * 0.65
    for side in (-1, 1):
        ellipse(
            draw,
            (
                mid + side * size * 0.23 + lean * 0.12 - size * 0.11,
                shoulder_y - size * 0.08,
                mid + side * size * 0.23 + lean * 0.12 + size * 0.11,
                shoulder_y + size * 0.1,
            ),
            with_alpha(look.primary, round(alpha * 0.92)),
            accent,
            size * 0.018,
        )
    for index in range(3):
        y = base_y - size * (0.57 - index * 0.12)
        line(draw, [(mid - size * 0.2 + lean * 0.08, y), (mid + size * 0.2 + lean * 0.08, y + size * 0.02)], dark, size * 0.012)
        line(draw, [(mid - size * 0.14 + lean * 0.08, y - size * 0.018), (mid + size * 0.1 + lean * 0.08, y)], shine, size * 0.008)
    ellipse(draw, (mid - size * 0.045 + lean * 0.1, base_y - size * 0.6, mid + size * 0.045 + lean * 0.1, base_y - size * 0.51), accent)
    if look.role == "archer":
        line(draw, [(mid - size * 0.26, base_y - size * 0.36), (mid + size * 0.2, base_y - size * 0.52)], shine, size * 0.012)
    if look.role in ("captain", "boss"):
        for side in (-1, 1):
            line(draw, [(mid + side * size * 0.18, base_y - size * 0.76), (mid + side * size * 0.35, base_y - size * 0.95)], accent, size * 0.018)


def draw_weapon(draw: ImageDraw.ImageDraw, look: EnemyLook, mid: float, base_y: float, size: float, pose: dict[str, float]) -> None:
    accent = look.accent
    sway = pose.get("weapon_sway", 0)
    if look.role == "archer":
        draw.arc(
            tuple(round(v * SCALE) for v in (mid + size * 0.18 + sway, base_y - size * 0.66, mid + size * 0.68 + sway, base_y - size * 0.02)),
            -112,
            112,
            fill=accent,
            width=max(1, round(size * 0.045 * SCALE)),
        )
        line(draw, [(mid + size * 0.49 + sway, base_y - size * 0.6), (mid + size * 0.49 + sway, base_y - size * 0.08)], with_alpha("#fff0bd", 220), size * 0.014)
        line(draw, [(mid - size * 0.04, base_y - size * 0.36), (mid + size * 0.6 + sway, base_y - size * 0.36)], accent, size * 0.022)
        polygon(draw, [(mid + size * 0.62 + sway, base_y - size * 0.36), (mid + size * 0.52 + sway, base_y - size * 0.42), (mid + size * 0.52 + sway, base_y - size * 0.3)], accent)
    elif look.role in ("captain", "boss"):
        line(draw, [(mid - size * 0.42 + sway, base_y - size * 0.12), (mid + size * 0.48 + sway, base_y - size * 0.82)], accent, size * 0.055)
        ellipse(draw, (mid + size * 0.4 + sway, base_y - size * 0.96, mid + size * 0.6 + sway, base_y - size * 0.62), accent)
    elif look.role == "shield":
        line(draw, [(mid - size * 0.44 + sway, base_y - size * 0.18), (mid - size * 0.12 + sway, base_y - size * 0.54)], accent, size * 0.04)
    elif look.role == "infantry":
        line(draw, [(mid - size * 0.48 + sway, base_y - size * 0.04), (mid + size * 0.44 + sway, base_y - size * 0.72)], accent, size * 0.036)
        polygon(draw, [(mid + size * 0.44 + sway, base_y - size * 0.72), (mid + size * 0.31 + sway, base_y - size * 0.52), (mid + size * 0.56 + sway, base_y - size * 0.56)], accent)
        line(draw, [(mid - size * 0.42 + sway, base_y - size * 0.07), (mid + size * 0.34 + sway, base_y - size * 0.63)], with_alpha("#fff3c9", 120), size * 0.012)
    else:
        line(draw, [(mid - size * 0.38 + sway, base_y - size * 0.12), (mid + size * 0.32 + sway, base_y - size * 0.72)], accent, size * 0.05)
        polygon(draw, [(mid + size * 0.32 + sway, base_y - size * 0.72), (mid + size * 0.18 + sway, base_y - size * 0.52), (mid + size * 0.42 + sway, base_y - size * 0.55)], accent)


def draw_enemy(look: EnemyLook, pose: dict[str, float]) -> Image.Image:
    image = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    size = look.size
    mid = 96 + pose.get("dx", 0)
    base_y = 152 + pose.get("dy", 0)
    squash_x = pose.get("sx", 1.0)
    squash_y = pose.get("sy", 1.0)
    lean = pose.get("lean", 0)
    alpha = round(255 * pose.get("alpha", 1.0))
    primary = with_alpha(look.primary, alpha)
    accent = with_alpha(look.accent, alpha)
    skin = with_alpha(look.skin, alpha)

    if look.role == "cavalry":
        horse_y = base_y - size * 0.04
        ellipse(draw, (mid - size * 0.52, horse_y - size * 0.13, mid + size * 0.36, horse_y + size * 0.22), with_alpha("#2a1a16", alpha), accent, size * 0.025)
        ellipse(draw, (mid + size * 0.16, horse_y - size * 0.27, mid + size * 0.46, horse_y + size * 0.04), primary, accent, size * 0.025)
        for leg_dx in (-0.32, -0.12, 0.14, 0.3):
            leg_swing = math.sin(pose.get("phase", 0) + leg_dx * 8) * 5
            line(draw, [(mid + size * leg_dx, horse_y + size * 0.16), (mid + size * leg_dx + leg_swing, horse_y + size * 0.38)], with_alpha("#211611", alpha), size * 0.045)
    else:
        step = math.sin(pose.get("phase", 0))
        boot = with_alpha("#2a1715", alpha)
        rounded_rect(draw, (mid - size * 0.21 - step * 2, base_y - size * 0.07, mid - size * 0.02 - step * 2, base_y + size * 0.12), size * 0.045, boot, accent, size * 0.012)
        rounded_rect(draw, (mid + size * 0.02 + step * 2, base_y - size * 0.07, mid + size * 0.21 + step * 2, base_y + size * 0.12), size * 0.045, boot, accent, size * 0.012)

    body_rx = size * (0.38 if look.role == "shield" else 0.32) * squash_x
    body_ry = size * 0.36 * squash_y
    if look.role != "shield":
        cape = with_alpha("#2a1720", round(alpha * 0.5))
        polygon(
            draw,
            [
                (mid - size * 0.22 + lean * 0.08, base_y - size * 0.66),
                (mid + size * 0.32 + lean * 0.08, base_y - size * 0.58),
                (mid + size * 0.18 + lean * 0.08, base_y - size * 0.05),
                (mid - size * 0.36 + lean * 0.08, base_y - size * 0.13),
            ],
            cape,
        )
    ellipse(draw, (mid - body_rx + lean * 0.2, base_y - size * 0.84, mid + body_rx + lean * 0.2, base_y - size * 0.12), primary, accent, size * 0.045)
    draw_armor_detail(draw, look, mid, base_y, size, lean, alpha)
    sleeve = with_alpha(look.primary, round(alpha * 0.9))
    line(draw, [(mid - size * 0.27 + lean * 0.08, base_y - size * 0.55), (mid - size * 0.43 + lean * 0.05, base_y - size * 0.34)], sleeve, size * 0.075)
    line(draw, [(mid + size * 0.27 + lean * 0.08, base_y - size * 0.55), (mid + size * 0.42 + lean * 0.05, base_y - size * 0.34)], sleeve, size * 0.075)

    if look.role == "shield":
        shield_w = size * 0.56
        polygon(
            draw,
            [
                (mid, base_y - size * 0.78),
                (mid + shield_w * 0.52 + lean * 0.1, base_y - size * 0.68),
                (mid + shield_w * 0.4 + lean * 0.1, base_y - size * 0.32),
                (mid, base_y - size * 0.15),
                (mid - shield_w * 0.4 + lean * 0.1, base_y - size * 0.32),
                (mid - shield_w * 0.52 + lean * 0.1, base_y - size * 0.68),
            ],
            with_alpha("#e9edf4", round(alpha * 0.96)),
            accent,
        )

    head_y = base_y - size * 0.82
    ellipse(draw, (mid - size * 0.25 + lean * 0.38, head_y - size * 0.24, mid + size * 0.25 + lean * 0.38, head_y + size * 0.26), skin, with_alpha("#fff5da", round(alpha * 0.34)), size * 0.024)
    polygon(
        draw,
        [
            (mid - size * 0.36 + lean * 0.2, head_y - size * 0.12),
            (mid - size * (0.28 if look.role == "boss" else 0.18) + lean * 0.24, head_y - size * 0.38),
            (mid + size * (0.28 if look.role == "boss" else 0.18) + lean * 0.24, head_y - size * 0.38),
            (mid + size * 0.36 + lean * 0.2, head_y - size * 0.12),
            (mid + size * 0.24 + lean * 0.16, head_y - size * 0.18),
            (mid - size * 0.24 + lean * 0.16, head_y - size * 0.18),
        ],
        primary,
        accent,
    )
    ellipse(draw, (mid - size * 0.08 + lean * 0.2, head_y - size * 0.28, mid + size * 0.08 + lean * 0.2, head_y - size * 0.12), accent)
    if look.role in ("captain", "boss"):
        horn = "#ff4e74" if look.role == "boss" else "#ffd36a"
        line(draw, [(mid - size * 0.22, head_y - size * 0.26), (mid - size * 0.42, head_y - size * 0.44)], with_alpha(horn, alpha), size * 0.045)
        line(draw, [(mid + size * 0.22, head_y - size * 0.26), (mid + size * 0.42, head_y - size * 0.44)], with_alpha(horn, alpha), size * 0.045)

    eye_offset = pose.get("eye_offset", 0)
    draw_eye(draw, mid - size * 0.09 + lean * 0.34 + eye_offset, head_y + size * 0.02, size * 0.105, look.eye)
    draw_eye(draw, mid + size * 0.09 + lean * 0.34 + eye_offset, head_y + size * 0.02, size * 0.105, look.eye)
    ellipse(draw, (mid - size * 0.2 + lean * 0.32, head_y + size * 0.08, mid - size * 0.11 + lean * 0.32, head_y + size * 0.15), (255, 128, 148, round(alpha * 0.24)))
    ellipse(draw, (mid + size * 0.11 + lean * 0.32, head_y + size * 0.08, mid + size * 0.2 + lean * 0.32, head_y + size * 0.15), (255, 128, 148, round(alpha * 0.24)))
    mouth_y = head_y + size * 0.13 + pose.get("mouth_dy", 0)
    if pose.get("hit_face", 0) > 0:
        line(draw, [(mid - size * 0.07, mouth_y), (mid + size * 0.07, mouth_y + size * 0.02)], with_alpha("#6d3a2c", alpha), size * 0.026)
    else:
        draw.arc(
            (round((mid - size * 0.07) * SCALE), round((mouth_y - size * 0.02) * SCALE), round((mid + size * 0.07) * SCALE), round((mouth_y + size * 0.1) * SCALE)),
            8,
            172,
            fill=with_alpha("#ffd98a" if look.role == "boss" else "#6d3a2c", alpha),
            width=max(1, round(size * 0.023 * SCALE)),
        )

    rounded_rect(draw, (mid - size * 0.22 + lean * 0.1, base_y - size * 0.2, mid + size * 0.22 + lean * 0.1, base_y + size * 0.05), size * 0.07, primary, accent, size * 0.04)
    draw_weapon(draw, look, mid, base_y, size, pose)

    image = add_sprite_finish(image, look.accent)
    image = image.resize((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.LANCZOS)
    return normalize_runtime_frame(image)


def offset_no_wrap(image: Image.Image, dx: int, dy: int) -> Image.Image:
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    src_left = max(0, -dx)
    src_top = max(0, -dy)
    src_right = min(image.width, image.width - dx) if dx >= 0 else image.width
    src_bottom = min(image.height, image.height - dy) if dy >= 0 else image.height
    if src_right <= src_left or src_bottom <= src_top:
        return result
    result.alpha_composite(image.crop((src_left, src_top, src_right, src_bottom)), (max(0, dx), max(0, dy)))
    return result


def add_smear(image: Image.Image, color: str, dx: int, dy: int, strength: float = 0.42) -> Image.Image:
    alpha = image.getchannel("A").filter(ImageFilter.GaussianBlur(2.0))
    smear = Image.new("RGBA", image.size, with_alpha(color, round(180 * strength)))
    smear.putalpha(alpha.point(lambda value: round(value * strength)))
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(offset_no_wrap(smear, dx, dy))
    result.alpha_composite(image)
    return result


def transform_source_sprite(base: Image.Image, dx: int = 0, dy: int = 0, angle: float = 0, alpha: float = 1) -> Image.Image:
    rotated = base.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        center=(FRAME_CENTER_X, FRAME_CENTER_Y),
        fillcolor=(0, 0, 0, 0),
    )
    shifted = offset_no_wrap(rotated, dx, dy)
    if alpha < 1:
        channel = shifted.getchannel("A").point(lambda value: round(value * alpha))
        shifted.putalpha(channel)
    return shifted


def add_sprite_flash(frame: Image.Image, strength: float) -> Image.Image:
    flash = Image.new("RGBA", frame.size, (255, 244, 215, 0))
    flash.putalpha(frame.getchannel("A").point(lambda value: round(value * strength)))
    result = frame.copy()
    result.alpha_composite(flash)
    return result


def add_ground_dust(frame: Image.Image, amount: float) -> Image.Image:
    result = frame.copy()
    dust = Image.new("RGBA", result.size, (0, 0, 0, 0))
    dust_draw = ImageDraw.Draw(dust)
    alpha = round(125 * amount)
    for index in range(8):
        x = 58 + index * 12
        y = 176 - (index % 3) * 4
        rx = 5 + (index % 4)
        ry = 3 + (index % 2)
        dust_draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(222, 205, 172, alpha))
    result.alpha_composite(dust.filter(ImageFilter.GaussianBlur(1.2)))
    return result


def make_ai_frames(look: EnemyLook, action: str) -> list[Image.Image] | None:
    base = load_ai_source_sprite(look.enemy_id)
    if base is None:
        return None

    if action == "walk":
        poses = [(-7, 1, -4.0), (-2, -7, -2.4), (7, 1, 4.0), (2, -6, 2.4)]
        return [transform_source_sprite(base, dx, dy, angle) for dx, dy, angle in poses]
    if action == "hit":
        return [
            transform_source_sprite(base, 8, -3, 5.2),
            transform_source_sprite(base, -5, 1, -5.0),
            transform_source_sprite(base, 3, -1, 2.4),
            transform_source_sprite(base),
        ]
    if action == "death":
        frames = [
            transform_source_sprite(base),
            transform_source_sprite(base, 6, 5, 9, 0.94),
            transform_source_sprite(base, 13, 14, 20, 0.8),
            transform_source_sprite(base, 18, 25, 32, 0.58),
            transform_source_sprite(base, 22, 39, 45, 0.32),
        ]
        return frames
    raise ValueError(f"Unknown action: {action}")


def add_death_fade(frame: Image.Image, amount: float) -> Image.Image:
    lowered = ImageEnhance.Brightness(frame).enhance(max(0.25, 1 - amount * 0.45))
    alpha = lowered.getchannel("A").point(lambda value: round(value * (1 - amount * 0.58)))
    lowered.putalpha(alpha)
    return lowered


def make_frames(look: EnemyLook, action: str) -> list[Image.Image]:
    ai_frames = make_ai_frames(look, action)
    if ai_frames is not None:
        return ai_frames

    if action == "walk":
        poses = [
            {"dx": -4, "dy": 0, "lean": -3, "phase": 0.0, "weapon_sway": -2},
            {"dx": -1, "dy": -5, "lean": -6, "phase": 1.6, "weapon_sway": 2},
            {"dx": 4, "dy": 0, "lean": 3, "phase": 3.2, "weapon_sway": 3},
            {"dx": 1, "dy": -4, "lean": 5, "phase": 4.8, "weapon_sway": -1},
        ]
        frames = [draw_enemy(look, pose) for pose in poses]
        return frames
    if action == "hit":
        poses = [
            {"dx": 7, "dy": -2, "lean": 9, "sx": 1.08, "sy": 0.94, "hit_face": 1, "hit_flash": 1, "weapon_sway": 5},
            {"dx": -3, "dy": 1, "lean": -8, "sx": 0.96, "sy": 1.04, "hit_face": 1, "weapon_sway": -4},
            {"dx": 3, "dy": -1, "lean": 4, "sx": 1.03, "sy": 0.98, "hit_face": 1, "hit_flash": 0.45, "weapon_sway": 2},
            {"dx": 0, "dy": 0, "lean": -2, "hit_face": 0, "weapon_sway": 0},
        ]
        frames = [draw_enemy(look, pose) for pose in poses]
        frames[0] = add_smear(frames[0], "#fff1cf", 9, -3, 0.36)
        return frames
    if action == "death":
        poses = [
            {"dx": 0, "dy": 0, "lean": 0, "dust": 0.25},
            {"dx": 8, "dy": 5, "lean": 14, "sx": 1.06, "sy": 0.9, "hit_face": 1, "dust": 0.5, "weapon_sway": 7},
            {"dx": 15, "dy": 17, "lean": 24, "sx": 1.14, "sy": 0.72, "hit_face": 1, "dust": 0.7, "weapon_sway": 10},
            {"dx": 21, "dy": 29, "lean": 32, "sx": 1.22, "sy": 0.52, "hit_face": 1, "dust": 0.9, "alpha": 0.86, "weapon_sway": 12},
            {"dx": 26, "dy": 42, "lean": 40, "sx": 1.32, "sy": 0.34, "hit_face": 1, "dust": 1.0, "alpha": 0.54, "weapon_sway": 14},
        ]
        frames = [draw_enemy(look, pose) for pose in poses]
        return [add_death_fade(frame, index / 4) for index, frame in enumerate(frames)]
    raise ValueError(f"Unknown action: {action}")


def make_preview(frames: list[Image.Image]) -> Image.Image:
    gutter = 10
    preview = Image.new("RGBA", (FRAME_WIDTH * len(frames) + gutter * (len(frames) - 1), FRAME_HEIGHT), (28, 18, 24, 255))
    for index, frame in enumerate(frames):
        tile = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (38, 24, 34, 255))
        draw = ImageDraw.Draw(tile)
        for y in range(0, FRAME_HEIGHT, 16):
            for x in range(0, FRAME_WIDTH, 16):
                if (x // 16 + y // 16) % 2 == 0:
                    draw.rectangle((x, y, x + 15, y + 15), fill=(49, 32, 44, 255))
        tile.alpha_composite(frame)
        preview.alpha_composite(tile, (index * (FRAME_WIDTH + gutter), 0))
    return preview


def make_reference(frames: list[Image.Image]) -> Image.Image:
    gutter = 20
    strip = Image.new("RGBA", (FRAME_WIDTH * len(frames) + gutter * (len(frames) - 1), FRAME_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * (FRAME_WIDTH + gutter), 0))
    return strip


def write_animation(look: EnemyLook, action: str) -> list[Path]:
    frames = make_frames(look, action)
    out_dir = PUBLIC_ROOT / look.enemy_id / action
    source_dir = SOURCE_ROOT / look.enemy_id / action
    raw_dir = source_dir / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    source_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    written: list[Path] = []
    for index, frame in enumerate(frames, start=1):
        frame = normalize_runtime_frame(frame)
        path = out_dir / f"{index:02d}.png"
        frame.save(path)
        raw_path = raw_dir / f"{index:02d}.png"
        frame.save(raw_path)
        written.extend([path, raw_path])

    preview = make_preview(frames)
    reference = make_reference(frames)
    for root in (out_dir, source_dir):
        preview.save(root / "preview.png")
        reference.save(root / "reference-action.png")
        written.extend([root / "preview.png", root / "reference-action.png"])

    return written


def main() -> None:
    count = 0
    for look in ENEMIES:
        for action, expected_count in ACTIONS.items():
            written = write_animation(look, action)
            count += expected_count
            print(f"{look.enemy_id}/{action}: {expected_count} frames -> {PUBLIC_ROOT / look.enemy_id / action}")
    print(f"Generated {count} transparent {FRAME_WIDTH}x{FRAME_HEIGHT} PNG frames.")


if __name__ == "__main__":
    main()
