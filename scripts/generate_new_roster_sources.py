#!/usr/bin/env python3
"""Generate high-detail Q-style source images for newly added playable heroes.

The project already has AI-rendered Q-version Three Kingdoms card and sprite
sources. These two additions are derived from that visual language: dense
ornamentation, glossy anime eyes, gold trim, magical particles, and full-body
chibi proportions on removable chroma-key sprite sources.
"""

from __future__ import annotations

import colorsys
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "output" / "ai-character-sources"
CHARACTER_ROOT = ROOT / "public" / "assets" / "characters"

DIAOCHAN_CARD = CHARACTER_ROOT / "diaochan" / "card.png"
DIAOCHAN_SPRITE = SOURCE_ROOT / "diaochan-idle-01.png"


def remap_palette(image: Image.Image, hero_id: str) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if g > 210 and r < 35 and b < 35:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hue = h * 360
            skin = 0 <= hue <= 45 and 0.12 <= s <= 0.48 and v >= 0.68
            dark_hair = v < 0.34 and s > 0.2
            if skin:
                pixels[x, y] = (r, g, b, a)
                continue
            if hero_id == "zhenji":
                if dark_hair:
                    nr = round(r * 0.72)
                    ng = round(g * 0.82)
                    nb = min(255, round(b * 1.18 + 12))
                    pixels[x, y] = (nr, ng, nb, a)
                    continue
                if (hue <= 18 or hue >= 315 or 285 <= hue <= 315) and s > 0.28:
                    h = (211 + (x + y) % 20 - 10) / 360
                    s = min(0.88, max(0.42, s * 0.92 + 0.18))
                    v = min(1, v * 1.08 + 0.02)
                elif 18 < hue < 58 and s > 0.5 and v > 0.44:
                    # Keep ornate gold trim, but cool the brightest pink gems toward ice.
                    if v > 0.72 and s > 0.72:
                        h = 196 / 360
                        s = min(0.74, s * 0.7)
                        v = min(1, v * 1.1)
                elif 250 <= hue <= 315 and s > 0.25:
                    h = 205 / 360
                    s = min(0.78, s * 0.95 + 0.08)
                    v = min(1, v * 1.06)
            else:
                if (hue <= 18 or hue >= 315 or 285 <= hue <= 315) and s > 0.28:
                    h = (12 + (x * 3 + y) % 22) / 360
                    s = min(0.96, s * 1.04 + 0.08)
                    v = min(1, v * 1.05 + 0.02)
                elif 18 < hue < 58 and s > 0.45 and v > 0.4:
                    h = (38 + (x + y) % 10) / 360
                    s = min(0.98, s * 1.08)
                    v = min(1, v * 1.05)
            nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
            pixels[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return image


def glow_layer(size: tuple[int, int]) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    return layer, ImageDraw.Draw(layer)


def composite_blurred(base: Image.Image, layer: Image.Image, blur: float) -> None:
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    base.alpha_composite(layer)


def draw_snowflake(draw: ImageDraw.ImageDraw, x: float, y: float, radius: float, color: tuple[int, int, int, int]) -> None:
    for index in range(6):
        angle = math.tau * index / 6
        x2 = x + math.cos(angle) * radius
        y2 = y + math.sin(angle) * radius
        draw.line((x, y, x2, y2), fill=color, width=max(1, round(radius / 7)))
        draw.ellipse((x2 - 2, y2 - 2, x2 + 2, y2 + 2), fill=color)


def draw_magic_overlays(image: Image.Image, hero_id: str) -> Image.Image:
    rng = random.Random(713 if hero_id == "zhenji" else 927)
    width, height = image.size
    layer, draw = glow_layer(image.size)
    if hero_id == "zhenji":
        cyan = (184, 232, 255, 142)
        white = (242, 255, 255, 180)
        for index in range(7):
            y = 150 + index * 95
            draw.arc((80 + index * 8, y, width - 110 + index * 5, y + 260), 198, 338, fill=cyan, width=5)
        for _ in range(95):
            x = rng.randrange(60, width - 60)
            y = rng.randrange(54, height - 76)
            radius = rng.randrange(2, 7)
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(198, 238, 255, rng.randrange(90, 190)))
        for _ in range(18):
            draw_snowflake(draw, rng.randrange(95, width - 95), rng.randrange(80, height - 120), rng.randrange(10, 24), white)
    else:
        gold = (255, 222, 125, 165)
        ember = (255, 94, 64, 150)
        for index in range(8):
            y = 118 + index * 82
            draw.arc((96 - index * 8, y, width + 30 - index * 12, y + 320), 170, 310, fill=gold, width=6)
        for _ in range(120):
            x = rng.randrange(52, width - 52)
            y = rng.randrange(44, height - 52)
            radius = rng.randrange(2, 9)
            color = gold if rng.random() > 0.38 else ember
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(color[0], color[1], color[2], rng.randrange(86, 190)))
        for _ in range(13):
            x = rng.randrange(80, width - 80)
            y = rng.randrange(110, height - 140)
            flame_h = rng.randrange(34, 78)
            draw.polygon([(x, y - flame_h), (x + flame_h * 0.34, y), (x - flame_h * 0.22, y - flame_h * 0.08)], fill=(255, 188, 88, 118))
    composite_blurred(image, layer, 5.5)
    return image


def make_card(hero_id: str) -> Image.Image:
    base = Image.open(DIAOCHAN_CARD).convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    if hero_id == "zhenji":
        base = base.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    base = remap_palette(base, hero_id)
    return draw_magic_overlays(base, hero_id)


def make_sprite(hero_id: str) -> Image.Image:
    source = Image.open(DIAOCHAN_SPRITE).convert("RGBA")
    if hero_id == "zhenji":
        source = source.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    source = remap_palette(source, hero_id)
    # Keep the chroma-key background flat for the existing extraction pipeline.
    bg = Image.new("RGBA", source.size, (0, 255, 0, 255))
    alpha = source.getchannel("A")
    bg.alpha_composite(source)
    bg.putalpha(Image.new("L", source.size, 255))
    green = bg.load()
    src = source.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, _ = src[x, y]
            if g > 210 and r < 35 and b < 35:
                green[x, y] = (0, 255, 0, 255)
    return bg


def main() -> None:
    SOURCE_ROOT.mkdir(parents=True, exist_ok=True)
    for hero_id in ("zhenji", "xiaoqiao"):
        make_card(hero_id).save(SOURCE_ROOT / f"{hero_id}-card.png")
        make_sprite(hero_id).save(SOURCE_ROOT / f"{hero_id}-sprite.png")
        print(f"generated high-detail Q-style source images for {hero_id}")


if __name__ == "__main__":
    main()
