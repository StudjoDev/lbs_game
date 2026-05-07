#!/usr/bin/env python3
"""Generate procedural candidate assets for Zuo Ci.

The output intentionally stays in the Zuo Ci-only asset paths so parallel
agents can integrate shared registries later.
"""

from __future__ import annotations

import math
import shutil
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[4]
CHARACTER_DIR = ROOT / "public" / "assets" / "characters" / "zuoci"
ANIM_DIR = CHARACTER_DIR / "anim"
WORK_DIR = ROOT / "output" / "agent-work" / "zuoci"
WEB_DIR = ROOT / "output" / "web-game"

FRAME_W = 192
FRAME_H = 224
SCALE = 4

ELEMENTS = ["#7cf5ff", "#66e6a4", "#ff8f86", "#77a8ff", "#edf7ff"]


def color(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
        max(0, min(255, alpha)),
    )


def scale_point(point: tuple[float, float]) -> tuple[int, int]:
    return (round(point[0] * SCALE), round(point[1] * SCALE))


def scale_box(box: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(round(v * SCALE) for v in box)  # type: ignore[return-value]


def rotate_point(x: float, y: float, angle_deg: float, scale: float = 1.0) -> tuple[float, float]:
    radians = math.radians(angle_deg)
    x *= scale
    y *= scale
    return (
        x * math.cos(radians) - y * math.sin(radians),
        x * math.sin(radians) + y * math.cos(radians),
    )


def transformed(
    points: list[tuple[float, float]],
    cx: float,
    cy: float,
    angle_deg: float = 0.0,
    scale: float = 1.0,
) -> list[tuple[float, float]]:
    return [(cx + px, cy + py) for px, py in (rotate_point(x, y, angle_deg, scale) for x, y in points)]


class Canvas:
    def __init__(self, image: Image.Image) -> None:
        self.image = image
        self.draw = ImageDraw.Draw(image, "RGBA")

    def ellipse(
        self,
        box: tuple[float, float, float, float],
        fill: tuple[int, int, int, int] | None = None,
        outline: tuple[int, int, int, int] | None = None,
        width: float = 1,
    ) -> None:
        self.draw.ellipse(scale_box(box), fill=fill, outline=outline, width=max(1, round(width * SCALE)))

    def rectangle(
        self,
        box: tuple[float, float, float, float],
        fill: tuple[int, int, int, int] | None = None,
        outline: tuple[int, int, int, int] | None = None,
        width: float = 1,
    ) -> None:
        self.draw.rectangle(scale_box(box), fill=fill, outline=outline, width=max(1, round(width * SCALE)))

    def line(
        self,
        points: list[tuple[float, float]] | tuple[tuple[float, float], tuple[float, float]],
        fill: tuple[int, int, int, int],
        width: float = 1,
        joint: str = "curve",
    ) -> None:
        self.draw.line([scale_point(point) for point in points], fill=fill, width=max(1, round(width * SCALE)), joint=joint)

    def polygon(
        self,
        points: list[tuple[float, float]],
        fill: tuple[int, int, int, int] | None = None,
        outline: tuple[int, int, int, int] | None = None,
    ) -> None:
        self.draw.polygon([scale_point(point) for point in points], fill=fill, outline=outline)

    def arc(
        self,
        box: tuple[float, float, float, float],
        start: float,
        end: float,
        fill: tuple[int, int, int, int],
        width: float = 1,
    ) -> None:
        self.draw.arc(scale_box(box), start=start, end=end, fill=fill, width=max(1, round(width * SCALE)))


def make_frame(draw_fn: Callable[[Canvas], None]) -> Image.Image:
    high = Image.new("RGBA", (FRAME_W * SCALE, FRAME_H * SCALE), (0, 0, 0, 0))
    canvas = Canvas(high)
    draw_fn(canvas)
    low = high.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS)
    return low


def glow_line(c: Canvas, points: list[tuple[float, float]], base: str, alpha: int, width: float) -> None:
    c.line(points, color(base, round(alpha * 0.25)), width + 7)
    c.line(points, color(base, round(alpha * 0.5)), width + 3)
    c.line(points, color("#eefcff", min(235, alpha + 28)), max(1.2, width * 0.45))


def glow_ellipse(c: Canvas, box: tuple[float, float, float, float], base: str, alpha: int, width: float) -> None:
    c.ellipse(box, outline=color(base, round(alpha * 0.18)), width=width + 6)
    c.ellipse(box, outline=color(base, round(alpha * 0.42)), width=width + 2)
    c.ellipse(box, outline=color("#eaffff", min(230, alpha + 20)), width=max(1, width * 0.45))


def draw_star(c: Canvas, x: float, y: float, radius: float, base: str, alpha: int) -> None:
    c.line([(x - radius, y), (x + radius, y)], color(base, alpha), width=1)
    c.line([(x, y - radius), (x, y + radius)], color(base, alpha), width=1)
    c.line([(x - radius * 0.7, y - radius * 0.7), (x + radius * 0.7, y + radius * 0.7)], color("#f8ffff", round(alpha * 0.7)), width=0.8)
    c.line([(x - radius * 0.7, y + radius * 0.7), (x + radius * 0.7, y - radius * 0.7)], color("#f8ffff", round(alpha * 0.7)), width=0.8)


def draw_talisman(c: Canvas, x: float, y: float, angle: float, scale: float, fill_hex: str, alpha: int = 235) -> None:
    body = [(-5.8, -14), (5.8, -14), (6.4, 10.8), (2.4, 16), (0, 12.2), (-2.4, 16), (-6.4, 10.8)]
    pts = transformed(body, x, y, angle, scale)
    c.polygon(pts, fill=color(fill_hex, alpha), outline=color("#19375c", min(230, alpha + 25)))
    c.line(transformed([(-3.6, -9.5), (3.6, -9.5)], x, y, angle, scale), color("#ffffff", min(210, alpha)), width=0.9 * scale)
    c.line(transformed([(-3.7, -3.5), (3.1, -1.0), (-2.9, 2.0), (3.2, 5.6)], x, y, angle, scale), color("#173052", min(215, alpha)), width=1.0 * scale)
    c.line(transformed([(-2.6, 9.0), (2.7, 9.0)], x, y, angle, scale), color("#ffffff", min(180, alpha)), width=0.8 * scale)


def draw_staff(c: Canvas, x: float, y: float, angle: float, scale: float, alpha: int = 245) -> None:
    shaft = transformed([(0, 34), (0, -38)], x, y, angle, scale)
    c.line(shaft, color("#1a4c6c", round(alpha * 0.8)), width=5.0 * scale)
    c.line(shaft, color("#dffdf8", alpha), width=2.5 * scale)
    c.line(shaft, color("#7defff", round(alpha * 0.8)), width=1.1 * scale)
    top = transformed([(0, -44)], x, y, angle, scale)[0]
    c.ellipse((top[0] - 7 * scale, top[1] - 7 * scale, top[0] + 7 * scale, top[1] + 7 * scale), fill=color("#93f7ff", round(alpha * 0.82)), outline=color("#efffff", alpha), width=1.2 * scale)
    c.arc((top[0] - 13 * scale, top[1] - 12 * scale, top[0] + 13 * scale, top[1] + 12 * scale), 210 + angle, 490 + angle, color("#f2f5d0", round(alpha * 0.9)), width=2.0 * scale)
    charm = transformed([(5, -22)], x, y, angle, scale)[0]
    draw_talisman(c, charm[0], charm[1], angle + 12, 0.55 * scale, "#dffaf6", round(alpha * 0.8))


def draw_open_book(c: Canvas, x: float, y: float, scale: float, phase: float, alpha: int) -> None:
    sway = math.sin(phase) * 2.5
    left = transformed([(-18, -10), (0, -7), (0, 11), (-17, 8)], x + sway, y, -5, scale)
    right = transformed([(0, -7), (18, -10), (17, 8), (0, 11)], x + sway, y, 5, scale)
    c.polygon(left, fill=color("#eefcf2", alpha), outline=color("#2c6080", min(240, alpha + 15)))
    c.polygon(right, fill=color("#dff9ff", alpha), outline=color("#2c6080", min(240, alpha + 15)))
    c.line(transformed([(0, -7), (0, 12)], x + sway, y, 0, scale), color("#54cbd3", min(220, alpha)), width=1.0 * scale)
    for offset in (-9, -4, 6, 11):
        c.line(transformed([(offset, -3), (offset + 4, -1.5)], x + sway, y, 0, scale), color("#499eae", round(alpha * 0.75)), width=0.7 * scale)
        c.line(transformed([(offset, 3), (offset + 3, 4.5)], x + sway, y, 0, scale), color("#499eae", round(alpha * 0.65)), width=0.65 * scale)
    glow_ellipse(c, (x - 25 * scale, y - 18 * scale, x + 25 * scale, y + 18 * scale), "#8cfaff", round(alpha * 0.28), 0.7 * scale)


def draw_bagua(c: Canvas, cx: float, cy: float, radius: float, phase: float, alpha: int = 170) -> None:
    outer = (cx - radius, cy - radius * 0.56, cx + radius, cy + radius * 0.56)
    glow_ellipse(c, outer, "#84faff", alpha, 1.2)
    points = [
        (cx + math.cos(phase + i * math.tau / 8) * radius * 0.92, cy + math.sin(phase + i * math.tau / 8) * radius * 0.52)
        for i in range(8)
    ]
    c.line(points + [points[0]], color("#dffcff", round(alpha * 0.75)), width=1.2)
    for i, point in enumerate(points):
        c.line([(cx, cy), point], color("#7df4ff", round(alpha * 0.35)), width=0.7)
        tx = cx + math.cos(phase + i * math.tau / 8) * radius * 0.7
        ty = cy + math.sin(phase + i * math.tau / 8) * radius * 0.39
        for n in range(3):
            c.line([(tx - 3.5, ty - 3 + n * 3), (tx + 3.5, ty - 3 + n * 3)], color("#efffff", round(alpha * 0.8)), width=0.75)
    c.ellipse((cx - 9, cy - 5, cx + 9, cy + 5), fill=color("#132d49", round(alpha * 0.55)), outline=color("#eaffff", alpha), width=0.8)


def draw_mist(c: Canvas, phase: float, alpha: int = 120) -> None:
    c.arc((46, 64, 148, 160), 195 + math.degrees(phase) * 0.4, 330 + math.degrees(phase) * 0.4, color("#6df2ff", alpha), width=2.4)
    c.arc((55, 51, 139, 145), 20 + math.degrees(phase) * 0.55, 154 + math.degrees(phase) * 0.55, color("#e9ffff", round(alpha * 0.72)), width=1.5)
    c.arc((55, 94, 139, 188), 205 - math.degrees(phase) * 0.32, 336 - math.degrees(phase) * 0.32, color("#8bf7d4", round(alpha * 0.68)), width=1.6)
    for n in range(3):
        x = 70 + math.cos(phase + n * 2.0) * 35
        y = 85 + math.sin(phase * 1.3 + n * 1.7) * 24
        draw_star(c, x, y, 2.4, "#eaffff", round(alpha * 0.55))


def figure_point(cx: float, fy: float, lean: float, scale: float, x: float, y: float) -> tuple[float, float]:
    rx, ry = rotate_point(x, y, lean, scale)
    return cx + rx, fy + ry


def draw_sleeve(c: Canvas, cx: float, fy: float, lean: float, scale: float, start: tuple[float, float], end: tuple[float, float], alpha: int, accent: str) -> None:
    p0 = figure_point(cx, fy, lean, scale, *start)
    p1 = figure_point(cx, fy, lean, scale, *end)
    c.line([p0, p1], color("#1d5570", round(alpha * 0.85)), width=11.0 * scale)
    c.line([p0, p1], color(accent, round(alpha * 0.88)), width=7.0 * scale)
    c.line([p0, p1], color("#eefcff", round(alpha * 0.68)), width=2.6 * scale)
    c.ellipse((p1[0] - 4.2 * scale, p1[1] - 4.2 * scale, p1[0] + 4.2 * scale, p1[1] + 4.2 * scale), fill=color("#ffe7ca", alpha), outline=color("#24506b", alpha), width=0.8 * scale)


def draw_figure(c: Canvas, pose: dict[str, float], alpha: int = 255, ghost: bool = False) -> None:
    cx = 96 + pose.get("x", 0)
    fy = 181 + pose.get("y", 0)
    lean = pose.get("lean", 0)
    scale = pose.get("scale", 1.0)
    robe_sway = pose.get("robe", 0)
    accent = "#baf7ee" if not ghost else "#86f5ff"
    outline = "#173047" if not ghost else "#6af5ff"
    robe = "#f4fff7" if not ghost else "#bafaff"
    dark = "#235d73" if not ghost else "#3ceaff"

    if not ghost:
        c.ellipse((cx - 33 * scale, fy - 2 * scale, cx + 33 * scale, fy + 9 * scale), fill=color("#08213a", 42), width=1)

    staff_x = pose.get("staff_x", 34)
    staff_y = pose.get("staff_y", -53)
    staff_anchor = figure_point(cx, fy, lean, scale, staff_x, staff_y)
    draw_staff(c, staff_anchor[0], staff_anchor[1], pose.get("staff_angle", -10) + lean, scale * 0.82, round(alpha * (0.86 if ghost else 1.0)))

    for hx, hy, hw, hh in [(-24, -110, 23, 48), (5, -111, 27, 50), (-34, -96, 20, 45), (21, -94, 19, 42)]:
        center = figure_point(cx, fy, lean, scale, hx + hw / 2, hy + hh / 2)
        c.ellipse(
            (center[0] - hw * scale / 2, center[1] - hh * scale / 2, center[0] + hw * scale / 2, center[1] + hh * scale / 2),
            fill=color("#dff5f0" if not ghost else "#a2ffff", round(alpha * 0.75)),
            outline=color(outline, round(alpha * 0.8)),
            width=0.7 * scale,
        )

    feet_l = figure_point(cx, fy, lean, scale, -12, -2)
    feet_r = figure_point(cx, fy, lean, scale, 13, -2)
    c.ellipse((feet_l[0] - 8 * scale, feet_l[1] - 4 * scale, feet_l[0] + 8 * scale, feet_l[1] + 4 * scale), fill=color("#173047", alpha))
    c.ellipse((feet_r[0] - 8 * scale, feet_r[1] - 4 * scale, feet_r[0] + 8 * scale, feet_r[1] + 4 * scale), fill=color("#173047", alpha))

    robe_pts = transformed(
        [(-26 - robe_sway, -76), (27 - robe_sway * 0.25, -76), (35 + robe_sway, -9), (15, 1), (0, -8), (-15, 1), (-35 + robe_sway, -9)],
        cx,
        fy,
        lean,
        scale,
    )
    c.polygon(robe_pts, fill=color(robe, round(alpha * 0.98)), outline=color(outline, alpha))
    teal_panel = transformed([(-13, -71), (13, -71), (18, -13), (0, -5), (-18, -13)], cx, fy, lean, scale)
    c.polygon(teal_panel, fill=color(dark, round(alpha * 0.94)), outline=color("#d8f5ef", round(alpha * 0.86)))
    for sx in (-20, 20):
        p0 = figure_point(cx, fy, lean, scale, sx, -68)
        p1 = figure_point(cx, fy, lean, scale, sx * 0.55 + robe_sway, -10)
        c.line([p0, p1], color("#d7b85c", round(alpha * 0.8)), width=1.4 * scale)

    left_end = (-31 + pose.get("left_x", 0), -48 + pose.get("left_y", 0))
    right_end = (31 + pose.get("right_x", 0), -49 + pose.get("right_y", 0))
    draw_sleeve(c, cx, fy, lean, scale, (-17, -63), left_end, alpha, accent)
    draw_sleeve(c, cx, fy, lean, scale, (17, -63), right_end, alpha, "#d8fffa")

    belt = figure_point(cx, fy, lean, scale, 0, -48)
    c.ellipse((belt[0] - 9 * scale, belt[1] - 6 * scale, belt[0] + 9 * scale, belt[1] + 6 * scale), fill=color("#173047", alpha), outline=color("#d4be68", alpha), width=1.0 * scale)
    c.ellipse((belt[0] - 4 * scale, belt[1] - 4 * scale, belt[0] + 4 * scale, belt[1] + 4 * scale), fill=color("#8cfaff", round(alpha * 0.8)))

    head = figure_point(cx, fy, lean, scale, 0, -101)
    c.ellipse((head[0] - 29 * scale, head[1] - 31 * scale, head[0] + 29 * scale, head[1] + 31 * scale), fill=color("#f6ccb4", alpha), outline=color(outline, alpha), width=1.3 * scale)
    c.arc((head[0] - 31 * scale, head[1] - 34 * scale, head[0] + 31 * scale, head[1] + 22 * scale), 190, 350, color("#dff5f0", alpha), width=8.0 * scale)
    c.arc((head[0] - 33 * scale, head[1] - 35 * scale, head[0] + 33 * scale, head[1] + 26 * scale), 202, 335, color("#244b61", round(alpha * 0.62)), width=2.0 * scale)
    for eye_x in (-10, 10):
        ex, ey = figure_point(cx, fy, lean, scale, eye_x, -101)
        c.ellipse((ex - 5.5 * scale, ey - 6.5 * scale, ex + 5.5 * scale, ey + 6.5 * scale), fill=color("#0b324c", alpha))
        c.ellipse((ex - 2.0 * scale, ey - 2.4 * scale, ex + 2.8 * scale, ey + 3.5 * scale), fill=color("#73f5ff", round(alpha * 0.86)))
        c.ellipse((ex - 2.0 * scale, ey - 4.2 * scale, ex + 0.2 * scale, ey - 2.0 * scale), fill=color("#ffffff", alpha))
    mouth = figure_point(cx, fy, lean, scale, 0, -88)
    c.arc((mouth[0] - 5 * scale, mouth[1] - 3 * scale, mouth[0] + 5 * scale, mouth[1] + 4 * scale), 20, 160, color("#67382d", alpha), width=0.9 * scale)
    beard_top = figure_point(cx, fy, lean, scale, 0, -84)
    c.polygon(transformed([(-5, -1), (0, 12), (5, -1), (2, 7), (0, 16), (-2, 7)], beard_top[0], beard_top[1], lean * 0.2, scale), fill=color("#eaffff", round(alpha * 0.9)), outline=color("#6eb9c2", round(alpha * 0.75)))
    c.line([figure_point(cx, fy, lean, scale, -14, -112), figure_point(cx, fy, lean, scale, -4, -111)], color("#eaffff", alpha), width=1.3 * scale)
    c.line([figure_point(cx, fy, lean, scale, 4, -111), figure_point(cx, fy, lean, scale, 14, -112)], color("#eaffff", alpha), width=1.3 * scale)

    crown = figure_point(cx, fy, lean, scale, 0, -131)
    c.polygon(transformed([(-15, 6), (-6, -5), (0, 4), (7, -8), (16, 6), (8, 10), (-8, 10)], crown[0], crown[1], lean, scale), fill=color("#d9bd64", alpha), outline=color(outline, alpha))
    c.ellipse((crown[0] - 4 * scale, crown[1] - 2 * scale, crown[0] + 4 * scale, crown[1] + 6 * scale), fill=color("#7cf5ff", round(alpha * 0.92)), outline=color("#efffff", alpha), width=0.7 * scale)


def draw_orbit_talismans(c: Canvas, phase: float, alpha: int = 220, rx: float = 43, ry: float = 33, cy: float = 103) -> None:
    glow_ellipse(c, (96 - rx, cy - ry, 96 + rx, cy + ry), "#86faff", round(alpha * 0.35), 0.7)
    for i, fill in enumerate(ELEMENTS):
        angle = phase + i * math.tau / len(ELEMENTS)
        x = 96 + math.cos(angle) * rx
        y = cy + math.sin(angle) * ry
        draw_talisman(c, x, y, math.degrees(angle) + 92, 0.82, fill, alpha)


def idle_frame(index: int) -> Image.Image:
    phase = index * math.tau / 6

    def draw(c: Canvas) -> None:
        draw_mist(c, phase, 118)
        pose = {
            "x": math.sin(phase) * 1.5,
            "y": math.sin(phase + 0.4) * -2.0,
            "lean": math.sin(phase) * 1.8,
            "robe": math.sin(phase + 0.9) * 2.0,
            "left_y": math.sin(phase + 1.2) * 2.4,
            "right_y": math.sin(phase + 2.1) * -2.8,
            "staff_angle": -10 + math.sin(phase + 0.8) * 7.0,
            "staff_y": -54 + math.sin(phase + 1.8) * 3.0,
        }
        draw_figure(c, pose)
        draw_orbit_talismans(c, phase + 0.6, 210)
        anchor = (96 + math.sin(phase) * 3, 64 + math.cos(phase * 1.3) * 3)
        draw_open_book(c, anchor[0], anchor[1], 0.55, phase, 205)

    return make_frame(draw)


def run_frame(index: int) -> Image.Image:
    phase = index * math.tau / 6

    def draw(c: Canvas) -> None:
        draw_mist(c, phase + 1.1, 85)
        for trail in range(3):
            t = phase - trail * 0.7
            x = 57 + trail * 7 + math.sin(t) * 5
            y = 81 + trail * 22 + math.cos(t * 1.2) * 5
            glow_line(c, [(x + 21, y + 4), (x - 6, y - 1)], ELEMENTS[trail], 80 - trail * 12, 2.0)
            draw_talisman(c, x, y, -72 + trail * 18, 0.58, ELEMENTS[trail], 120 - trail * 10)
        pose = {
            "x": math.sin(phase) * 5.6,
            "y": -4 - max(0, math.sin(phase)) * 4.5,
            "lean": -5.5 + math.cos(phase) * 3.2,
            "robe": math.sin(phase + 1.7) * 4.0,
            "left_x": math.sin(phase + 0.8) * 5,
            "left_y": math.cos(phase) * 4,
            "right_x": math.sin(phase + 2.8) * 6,
            "right_y": math.cos(phase + 1.8) * 5,
            "staff_angle": -22 + math.sin(phase) * 12,
            "staff_y": -56 + math.sin(phase + 1.3) * 5,
        }
        draw_figure(c, pose)
        draw_orbit_talismans(c, phase + 1.3, 165, rx=37, ry=27, cy=105)

    return make_frame(draw)


ATTACK_POSES = [
    {"x": 0, "y": 0, "lean": 0, "left_x": 0, "left_y": 0, "right_x": 0, "right_y": 0, "staff_angle": -10},
    {"x": -4, "y": -1, "lean": -4, "left_x": -5, "left_y": -4, "right_x": 6, "right_y": -11, "staff_angle": -25},
    {"x": -7, "y": -4, "lean": -7, "left_x": -9, "left_y": -9, "right_x": 11, "right_y": -17, "staff_angle": -33},
    {"x": 5, "y": -5, "lean": 5, "left_x": 4, "left_y": 2, "right_x": 16, "right_y": -9, "staff_angle": 10},
    {"x": 8, "y": -4, "lean": 8, "left_x": 9, "left_y": 5, "right_x": 18, "right_y": 0, "staff_angle": 19},
    {"x": 4, "y": -2, "lean": 3, "left_x": 4, "left_y": 2, "right_x": 9, "right_y": 4, "staff_angle": 7},
    {"x": 1, "y": 0, "lean": -1, "left_x": 0, "left_y": 1, "right_x": 2, "right_y": 2, "staff_angle": -4},
    {"x": 0, "y": 0, "lean": 0, "left_x": 0, "left_y": 0, "right_x": 0, "right_y": 0, "staff_angle": -10},
]


def attack_effects(c: Canvas, index: int) -> None:
    if index == 0:
        draw_orbit_talismans(c, 0.25, 150, rx=35, ry=25, cy=101)
    elif index == 1:
        glow_line(c, [(89, 121), (72, 88)], "#7cf5ff", 145, 2.3)
        draw_talisman(c, 70, 84, -42, 0.85, ELEMENTS[0], 230)
        draw_talisman(c, 113, 76, 24, 0.70, ELEMENTS[1], 180)
    elif index == 2:
        for target, fill in [((62, 75), ELEMENTS[2]), ((125, 83), ELEMENTS[3]), ((77, 129), ELEMENTS[1])]:
            glow_line(c, [(96, 119), target], fill, 130, 2.4)
            draw_talisman(c, target[0], target[1], -30 + target[0] * 0.45, 0.80, fill, 235)
    elif index == 3:
        shots = [((145, 75), ELEMENTS[0], -62), ((149, 103), ELEMENTS[4], -80), ((137, 132), ELEMENTS[1], -98), ((125, 91), ELEMENTS[2], -35)]
        for target, fill, ang in shots:
            glow_line(c, [(103, 118), (target[0] - 8, target[1] + 2), target], fill, 170, 2.6)
            draw_talisman(c, target[0], target[1], ang, 0.84, fill, 245)
        draw_star(c, 117, 116, 5, "#eaffff", 190)
    elif index == 4:
        draw_bagua(c, 105, 111, 47, 0.25, 150)
        for i, fill in enumerate(ELEMENTS):
            ang = -math.pi / 2 + i * math.tau / 5
            x = 105 + math.cos(ang) * 38
            y = 111 + math.sin(ang) * 23
            glow_line(c, [(105, 111), (x, y)], fill, 120, 1.7)
            draw_talisman(c, x, y, math.degrees(ang) + 90, 0.72, fill, 225)
    elif index == 5:
        for target, fill in [((130, 84), ELEMENTS[0]), ((139, 118), ELEMENTS[2]), ((113, 142), ELEMENTS[4])]:
            glow_line(c, [(101, 120), target], fill, 105, 1.8)
            draw_talisman(c, target[0], target[1], -60, 0.62, fill, 160)
        for n in range(5):
            draw_star(c, 91 + n * 10, 78 + math.sin(n) * 18, 2.5, ELEMENTS[n % 5], 120)
    elif index == 6:
        draw_orbit_talismans(c, 4.2, 125, rx=32, ry=22, cy=105)
        draw_star(c, 125, 89, 3, "#eaffff", 130)


def attack_frame(index: int) -> Image.Image:
    phase = index * 0.7

    def draw(c: Canvas) -> None:
        draw_mist(c, phase, 95)
        attack_effects(c, index)
        pose = dict(ATTACK_POSES[index])
        pose["robe"] = math.sin(phase) * 4.5
        draw_figure(c, pose)
        if 1 <= index <= 5:
            draw_open_book(c, 83 + index * 4, 62 + math.sin(phase) * 3, 0.46, phase, 150)

    return make_frame(draw)


def ultimate_frame(index: int) -> Image.Image:
    phase = index * math.tau / 8

    def draw(c: Canvas) -> None:
        intensity = [95, 115, 145, 185, 170, 140, 115, 90][index]
        draw_mist(c, phase + 0.7, intensity)
        if index >= 1:
            draw_bagua(c, 96, 145, 34 + min(index, 4) * 5, phase * 0.5, min(190, 92 + index * 18))
        if 2 <= index <= 5:
            left = {"x": -28, "y": -2, "lean": -8, "scale": 0.72, "staff_angle": -34, "right_y": -8}
            right = {"x": 28, "y": -2, "lean": 8, "scale": 0.72, "staff_angle": 26, "left_y": -9}
            draw_figure(c, left, alpha=74, ghost=True)
            draw_figure(c, right, alpha=74, ghost=True)
        if index >= 2:
            for i, fill in enumerate(ELEMENTS):
                ang = phase + i * math.tau / 5
                x = 96 + math.cos(ang) * (35 + min(index, 4) * 2)
                y = 98 + math.sin(ang) * (27 + min(index, 4))
                glow_line(c, [(96, 103), (x, y)], fill, 105 + index * 13, 1.6)
                draw_talisman(c, x, y, math.degrees(ang) + 90, 0.72 + min(index, 4) * 0.03, fill, min(245, 160 + index * 15))
        book_scale = [0.50, 0.62, 0.78, 0.88, 0.82, 0.70, 0.58, 0.50][index]
        draw_open_book(c, 96, 65 + math.sin(phase) * 3, book_scale, phase, min(245, 165 + index * 10))
        if 3 <= index <= 5:
            for n in range(8):
                a = phase + n * math.tau / 8
                start = (96 + math.cos(a) * 18, 112 + math.sin(a) * 11)
                end = (96 + math.cos(a) * 55, 112 + math.sin(a) * 34)
                glow_line(c, [start, end], ELEMENTS[n % 5], 115, 1.4)
        pose = {
            "x": math.sin(phase) * 1.5,
            "y": -2 - max(0, math.sin(phase)) * 3,
            "lean": math.sin(phase) * 2.5,
            "robe": math.sin(phase + 1) * 4,
            "left_y": -5 if 2 <= index <= 5 else 0,
            "right_y": -8 if 2 <= index <= 5 else 0,
            "staff_angle": -16 + math.sin(phase) * 16,
        }
        draw_figure(c, pose)
        if index == 4:
            glow_ellipse(c, (42, 54, 150, 170), "#efffff", 135, 1.4)
            draw_star(c, 96, 101, 7, "#efffff", 210)
        if index >= 5:
            for n in range(5):
                draw_star(c, 65 + n * 15, 70 + math.sin(phase + n) * 18, 2.4, ELEMENTS[n], 130)

    return make_frame(draw)


def make_card() -> Image.Image:
    card = Image.new("RGBA", (1024, 1024), (8, 25, 39, 255))
    draw = ImageDraw.Draw(card, "RGBA")
    for y in range(1024):
        t = y / 1023
        r = round(8 + (18 - 8) * t)
        g = round(25 + (54 - 25) * t)
        b = round(39 + (68 - 39) * t)
        draw.line([(0, y), (1024, y)], fill=(r, g, b, 255))
    c = Canvas(card)
    for radius, alpha in [(410, 52), (315, 70), (230, 86)]:
        glow_ellipse(c, (512 - radius, 500 - radius * 0.56, 512 + radius, 500 + radius * 0.56), "#7df4ff", alpha, 4)
    for i, fill in enumerate(ELEMENTS):
        angle = -math.pi / 2 + i * math.tau / 5
        x = 512 + math.cos(angle) * 310
        y = 465 + math.sin(angle) * 185
        draw_talisman(c, x, y, math.degrees(angle) + 90, 3.0, fill, 210)
        glow_line(c, [(512, 470), (x, y)], fill, 90, 6)

    # Reuse the runtime figure drawing at larger scale so costume and weapon match.
    layer = Image.new("RGBA", (FRAME_W * SCALE, FRAME_H * SCALE), (0, 0, 0, 0))
    lc = Canvas(layer)
    draw_mist(lc, 1.2, 135)
    draw_bagua(lc, 96, 142, 53, 0.4, 135)
    draw_orbit_talismans(lc, 0.75, 210, rx=42, ry=31, cy=101)
    draw_open_book(lc, 96, 62, 0.75, 0.8, 220)
    draw_figure(lc, {"x": 0, "y": -1, "lean": 0, "staff_angle": -12, "left_y": -4, "right_y": -8})
    sprite = layer.resize((720, 840), Image.Resampling.LANCZOS)
    card.alpha_composite(sprite, (152, 170))
    for i in range(30):
        a = i * math.tau / 30
        x = 512 + math.cos(a) * (260 + (i % 5) * 22)
        y = 470 + math.sin(a) * (170 + (i % 4) * 16)
        draw_star(c, x, y, 6 + (i % 3), "#eaffff", 110)
    return card


def save_state(state: str, frames: list[Image.Image]) -> None:
    state_dir = ANIM_DIR / state
    if state_dir.exists():
        for stale in state_dir.glob("*.png"):
            stale.unlink()
    state_dir.mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(frames, 1):
        frame.save(state_dir / f"{i:02d}.png")


def save_legacy_attack(frames: list[Image.Image]) -> None:
    indices = [0, 2, 3, 5]
    strip = Image.new("RGBA", (FRAME_W * len(indices), FRAME_H), (0, 0, 0, 0))
    for out_index, frame_index in enumerate(indices):
        frame = frames[frame_index]
        frame.save(CHARACTER_DIR / f"attack-{out_index}.png")
        strip.alpha_composite(frame, (out_index * FRAME_W, 0))
    strip.save(CHARACTER_DIR / "attack-strip.png")


def make_contact_sheet(states: dict[str, list[Image.Image]]) -> Image.Image:
    thumb_w, thumb_h = 96, 112
    label_h = 24
    columns = 8
    rows = len(states)
    sheet = Image.new("RGBA", (columns * thumb_w, rows * (thumb_h + label_h)), (12, 24, 34, 255))
    draw = ImageDraw.Draw(sheet, "RGBA")
    for row, (state, frames) in enumerate(states.items()):
        y0 = row * (thumb_h + label_h)
        draw.rectangle((0, y0, sheet.width, y0 + label_h), fill=(20, 45, 59, 255))
        draw.text((8, y0 + 5), state, fill=(220, 255, 250, 255))
        for col, frame in enumerate(frames):
            thumb = frame.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            sheet.alpha_composite(thumb, (col * thumb_w, y0 + label_h))
            draw.text((col * thumb_w + 4, y0 + label_h + 4), f"{col + 1:02d}", fill=(180, 240, 246, 230))
    return sheet


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    return alpha.getbbox()


def fit_frame_to_safe_box(image: Image.Image, max_occupancy: float = 0.66, min_padding: int = 8) -> Image.Image:
    bbox = alpha_bbox(image)
    if bbox is None:
        return image
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    padding = min(left, top, FRAME_W - right, FRAME_H - bottom)
    max_width = math.floor(FRAME_W * max_occupancy)
    max_height = math.floor(FRAME_H * max_occupancy)
    safe_scale = min(1.0, max_width / width, max_height / height)
    if padding >= min_padding and safe_scale >= 0.999:
        return image

    cropped = image.crop(bbox)
    new_size = (max(1, round(width * safe_scale)), max(1, round(height * safe_scale)))
    resized = cropped.resize(new_size, Image.Resampling.LANCZOS)
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    paste_x = round(center_x - new_size[0] / 2)
    paste_y = round(center_y - new_size[1] / 2)
    paste_x = max(min_padding, min(FRAME_W - min_padding - new_size[0], paste_x))
    paste_y = max(min_padding, min(FRAME_H - min_padding - new_size[1], paste_y))
    result = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    result.alpha_composite(resized, (paste_x, paste_y))
    return result


def fit_state_to_safe_box(frames: list[Image.Image]) -> list[Image.Image]:
    return [fit_frame_to_safe_box(frame) for frame in frames]


def write_asset_report(states: dict[str, list[Image.Image]]) -> None:
    lines = [
        "# Zuo Ci Generated Asset List",
        "",
        "All runtime frames are 192x224 transparent PNGs.",
        "",
        "## Root assets",
        "",
        "- public/assets/characters/zuoci/card.png",
        "- public/assets/characters/zuoci/battle-idle.png",
        "- public/assets/characters/zuoci/attack-0.png",
        "- public/assets/characters/zuoci/attack-1.png",
        "- public/assets/characters/zuoci/attack-2.png",
        "- public/assets/characters/zuoci/attack-3.png",
        "- public/assets/characters/zuoci/attack-strip.png",
        "",
        "## Animation frames",
        "",
    ]
    for state, frames in states.items():
        lines.append(f"- {state}: {len(frames)} frames at public/assets/characters/zuoci/anim/{state}/01.png ... {len(frames):02d}.png")
    lines.extend(["", "## Alpha bounds", ""])
    for state, frames in states.items():
        for i, frame in enumerate(frames, 1):
            bbox = alpha_bbox(frame)
            if bbox is None:
                lines.append(f"- {state}/{i:02d}: empty")
                continue
            left, top, right, bottom = bbox
            padding = min(left, top, FRAME_W - right, FRAME_H - bottom)
            lines.append(f"- {state}/{i:02d}: bbox=({left},{top},{right},{bottom}) padding={padding}px occupancy={(right-left)/FRAME_W:.2f}x{(bottom-top)/FRAME_H:.2f}")
    (WORK_DIR / "asset-list.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_motion_brief() -> None:
    brief = """# Zuo Ci Motion Brief

Character: Zuo Ci (id: zuoci), Qun faction.
Weapon: immortal talismans, jade staff, floating spell plates and a Dunjia book. The staff is slim white-jade with a cyan orb; talismans are five-element slips, not Zhang Jiao yellow thunder charms.
Existing similar warriors to avoid: Zhang Jiao yellow-purple thunder Taoist staff, Zhuge Liang feather fan bagua/ice lotus, Sima Yi violet lightning talismans.
Idle identity: five talismans orbit at chest height while a spell book and jade staff float independently; body gently bobs.
Run identity: half-floating drift with trailing talisman afterimages, robe sway, staff tilt, and orbiting slips.
Normal attack: frames 2-6 launch five-element talismans from different origins and heights; frame 4 is the main multi-slip volley, frame 5 resolves into a compact five-element array.
Ultimate/Musou: Dunjia heavenly book opens, compact bagua/five-element field appears, two ghost projections cast with the main body, then residual cyan-white stars dissipate.
Effect grammar: cyan-white immortal mist, five colored talisman slips, octagonal Dunjia field, soft afterimages. No yellow-sky lightning, no frost lotus, no dark thunder prison.
Frame counts: idle 6, run 6, attack 8, ultimate 8.
Safe-box target: <= 0.67 frame width/height, roughly <= 128x149 visible alpha.
Padding target: >= 8 px transparent padding on all sides.
Independent limb/weapon movement: sleeves, hands, staff angle, floating book, talisman origins, robe sway, and ghost projections move independently across frames.
Validation notes: generated by scripts/source/character-anims/zuoci/generate_zuoci_assets.py; audit command is recorded in integration.md after validation.
"""
    (WORK_DIR / "motion-brief.md").write_text(brief, encoding="utf-8")


def main() -> None:
    for path in [CHARACTER_DIR, WORK_DIR, WEB_DIR]:
        path.mkdir(parents=True, exist_ok=True)
    for state in ["idle", "run", "attack", "ultimate"]:
        (ANIM_DIR / state).mkdir(parents=True, exist_ok=True)

    idle = fit_state_to_safe_box([idle_frame(i) for i in range(6)])
    run = fit_state_to_safe_box([run_frame(i) for i in range(6)])
    attack = fit_state_to_safe_box([attack_frame(i) for i in range(8)])
    ultimate = fit_state_to_safe_box([ultimate_frame(i) for i in range(8)])
    states = {"idle": idle, "run": run, "attack": attack, "ultimate": ultimate}

    for state, frames in states.items():
        save_state(state, frames)
    idle[0].save(CHARACTER_DIR / "battle-idle.png")
    save_legacy_attack(attack)
    make_card().save(CHARACTER_DIR / "card.png")
    make_contact_sheet(states).save(WEB_DIR / "zuoci-contact-sheet.png")
    shutil.copyfile(WEB_DIR / "zuoci-contact-sheet.png", WORK_DIR / "zuoci-contact-sheet.png")
    write_motion_brief()
    write_asset_report(states)


if __name__ == "__main__":
    main()
