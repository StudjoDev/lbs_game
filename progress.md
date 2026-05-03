Original prompt: 呂布的卡片圖像看起來還沒有被設定，幫我設定。

Notes:
- User clarified the Lu Bu card can directly use the existing battle image.
- Keep the active card path as `public/assets/characters/lubu/card.png` so existing manifest tests and UI references continue to work.
- Replaced `public/assets/characters/lubu/card.png` with the current `battle-idle.png` artwork.
- Verified with `npm test`, `npm run build`, the develop-web-game Playwright client, and locked/revealed codex screenshots.

TODO:
- None for this request.

Current request: Use multiple AI agents to make battle presentation more dynamic.
Notes:
- Spawned three parallel workers for enemy animation assets, XP pickup effects, and combat hit/death effects.
- Enemy animation worker generated fixed 192x192 walk/hit/death PNG frames for infantry, archer, shield, cavalry, captain, and Lu Bu.
- XP helper and combat juice helper were added under `src/phaser/effects` and kept render-only.
- Main integration loads enemy animation frames in BootScene and wires XP, hit, and death presentation helpers into BattleScene.

TODO:
- None for this request.

Current request: Remove strange floating icons and make enemy art fit hero style better.
Notes:
- Replaced upright banner-like battlefield props with low-alpha ground cloth decals.
- Changed stone props from bright outlined pebble clusters into low-contrast ground rubble so they no longer read as floating icons.
- Regenerated enemy animation frames from existing project-owned character PNG seeds, with stronger recolor/overlay treatment and fixed 192x192 output.
- Verified desktop and mobile screenshots on localhost:5176; no missing texture/animation/runtime warnings.

TODO:
- None for this request.

Current request: Enemies should be dedicated troop art, not Guan Yu clones; hit effects should not throw fast icon sprites.
Notes:
- Disabled the hero-seed path in `scripts/generate_enemy_animation_assets.py` for shipped frames and regenerated all enemy walk/hit/death frames as dedicated chibi troop art.
- Hit flashes no longer call `emitParticleBurst` sprite particles; hit/crit/playerHit events are graphics-only through `CombatJuiceEffects`.
- Shortened hit spark shard travel so impact reads as attached sparks instead of flying icons.
- Verified typecheck, unit tests, build, develop-web-game client smoke, and desktop/mobile Playwright screenshots on localhost:5176.

TODO:
- None for this request.

Current request: Make the battle camera scale down on mobile so the player sees a wider battlefield.
Notes:
- BattleScene now computes a responsive camera base zoom from Phaser scale gameSize.
- Desktop stays at 1x zoom; narrow/mobile screens zoom out down to 0.5 so more world area is visible.
- Camera event impulses now multiply the responsive base zoom instead of temporarily snapping mobile back to 1x.

TODO:
- None for this request.

Current request: Fix GitHub Pages mobile audio unlock and upgrade modal not closing after selecting a battle merit upgrade.
Notes:
- Mobile audio was vulnerable because Phaser input unlock only covered canvas/scene input; HTML UI gestures can own the initial touch. AudioController now also listens to DOM gestures during capture and directly resumes WebAudio before replaying desired music.
- Upgrade cards now use pointerup with click fallback and clear the modal immediately after a valid selection, avoiding mobile click delays or swallowed click events.
- Added dev-only render_game_to_text, advanceTime, collectDebugXp, and render_audio_state hooks for browser verification. These are guarded by import.meta.env.DEV.
- Verified typecheck, unit tests, production build, develop-web-game smoke run, and an iPhone 14 Playwright flow. Audio changed from locked/suspended to running/playing; selecting an upgrade returned status to playing with modalOpen false and no console errors.

TODO:
- None for this request.

Current request: Generate dedicated minion art in the same style as hero art and stop hit/slash icons from flying.
Notes:
- Added a project-owned chibi card-style minion source sheet under `scripts/source/enemy-anims/ai-minion-sheet.png`.
- Updated `scripts/generate_enemy_animation_assets.py` to cut each enemy from its own sheet cell, remove chroma green, filter stray connected-component artifacts, normalize to fixed 192x192 bottom-center frames, and generate walk/hit/death without hero image seeds.
- Added CC0 OpenGameArt spark/radial hit spritesheets and switched hit/crit/playerHit presentation to fixed-position spritesheet playback instead of particle bursts.
- Melee slash effects now remain anchored to the player offset, and spark/melee particle bursts fade/scale in place instead of flying outward with angle-distance tweening.
- Fixed enemy sprite pooling so recycled enemies restart their walk animation and initialize from the new animation frame instead of old canvas fallback textures.
- Loaded `enemy_*` base texture keys from the new minion walk frames and removed the full beige hit tint for animated enemies so hit flashes no longer look like old placeholder sprites.

TODO:
- None for this request.

Current request: Fix archer facing, add a view-scale setting, and use multiple agents to fill the remaining character animations.
Notes:
- Fixed archer-only horizontal flipping so bow direction faces the player without changing other enemy facing rules.
- Added a persisted display setting `viewScale` under `src/game/display/settings.ts`; the HUD/pause menu now exposes a view slider from 100% to 160%.
- BattleScene applies the view scale as a render-only camera zoom divisor, so larger view scale expands visible battlefield without changing simulation positions or collisions.
- Parallel workers generated idle/run/attack animations for Zhao Yun, Cao Cao, Xiahou Dun, Zhou Yu, and Lu Bu; `characterArt.ts` now wires these animations into BootScene loading.
- Validated generated frames for the five newly animated characters: 6 idle, 6 run, and 8 attack frames per character, all 192x224 RGBA transparent PNGs.
- Verified `npm run typecheck`, `npm test`, `npm run build`, and Playwright desktop/mobile screenshots with `viewScale=1.6`.

TODO:
- None for this request.

Current request: Add a settings page with adjustable parameters, including screen scale.
Notes:
- Added a shared DOM settings panel for menu and battle pause flows with display controls for view scale, HUD/control scale, effects intensity, screen shake, and damage-number visibility, plus existing audio controls.
- Main menu now has a Settings entry; battle pause now opens the same settings panel instead of exposing the view slider directly in the HUD.
- Display settings are persisted in `localStorage` and reloaded on each scene `create`, so menu changes immediately apply to the next battle.
- BattleScene now uses the new render-only settings to scale camera view, reduce particle/hit effect density, scale screen shake, and hide damage-number floating text.
- Verified `npm run typecheck`, `npm test`, `npm run build`, and Playwright desktop/mobile settings flows on localhost:5176. The Playwright report confirms `viewScale=1.6` produces camera zoom `0.625` and a 2048x1152 world view at 1280x720.

TODO:
- None for this request.
