# Visual Asset Credits

Canonical credits and download evidence live in `../licenses/credits.md`.

This folder contains battle-only visual assets used by the Phaser renderer.

## Kenney Particle Pack

- Source: https://opengameart.org/content/particle-pack-80-sprites
- Author: Kenney
- License: Creative Commons Zero (CC0)
- Used files: smoke, spark, magic, circle, and dirt particles.
- Local edits: renamed selected PNG files for stable manifest keys.

## Weapon Slash - Effect

- Source: https://opengameart.org/content/weapon-slash-effect
- Author: Cethiel
- License: Creative Commons Zero (CC0)
- Used files: Classic slash animation frames 1-6.
- Local edits: renamed selected PNG frames for Phaser animation loading.

## Spark Effect

- Source: https://opengameart.org/content/spark-effect
- Author: kurohina
- License: Creative Commons Zero (CC0)
- Used files: `spark_sprite_strip9.png`.
- Local edits: renamed for stable Phaser spritesheet loading.

## Radial Lightning Effect

- Source: https://opengameart.org/content/radial-lightning-effect
- Author: 13rice
- License: Creative Commons Zero (CC0)
- Used files: `spark_radial_spritesheet_13rice.png`.
- Local edits: renamed for stable Phaser spritesheet loading.

## Generated Battlefield Fallbacks

- Source: local canvas generation in `BootScene`.
- License: project-owned generated textures.
- Used for: battlefield ground, detail tile, banners, stones, and weapon props when no external tile pack is loaded.

## Generated Enemy Animation Frames

- Source: local generation in `scripts/generate_enemy_animation_assets.py`, using the project-owned source sheet at `scripts/source/enemy-anims/ai-minion-sheet.png` when present.
- License: project-owned generated textures.
- Used for: enemy walk, hit, and death frame animations under `public/assets/enemies`.
- Local edits: dedicated chibi troop silhouettes with role-specific gear, chroma-key cleanup, largest-component artifact filtering, and fixed 192x192 transparent frames with consistent bottom-center alignment.
