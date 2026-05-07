# Warrior Generation Pipeline

新增武將只走單一入口：

```bash
npm run warrior:new -- --spec scripts/warrior-generation/specs/<heroId>.json
```

流程一律先寫入 `output/warrior-generation/<heroId>/candidate/`。只有 spec、來源圖、資產 gate、特效 gate、content wiring 全部通過後，才會 promote 到 `public/assets/characters/<heroId>/` 與正式 TypeScript content。

## Source Contract

管線不產生 placeholder，不用 SVG 或 PIL 假圖補主美術。你必須提供：

- `card.png`: imagegen raster card source
- `battle.png`: transparent imagegen raster battle cutout

可以放在 `output/warrior-generation/<heroId>/sources/`，或在 spec 的 `sourceImages` 指向既有 PNG。若要接外部 provider，設定 `WARRIOR_IMAGEGEN_COMMAND` 或傳 `--imagegen-command`；provider 會收到：

- `WARRIOR_SPEC_PATH`
- `WARRIOR_PROMPT_PACK`
- `WARRIOR_SOURCE_DIR`

provider 必須把 `card.png`、`battle.png` 寫入 `WARRIOR_SOURCE_DIR`。沒有 provider 或缺圖時，流程只輸出 prompt pack 與 failure report，不會 promote。

## Required Gates

- `idle/run/attack/ultimate = 6/6/8/8`
- 每個 state 都要有 `anim/<state>/effect/*.png`
- base frame 只放人物、武器、衣物，不准 baked glow/trail
- overlay 不准方形、矩形、面板式或 lightstreak profile
- PNG only，battle/action frame 固定 `192x224`
- padding >= 8，occupancy <= 0.67，center offset <= x18/y16
- duplicate hero id、missing bond、invalid VFX key 直接 fail
- dry-run 不改正式 roster

## Reports

通過或失敗都會在 candidate 產出：

- `generation-report.json`
- `motion-brief.md`
- `prompt-pack.json`
- `contact-sheet.png`

正式 promote 後，會同步寫入 `scripts/source/character-anims/<heroId>/generation-report.json` 與 `motion-brief.md`。

## Legacy Entry Points

`scripts/process_ai_character_sources.py` 已預設停用新武將流程，避免再產生缺少 ultimate / overlay 的舊格式。`scripts/process_independent_character_frames.py` 只接受 individual PNG frames，並要求 `idle=6 run=6 attack=8 ultimate=8`；舊 4x3 sheet 輸入會直接 fail。
