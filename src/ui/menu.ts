import { loadCollection } from "../game/collection/collectionStore";
import { bondById, characterArtById, characterArts } from "../game/content/characterArt";
import { factions } from "../game/content/factions";
import { heroes } from "../game/content/heroes";
import type { DisplaySettings } from "../game/display/settings";
import type { CharacterArtDef, CharacterId, CollectionState, FactionId, HeroId } from "../game/types";
import { bindAudioControls, renderAudioControls, type AudioControlCallbacks } from "./audioControls";
import { createUiLayer, removeUiLayer } from "./layer";
import { bindSettingsPanel, renderSettingsPanel } from "./settingsPanel";

interface MenuCallbacks extends AudioControlCallbacks {
  getDisplaySettings: () => DisplaySettings;
  onDisplaySettingsChange: (settings: DisplaySettings) => void;
  onStart: (heroId: HeroId) => void;
}

type MenuMode = "select" | "collection" | "settings";

export class MenuController {
  private readonly root = createUiLayer("menu-ui");
  private selectedFaction: FactionId = "qun";
  private selectedHero: HeroId = "diaochan";
  private selectedCollectionCharacter: CharacterId = "diaochan";
  private mode: MenuMode = "select";

  constructor(private readonly callbacks: MenuCallbacks) {
    this.render();
  }

  destroy(): void {
    removeUiLayer();
  }

  private render(): void {
    this.root.style.setProperty("--ui-scale", this.callbacks.getDisplaySettings().uiScale.toString());
    const collection = loadCollection();
    if (this.mode === "settings") {
      this.renderSettings();
      return;
    }
    if (this.mode === "collection") {
      this.renderCollection(collection);
      return;
    }
    this.renderSelect(collection);
  }

  private renderSelect(collection: CollectionState): void {
    const faction = factions.find((item) => item.id === this.selectedFaction) ?? factions[0];
    const visibleHeroes = heroes.filter((hero) => hero.factionId === this.selectedFaction);
    if (!visibleHeroes.some((hero) => hero.id === this.selectedHero)) {
      this.selectedHero = visibleHeroes[0].id;
    }
    const selectedHero = heroes.find((hero) => hero.id === this.selectedHero) ?? visibleHeroes[0];
    const selectedArt = characterArtById[selectedHero.artId];

    this.root.innerHTML = `
      <main class="menu-stage">
        <section class="menu-hero" style="${artVars(selectedArt)}">
          <div class="seal">Q版三國</div>
          <h1>亂世割草傳</h1>
          <p>選陣營、收武將、衝進虎牢關，把滿屏敵軍掃成經驗光點。首版主打 Q 版日式手遊卡牌感與爽快割草節奏。</p>
          <div class="feature-ribbon">
            <span>武將收藏</span>
            <span>陣營被動</span>
            <span>自動攻擊</span>
            <span>手動大招</span>
          </div>
          <div class="hero-preview card-preview" style="${artVars(selectedArt)}">
            <img class="hero-preview-art" src="${selectedArt.cardImage}" alt="${selectedArt.name}" draggable="false" />
            <div class="hero-preview-copy">
              ${renderStars(selectedArt.stars)}
              <strong>${selectedHero.name}</strong>
              <span>${selectedHero.title} ・ ${selectedHero.role}</span>
              <small>${selectedArt.quote}</small>
            </div>
          </div>
        </section>
        <section class="selection-panel">
          <div class="panel-heading">
            <span>選擇陣營</span>
            <strong>${faction.passiveName}</strong>
          </div>
          <div class="faction-row">
            ${factions
              .map(
                (item) => `
                  <button class="faction-card ${item.id === this.selectedFaction ? "is-selected" : ""}" data-faction="${item.id}">
                    <span class="faction-mark" style="--faction:${item.palette.primary}; --accent:${item.palette.accent}">${item.name}</span>
                    <strong>${item.subtitle}</strong>
                    <small>${item.passiveText}</small>
                  </button>
                `
              )
              .join("")}
          </div>
          <div class="panel-heading">
            <span>選擇武將</span>
            <strong>${selectedHero.passiveName}</strong>
          </div>
          <div class="hero-grid">
            ${visibleHeroes.map((hero) => renderHeroPick(hero.id, collection, hero.id === this.selectedHero)).join("")}
          </div>
          <div class="skill-panel">
            <div>
              <span>自動攻擊</span>
              <strong>${selectedHero.autoAbility.name}</strong>
              <small>${selectedHero.autoAbility.description}</small>
            </div>
            <div>
              <span>手動技能</span>
              <strong>${selectedHero.manualAbility.name}</strong>
              <small>${selectedHero.manualAbility.description}</small>
            </div>
          </div>
          <div class="progression-note">
            <strong>${selectedHero.name} 可在局內升級並抽到專屬強化</strong>
            <span>首版先保留簡潔成長線，收藏圖鑑與羈絆展示會提供長期收集目標。</span>
          </div>
          ${renderAudioControls(this.callbacks.getAudioSettings())}
          <div class="menu-actions">
            <button class="codex-button" data-collection="true">武將圖鑑</button>
            <button class="codex-button" data-settings="true">設定</button>
            <button class="start-button" data-start="true">開戰</button>
          </div>
        </section>
      </main>
    `;

    this.root.querySelectorAll<HTMLButtonElement>("[data-faction]").forEach((button) => {
      button.addEventListener("click", () => {
        this.callbacks.onAudioCue("sfx_ui_select");
        this.selectedFaction = button.dataset.faction as FactionId;
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-hero]").forEach((button) => {
      button.addEventListener("click", () => {
        this.callbacks.onAudioCue("sfx_ui_select");
        this.selectedHero = button.dataset.hero as HeroId;
        this.selectedCollectionCharacter = this.selectedHero;
        this.render();
      });
    });
    this.root.querySelector<HTMLButtonElement>("[data-collection]")?.addEventListener("click", () => {
      this.callbacks.onAudioCue("sfx_ui_select");
      this.selectedCollectionCharacter = this.selectedHero;
      this.mode = "collection";
      this.render();
    });
    this.root.querySelector<HTMLButtonElement>("[data-settings]")?.addEventListener("click", () => {
      this.callbacks.onAudioCue("sfx_ui_select");
      this.mode = "settings";
      this.render();
    });
    this.root.querySelector<HTMLButtonElement>("[data-start]")?.addEventListener("click", () => {
      this.callbacks.onStart(this.selectedHero);
    });
    bindAudioControls(this.root, this.callbacks);
  }

  private renderSettings(): void {
    this.root.innerHTML = `
      <main class="settings-stage">
        ${renderSettingsPanel(this.callbacks.getAudioSettings(), this.callbacks.getDisplaySettings(), {
          kicker: "系統",
          title: "設定",
          closeLabel: "返回",
          closeData: "settings-back"
        })}
      </main>
    `;
    bindSettingsPanel(this.root, this.callbacks, () => this.renderSettings());
    this.root.querySelector<HTMLButtonElement>("[data-settings-back]")?.addEventListener("click", () => {
      this.callbacks.onAudioCue("sfx_ui_select");
      this.mode = "select";
      this.render();
    });
  }

  private renderCollection(collection: CollectionState): void {
    const selectedArt = characterArtById[this.selectedCollectionCharacter];
    const selectedEntry = collection[selectedArt.id];
    const revealed = selectedEntry.revealed;
    const ownedCount = characterArts.filter((art) => collection[art.id].owned).length;

    this.root.innerHTML = `
      <main class="codex-stage" style="${artVars(selectedArt)}">
        <section class="codex-showcase">
          <div class="codex-topline">
            <button class="codex-back" data-back="true">返回</button>
            <span>${ownedCount}/${characterArts.length} 已擁有</span>
          </div>
          <div class="codex-card-frame ${revealed ? "" : "is-locked"}" style="${artVars(selectedArt)}">
            <img src="${selectedArt.cardImage}" alt="${revealed ? selectedArt.name : "未揭示武將"}" draggable="false" />
            ${revealed ? "" : `<div class="lock-veil"><strong>未揭示</strong><span>擊敗虎牢 Boss 後解鎖</span></div>`}
          </div>
        </section>
        <section class="codex-detail-panel">
          <div class="panel-heading codex-heading">
            <span>武將圖鑑</span>
            <strong>${revealed ? selectedArt.rarityLabel : "未知"}</strong>
          </div>
          <div class="codex-title-row">
            <div>
              ${renderStars(selectedArt.stars, !revealed)}
              <h2>${revealed ? selectedArt.name : "未揭示武將"}</h2>
              <p>${revealed ? `${selectedArt.title} ・ ${selectedArt.role}` : "擊敗虎牢關最終強敵後，才能揭示完整卡面。"}</p>
            </div>
            <span class="owned-pill ${selectedEntry.owned ? "is-owned" : ""}">${selectedEntry.owned ? "已擁有" : "未擁有"}</span>
          </div>
          <blockquote>${revealed ? selectedArt.quote : "尚未解鎖的武將卡，輪廓與星級先保留神秘感。"}</blockquote>
          <div class="codex-lore">
            <strong>角色故事</strong>
            <p>${revealed ? selectedArt.biography : "完成一局並擊敗呂布後，圖鑑會揭示 Boss 的完整卡面與背景。"}</p>
          </div>
          <div class="codex-bonds">
            <strong>羈絆</strong>
            <div>${renderBondChips(selectedArt.bondIds, !revealed)}</div>
          </div>
          ${this.renderCollectionSkillBlock(selectedArt, revealed)}
          <div class="codex-grid">
            ${characterArts
              .map((art) => renderCodexThumb(art, collection, art.id === this.selectedCollectionCharacter))
              .join("")}
          </div>
          <div class="menu-actions codex-actions">
            ${renderAudioControls(this.callbacks.getAudioSettings())}
            ${selectedArt.playable && selectedEntry.owned ? `<button class="start-button" data-codex-start="${selectedArt.id}">使用此武將開戰</button>` : ""}
          </div>
        </section>
      </main>
    `;

    this.root.querySelector<HTMLButtonElement>("[data-back]")?.addEventListener("click", () => {
      this.callbacks.onAudioCue("sfx_ui_select");
      this.mode = "select";
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-codex-character]").forEach((button) => {
      button.addEventListener("click", () => {
        this.callbacks.onAudioCue("sfx_ui_select");
        this.selectedCollectionCharacter = button.dataset.codexCharacter as CharacterId;
        this.render();
      });
    });
    this.root.querySelector<HTMLButtonElement>("[data-codex-start]")?.addEventListener("click", (event) => {
      const heroId = (event.currentTarget as HTMLButtonElement).dataset.codexStart as HeroId;
      this.callbacks.onStart(heroId);
    });
    bindAudioControls(this.root, this.callbacks);
  }

  private renderCollectionSkillBlock(art: CharacterArtDef, revealed: boolean): string {
    if (!revealed || !art.playable) {
      return `
        <div class="codex-skill-row">
          <div><span>定位</span><strong>${revealed ? art.role : "未知"}</strong><small>Boss 圖鑑角色目前以收藏展示為主，暫不作為可選武將。</small></div>
        </div>
      `;
    }
    const hero = heroes.find((item) => item.artId === art.id);
    if (!hero) {
      return "";
    }
    return `
      <div class="codex-skill-row">
        <div><span>自動攻擊</span><strong>${hero.autoAbility.name}</strong><small>${hero.autoAbility.description}</small></div>
        <div><span>手動技能</span><strong>${hero.manualAbility.name}</strong><small>${hero.manualAbility.description}</small></div>
      </div>
    `;
  }
}

function renderHeroPick(heroId: HeroId, collection: CollectionState, selected: boolean): string {
  const hero = heroes.find((item) => item.id === heroId)!;
  const art = characterArtById[hero.artId];
  const entry = collection[art.id];
  return `
    <button class="hero-card character-pick ${selected ? "is-selected" : ""}" data-hero="${hero.id}" style="${artVars(art)}">
      <img class="mini-card-art" src="${art.cardImage}" alt="${art.name}" draggable="false" />
      <div>
        <div class="card-meta-line">
          ${renderStars(art.stars)}
          <span>${entry.owned ? "已擁有" : "未擁有"}</span>
        </div>
        <strong>${hero.name}</strong>
        <span>${hero.title}</span>
        <small>${hero.autoAbility.name} / ${hero.manualAbility.name}</small>
        <div class="bond-row">${renderBondChips(art.bondIds)}</div>
      </div>
    </button>
  `;
}

function renderCodexThumb(art: CharacterArtDef, collection: CollectionState, selected: boolean): string {
  const entry = collection[art.id];
  const locked = !entry.revealed;
  return `
    <button class="codex-thumb ${selected ? "is-selected" : ""} ${locked ? "is-locked" : ""}" data-codex-character="${art.id}" style="${artVars(art)}">
      <img src="${art.cardImage}" alt="${locked ? "未揭示武將" : art.name}" draggable="false" />
      <span>${locked ? "未揭示" : art.name}</span>
      ${renderStars(art.stars, locked)}
    </button>
  `;
}

function renderStars(count: number, dimmed = false): string {
  return `<span class="stars ${dimmed ? "is-dimmed" : ""}" aria-label="${count} 星">${"★".repeat(count)}</span>`;
}

function renderBondChips(ids: string[], dimmed = false): string {
  return ids
    .map((id) => {
      const bond = bondById[id];
      return `<span class="bond-chip ${dimmed ? "is-dimmed" : ""}" title="${bond?.description ?? ""}">${dimmed ? "未知" : (bond?.name ?? id)}</span>`;
    })
    .join("");
}

function artVars(art: CharacterArtDef): string {
  return `--art-primary:${art.palette.primary}; --art-secondary:${art.palette.secondary}; --art-accent:${art.palette.accent};`;
}
