Original prompt: 呂布的卡片圖像看起來還沒有被設定，幫我設定。

Notes:
- User clarified the Lu Bu card can directly use the existing battle image.
- Keep the active card path as `public/assets/characters/lubu/card.png` so existing manifest tests and UI references continue to work.
- Replaced `public/assets/characters/lubu/card.png` with the current `battle-idle.png` artwork.
- Verified with `npm test`, `npm run build`, the develop-web-game Playwright client, and locked/revealed codex screenshots.

TODO:
- None for this request.

Current request: Fix ultimate animation feeling unchanged after activation.
Notes:
- BattleScene now keeps replaying the hero's `ultimate` animation while `ultimateTimer > 0`, instead of only playing it during the short startup/finisher lock.
- Auto/manual attack animation playback now yields to the sustained ultimate animation while the ultimate is active, so idle/run/attack cannot visually overwrite the musou state.
- Dev-only `render_game_to_text` now reports the player animation key, texture key, and ultimate timer to make animation-state regressions directly testable.

Verification:
- `npm run typecheck` passed.
- Direct Playwright probe confirmed Guan Yu remains on `hero_guanyu_ultimate` at 50ms, 500ms, 1s, 2s, and 5s after activation.
- `npm test` passed: 8 files, 55 tests.
- `npm run build` passed; Vite still reports the existing large chunk warning.
- develop-web-game smoke ran against localhost:5173. Its existing screenshot path still produced black captures, but `state-1.json` confirmed Diaochan was playing `hero_diaochan_ultimate`.
- Direct Playwright sustain QA passed 14/14 cases for Guan Yu, Zhao Yun, Zhou Yu, Sun Shangxiang, Diaochan, Dong Zhuo, and Hua Tuo across desktop and iPhone viewports. Results are in `output/web-game/ultimate-qa/ultimate-sustain-qa-results.json`.

TODO:
- None for this request.

Current request: 全面提升 21 位可玩武將無雙招式體驗。
Notes:
- Added playable `ultimate` character animations at 8 frames / 20fps and kept Lu Bu excluded from playable ultimate animation wiring.
- Generated `public/assets/characters/<hero>/anim/ultimate/01..08.png` for all 21 playable heroes plus `output/web-game/ultimate-animation-contact-sheet.png`.
- Expanded ultimate profiles with presentation, dedicated animation keys, unique finisher abilities, and unique finisher VFX keys; startup, every-third-pulse, and near-end finisher now emit separate ultimate combat events.
- BattleScene now locks hero idle/run/attack switching while startup/finisher ultimate animations play, adds stronger short-presentation camera/flash/shake timing, and colors ultimate overlays from the authored VFX profile.
- Added authored musou VFX aliases for each playable hero using existing texture families with distinct color/motion/telegraph profile settings.
- Updated `process_independent_character_frames.py` to support optional 8-frame `ultimate` sources and contact-sheet validation output.

Verification:
- `python -m py_compile scripts\generate_ultimate_animation_assets.py scripts\process_independent_character_frames.py` passed.
- `npm run typecheck` passed.
- `npm test` passed: 8 files, 55 tests.
- `npm run build` passed; Vite still reports the existing large chunk warning.
- Direct Playwright QA passed for Guan Yu, Zhao Yun, Zhou Yu, Sun Shangxiang, Diaochan, Dong Zhuo, and Hua Tuo on desktop 1280x720 and iPhone 390x844 viewports. Screenshots and machine-readable results are under `output/web-game/ultimate-qa/`.
- Asset fetch QA confirmed each sampled hero's `ultimate/01..08.png` files return 200 image/png with no page errors or unexpected console errors.

TODO:
- None for this request.

Current request: Fix ultimate animation feeling unchanged after activation.
Notes:
- BattleScene now keeps replaying the hero's `ultimate` animation while `ultimateTimer > 0`, instead of only playing it during the short startup/finisher lock.
- Auto/manual attack animation playback now yields to the sustained ultimate animation while the ultimate is active, so idle/run/attack cannot visually overwrite the musou state.
- Dev-only `render_game_to_text` now reports the player animation key, texture key, and ultimate timer to make animation-state regressions directly testable.

Verification:
- `npm run typecheck` passed.
- Direct Playwright probe confirmed Guan Yu remains on `hero_guanyu_ultimate` at 50ms, 500ms, 1s, 2s, and 5s after activation.
- `npm test` passed: 8 files, 55 tests.
- `npm run build` passed; Vite still reports the existing large chunk warning.
- develop-web-game smoke ran against localhost:5173. Its existing screenshot path still produced black captures, but `state-1.json` confirmed Diaochan was playing `hero_diaochan_ultimate`.
- Direct Playwright sustain QA passed 14/14 cases for Guan Yu, Zhao Yun, Zhou Yu, Sun Shangxiang, Diaochan, Dong Zhuo, and Hua Tuo across desktop and iPhone viewports. Results are in `output/web-game/ultimate-qa/ultimate-sustain-qa-results.json`.

TODO:
- None for this request.

Current request: Replace mismatched character art, correct weapon silhouettes, and use independent animation frames.
Notes:
- Replaced Liu Bei, Zhang Fei, Gan Ning, Zhang Jiao, Yuan Shao, and Dong Zhuo card/battle assets with chibi mobile-RPG style art sources.
- Corrected Liu Bei to dual swords and Zhang Fei to a Zhangba serpent spear; refreshed Gan Ning, Zhang Jiao, Yuan Shao, and Dong Zhuo toward the game's Q-version style and weapon direction.
- Added `scripts/process_independent_character_frames.py` for one-source-image-per-frame processing. It now prefers individual `{hero}-{idle|run|attack}-01..04.png` sources over sheets, handles transparent sources, normalizes frames to 192x224, and writes legacy attack strips.
- Generated independent idle/run/attack sources for the six characters, 4 frames per state, then processed them into `public/assets/characters`.
- Updated `characterArt.ts` to load 4 animation frames per state so the game does not mix the new independent frames with older generated 05+ frames.
- Verified source/output previews, asset dimensions, `npm run typecheck`, `npm test`, `npm run build`, develop-web-game smoke, gallery Playwright loading, and a Zhang Fei battle launch on localhost:5173. Build still reports the existing large Vite chunk warning.

TODO:
- None for this request.

Current request: Fill in independent idle/run/attack animation frames for all remaining generals.
Notes:
- Parallel workers generated one-source-image-per-frame animation sources for the remaining 16 roster entries: Guan Yu, Zhao Yun, Ma Chao, Zhuge Liang, Cao Cao, Xiahou Dun, Xu Chu, Zhang Liao, Sima Yi, Sun Quan, Zhou Yu, Sun Shangxiang, Taishi Ci, Diaochan, Hua Tuo, and Lu Bu.
- Each of those characters now has `idle`, `run`, and `attack` sources with 4 independent frames per state under `output/ai-character-sources`.
- Re-ran `scripts/process_independent_character_frames.py` to output game-ready `192x224` frames, `battle-idle.png`, legacy `attack-0..3.png`, and `attack-strip.png` for the full roster.
- Updated the processing script card validator to allow existing high-resolution square cards, preserving Lu Bu's sharper `1254x1254` card instead of forcing it down to 1024.
- Verified all 22 roster entries: first 4 frames per state exist, are `192x224`, have visible alpha content, and each attack strip is `768x224`.
- Verified source and processed contact sheets, `npm run typecheck`, `npm test`, `npm run build`, develop-web-game smoke, gallery Playwright card loading, and a Hua Tuo battle launch on localhost:5173. Build still reports the existing large Vite chunk warning.

TODO:
- None for this request.

Current request: Lu Bu codex card looks blurry.
Notes:
- Root cause was `public/assets/characters/lubu/card.png` being the 192x224 battle sprite copied into the card slot, then enlarged to the codex card size.
- Replaced `public/assets/characters/lubu/card.png` with the previously generated high-resolution Lu Bu card art that preserves the battle sprite's horned helmet, twin red plumes, halberd, red eyes, and purple-crimson boss palette.
- Browser verification shows the card now loads at 1254x1254 natural size and renders at about 522x522 in the codex panel.

Verification:
- `npm run typecheck` passed.
- `npm test` passed: 8 files, 53 tests.
- `npm run build` passed; Vite still reports the existing large chunk warning.
- `develop-web-game` client smoke passed on localhost:5173. Direct Playwright codex screenshot saved to `output/web-game/lubu-card-sharp.png`; only WebGL ReadPixels performance warnings appeared.

TODO:
- None for this request.

Current request: Optimize melee swing effects because they feel clipped.
Notes:
- Investigating melee presentation path. Current melee profiles prefer the external `fx_slash_arc` frame animation; sampled slash PNGs appear visually tight/cropped, so the likely fix is to use larger procedural melee arc textures for melee playback and increase texture padding.
- Changed melee playback to skip the tight external slash frame animation for `meleeArc` profiles and use the generated melee textures instead.
- Increased transparent padding for generated melee arc, heavy cleave, petal blade, and thrust textures while keeping the drawn stroke footprint close to the old size.
- Verified `dragon_slash` and `heavy_cleave_wave` screenshots on desktop, plus `dragon_slash` on mobile. No console/page errors and no visible edge clipping.
- `npm run typecheck`, `npm test`, and `npm run build` passed. Build still reports the existing large Vite chunk warning.

TODO:
- None for this request.

Follow-up request: Guan Yu still shows clipping during basic attacks.
Notes:
- Isolated the remaining clipping to Guan Yu's character attack animation frames, not the global melee VFX sprite. Attack frames 04/05 touch the top/right canvas edge after the raw 288x320 animation frame is cropped to the 192x224 game frame.
- Added an attack-only safe margin for Guan Yu in `generate_character_animation_assets.py`, and changed safe-margin generation so source frames are fitted into the game crop window before the final 192x224 crop.
- Regenerated Guan Yu attack frames. All final attack frames now have at least 12px alpha padding on top/right/bottom/left where the previous problematic frames hit 0px.
- Added smaller rounded caps to generated attack arc cores so the slash reads as an intentional stroke endpoint rather than a hard canvas cut.
- Verified with direct Playwright full-page screenshots of Guan Yu basic attacks; no console/page errors and no visible top/right clipping in the attack frames.
- `develop-web-game` client smoke reached BattleScene state, but its screenshot output remained black due the known WebGL/canvas capture path issue; direct Playwright full-page screenshots were used for visual QA.
- `python -m py_compile scripts/generate_character_animation_assets.py`, `npm run typecheck`, `npm test`, and `npm run build` passed. Build still reports the existing large Vite chunk warning.

TODO:
- None for this request.

Current request: Check other generals; character attack animation should stay in bounds and contain no baked-in effects.
Notes:
- Found all 21 character folders have 8 attack frames.
- The generator for the currently scripted heroes baked attack VFX directly into character frames (`draw_arc_fx`, `draw_petal_fx`, `draw_arrow_fx`), which conflicts with the intended pipeline where combat VFX is overlaid separately.
- Changed scripted attack generation to output body motion only: windup, strike, follow-through, and recovery use transformed character sprites without slash/petal/arrow overlays.
- Set scripted attack generation to default to at least 12px safe margin so future regenerated attack frames do not touch the 192x224 bounds.
- Updated the AI-source processing path as well: `process_ai_character_sources.py` no longer bakes arc VFX into attack frames, and its attack-only path writes safe-bounded attack frames without touching card/menu art.
- Regenerated all 21 characters' 8-frame attack animations and 4-frame legacy fallback attack strips. Scripted heroes were regenerated through `generate_character_animation_assets.py`; the remaining AI-source heroes were regenerated with `process_ai_character_sources.py --attack-only`.
- Verified bounds across 168 attack animation frames and 84 legacy attack frames: minimum alpha padding is 12px.
- Generated and visually inspected `output/web-game/character-attack-cleanup/all-attack-frames-clean.png`; no generated attack slash/petal/arrow overlays remain in the character frames.
- Direct Playwright gameplay screenshots for Guan Yu, Sun Shangxiang, and Liu Bei loaded BattleScene with no console/page errors. Combat VFX still appears from the normal overlay pipeline.
- `develop-web-game` client was run. It currently captures black canvas screenshots through its canvas capture path and does not expose state on the menu, matching the known capture limitation; direct full-page Playwright screenshots were used for visual QA.
- `python -m py_compile scripts/generate_character_animation_assets.py scripts/process_ai_character_sources.py`, `npm run typecheck`, `npm test`, and `npm run build` passed. Build still reports the existing large Vite chunk warning.

TODO:
- None for this request.

Current request: Implement CC0 battle audiovisual asset upgrade plan.
Notes:
- Created `public/assets/vfx`, `public/assets/audio/bgm`, `public/assets/audio/sfx`, and `public/assets/licenses` structure.
- Downloaded CC0 core sources through normal source flows: Brackeys VFX Bundle, BiteMe Chinese Game Music, OpenGameArt Battle Theme A, StarNinjas Sword SFX, RPG Sound Pack, Swishes, and Kenney Impact Sounds.
- Copied selected VFX spritesheets/particles and audio variants to stable public paths; canonical credits are in `public/assets/licenses/credits.md`.
- Updated audio catalog to keep logical `MusicKey`/`SfxKey` names while preloading physical SFX variants; `AudioController.playSfx` now selects variants with bounded detune and volume jitter.
- Updated VFX manifest to use `assets/vfx`, generic animation entries, Brackeys spritesheet animations, and profile-level `animationKeys`/`nativeColor` support.

TODO:
- None for this request.

Verification:
- `npm run typecheck` passed.
- `npm test` passed: 7 files, 44 tests.
- `npm run build` passed; Vite still reports the existing large chunk warning.
- Playwright smoke passed on desktop and mobile with no failed requests or 4xx asset responses. Audio unlock reached `contextState: running`, battle music played, mobile camera stayed at 0.5 zoom, and defeat stopped BGM.
- Boss switch was not reached in the long smoke because the automated run hit upgrade pauses and then defeat before boss spawn; BattleScene's existing boss music branch remains wired to `music_boss`.

Follow-up request: Remove the strange square-looking combat effect.
Notes:
- Removed the Brackeys `lightstreaks` spritesheet from `frost_lotus`, which is used by Huatuo's 青囊無雙 pulse and produced the bright rectangular block.
- Removed Brackeys `big_hit` spritesheet references from area/profile mappings that could create the same square-sheet look.
- Kept the downloaded spritesheets in the asset manifest for future curated use, but they no longer auto-play in these battle profiles.

Verification:
- `npm run typecheck` passed.
- `npm run build` passed; Vite still reports the existing large chunk warning.
- Targeted tests passed: `src/game/assets/manifest.test.ts` and `src/game/audio/events.test.ts`.
- Full `npm test` currently fails in pre-existing `characterArt.test.ts` because several untracked character assets are 128x150/160x186 instead of the expected 192x224; this is unrelated to the square VFX change.
- Playwright Huatuo manual/ultimate smoke captured `output/web-game/no-square-huatuo.png`; the square lightstreak block is gone.

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

Current request: Improve combat VFX, moves, and effects by referencing Survivor-like combat presentation patterns.
Notes:
- Scope will stay render-focused unless a small simulation change is needed: stronger projectile trails, clearer area/telegraph silhouettes, heavier hit/crit/kill juice, and more distinct ultimate/manual presentation.
- Implemented render-only combat presentation changes in progress: contact flashes/starbursts/ripples in `CombatJuiceEffects`, projectile afterimages, rain streaks, kill-density collapse pulses, and denser area telegraph detail in `BattleScene`.
- `npm run typecheck`, `npm test`, and `npm run build` passed. Build still reports the existing large Vite chunk warning.
- develop-web-game smoke passed on localhost:5173 with no console/page errors; its canvas capture path produced black PNGs, so direct Playwright full-page screenshots were used for visual QA.
- Desktop screenshots verified Diaochan manual/ultimate pulse, Sun Shangxiang projectile trails, arrow-rain telegraphs, hit sparks, and kill pickups. Mobile iPhone 14 screenshot verified responsive 0.5 camera zoom and the new large manual pulse still renders under the HUD without runtime errors.

TODO:
- None for this request.

Current request: Apply the same independent-frame treatment to enemies.
Notes:
- Enemy runtime states remain `walk`, `hit`, and `death`; the game does not use `idle/run/attack` for enemies.
- Updated enemy animation counts to `walk=4`, `hit=4`, and `death=5`, so every enemy state now has at least 4 frames.
- Regenerated all six enemy sets: infantry, archer, shield, cavalry, captain, and Lu Bu.
- `scripts/generate_enemy_animation_assets.py` now writes each produced frame as its own raw source PNG under `scripts/source/enemy-anims/<enemy>/<state>/raw/NN.png`, matching the one-image-per-frame pipeline and avoiding runtime spritesheet slicing.
- Verified 78 public enemy frames and 78 raw source frames, all `192x192` transparent PNGs with visible alpha content.
- Source/output preview saved at `output/web-game/enemy-independent-frames-preview.png`.

Verification:
- `python -m py_compile scripts/generate_enemy_animation_assets.py` passed.
- `npm run typecheck` passed.
- `npm test` passed: 8 files, 53 tests.
- `npm run build` passed; Vite still reports the existing large chunk warning.
- develop-web-game client smoke passed on localhost:5173; only the skill script's existing module-type warning appeared.
- Direct Playwright verification loaded a battle, fetched all `assets/enemies/*/{walk,hit,death}/NN.png` paths including new `hit/04.png`, found no missing assets or console/page errors, and saved `output/web-game/browser-verify/enemy-animation-battle.png`.

TODO:
- None for this request.

Current request: Regenerate Ma Chao's card because it does not match the other generals.
Notes:
- Compared Ma Chao's existing card against Guan Yu, Zhao Yun, Zhang Fei, Cao Cao, Zhou Yu, Lu Bu, and Sun Shangxiang in `output/web-game/machao-card-style-check.png`.
- Root mismatch was the old Ma Chao card using taller, more realistic proportions while the rest of the roster reads as Q-version/chibi gacha card art.
- Generated a new square Ma Chao card with the built-in image generation tool, using the style contact sheet and Ma Chao battle sprite as references.
- Replaced `public/assets/characters/machao/card.png` with the new silver-blue chibi spear/lance card art.
- Comparison preview saved at `output/web-game/machao-card-replaced-check.png`.

Verification:
- New card is `1254x1254` RGB and loads from `/assets/characters/machao/card.png`.
- `npm test -- src/game/content/characterArt.test.ts` passed: 6 tests.
- Browser asset check returned HTTP 200, natural size `1254x1254`, and no console/page errors; screenshot saved at `output/web-game/browser-verify/machao-card-replaced.png`.

TODO:
- None for this request.

Current request: Upgrade playable hero ultimate / musou move experience.
Notes:
- Added playable `ultimate` character animations at 8 frames / 20fps and kept Lu Bu excluded from playable ultimate animation wiring.
- Generated `public/assets/characters/<hero>/anim/ultimate/01..08.png` for all 21 playable heroes plus `output/web-game/ultimate-animation-contact-sheet.png`.
- Expanded ultimate profiles with presentation data, dedicated animation keys, unique finisher abilities, and unique finisher VFX keys. Startup, every-third-pulse, and near-end finisher now emit separate ultimate combat events.
- BattleScene now locks hero idle/run/attack switching while startup/finisher ultimate animations play, adds stronger short-presentation camera/flash/shake timing, and colors ultimate overlays from the authored VFX profile.
- Added authored musou VFX aliases for each playable hero using existing texture families with distinct color, motion, and telegraph profile settings.
- Updated `process_independent_character_frames.py` to support optional 8-frame `ultimate` sources and contact-sheet validation output.

Verification:
- `python -m py_compile scripts\generate_ultimate_animation_assets.py scripts\process_independent_character_frames.py` passed.
- `npm run typecheck` passed.
- `npm test` passed: 8 files, 55 tests.
- `npm run build` passed; Vite still reports the existing large chunk warning.
- Direct Playwright QA passed for Guan Yu, Zhao Yun, Zhou Yu, Sun Shangxiang, Diaochan, Dong Zhuo, and Hua Tuo on desktop 1280x720 and iPhone 390x844 viewports. Screenshots and machine-readable results are under `output/web-game/ultimate-qa/`.
- Asset fetch QA confirmed each sampled hero's `ultimate/01..08.png` files return 200 image/png with no page errors or unexpected console errors.

TODO:
- None for this request.

Current request: Fix ultimate animation feeling unchanged after activation.
Notes:
- BattleScene now keeps replaying the hero's `ultimate` animation while `ultimateTimer > 0`, instead of only playing it during the short startup/finisher lock.
- Auto/manual attack animation playback now yields to the sustained ultimate animation while the ultimate is active, so idle/run/attack cannot visually overwrite the musou state.
- Dev-only `render_game_to_text` now reports the player animation key, texture key, and ultimate timer to make animation-state regressions directly testable.

Verification:
- `npm run typecheck` passed.
- Direct Playwright probe confirmed Guan Yu remains on `hero_guanyu_ultimate` at 50ms, 500ms, 1s, 2s, and 5s after activation.
- `npm test` passed: 8 files, 55 tests.
- `npm run build` passed; Vite still reports the existing large chunk warning.
- develop-web-game smoke ran against localhost:5173. Its existing screenshot path still produced black captures, but `state-1.json` confirmed Diaochan was playing `hero_diaochan_ultimate`.
- Direct Playwright sustain QA passed 14/14 cases for Guan Yu, Zhao Yun, Zhou Yu, Sun Shangxiang, Diaochan, Dong Zhuo, and Hua Tuo across desktop and iPhone viewports. Results are in `output/web-game/ultimate-qa/ultimate-sustain-qa-results.json`.

TODO:
- None for this request.
