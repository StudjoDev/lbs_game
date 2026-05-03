Original prompt: 呂布的卡片圖像看起來還沒有被設定，幫我設定。

Notes:
- User clarified the Lu Bu card can directly use the existing battle image.
- Keep the active card path as `public/assets/characters/lubu/card.png` so existing manifest tests and UI references continue to work.
- Replaced `public/assets/characters/lubu/card.png` with the current `battle-idle.png` artwork.
- Verified with `npm test`, `npm run build`, the develop-web-game Playwright client, and locked/revealed codex screenshots.

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
