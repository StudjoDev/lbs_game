import { loadCollection } from "../game/collection/collectionStore";
import { bondById, characterArtById, characterArts } from "../game/content/characterArt";
import { chapters } from "../game/content/chapters";
import {
  conquestCities,
  conquestCityById,
  getConquestCityForHero
} from "../game/content/conquest";
import { factions } from "../game/content/factions";
import { heroes } from "../game/content/heroes";
import type { DisplaySettings } from "../game/display/settings";
import type { GameSettings } from "../game/settings/gameSettings";
import {
  accrueIdleRewards,
  claimDailyMission,
  claimIdleRewards,
  equipItem,
  loadMetaProgression,
  mergeEquipment,
  openChapterChest,
  saveMetaProgression,
  upgradeTalent,
  upgradeFacility,
  type DailyMissionId,
  type FacilityId,
  type MetaProgressionState,
  type TalentId
} from "../game/meta/progression";
import type { ChapterId, CharacterArtDef, CharacterId, CollectionState, ConquestCityId, FactionId, HeroId } from "../game/types";
import { bindAudioControls, renderAudioControls, type AudioControlCallbacks } from "./audioControls";
import { bindBasePanel, renderBasePanel, type BaseTab } from "./base";
import { createUiLayer, removeUiLayer } from "./layer";
import { bindSettingsPanel, renderSettingsPanel } from "./settingsPanel";

interface MenuCallbacks extends AudioControlCallbacks {
  getDisplaySettings: () => DisplaySettings;
  onDisplaySettingsChange: (settings: DisplaySettings) => void;
  getGameSettings: () => GameSettings;
  onGameSettingsChange: (settings: GameSettings) => void;
  onStart: (heroId: HeroId, chapterId: ChapterId, conquestCityId?: ConquestCityId) => void;
}

type MenuMode = "select" | "collection" | "settings" | "base" | "chapter" | "conquest";
type RunTarget = { kind: "chapter"; chapterId: ChapterId } | { kind: "conquest"; cityId: ConquestCityId };

export class MenuController {
  private readonly root = createUiLayer("menu-ui");
  private selectedFaction: FactionId = "qun";
  private selectedHero: HeroId = "diaochan";
  private selectedChapter: ChapterId = "yellow_turbans";
  private selectedConquestCity: ConquestCityId = "julu";
  private selectedRunTarget: RunTarget = { kind: "chapter", chapterId: "yellow_turbans" };
  private conquestMapFullscreen = false;
  private conquestMapLayoutAbort?: AbortController;
  private selectedCollectionCharacter: CharacterId = "diaochan";
  private mode: MenuMode = "select";
  private baseTab: BaseTab = "overview";
  private meta: MetaProgressionState = loadMetaProgression();

  constructor(private readonly callbacks: MenuCallbacks) {
    this.render();
  }

  destroy(): void {
    this.conquestMapLayoutAbort?.abort();
    removeUiLayer();
  }

  private render(): void {
    this.conquestMapLayoutAbort?.abort();
    this.conquestMapLayoutAbort = undefined;
    this.root.style.setProperty("--ui-scale", this.callbacks.getDisplaySettings().uiScale.toString());
    const collection = loadCollection();
    if (this.mode === "settings") {
      this.renderSettings();
      return;
    }
    if (this.mode === "base") {
      this.renderBase();
      return;
    }
    if (this.mode === "chapter") {
      this.renderChapter();
      return;
    }
    if (this.mode === "conquest") {
      this.renderConquest();
      return;
    }
    if (this.mode === "collection") {
      this.renderCollection(collection);
      return;
    }
    this.renderSelect(collection);
  }

  private renderBottomNav(activeMode: MenuMode): string {
    const items: Array<{ mode: MenuMode; icon: string; label: string }> = [
      { mode: "select", icon: "將", label: "武將" },
      { mode: "chapter", icon: "章", label: "章節" },
      { mode: "conquest", icon: "城", label: "天下" },
      { mode: "base", icon: "營", label: "基地" },
      { mode: "settings", icon: "設", label: "設定" }
    ];
    return `
      <nav class="bottom-nav" aria-label="主選單">
        ${items
          .map(
            (item) => `
              <button class="${item.mode === activeMode ? "is-active" : ""}" data-nav="${item.mode}">
                <span>${item.icon}</span>
                <b>${item.label}</b>
              </button>
            `
          )
          .join("")}
      </nav>
    `;
  }

  private bindBottomNav(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.nav as MenuMode;
        if (this.mode === mode) {
          return;
        }
        this.callbacks.onAudioCue("sfx_ui_select");
        this.mode = mode;
        this.root.scrollTo(0, 0);
        this.render();
      });
    });
  }

  private getRunTargetSummary(): {
    kicker: string;
    title: string;
    subtitle: string;
    detail: string;
    actionLabel: string;
    locked: boolean;
  } {
    this.meta = loadMetaProgression();
    const target = this.selectedRunTarget;
    if (target.kind === "conquest") {
      const city = conquestCityById[target.cityId];
      const progress = this.meta.conquest.cities[city.id];
      const gatekeeper = heroes.find((hero) => hero.id === city.gatekeeperHeroId);
      return {
        kicker: "天下出征",
        title: city.name,
        subtitle: `${city.regionName} · 戰力 ${city.recommendedPower}`,
        detail: `守門 ${gatekeeper?.name ?? "武將"} · ${progress.conquered ? "已攻下" : progress.unlocked ? "可攻打" : "未解鎖"}`,
        actionLabel: progress.conquered ? "重訪城池" : "攻打城池",
        locked: !progress.unlocked
      };
    }
    const chapter = chapters.find((item) => item.id === target.chapterId) ?? chapters[0];
    const progress = this.meta.chapterProgress[chapter.id];
    return {
      kicker: "章節出征",
      title: chapter.name,
      subtitle: `${chapter.subtitle} · 戰力 ${chapter.recommendedPower}`,
      detail: `最佳 ${progress.bestRoom}/${chapter.rooms.length} · 通關 ${progress.clears}`,
      actionLabel: "進入章節",
      locked: !progress.unlocked
    };
  }

  private startSelectedRun(heroId = this.selectedHero): void {
    const heroAvailable = this.callbacks.getGameSettings().testMode || loadCollection()[heroId]?.owned === true;
    if (!heroAvailable) {
      this.callbacks.onAudioCue("sfx_ui_select");
      return;
    }
    const target = this.selectedRunTarget;
    if (target.kind === "conquest") {
      const city = conquestCityById[target.cityId];
      const progress = loadMetaProgression().conquest.cities[city.id];
      if (!progress.unlocked) {
        this.callbacks.onAudioCue("sfx_ui_select");
        return;
      }
      this.callbacks.onStart(heroId, city.chapterId, city.id);
      return;
    }
    const chapter = chapters.find((item) => item.id === target.chapterId) ?? chapters[0];
    const progress = loadMetaProgression().chapterProgress[chapter.id];
    if (!progress.unlocked) {
      this.callbacks.onAudioCue("sfx_ui_select");
      return;
    }
    this.callbacks.onStart(heroId, chapter.id);
  }

  private renderSelect(collection: CollectionState): void {
    this.meta = loadMetaProgression();
    const testMode = this.callbacks.getGameSettings().testMode;
    const faction = factions.find((item) => item.id === this.selectedFaction) ?? factions[0];
    const visibleHeroes = heroes.filter((hero) => hero.factionId === this.selectedFaction);
    const ownedVisibleHeroes = visibleHeroes.filter((hero) => collection[hero.artId]?.owned);
    if (
      !visibleHeroes.some((hero) => hero.id === this.selectedHero) ||
      (!testMode && !collection[this.selectedHero]?.owned)
    ) {
      this.selectedHero = (ownedVisibleHeroes[0] ?? visibleHeroes[0]).id;
    }
    const selectedHero = heroes.find((hero) => hero.id === this.selectedHero) ?? visibleHeroes[0];
    const selectedArt = characterArtById[selectedHero.artId];
    const selectedOwned = collection[selectedHero.artId]?.owned === true;
    const selectedAvailable = selectedOwned || testMode;
    const mastery = this.meta.heroMastery[selectedHero.id];
    const target = this.getRunTargetSummary();

    this.root.innerHTML = `
      <main class="menu-stage home-stage" style="${artVars(selectedArt)}">
        <section class="home-topbar">
          <div>
            <span class="seal">Q版三國</span>
            <strong>亂世割草傳</strong>
          </div>
          <div class="home-resources" aria-label="資源">
            ${renderResourceChip("戰功", this.meta.resources.merit)}
            ${renderResourceChip("軍糧", this.meta.resources.provisions)}
            ${renderResourceChip("聲望", this.meta.resources.renown)}
            ${renderResourceChip("鑰匙", this.meta.chapterChests.keys)}
          </div>
        </section>

        <section class="home-brief">
          <div class="home-hero-card">
            <img src="${selectedArt.cardImage}" alt="${selectedArt.name}" draggable="false" />
            <div>
              <span class="panel-kicker">出戰武將</span>
              <h1>${selectedHero.name}</h1>
              <p>${selectedHero.title} · ${selectedHero.role}</p>
              <div class="home-stat-line">
                <span>Lv.${mastery.level}</span>
                <span>${faction.name}</span>
                <span>${selectedHero.manualAbility.name}</span>
              </div>
            </div>
          </div>

          <div class="sortie-card">
            <div>
              <span class="panel-kicker">${target.kicker}</span>
              <strong>${target.title}</strong>
              <small>${target.subtitle}</small>
              <small>${target.detail}</small>
            </div>
            <button class="start-button" data-start="true" ${selectedAvailable && !target.locked ? "" : "disabled"}>${target.actionLabel}</button>
            <div class="sortie-switch">
              <button data-chapter="true">章節</button>
              <button data-conquest="true">天下</button>
            </div>
          </div>
        </section>

        <section class="selection-panel roster-panel">
          <div class="panel-heading">
            <span>陣營</span>
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
            <span>武將編隊</span>
            <strong>${selectedHero.passiveName}</strong>
          </div>
          <div class="hero-grid">
            ${visibleHeroes.map((hero) => renderHeroPick(hero.id, collection, hero.id === this.selectedHero, this.meta, testMode)).join("")}
          </div>
          <div class="skill-panel home-skill-panel">
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
          <div class="home-utility-row">
            <button class="codex-button" data-collection="true">圖鑑</button>
            <button class="codex-button" data-base="true">基地養成</button>
            <button class="codex-button" data-settings="true">設定</button>
          </div>
          <details class="audio-drawer">
            <summary>聲音</summary>
            ${renderAudioControls(this.callbacks.getAudioSettings())}
          </details>
        </section>
      </main>
      ${this.renderBottomNav("select")}
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
        if (button.disabled) {
          this.callbacks.onAudioCue("sfx_ui_select");
          return;
        }
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
    this.root.querySelector<HTMLButtonElement>("[data-base]")?.addEventListener("click", () => {
      this.callbacks.onAudioCue("sfx_ui_select");
      this.mode = "base";
      this.render();
    });
    this.root.querySelector<HTMLButtonElement>("[data-chapter]")?.addEventListener("click", () => {
      this.callbacks.onAudioCue("sfx_ui_select");
      this.mode = "chapter";
      this.render();
    });
    this.root.querySelector<HTMLButtonElement>("[data-conquest]")?.addEventListener("click", () => {
      this.callbacks.onAudioCue("sfx_ui_select");
      this.mode = "conquest";
      this.root.parentElement?.scrollTo(0, 0);
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-start]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!testMode && !collection[this.selectedHero]?.owned) {
          this.callbacks.onAudioCue("sfx_ui_select");
          return;
        }
        this.startSelectedRun();
      });
    });
    bindAudioControls(this.root, this.callbacks);
    this.bindBottomNav();
  }

  private renderSettings(): void {
    this.root.innerHTML = `
      <main class="settings-stage">
        ${renderSettingsPanel(this.callbacks.getAudioSettings(), this.callbacks.getDisplaySettings(), {
          kicker: "系統",
          title: "設定",
          closeLabel: "返回",
          closeData: "settings-back",
          gameSettings: this.callbacks.getGameSettings()
        })}
      </main>
      ${this.renderBottomNav("settings")}
    `;
    bindSettingsPanel(this.root, this.callbacks, () => this.renderSettings());
    this.root.querySelector<HTMLButtonElement>("[data-settings-back]")?.addEventListener("click", () => {
      this.callbacks.onAudioCue("sfx_ui_select");
      this.mode = "select";
      this.render();
    });
    this.bindBottomNav();
  }

  private renderBase(): void {
    this.meta = saveMetaProgression(accrueIdleRewards(loadMetaProgression()));
    this.root.innerHTML = `${renderBasePanel(this.meta, this.selectedHero, this.baseTab)}${this.renderBottomNav("base")}`;
    bindBasePanel(this.root, {
      onBack: () => {
        this.callbacks.onAudioCue("sfx_ui_select");
        this.mode = "select";
        this.render();
      },
      onClaimIdle: () => {
        const result = claimIdleRewards(loadMetaProgression());
        this.meta = saveMetaProgression(result.state);
        this.callbacks.onAudioCue(result.rewards.merit + result.rewards.provisions + result.rewards.renown > 0 ? "sfx_ui_confirm" : "sfx_ui_select");
        this.renderBase();
      },
      onUpgradeFacility: (facilityId: FacilityId) => {
        const result = upgradeFacility(loadMetaProgression(), facilityId);
        this.meta = saveMetaProgression(result.state);
        this.callbacks.onAudioCue(result.upgraded ? "sfx_ui_confirm" : "sfx_ui_select");
        this.renderBase();
      },
      onSelectHero: (heroId: HeroId) => {
        const hero = heroes.find((item) => item.id === heroId);
        if (hero) {
          this.selectedHero = hero.id;
          this.selectedFaction = hero.factionId;
          this.selectedCollectionCharacter = hero.artId;
        }
        this.callbacks.onAudioCue("sfx_ui_select");
        this.renderBase();
      },
      onTab: (tab: BaseTab) => {
        this.baseTab = tab;
        this.callbacks.onAudioCue("sfx_ui_select");
        this.renderBase();
      },
      onUpgradeTalent: (talentId: TalentId) => {
        const result = upgradeTalent(loadMetaProgression(), talentId);
        this.meta = saveMetaProgression(result.state);
        this.callbacks.onAudioCue(result.upgraded ? "sfx_ui_confirm" : "sfx_ui_select");
        this.renderBase();
      },
      onMergeEquipment: (itemKey: string) => {
        const result = mergeEquipment(loadMetaProgression(), itemKey);
        this.meta = saveMetaProgression(result.state);
        this.callbacks.onAudioCue(result.merged ? "sfx_ui_confirm" : "sfx_ui_select");
        this.renderBase();
      },
      onEquipItem: (itemKey: string) => {
        this.meta = saveMetaProgression(equipItem(loadMetaProgression(), itemKey));
        this.callbacks.onAudioCue("sfx_ui_confirm");
        this.renderBase();
      },
      onClaimMission: (missionId: DailyMissionId) => {
        this.meta = saveMetaProgression(claimDailyMission(loadMetaProgression(), missionId));
        this.callbacks.onAudioCue("sfx_ui_confirm");
        this.renderBase();
      },
      onOpenChest: () => {
        const result = openChapterChest(loadMetaProgression());
        this.meta = saveMetaProgression(result.state);
        this.callbacks.onAudioCue(result.opened ? "sfx_ui_confirm" : "sfx_ui_select");
        this.renderBase();
      }
    });
    this.bindBottomNav();
  }

  private renderChapter(): void {
    this.meta = loadMetaProgression();
    const selectedChapter = chapters.find((chapter) => chapter.id === this.selectedChapter) ?? chapters[0];
    const selectedProgress = this.meta.chapterProgress[selectedChapter.id];
    this.root.innerHTML = `
      <main class="chapter-stage app-page-stage">
        <section class="base-topline">
          <div>
            <span class="panel-kicker">Chapter</span>
            <h2>章節推進</h2>
          </div>
          <button class="codex-back" data-chapter-back="true">返回</button>
        </section>
        <div class="page-action-bar">
          <div>
            <span>目前目標</span>
            <strong>${selectedChapter.name}</strong>
            <small>最佳 ${selectedProgress.bestRoom}/${selectedChapter.rooms.length} · ${selectedChapter.rewardPreview}</small>
          </div>
          <button class="start-button" data-start-chapter="true" ${selectedProgress.unlocked ? "" : "disabled"}>設為目標並出征</button>
        </div>
        <section class="chapter-grid">
          ${chapters
            .map((chapter) => {
              const progress = this.meta.chapterProgress[chapter.id];
              const selected = chapter.id === this.selectedChapter;
              const locked = !progress.unlocked;
              return `
                <button class="chapter-card ${selected ? "is-selected" : ""}" data-chapter-id="${chapter.id}" ${locked ? "disabled" : ""}>
                  <span>${chapter.recommendedPower} 戰力</span>
                  <strong>${chapter.name}</strong>
                  <small>${chapter.subtitle}</small>
                  <small>最佳 ${progress.bestRoom}/${chapter.rooms.length} · 通關 ${progress.clears}</small>
                  <em>${chapter.rewardPreview}</em>
                </button>
              `;
            })
            .join("")}
        </section>
      </main>
      ${this.renderBottomNav("chapter")}
    `;
    this.root.querySelectorAll<HTMLButtonElement>("[data-chapter-back]").forEach((button) => {
      button.addEventListener("click", () => {
        this.callbacks.onAudioCue("sfx_ui_select");
        this.mode = "select";
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-chapter-id]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedChapter = button.dataset.chapterId as ChapterId;
        this.selectedRunTarget = { kind: "chapter", chapterId: this.selectedChapter };
        this.callbacks.onAudioCue("sfx_ui_select");
        this.renderChapter();
      });
    });
    this.root.querySelector<HTMLButtonElement>("[data-start-chapter]")?.addEventListener("click", () => {
      this.selectedRunTarget = { kind: "chapter", chapterId: this.selectedChapter };
      this.startSelectedRun();
    });
    this.bindBottomNav();
  }

  private renderConquest(): void {
    this.conquestMapLayoutAbort?.abort();
    this.conquestMapLayoutAbort = undefined;
    this.meta = loadMetaProgression();
    const conquest = this.meta.conquest;
    const selectable =
      conquestCities.find((city) => city.id === this.selectedConquestCity && conquest.cities[city.id].unlocked) ??
      conquestCities.find((city) => conquest.cities[city.id].unlocked && !conquest.cities[city.id].conquered) ??
      conquestCities.find((city) => conquest.cities[city.id].unlocked) ??
      conquestCities[0];
    this.selectedConquestCity = selectable.id;
    const selectedCity = conquestCityById[this.selectedConquestCity];
    const selectedProgress = conquest.cities[selectedCity.id];
    const selectedHero = heroes.find((hero) => hero.id === selectedCity.gatekeeperHeroId)!;
    const selectedArt = characterArtById[selectedHero.artId];
    const conqueredCount = conquestCities.filter((city) => conquest.cities[city.id].conquered).length;
    const unified = Boolean(conquest.unifiedAt);

    this.root.innerHTML = `
      <main class="conquest-stage app-page-stage">
        <section class="base-topline">
          <div>
            <span class="panel-kicker">Conquest</span>
            <h2>統一天下</h2>
          </div>
          <button class="codex-back" data-conquest-back="true">返回</button>
        </section>
        <section class="conquest-summary" style="${artVars(selectedArt)}">
          <div>
            <span>${selectedCity.regionName} · ${selectedCity.recommendedPower} 戰力</span>
            <strong>${selectedCity.name}</strong>
            <small>守門武將 ${selectedHero.name} · ${selectedProgress.conquered ? "已加入" : selectedProgress.unlocked ? "可攻打" : "未開放"}</small>
          </div>
          <img src="${selectedArt.cardImage}" alt="${selectedHero.name}" draggable="false" />
          <div class="conquest-summary-stats">
            <span>進度 ${conqueredCount}/${conquestCities.length}</span>
            <span>首勝 +${selectedCity.firstClearRewards.merit} 戰功 / +${selectedCity.firstClearRewards.renown} 聲望</span>
            <span>${unified ? "天下已定" : "四路平定後開洛陽"}</span>
          </div>
        </section>
        <div class="page-action-bar">
          <div>
            <span>目前目標</span>
            <strong>${selectedCity.name}</strong>
            <small>${selectedCity.regionName} · 守門 ${selectedHero.name} · 戰力 ${selectedCity.recommendedPower}</small>
          </div>
          <button class="start-button" data-start-conquest="true" ${selectedProgress.unlocked ? "" : "disabled"}>
            ${selectedProgress.conquered ? "重訪城池" : "攻打城池"}
          </button>
        </div>
        <section class="conquest-map-shell ${this.conquestMapFullscreen ? "is-fullscreen" : ""}">
          <div class="conquest-map-toolbar">
            <div>
              <span>天下地圖</span>
              <small>手指拖曳滑動</small>
            </div>
            <button class="codex-button conquest-map-toggle" data-map-fullscreen="true" aria-expanded="${this.conquestMapFullscreen}">
              ${this.conquestMapFullscreen ? "縮小" : "全螢幕"}
            </button>
          </div>
          <section class="conquest-map" aria-label="天下城池地圖">
            <div class="conquest-map-fit-frame">
              ${renderConquestMap(conquest, this.selectedConquestCity)}
            </div>
          </section>
          ${renderConquestMapLegend()}
        </section>
      </main>
      ${this.renderBottomNav("conquest")}
    `;

    this.root.querySelectorAll<HTMLButtonElement>("[data-conquest-back]").forEach((button) => {
      button.addEventListener("click", () => {
        this.callbacks.onAudioCue("sfx_ui_select");
        this.mode = "select";
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-city-id]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) {
          this.callbacks.onAudioCue("sfx_ui_select");
          return;
        }
        this.selectedConquestCity = button.dataset.cityId as ConquestCityId;
        this.selectedRunTarget = { kind: "conquest", cityId: this.selectedConquestCity };
        this.callbacks.onAudioCue("sfx_ui_select");
        this.renderConquest();
      });
    });
    this.root.querySelector<HTMLButtonElement>("[data-start-conquest]")?.addEventListener("click", () => {
      this.selectedRunTarget = { kind: "conquest", cityId: this.selectedConquestCity };
      this.startSelectedRun();
    });
    this.root.querySelector<HTMLButtonElement>("[data-map-fullscreen]")?.addEventListener("click", () => {
      this.conquestMapFullscreen = !this.conquestMapFullscreen;
      this.callbacks.onAudioCue("sfx_ui_select");
      this.renderConquest();
    });
    this.bindConquestMapDrag();
    this.bindConquestMapLayout();
    this.bindBottomNav();
  }

  private bindConquestMapLayout(): void {
    const shell = this.root.querySelector<HTMLElement>(".conquest-map-shell");
    if (!shell) {
      return;
    }

    const applyLayout = (): void => this.layoutConquestMap();
    applyLayout();

    if (!this.conquestMapFullscreen) {
      return;
    }

    const controller = new AbortController();
    this.conquestMapLayoutAbort = controller;
    window.addEventListener("resize", applyLayout, { signal: controller.signal });
    window.addEventListener("orientationchange", applyLayout, { signal: controller.signal });
    window.requestAnimationFrame(applyLayout);
  }

  private layoutConquestMap(): void {
    const shell = this.root.querySelector<HTMLElement>(".conquest-map-shell");
    const map = this.root.querySelector<HTMLElement>(".conquest-map");
    const board = this.root.querySelector<HTMLElement>(".conquest-map-board");
    const toolbar = this.root.querySelector<HTMLElement>(".conquest-map-toolbar");
    if (!shell || !map || !board || !toolbar) {
      return;
    }

    shell.classList.remove("is-rotated-landscape");
    shell.style.removeProperty("--map-fit-scale");
    shell.style.removeProperty("--map-shell-height");
    shell.style.removeProperty("--map-shell-rotate");
    shell.style.removeProperty("--map-shell-width");
    map.scrollLeft = 0;
    map.scrollTop = 0;

    if (!this.conquestMapFullscreen) {
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const chromePadding = 12 * 2;
    const toolbarGap = 10;
    const toolbarHeight = Math.max(58, Math.ceil(toolbar.getBoundingClientRect().height));
    const boardWidth = Math.max(920, board.offsetWidth);
    const boardHeight = Math.max(620, board.offsetHeight);

    const normalAvailableWidth = Math.max(1, viewportWidth - chromePadding);
    const normalAvailableHeight = Math.max(1, viewportHeight - chromePadding - toolbarHeight - toolbarGap);
    const rotatedAvailableWidth = Math.max(1, viewportHeight - chromePadding);
    const rotatedAvailableHeight = Math.max(1, viewportWidth - chromePadding - toolbarHeight - toolbarGap);
    const normalScale = Math.min(1, normalAvailableWidth / boardWidth, normalAvailableHeight / boardHeight);
    const rotatedScale = Math.min(1, rotatedAvailableWidth / boardWidth, rotatedAvailableHeight / boardHeight);
    const shouldRotate = rotatedScale > normalScale;
    const fitScale = shouldRotate ? rotatedScale : normalScale;

    shell.classList.toggle("is-rotated-landscape", shouldRotate);
    shell.style.setProperty("--map-fit-scale", fitScale.toFixed(4));
    shell.style.setProperty("--map-shell-width", `${shouldRotate ? viewportHeight : viewportWidth}px`);
    shell.style.setProperty("--map-shell-height", `${shouldRotate ? viewportWidth : viewportHeight}px`);
    shell.style.setProperty("--map-shell-rotate", shouldRotate ? "90deg" : "0deg");
  }

  private bindConquestMapDrag(): void {
    const map = this.root.querySelector<HTMLElement>(".conquest-map");
    if (!map) {
      return;
    }

    let pointerId: number | undefined;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let isDragging = false;
    let suppressClick = false;

    const usesFullscreenFit = (): boolean => {
      const shell = map.closest<HTMLElement>(".conquest-map-shell");
      return shell?.classList.contains("is-fullscreen") === true;
    };

    const finishDrag = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) {
        return;
      }

      if (map.hasPointerCapture(event.pointerId)) {
        map.releasePointerCapture(event.pointerId);
      }

      pointerId = undefined;
      isDragging = false;
      map.classList.remove("is-touching", "is-dragging");
      window.setTimeout(() => {
        suppressClick = false;
      }, 0);
    };

    map.addEventListener("pointerdown", (event) => {
      if (usesFullscreenFit()) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startScrollLeft = map.scrollLeft;
      isDragging = false;
      map.classList.add("is-touching");
      map.setPointerCapture(event.pointerId);
    });

    map.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) {
        return;
      }

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      const primaryDelta = deltaX;
      const crossDelta = deltaY;

      if (!isDragging) {
        if (Math.abs(primaryDelta) < 8 || Math.abs(primaryDelta) <= Math.abs(crossDelta)) {
          return;
        }
        isDragging = true;
        suppressClick = true;
        map.classList.add("is-dragging");
      }

      map.scrollLeft = startScrollLeft - primaryDelta;
      event.preventDefault();
    });

    map.addEventListener("pointerup", finishDrag);
    map.addEventListener("pointercancel", finishDrag);
    map.addEventListener(
      "click",
      (event) => {
        if (!suppressClick) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
  }

  private renderCollection(collection: CollectionState): void {
    const testMode = this.callbacks.getGameSettings().testMode;
    const selectedArt = characterArtById[this.selectedCollectionCharacter];
    const selectedEntry = collection[selectedArt.id];
    const revealed = selectedEntry.revealed;
    const ownedCount = characterArts.filter((art) => collection[art.id].owned).length;
    const selectedTestAvailable = testMode && selectedArt.playable && !selectedEntry.owned;

    this.root.innerHTML = `
      <main class="codex-stage app-page-stage" style="${artVars(selectedArt)}">
        <section class="codex-showcase">
          <div class="codex-topline">
            <button class="codex-back" data-back="true">返回</button>
            <span>${ownedCount}/${characterArts.length} 已擁有</span>
          </div>
          <div class="codex-card-frame ${revealed ? "" : "is-locked"}" style="${artVars(selectedArt)}">
            <img src="${selectedArt.cardImage}" alt="${revealed ? selectedArt.name : "未揭示武將"}" draggable="false" />
            ${revealed ? "" : `<div class="lock-veil"><strong>未揭示</strong><span>攻下對應城池後解鎖</span></div>`}
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
              <p>${revealed ? `${selectedArt.title} ・ ${selectedArt.role}` : "攻下對應城池後，才能揭示完整卡面。"}</p>
            </div>
            <span class="owned-pill ${selectedEntry.owned ? "is-owned" : selectedTestAvailable ? "is-test" : ""}">${selectedEntry.owned ? "已擁有" : selectedTestAvailable ? "測試可用" : "未擁有"}</span>
          </div>
          <blockquote>${revealed ? selectedArt.quote : "尚未解鎖的武將卡，輪廓與星級先保留神秘感。"}</blockquote>
          <div class="codex-lore">
            <strong>角色故事</strong>
            <p>${revealed ? selectedArt.biography : "攻下對應城池後，圖鑑會揭示完整卡面與背景。"}</p>
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
            ${selectedArt.playable && (selectedEntry.owned || testMode) ? `<button class="start-button" data-codex-start="${selectedArt.id}">${selectedEntry.owned ? "使用此武將開戰" : "測試出戰"}</button>` : ""}
          </div>
        </section>
      </main>
      ${this.renderBottomNav("select")}
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
      this.startSelectedRun(heroId);
    });
    bindAudioControls(this.root, this.callbacks);
    this.bindBottomNav();
  }

  private renderCollectionSkillBlock(art: CharacterArtDef, revealed: boolean): string {
    if (!revealed || !art.playable) {
      return `
        <div class="codex-skill-row">
          <div><span>定位</span><strong>${revealed ? art.role : "未知"}</strong><small>未揭示前僅顯示基本資料。</small></div>
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

const conquestMapPositions = {
  jingzhou: { x: 15, y: 36 },
  changban: { x: 25, y: 49 },
  hanzhong: { x: 16, y: 66 },
  tongguan: { x: 31, y: 77 },
  longzhong: { x: 42, y: 62 },
  xuchang: { x: 49, y: 24 },
  qiaojun: { x: 63, y: 36 },
  hefei: { x: 70, y: 54 },
  yecheng: { x: 65, y: 76 },
  luoshui: { x: 56, y: 88 },
  jianye: { x: 82, y: 27 },
  wujun: { x: 91, y: 44 },
  jinfan_camp: { x: 83, y: 65 },
  shenting: { x: 92, y: 82 },
  wan_city: { x: 79, y: 88 },
  julu: { x: 34, y: 17 },
  guandu: { x: 40, y: 36 },
  qingnang_valley: { x: 50, y: 83 },
  hulao_gate: { x: 45, y: 58 },
  luoyang: { x: 54, y: 48 }
} satisfies Record<ConquestCityId, { x: number; y: number }>;

const conquestMapLabels = [
  { label: "蜀線", className: "region-shu", x: 14, y: 21 },
  { label: "魏線", className: "region-wei", x: 58, y: 18 },
  { label: "吳線", className: "region-wu", x: 86, y: 18 },
  { label: "群雄", className: "region-qun", x: 35, y: 8 },
  { label: "洛陽", className: "region-final", x: 55, y: 45 }
];

function renderConquestMap(conquest: MetaProgressionState["conquest"], selectedCityId: ConquestCityId): string {
  return `
    <div class="conquest-map-board">
      ${renderConquestRoads(conquest)}
      ${conquestMapLabels
        .map(
          (item) => `
            <span class="conquest-territory-label ${item.className}" style="--x:${item.x}%; --y:${item.y}%">
              ${item.label}
            </span>
          `
        )
        .join("")}
      ${conquestCities.map((city) => renderConquestMapNode(city.id, conquest, selectedCityId)).join("")}
    </div>
  `;
}

function renderConquestMapLegend(): string {
  return `
    <div class="conquest-map-legend" aria-hidden="true">
      <span class="is-open">可攻打</span>
      <span class="is-conquered">已攻下</span>
      <span class="is-locked">未解鎖</span>
    </div>
  `;
}

function renderResourceChip(label: string, value: number): string {
  return `
    <span>
      <b>${label}</b>
      <strong>${value}</strong>
    </span>
  `;
}

function renderConquestRoads(conquest: MetaProgressionState["conquest"]): string {
  return `
    <svg class="conquest-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      ${conquestCities
        .flatMap((city) =>
          city.prerequisiteCityIds.map((prerequisiteId) => {
            const from = conquestMapPositions[prerequisiteId];
            const to = conquestMapPositions[city.id];
            const progress = conquest.cities[city.id];
            const roadClass = progress.conquered ? "is-conquered" : progress.unlocked ? "is-open" : "is-locked";
            return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="${roadClass} region-${city.region}" />`;
          })
        )
        .join("")}
    </svg>
  `;
}

function renderConquestMapNode(
  cityId: ConquestCityId,
  conquest: MetaProgressionState["conquest"],
  selectedCityId: ConquestCityId
): string {
  const city = conquestCityById[cityId];
  const progress = conquest.cities[city.id];
  const hero = heroes.find((item) => item.id === city.gatekeeperHeroId)!;
  const art = characterArtById[hero.artId];
  const locked = !progress.unlocked;
  const selected = city.id === selectedCityId;
  const stateLabel = progress.conquered ? "已攻下" : locked ? "鎖定" : "可攻打";
  const prereq = city.prerequisiteCityIds.map((id) => conquestCityById[id].name).join("、") || "入口城";
  const metaLine = locked ? `需攻下 ${prereq}` : `房 ${progress.bestRoom}/8 · ${progress.attempts} 戰`;
  const position = conquestMapPositions[city.id];
  return `
    <button
      class="conquest-map-node ${selected ? "is-selected" : ""} ${progress.conquered ? "is-conquered" : ""} ${locked ? "is-locked" : "is-open"}"
      data-city-id="${city.id}"
      style="${artVars(art)} --x:${position.x}%; --y:${position.y}%;"
      ${locked ? "disabled" : ""}
    >
      <img src="${art.cardImage}" alt="${hero.name}" draggable="false" />
      <div>
        <strong>${city.name}</strong>
        <span>${hero.name}</span>
        <small>${stateLabel} · 戰力 ${city.recommendedPower}</small>
        <em>${metaLine}</em>
      </div>
    </button>
  `;
}

function renderHeroPick(
  heroId: HeroId,
  collection: CollectionState,
  selected: boolean,
  meta: MetaProgressionState,
  testMode: boolean
): string {
  const hero = heroes.find((item) => item.id === heroId)!;
  const art = characterArtById[hero.artId];
  const entry = collection[art.id];
  const mastery = meta.heroMastery[heroId];
  const recruitCity = getConquestCityForHero(heroId);
  const testAvailable = testMode && !entry.owned;
  const locked = !entry.owned && !testMode;
  return `
    <button class="hero-card character-pick ${selected ? "is-selected" : ""} ${locked ? "is-locked" : ""} ${testAvailable ? "is-test" : ""}" data-hero="${hero.id}" style="${artVars(art)}" ${locked ? "disabled" : ""}>
      <img class="mini-card-art" src="${art.cardImage}" alt="${art.name}" draggable="false" />
      <div>
        <div class="card-meta-line">
          ${renderStars(art.stars, locked)}
          <span>${entry.owned ? "已擁有" : testAvailable ? "測試可用" : "未招降"}</span>
        </div>
        <strong>${hero.name}</strong>
        <span>${hero.title}</span>
        <small>${locked && recruitCity ? `攻下 ${recruitCity.name} 後加入` : testAvailable ? "測試模式：可直接出戰，不改變招降進度" : `Lv.${mastery.level} · 生命 +${mastery.level}% · 傷害 +${mastery.level}%`}</small>
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
