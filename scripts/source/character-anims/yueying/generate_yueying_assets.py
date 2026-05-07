#!/usr/bin/env python3
"""Generate Yueying assets from approved imagegen source art.

Yueying's effect grammar is mechanical motion without closed square or
rectangular frames: open jade arcs, gold bolt traces, and compact gear sparks.
"""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[4]
HERO_ID = "yueying"
HERO_ROOT = ROOT / "public" / "assets" / "characters" / HERO_ID
SOURCE_ROOT = ROOT / "scripts" / "source" / "character-anims" / HERO_ID
IMAGEGEN_ROOT = SOURCE_ROOT / "imagegen"
AGENT_ROOT = ROOT / "output" / "agent-work" / HERO_ID
WEB_ROOT = ROOT / "output" / "web-game"

FRAME_W = 192
FRAME_H = 224
SCALE = 4
SAFE_MARGIN = 8
MAX_OCCUPANCY = 0.66
ALPHA_THRESHOLD = 8

TEAL = (69, 242, 198, 190)
TEAL_CORE = (202, 255, 231, 235)
GOLD = (255, 216, 108, 190)
GOLD_CORE = (255, 240, 165, 230)
METAL = (220, 244, 220, 230)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return alpha.getbbox()


def brighten(image: Image.Image, factor: float) -> Image.Image:
    if factor == 1:
        return image
    rgb = Image.new("RGB", image.size, (0, 0, 0))
    rgb.paste(image.convert("RGB"), mask=image.getchannel("A"))
    rgb = ImageEnhance.Brightness(rgb).enhance(factor)
    result = rgb.convert("RGBA")
    result.putalpha(image.getchannel("A"))
    return result


def transformed_sprite(
    base: Image.Image,
    *,
    dx: float = 0,
    dy: float = 0,
    rotate: float = 0,
    scale: float = 1,
    brightness: float = 1,
    bottom: float = 216,
) -> Image.Image:
    bbox = alpha_bbox(base)
    if bbox is None:
        raise ValueError("base sprite has no visible alpha")
    sprite = base.crop(bbox)
    if scale != 1:
        size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
        sprite = sprite.resize(size, Image.Resampling.LANCZOS)
    if rotate:
        sprite = sprite.rotate(rotate, expand=True, resample=Image.Resampling.BICUBIC)
    sprite = brighten(sprite, brightness)
    frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    x = round((FRAME_W - sprite.width) / 2 + dx)
    y = round(bottom - sprite.height + dy)
    frame.alpha_composite(sprite, (x, y))
    return frame


def fit_to_safe_box(image: Image.Image, margin: int = SAFE_MARGIN, max_occupancy: float = MAX_OCCUPANCY) -> Image.Image:
    bbox = alpha_bbox(image)
    if bbox is None:
        raise ValueError("frame has no visible alpha")
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    max_w = min(FRAME_W - margin * 2, math.floor(FRAME_W * max_occupancy))
    max_h = min(FRAME_H - margin * 2, math.floor(FRAME_H * max_occupancy))
    scale = min(1.0, max_w / width, max_h / height)
    crop = image.crop(bbox)
    if scale < 1:
        crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
    old_cx = (bbox[0] + bbox[2]) / 2
    center_delta = (old_cx - FRAME_W / 2) * scale
    x = round((FRAME_W - crop.width) / 2 + center_delta)
    x = max(margin, min(FRAME_W - margin - crop.width, x))
    y = min(FRAME_H - margin - crop.height, max(margin, round(FRAME_H - margin - crop.height)))
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    canvas.alpha_composite(crop, (x, y))
    return canvas


def hi_layer() -> Image.Image:
    return Image.new("RGBA", (FRAME_W * SCALE, FRAME_H * SCALE), (0, 0, 0, 0))


def sp(value: float) -> int:
    return round(value * SCALE)


def spoints(points: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(sp(x), sp(y)) for x, y in points]


def bezier(points: list[tuple[float, float]], steps: int = 40) -> list[tuple[float, float]]:
    if len(points) != 4:
        return points
    p0, p1, p2, p3 = points
    result = []
    for step in range(steps + 1):
        t = step / steps
        inv = 1 - t
        result.append(
            (
                inv**3 * p0[0] + 3 * inv**2 * t * p1[0] + 3 * inv * t**2 * p2[0] + t**3 * p3[0],
                inv**3 * p0[1] + 3 * inv**2 * t * p1[1] + 3 * inv * t**2 * p2[1] + t**3 * p3[1],
            )
        )
    return result


def glow_line(layer: Image.Image, points: list[tuple[float, float]], color: tuple[int, int, int, int], width: float, blur: float = 2.0) -> None:
    glow = hi_layer()
    ImageDraw.Draw(glow).line(spoints(points), fill=color, width=max(1, sp(width * 2.2)), joint="curve")
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(sp(blur))))
    ImageDraw.Draw(layer).line(spoints(points), fill=color, width=max(1, sp(width)), joint="curve")


def glow_curve(layer: Image.Image, controls: list[tuple[float, float]], color: tuple[int, int, int, int], width: float, blur: float = 2.0) -> None:
    glow_line(layer, bezier(controls), color, width, blur)


def rotated_diamond(center: tuple[float, float], length: float, width: float, angle: float) -> list[tuple[float, float]]:
    rad = math.radians(angle)
    ux, uy = math.cos(rad), math.sin(rad)
    px, py = -uy, ux
    cx, cy = center
    return [
        (cx + ux * length * 0.55, cy + uy * length * 0.55),
        (cx + px * width * 0.5, cy + py * width * 0.5),
        (cx - ux * length * 0.45, cy - uy * length * 0.45),
        (cx - px * width * 0.5, cy - py * width * 0.5),
    ]


def draw_bolt(layer: Image.Image, start: tuple[float, float], end: tuple[float, float], angle: float, alpha: int) -> None:
    sx, sy = start
    ex, ey = end
    glow_line(layer, [(sx, sy), (ex, ey)], (TEAL[0], TEAL[1], TEAL[2], alpha), 2.3, 1.4)
    glow_line(layer, [(sx + 5, sy - 5), (ex - 9, ey + 3)], (GOLD[0], GOLD[1], GOLD[2], round(alpha * 0.72)), 1.3, 0.8)
    draw = ImageDraw.Draw(layer)
    draw.polygon(spoints(rotated_diamond((ex, ey), 15, 7, angle)), fill=METAL)
    for offset in (-12, 14):
        rad = math.radians(angle + offset)
        shard = (sx + math.cos(rad) * 12, sy + math.sin(rad) * 7)
        draw.line(
            (sp(shard[0]), sp(shard[1]), sp(shard[0] + math.cos(rad) * 10), sp(shard[1] + math.sin(rad) * 7)),
            fill=(GOLD[0], GOLD[1], GOLD[2], round(alpha * 0.56)),
            width=sp(1.4),
        )


def draw_mechanic_arc(layer: Image.Image, frame_index: int, cx: float, cy: float) -> None:
    alpha = [0, 120, 158, 220, 208, 150, 92, 0][frame_index]
    if alpha <= 0:
        return
    glow_curve(layer, [(cx - 42, cy - 58), (cx - 51, cy - 108), (cx + 38, cy - 116), (cx + 63, cy - 46)], (TEAL[0], TEAL[1], TEAL[2], alpha), 4.8)
    if frame_index in (3, 4, 5):
        glow_curve(layer, [(cx + 52, cy - 44), (cx + 79, cy - 9), (cx - 34, cy - 7), (cx - 49, cy - 48)], (GOLD[0], GOLD[1], GOLD[2], round(alpha * 0.68)), 3.1)
    for tick in range(3):
        theta = -0.8 + tick * 0.62 + frame_index * 0.08
        x = cx + math.cos(theta) * (45 + tick * 5)
        y = cy - 62 + math.sin(theta) * 18
        glow_line(layer, [(x - 4, y - 2), (x + 5, y + 2)], (GOLD_CORE[0], GOLD_CORE[1], GOLD_CORE[2], round(alpha * 0.58)), 1.2, 0.7)


def draw_bagua_field(layer: Image.Image, intensity: float, phase: float) -> None:
    if intensity <= 0:
        return
    alpha = round(150 * intensity)
    draw = ImageDraw.Draw(layer)
    cx, cy = 96, 188
    for radius, color, width in ((47, TEAL, 2.4), (34, GOLD, 1.7), (21, TEAL_CORE, 1.3)):
        box = (sp(cx - radius), sp(cy - radius * 0.34), sp(cx + radius), sp(cy + radius * 0.34))
        draw.ellipse(box, outline=(color[0], color[1], color[2], round(alpha * color[3] / 255)), width=max(1, sp(width)))
    for index in range(8):
        theta = phase + index * math.pi / 4
        x0 = cx + math.cos(theta) * 19
        y0 = cy + math.sin(theta) * 7
        x1 = cx + math.cos(theta) * 47
        y1 = cy + math.sin(theta) * 17
        draw.line((sp(x0), sp(y0), sp(x1), sp(y1)), fill=(TEAL[0], TEAL[1], TEAL[2], round(alpha * 0.84)), width=sp(1.1))


def composite(sprite: Image.Image, back: Image.Image | None = None, front: Image.Image | None = None) -> Image.Image:
    frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    if back:
        frame.alpha_composite(back.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS))
    frame.alpha_composite(sprite)
    if front:
        frame.alpha_composite(front.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS))
    return fit_to_safe_box(frame)


def idle_frames(base: Image.Image) -> list[Image.Image]:
    specs = [
        (0, 0, 0, 1.0, 1.0),
        (1, -1, -1.2, 1.006, 1.01),
        (1, -2, -0.4, 1.012, 1.02),
        (0, -1, 0.8, 1.008, 1.015),
        (-1, 0, 1.1, 1.002, 1.0),
        (-1, 1, 0.3, 1.0, 0.99),
    ]
    return [composite(transformed_sprite(base, dx=dx, dy=dy, rotate=rot, scale=scale, brightness=bright)) for dx, dy, rot, scale, bright in specs]


def run_frames(base: Image.Image) -> list[Image.Image]:
    specs = [
        (-8, 2, -7.0, 0.98, 1.0),
        (-13, 4, -4.2, 0.965, 1.02),
        (-5, 1, 2.6, 0.985, 1.01),
        (7, 0, 6.4, 0.99, 1.02),
        (13, 3, 2.8, 0.97, 1.0),
        (5, 2, -4.8, 0.982, 0.99),
    ]
    frames = []
    for index, (dx, dy, rot, scale, bright) in enumerate(specs):
        back = hi_layer()
        if index in (1, 4):
            direction = -1 if index == 1 else 1
            glow_curve(back, [(72, 166), (62 - direction * 8, 153), (84 + direction * 16, 191), (116, 190)], (TEAL[0], TEAL[1], TEAL[2], 110), 3.0)
        frames.append(composite(transformed_sprite(base, dx=dx, dy=dy, rotate=rot, scale=scale, brightness=bright), back=back))
    return frames


def attack_frames(base: Image.Image) -> list[Image.Image]:
    specs = [
        (0, 0, -3, 1.0, 1.0),
        (-7, -1, -15, 1.0, 1.03),
        (-13, -4, -25, 1.01, 1.07),
        (7, -5, 11, 1.015, 1.09),
        (14, -3, 21, 1.01, 1.07),
        (9, -1, 13, 1.0, 1.04),
        (3, 0, 4, 1.0, 1.0),
        (0, 0, -2, 1.0, 0.99),
    ]
    bolt_specs = [
        None,
        ((59, 146), (91, 122), -26, 116),
        ((48, 132), (97, 105), -12, 154),
        ((68, 113), (132, 99), 8, 218),
        ((91, 116), (151, 126), 18, 204),
        ((103, 140), (139, 160), 31, 148),
        ((94, 151), (121, 164), 39, 96),
        None,
    ]
    frames = []
    for index, (dx, dy, rot, scale, bright) in enumerate(specs):
        cx = 96 + dx
        cy = 209 + dy
        back = hi_layer()
        front = hi_layer()
        if bolt_specs[index] is not None:
            draw_mechanic_arc(back, index, cx, cy)
            start, end, angle, alpha = bolt_specs[index]
            draw_bolt(front, start, end, angle, alpha)
        sprite = transformed_sprite(base, dx=dx, dy=dy, rotate=rot, scale=scale, brightness=bright, bottom=216 + dy * 0.25)
        frames.append(composite(sprite, back=back, front=front))
    return frames


def ultimate_frames(base: Image.Image) -> list[Image.Image]:
    specs = [
        (0, 0, -2, 1.0, 1.0, 0.15),
        (-2, -2, -10, 1.0, 1.04, 0.32),
        (-6, -4, -19, 1.015, 1.08, 0.62),
        (6, -6, 9, 1.025, 1.12, 1.0),
        (10, -5, 17, 1.02, 1.1, 0.92),
        (6, -2, 12, 1.012, 1.06, 0.68),
        (2, 0, 4, 1.0, 1.02, 0.4),
        (0, 0, -1, 1.0, 1.0, 0.2),
    ]
    frames = []
    for index, (dx, dy, rot, scale, bright, intensity) in enumerate(specs):
        phase = index / 8 * math.tau
        back = hi_layer()
        front = hi_layer()
        draw_bagua_field(back, intensity, phase)
        if index in (2, 3, 4, 5):
            for lane in range(max(1, index - 1)):
                y = 132 + lane * 10 - index * 1.4
                start = (55 + lane * 8, y)
                end = (111 + lane * 8 + index * 3, y - 7)
                draw_bolt(front, start, end, -8 + lane * 3, round(118 + intensity * 90))
        if index in (3, 4):
            glow_curve(front, [(52, 151), (68, 101), (125, 96), (147, 151)], (TEAL[0], TEAL[1], TEAL[2], 170), 3.5)
        sprite = transformed_sprite(base, dx=dx, dy=dy, rotate=rot, scale=scale, brightness=bright, bottom=216 + dy * 0.2)
        frames.append(composite(sprite, back=back, front=front))
    return frames


def check_frame(path: Path) -> dict[str, object]:
    image = Image.open(path).convert("RGBA")
    if image.size != (FRAME_W, FRAME_H):
        raise ValueError(f"{path}: expected {(FRAME_W, FRAME_H)}, found {image.size}")
    bbox = alpha_bbox(image)
    if bbox is None:
        raise ValueError(f"{path}: empty alpha")
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    padding = min(left, top, FRAME_W - right, FRAME_H - bottom)
    if padding < SAFE_MARGIN:
        raise ValueError(f"{path}: padding {padding}px is below {SAFE_MARGIN}px")
    if width / FRAME_W > MAX_OCCUPANCY + 0.01 or height / FRAME_H > MAX_OCCUPANCY + 0.01:
        raise ValueError(f"{path}: bbox {(width, height)} exceeds safe occupancy")
    return {
        "path": str(path.relative_to(ROOT)).replace("\\", "/"),
        "bbox": [left, top, right, bottom],
        "padding": padding,
        "occupancy": [round(width / FRAME_W, 3), round(height / FRAME_H, 3)],
    }


def checkerboard() -> Image.Image:
    tile = Image.new("RGBA", (FRAME_W, FRAME_H), (34, 27, 30, 255))
    draw = ImageDraw.Draw(tile)
    for y in range(0, FRAME_H, 16):
        for x in range(0, FRAME_W, 16):
            if ((x // 16) + (y // 16)) % 2 == 0:
                draw.rectangle((x, y, x + 15, y + 15), fill=(43, 48, 57, 255))
    return tile


def write_preview(paths: list[Path], out_path: Path, label_prefix: str) -> None:
    sheet = Image.new("RGBA", (FRAME_W * len(paths), FRAME_H), (20, 14, 18, 255))
    for index, path in enumerate(paths):
        tile = checkerboard()
        tile.alpha_composite(Image.open(path).convert("RGBA"))
        ImageDraw.Draw(tile).text((5, 4), f"{label_prefix}{index + 1:02d}", fill=(255, 232, 146, 255))
        sheet.alpha_composite(tile, (index * FRAME_W, 0))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def write_contact_sheet(output: dict[str, list[Path]], out_path: Path) -> None:
    states = ["idle", "run", "attack", "ultimate"]
    label_w = 88
    cols = max(len(output[state]) for state in states)
    sheet = Image.new("RGBA", (label_w + FRAME_W * cols, FRAME_H * len(states)), (18, 14, 18, 255))
    draw = ImageDraw.Draw(sheet)
    for row, state in enumerate(states):
        y = row * FRAME_H
        draw.rectangle((0, y, label_w, y + FRAME_H), fill=(32, 23, 28, 255))
        draw.text((12, y + 18), state, fill=(255, 232, 146, 255))
        for index, path in enumerate(output[state]):
            tile = checkerboard()
            tile.alpha_composite(Image.open(path).convert("RGBA"))
            ImageDraw.Draw(tile).text((5, 4), f"{index + 1:02d}", fill=(255, 232, 146, 255))
            sheet.alpha_composite(tile, (label_w + index * FRAME_W, y))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def write_motion_brief() -> None:
    brief = """Character: Yueying
Weapon: ornate halberd with mechanical crossbow/wooden-ox identity from approved imagegen source.
Existing similar warriors to avoid: Zhuge Liang feather-fan caster, Zhenji music/ice waves, Sun Shangxiang crossbow fan spread.
Idle identity: compact engineer stance, small robe/weapon bob, mechanical ornament readable.
Run identity: forward-leaning halberd engineer dash with short jade afterimage arcs.
Normal attack: halberd sweep plus non-closed jade mechanism arc and gold bolt traces; no square, rectangular, card, panel, UI, or framed effect.
Ultimate/Musou: compact bagua field with multi-lane crossbow bolts and open arcs, kept inside safe box.
Effect grammar: open curves, slim bolts, small line shards; never closed square/rectangular frames.
Frame counts: idle 6, run 6, attack 8, ultimate 8.
Safe-box target: <= 66% frame width/height.
Padding target: >= 8px transparent padding.
Independent movement: sprite translation/lean plus effect origin/path/bolt position changes each middle frame.
Validation notes: visual audit must reject framed square/rectangle effects and palette-only reuse.
"""
    AGENT_ROOT.mkdir(parents=True, exist_ok=True)
    (AGENT_ROOT / "motion-brief.md").write_text(brief, encoding="utf-8")


def write_assets() -> None:
    HERO_ROOT.mkdir(parents=True, exist_ok=True)
    SOURCE_ROOT.mkdir(parents=True, exist_ok=True)
    AGENT_ROOT.mkdir(parents=True, exist_ok=True)
    WEB_ROOT.mkdir(parents=True, exist_ok=True)

    base_path = IMAGEGEN_ROOT / "battle-idle-normalized.png"
    card_path = IMAGEGEN_ROOT / "card-source.png"
    if not base_path.exists():
        raise FileNotFoundError(base_path)
    base = Image.open(base_path).convert("RGBA")
    if base.size != (FRAME_W, FRAME_H):
        raise ValueError(f"{base_path}: expected {(FRAME_W, FRAME_H)}, found {base.size}")

    states = {
        "idle": idle_frames(base),
        "run": run_frames(base),
        "attack": attack_frames(base),
        "ultimate": ultimate_frames(base),
    }
    output: dict[str, list[Path]] = {}
    audit_rows: list[dict[str, object]] = []
    for state, frames in states.items():
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
        paths = []
        for index, frame in enumerate(frames, start=1):
            raw_path = raw_dir / f"{index:02d}.png"
            frame.save(raw_path)
            out_path = final_dir / f"{index:02d}.png"
            frame.save(out_path)
            audit_rows.append(check_frame(out_path))
            paths.append(out_path)
        output[state] = paths
        write_preview(paths, source_dir / "preview.png", state[0])
        write_preview(paths, source_dir / "reference-action.png", state[0])

    base.save(HERO_ROOT / "battle-idle.png")
    if card_path.exists():
        Image.open(card_path).convert("RGBA").save(HERO_ROOT / "card.png")

    legacy_indices = [0, 2, 3, 5]
    legacy_frames = []
    for out_index, frame_index in enumerate(legacy_indices):
        frame = Image.open(output["attack"][frame_index]).convert("RGBA")
        frame.save(HERO_ROOT / f"attack-{out_index}.png")
        legacy_frames.append(frame)
    strip = Image.new("RGBA", (FRAME_W * len(legacy_frames), FRAME_H), (0, 0, 0, 0))
    for index, frame in enumerate(legacy_frames):
        strip.alpha_composite(frame, (index * FRAME_W, 0))
    strip.save(HERO_ROOT / "attack-strip.png")

    write_contact_sheet(output, WEB_ROOT / "yueying-contact-sheet.png")
    write_preview(output["attack"], WEB_ROOT / "yueying-attack-strip-preview.png", "a")
    write_motion_brief()
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
                    "animations": {
                        state: [f"anim/{state}/{index + 1:02d}.png" for index in range(len(paths))]
                        for state, paths in output.items()
                    },
                },
                "contactSheet": "output/web-game/yueying-contact-sheet.png",
            },
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    write_assets()
    print(f"generated Yueying imagegen-based assets under {HERO_ROOT}")
