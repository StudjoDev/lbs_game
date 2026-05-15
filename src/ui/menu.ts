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
  type MetaResources,
  type TalentId
} from "../game/meta/progression";
import type { ChapterId, CharacterArtDef, CharacterId, CollectionState, ConquestCityId, FactionId, HeroId } from "../game/types";
import { bindAudioControls, renderAudioControls, type AudioControlCallbacks } from "./audioControls";
import { bindBasePanel, renderBasePanel, type BaseTab } from "./base";
import { createUiLayer, removeUiLayer } from "./layer";
import { bindSettingsPanel, renderSettingsPanel } from "./settingsPanel";

interface MenuCallbacks extends AudioControlCallbacks {
  onHomePreviewChange?: (state: HomePreviewState) => void;
  getDisplaySettings: () => DisplaySettings;
  onDisplaySettingsChange: (settings: DisplaySettings) => void;
  getGameSettings: () => GameSettings;
  onGameSettingsChange: (settings: GameSettings) => void;
  onStart: (heroId: HeroId, chapterId: ChapterId, conquestCityId?: ConquestCityId) => void;
}

type MenuMode = "select" | "collection" | "settings" | "base" | "chapter" | "conquest";
type RunTarget = { kind: "chapter"; chapterId: ChapterId } | { kind: "conquest"; cityId: ConquestCityId };
type HomePreviewState = { visible: boolean; heroId?: HeroId; companionHeroIds?: readonly HeroId[] };

export class MenuController {
  private readonly root = createUiLayer("menu-ui");
  private selectedHero: HeroId = "diaochan";
  private selectedChapter: ChapterId = "yellow_turbans";
  private selectedConquestCity: ConquestCityId = "julu";
  private selectedRunTarget: RunTarget = { kind: "chapter", chapterId: "yellow_turbans" };
  private conquestMapFullscreen = false;
  private conquestAutoFocus = true;
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
    if (this.mode !== "select") {
      this.callbacks.onHomePreviewChange?.({ visible: false });
    }
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
      { mode: "settings", icon: "令", label: "設定" }
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
        this.mode = button.dataset.nav as MenuMode;
        this.callbacks.onAudioCue("sfx_ui_select");
        this.render();
      });
    });
  }

  private renderSelect(collection: CollectionState): void {
    const selectedHero = heroes.find((hero) => hero.id === this.selectedHero) ?? heroes[0];
    const selectedArt = characterArtById[selectedHero.artId];
    const selectedFaction = factions.find((faction) => faction.id === selectedHero.factionId) ?? factions[0];
    const mastery = this.meta.heroMastery[selectedHero.id];
    const idlePreview = accrueIdleRewards(this.meta).idle.unclaimed;
    const testMode = this.callbacks.getGameSettings().testMode;
    const idleAvailable = hasAnyMenuResource(idlePreview);
    const companionHeroIds = getTrainingCompanionHeroIds(selectedHero.id, collection, testMode);
    this.callbacks.onHomePreviewChange?.({ visible: true, heroId: selectedHero.id, companionHeroIds });

    this.root.innerHTML = `
      <main class="menu-stage home-stage" style="${artVars(selectedArt)}">
        <section class="home-left-rail">
          <section class="menu-hero home-hero-card">
            <img src="${selectedArt.cardImage}" alt="${selectedHero.name}" draggable="false" />
            <div class="home-hero-copy">
              <span class="seal">演武修行 · 熟練 Lv.${mastery.level}</span>
              <h1>${selectedHero.name}</h1>
              <p>${selectedHero.title}正在校場練功，離線時也會累積戰功與軍糧。</p>
              <div class="feature-ribbon war-ribbon">
                <span>${selectedFaction.name} · ${selectedHero.role}</span>
                <span>熟練 Lv.${mastery.level}</span>
                <span>收益 ${formatMenuResources(idlePreview)}</span>
              </div>
            </div>
          </section>
          <section class="home-idle-card">
            <div class="panel-heading">
              <span>Idle</span>
              <strong>修行收益</strong>
            </div>
            <div class="home-idle-rewards" aria-label="目前可領取的修行收益">
              <div>
                <span>戰功</span>
                <strong>${idlePreview.merit}</strong>
              </div>
              <div>
                <span>軍糧</span>
                <strong>${idlePreview.provisions}</strong>
              </div>
              <div>
                <span>聲望</span>
                <strong>${idlePreview.renown}</strong>
              </div>
            </div>
            <button class="codex-button home-claim-button" data-claim-home-idle="true" ${idleAvailable ? "" : "disabled"}>
              ${idleAvailable ? "領取修行收益" : "暫無收益"}
            </button>
          </section>
          <section class="skill-panel home-skill-panel">
            <div>
              <span>自動武技</span>
              <strong>${selectedHero.autoAbility.name}</strong>
              <small>${selectedHero.autoAbility.description}</small>
            </div>
            <div>
              <span>手動無雙</span>
              <strong>${selectedHero.manualAbility.name}</strong>
              <small>${selectedHero.manualAbility.description}</small>
            </div>
          </section>
        </section>
        <section class="build-panel home-build-panel">
          <div class="panel-heading">
            <span>Roster</span>
            <strong>演武編隊</strong>
          </div>
          <div class="page-action-bar">
            <div>
              <span>目前武將</span>
              <strong>${selectedHero.name}</strong>
              <small>熟練 Lv.${mastery.level} · ${selectedFaction.name} · ${selectedHero.title}</small>
            </div>
            <div class="home-action-buttons">
              <button class="start-button" data-start-selected="true">開始出戰</button>
              <button class="codex-button" data-open-base="true">前往基地</button>
            </div>
          </div>
          <div class="home-roster-scroll" aria-label="可選武將列表">
            <div class="hero-grid">
              ${heroes.map((hero) => renderHeroPick(hero.id, collection, hero.id === selectedHero.id, this.meta, testMode)).join("")}
            </div>
          </div>
        </section>
      </main>
      ${this.renderBottomNav("select")}
    `;
    this.root.querySelectorAll<HTMLButtonElement>("[data-hero]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedHero = button.dataset.hero as HeroId;
        this.callbacks.onAudioCue("sfx_ui_select");
        this.render();
      });
    });
    this.root.querySelector<HTMLButtonElement>("[data-start-selected]")?.addEventListener("click", () => this.startSelectedRun());
    this.root.querySelector<HTMLButtonElement>("[data-claim-home-idle]")?.addEventListener("click", () => {
      const result = claimIdleRewards(this.meta);
      this.meta = saveMetaProgression(result.state);
      this.callbacks.onAudioCue(hasAnyMenuResource(result.rewards) ? "sfx_ui_confirm" : "sfx_ui_select");
      this.render();
    });
    this.root.querySelector<HTMLButtonElement>("[data-open-base]")?.addEventListener("click", () => {
      this.mode = "base";
      this.callbacks.onAudioCue("sfx_ui_select");
      this.render();
    });
    this.bindBottomNav();
  }

  private renderSettings(): void {
    this.root.innerHTML = `
      <main class="settings-stage app-page-stage">
        ${renderSettingsPanel(this.callbacks.getAudioSettings(), this.callbacks.getDisplaySettings(), {
          title: "設定",
          kicker: "Settings",
          showClose: false,
          gameSettings: this.callbacks.getGameSettings()
        })}
      </main>
      ${this.renderBottomNav("settings")}
    `;
    bindSettingsPanel(this.root, this.callbacks, () => this.renderSettings());
    this.bindBottomNav();
  }

  private renderBase(): void {
    this.meta = saveMetaProgression(accrueIdleRewards(this.meta));
    this.root.innerHTML = `
      ${renderBasePanel(this.meta, this.selectedHero, this.baseTab)}
      ${this.renderBottomNav("base")}
    `;
    bindBasePanel(this.root, {
      onBack: () => {
        this.mode = "select";
        this.render();
      },
      onClaimIdle: () => {
        const result = claimIdleRewards(this.meta);
        this.meta = saveMetaProgression(result.state);
        this.callbacks.onAudioCue("sfx_ui_confirm");
        this.renderBase();
      },
      onUpgradeFacility: (facilityId: FacilityId) => {
        const result = upgradeFacility(this.meta, facilityId);
        this.meta = saveMetaProgression(result.state);
        this.callbacks.onAudioCue(result.upgraded ? "sfx_ui_confirm" : "sfx_ui_select");
        this.renderBase();
      },
      onSelectHero: (heroId: HeroId) => {
        this.selectedHero = heroId;
        this.callbacks.onAudioCue("sfx_ui_select");
        this.renderBase();
      },
      onTab: (tab: BaseTab) => {
        this.baseTab = tab;
        this.callbacks.onAudioCue("sfx_ui_select");
        this.renderBase();
      },
      onUpgradeTalent: (talentId: TalentId) => {
        const result = upgradeTalent(this.meta, talentId);
        this.meta = saveMetaProgression(result.state);
        this.callbacks.onAudioCue(result.upgraded ? "sfx_ui_confirm" : "sfx_ui_select");
        this.renderBase();
      },
      onMergeEquipment: (itemKey: string) => {
        const result = mergeEquipment(this.meta, itemKey);
        this.meta = saveMetaProgression(result.state);
        this.callbacks.onAudioCue(result.merged ? "sfx_ui_confirm" : "sfx_ui_select");
        this.renderBase();
      },
      onEquipItem: (itemKey: string) => {
        this.meta = saveMetaProgression(equipItem(this.meta, itemKey));
        this.callbacks.onAudioCue("sfx_ui_confirm");
        this.renderBase();
      },
      onClaimMission: (missionId: DailyMissionId) => {
        this.meta = saveMetaProgression(claimDailyMission(this.meta, missionId));
        this.callbacks.onAudioCue("sfx_ui_confirm");
        this.renderBase();
      },
      onOpenChest: () => {
        const result = openChapterChest(this.meta);
        this.meta = saveMetaProgression(result.state);
        this.callbacks.onAudioCue(result.opened ? "sfx_ui_confirm" : "sfx_ui_select");
        this.renderBase();
      }
    });
    this.bindBottomNav();
  }

  private renderChapter(): void {
    const selectedChapter = chapters.find((chapter) => chapter.id === this.selectedChapter) ?? chapters[0];
    const selectedProgress = this.meta.chapterProgress[selectedChapter.id];
    this.selectedRunTarget = { kind: "chapter", chapterId: selectedChapter.id };

    this.root.innerHTML = `
      <main class="chapter-stage app-page-stage">
        <div class="panel-heading">
          <span>Campaign</span>
          <strong>章節戰役</strong>
        </div>
        <div class="chapter-grid">
          ${chapters
            .map((chapter) => {
              const progress = this.meta.chapterProgress[chapter.id];
              return `
                <button
                  class="chapter-card ${chapter.id === selectedChapter.id ? "is-selected" : ""}"
                  data-chapter="${chapter.id}"
                  ${progress.unlocked ? "" : "disabled"}
                >
                  <span>${progress.unlocked ? "可挑戰" : "未解鎖"}</span>
                  <strong>${chapter.name}</strong>
                  <small>${chapter.subtitle}</small>
                  <em>${formatRecommendedPower(chapter.recommendedPower)} · 通關 ${progress.clears}</em>
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="page-action-bar">
          <div>
            <span>目前章節</span>
            <strong>${selectedChapter.name}</strong>
            <small>${selectedChapter.rewardPreview} · ${formatRecommendedPower(selectedChapter.recommendedPower)}</small>
          </div>
          <button class="start-button" data-start-chapter="true" ${selectedProgress.unlocked ? "" : "disabled"}>開始戰役</button>
        </div>
      </main>
      ${this.renderBottomNav("chapter")}
    `;
    this.root.querySelectorAll<HTMLButtonElement>("[data-chapter]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedChapter = button.dataset.chapter as ChapterId;
        this.selectedRunTarget = { kind: "chapter", chapterId: this.selectedChapter };
        this.callbacks.onAudioCue("sfx_ui_select");
        this.renderChapter();
      });
    });
    this.root.querySelector<HTMLButtonElement>("[data-start-chapter]")?.addEventListener("click", () => this.startSelectedRun());
    this.bindBottomNav();
  }

  private renderConquest(): void {
    const conquest = this.meta.conquest;
    const routeGuide = getConquestRouteGuide(conquest);
    const currentProgress = conquest.cities[this.selectedConquestCity];
    if (this.conquestAutoFocus && routeGuide.recommendedCity && (!currentProgress?.unlocked || currentProgress.conquered)) {
      this.selectedConquestCity = routeGuide.recommendedCity.id;
    }
    const selectedCity = conquestCityById[this.selectedConquestCity] ?? conquestCities[0];
    const selectedProgress = conquest.cities[selectedCity.id];
    const selectedHero = selectedCity.gatekeeperHeroId ? heroes.find((hero) => hero.id === selectedCity.gatekeeperHeroId) : undefined;
    const selectedArt = selectedHero ? characterArtById[selectedHero.artId] : undefined;
    const selectedOwnerFactionId = getCityOwnerFactionId(selectedCity, conquest);
    const selectedOwnerFactionName = getFactionName(selectedOwnerFactionId);
    const selectedStyle = factionVars(selectedOwnerFactionId);
    const recommendedCity = routeGuide.recommendedCity;
    const recommendedHero = recommendedCity?.gatekeeperHeroId
      ? heroes.find((hero) => hero.id === recommendedCity.gatekeeperHeroId)
      : undefined;
    const recommendedOwnerFactionId = recommendedCity ? getCityOwnerFactionId(recommendedCity, conquest) : undefined;
    const recommendedMeta = recommendedCity
      ? `${recommendedCity.regionName} · ${recommendedHero ? `守軍 ${recommendedHero.name}` : "空城"} · ${formatRecommendedPower(recommendedCity.recommendedPower)}`
      : `${routeGuide.totalCount} 城全數攻下`;
    const recommendedActionDisabled = recommendedCity ? "" : "disabled";
    const conqueredCount = routeGuide.conqueredCount;
    const unified = conqueredCount === routeGuide.totalCount;
    const nextStep = unified ? routeGuide.totalCount : Math.min(conqueredCount + 1, routeGuide.totalCount);
    if (selectedProgress.unlocked) {
      this.selectedRunTarget = { kind: "conquest", cityId: selectedCity.id };
    }

    this.root.innerHTML = `
      <main class="chapter-stage app-page-stage" style="${selectedStyle}">
        <div class="panel-heading">
          <span>Conquest</span>
          <strong>天下戰圖</strong>
        </div>
        <section class="conquest-summary">
          <div>
            <span>${selectedCity.regionName} · ${selectedOwnerFactionId ? `${selectedOwnerFactionName}勢力` : "無陣營"} · ${formatRecommendedPower(selectedCity.recommendedPower)}</span>
            <strong>${selectedCity.name}</strong>
            <small>${selectedHero ? `守軍武將 ${selectedHero.name}` : "空城 · 城防隊長"} · ${selectedProgress.conquered ? "已歸附" : selectedProgress.unlocked ? "可攻打" : "未解鎖"} · 勢力 ${selectedOwnerFactionName}</small>
          </div>
          ${selectedArt && selectedHero ? `<img src="${selectedArt.cardImage}" alt="${selectedHero.name}" draggable="false" />` : `<div class="conquest-empty-city-mark" aria-hidden="true">城</div>`}
          <div class="conquest-summary-stats">
            <span>已佔領 ${conqueredCount}/${routeGuide.totalCount}</span>
            <span>路線進度 ${routeGuide.progressPercent}% · 第 ${nextStep}/${routeGuide.totalCount} 城</span>
            <span>首勝 +${selectedCity.firstClearRewards.merit} 戰功 / +${selectedCity.firstClearRewards.renown} 聲望</span>
            <span>${unified ? "天下已定" : "全城歸附後定鼎"}</span>
          </div>
        </section>
        <section class="conquest-route-guide" style="${factionVars(recommendedOwnerFactionId)}">
          <div class="conquest-route-target">
            <span>下一個目標</span>
            <strong>${recommendedCity?.name ?? "天下已定"}</strong>
            <small>${recommendedMeta}</small>
          </div>
          <div class="conquest-route-progress">
            <div>
              <span>路線進度</span>
              <strong>${conqueredCount}/${routeGuide.totalCount}</strong>
            </div>
            <div class="conquest-progress-track" aria-label="路線進度 ${routeGuide.progressPercent}%">
              <i style="width:${routeGuide.progressPercent}%"></i>
            </div>
            <small>已開放 ${routeGuide.unlockedCount} 城 · 可攻打 ${routeGuide.frontierCount} 城</small>
          </div>
          <div class="conquest-focus-controls">
            <button class="codex-button" data-select-recommended="true" ${recommendedActionDisabled}>追蹤目標</button>
            <button class="codex-button" data-focus-selected="true">聚焦目前</button>
            <button class="codex-button ${this.conquestAutoFocus ? "is-active" : ""}" data-toggle-auto-focus="true" aria-pressed="${this.conquestAutoFocus}">
              ${this.conquestAutoFocus ? "自動聚焦開" : "自動聚焦關"}
            </button>
          </div>
        </section>
        <div class="page-action-bar">
          <div>
            <span>目前城池</span>
            <strong>${selectedCity.name}</strong>
            <small>${selectedHero ? `守軍武將 ${selectedHero.name}` : "空城 · 城防隊長"} · ${selectedOwnerFactionId ? `${selectedOwnerFactionName}勢力` : "無陣營"} · ${formatRecommendedPower(selectedCity.recommendedPower)}</small>
            <small>${selectedCity.historicalNote}</small>
          </div>
          <button class="start-button" data-start-conquest="true" ${selectedProgress.unlocked ? "" : "disabled"}>
            ${selectedProgress.conquered ? "重訪城池" : selectedProgress.unlocked ? "攻打城池" : "尚未解鎖"}
          </button>
        </div>
        <section class="conquest-map-shell ${this.conquestMapFullscreen ? "is-fullscreen" : "is-embedded"}">
          <div class="conquest-map-toolbar">
            <div>
              <span>天下戰圖</span>
              <small>拖曳查看全域，點選城池查看典故、勢力與攻城狀態</small>
            </div>
            <button class="codex-button conquest-map-toggle" data-map-fullscreen="true" aria-expanded="${this.conquestMapFullscreen}">
              ${this.conquestMapFullscreen ? "縮小" : "全螢幕"}
            </button>
          </div>
          <section class="conquest-map" aria-label="天下城池地圖">
            <div class="conquest-map-fit-frame">
              ${renderConquestMap(conquest, this.selectedConquestCity, recommendedCity?.id)}
            </div>
          </section>
          ${renderConquestMapLegend()}
        </section>
      </main>
      ${this.renderBottomNav("conquest")}
    `;
    this.root.querySelectorAll<HTMLButtonElement>("[data-city-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const cityId = button.dataset.cityId as ConquestCityId;
        this.selectedConquestCity = cityId;
        this.conquestAutoFocus = false;
        if (this.meta.conquest.cities[cityId]?.unlocked) {
          this.selectedRunTarget = { kind: "conquest", cityId };
        }
        this.callbacks.onAudioCue("sfx_ui_select");
        this.renderConquest();
      });
    });
    this.root.querySelector<HTMLButtonElement>("[data-start-conquest]")?.addEventListener("click", () => {
      if (this.meta.conquest.cities[this.selectedConquestCity]?.unlocked) {
        this.selectedRunTarget = { kind: "conquest", cityId: this.selectedConquestCity };
        this.startSelectedRun();
      }
    });
    this.root.querySelector<HTMLButtonElement>("[data-map-fullscreen]")?.addEventListener("click", () => {
      this.conquestMapFullscreen = !this.conquestMapFullscreen;
      this.callbacks.onAudioCue("sfx_ui_select");
      this.renderConquest();
    });
    this.root.querySelector<HTMLButtonElement>("[data-select-recommended]")?.addEventListener("click", () => {
      if (!recommendedCity) {
        return;
      }
      this.selectedConquestCity = recommendedCity.id;
      this.conquestAutoFocus = true;
      this.selectedRunTarget = { kind: "conquest", cityId: recommendedCity.id };
      this.callbacks.onAudioCue("sfx_ui_select");
      this.renderConquest();
    });
    this.root.querySelector<HTMLButtonElement>("[data-focus-selected]")?.addEventListener("click", () => {
      this.callbacks.onAudioCue("sfx_ui_select");
      this.focusConquestMapCity(this.selectedConquestCity, true);
    });
    this.root.querySelector<HTMLButtonElement>("[data-toggle-auto-focus]")?.addEventListener("click", () => {
      this.conquestAutoFocus = !this.conquestAutoFocus;
      if (this.conquestAutoFocus && recommendedCity) {
        this.selectedConquestCity = recommendedCity.id;
      }
      this.callbacks.onAudioCue("sfx_ui_select");
      this.renderConquest();
    });
    this.bindConquestMapDrag();
    this.bindConquestMapLayout();
    this.bindBottomNav();
    this.focusConquestMapCity(
      this.conquestAutoFocus && recommendedCity ? recommendedCity.id : this.selectedConquestCity,
      false
    );
  }

  private startSelectedRun(): void {
    const target = this.selectedRunTarget;
    if (target.kind === "conquest") {
      if (!this.meta.conquest.cities[target.cityId]?.unlocked) {
        this.callbacks.onAudioCue("sfx_ui_select");
        return;
      }
      this.callbacks.onStart(this.selectedHero, this.selectedChapter, target.cityId);
      return;
    }
    this.callbacks.onStart(this.selectedHero, target.chapterId);
  }

  private bindConquestMapLayout(): void {
    const shell = this.root.querySelector<HTMLElement>(".conquest-map-shell");
    if (!shell) {
      return;
    }

    const applyLayout = (): void => {
      this.layoutConquestMap();
      if (!this.conquestMapFullscreen) {
        this.focusConquestMapCity(this.selectedConquestCity, false);
      }
    };
    applyLayout();

    const controller = new AbortController();
    this.conquestMapLayoutAbort = controller;
    window.addEventListener("resize", applyLayout, { signal: controller.signal });
    window.addEventListener("orientationchange", applyLayout, { signal: controller.signal });
    if (this.conquestMapFullscreen) {
      window.requestAnimationFrame(applyLayout);
    }
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

  private focusConquestMapCity(cityId: ConquestCityId, smooth: boolean): void {
    const shell = this.root.querySelector<HTMLElement>(".conquest-map-shell");
    const map = this.root.querySelector<HTMLElement>(".conquest-map");
    const board = this.root.querySelector<HTMLElement>(".conquest-map-board");
    const node = this.root.querySelector<HTMLElement>(`[data-city-id="${cityId}"]`);
    if (!shell || !map || !board || !node || shell.classList.contains("is-fullscreen")) {
      return;
    }

    window.requestAnimationFrame(() => {
      const boardRect = board.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const nodeCenterX = nodeRect.left - boardRect.left + nodeRect.width / 2;
      const targetLeft = Math.max(0, nodeCenterX - map.clientWidth / 2);
      map.scrollTo({
        left: targetLeft,
        behavior: smooth ? "smooth" : "auto"
      });
    });
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
    let pressedCityId: ConquestCityId | undefined;

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
      if (event.type === "pointerup" && !isDragging && pressedCityId) {
        this.selectedConquestCity = pressedCityId;
        this.conquestAutoFocus = false;
        if (this.meta.conquest.cities[pressedCityId]?.unlocked) {
          this.selectedRunTarget = { kind: "conquest", cityId: pressedCityId };
        }
        this.callbacks.onAudioCue("sfx_ui_select");
        pressedCityId = undefined;
        this.renderConquest();
        return;
      }
      pressedCityId = undefined;
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
      pressedCityId = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-city-id]")?.dataset
        .cityId as ConquestCityId | undefined;
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
          </div>
        </section>
      </main>
      ${this.renderBottomNav("select")}
    `;
    this.root.querySelectorAll<HTMLButtonElement>("[data-codex-character]").forEach((button) => {
      button.addEventListener("click", () => {
        this.callbacks.onAudioCue("sfx_ui_select");
        this.selectedCollectionCharacter = button.dataset.codexCharacter as CharacterId;
        this.render();
      });
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
        <div><span>自動武技</span><strong>${hero.autoAbility.name}</strong><small>${hero.autoAbility.description}</small></div>
        <div><span>手動無雙</span><strong>${hero.manualAbility.name}</strong><small>${hero.manualAbility.description}</small></div>
      </div>
    `;
  }
}

const conquestMapPositions = Object.fromEntries(
  conquestCities.map((city) => [city.id, city.mapPosition])
) as Record<ConquestCityId, { x: number; y: number }>;

const conquestCityOrder = Object.fromEntries(conquestCities.map((city, index) => [city.id, index])) as Record<
  ConquestCityId,
  number
>;

const conquestMapLabels: Array<{ label: string; className: string; x: number; y: number }> = [];

function renderConquestMap(
  conquest: MetaProgressionState["conquest"],
  selectedCityId: ConquestCityId,
  recommendedCityId: ConquestCityId | undefined
): string {
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
      ${conquestCities.map((city) => renderConquestMapNode(city.id, conquest, selectedCityId, recommendedCityId)).join("")}
    </div>
  `;
}

function renderConquestMapLegend(): string {
  return `
    <div class="conquest-map-legend" aria-hidden="true">
      <span class="is-open">可攻打</span>
      <span class="is-conquered">已歸附</span>
      <span class="is-locked">未解鎖</span>
    </div>
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
            return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="${roadClass}" />`;
          })
        )
        .join("")}
    </svg>
  `;
}

function renderConquestMapNode(
  cityId: ConquestCityId,
  conquest: MetaProgressionState["conquest"],
  selectedCityId: ConquestCityId,
  recommendedCityId: ConquestCityId | undefined
): string {
  const city = conquestCityById[cityId];
  const progress = conquest.cities[city.id];
  const hero = city.gatekeeperHeroId ? heroes.find((item) => item.id === city.gatekeeperHeroId) : undefined;
  const art = hero ? characterArtById[hero.artId] : undefined;
  const ownerFactionId = getCityOwnerFactionId(city, conquest);
  const ownerFactionName = getFactionName(ownerFactionId);
  const locked = !progress.unlocked;
  const selected = city.id === selectedCityId;
  const recommended = city.id === recommendedCityId;
  const stateLabel = progress.conquered ? "已歸附" : locked ? "鎖定" : "可攻打";
  const position = conquestMapPositions[city.id];
  return `
    <button
      class="conquest-map-node owner-${ownerFactionId ?? "neutral"} ${selected ? "is-selected" : ""} ${recommended ? "is-recommended" : ""} ${progress.conquered ? "is-conquered" : ""} ${locked ? "is-locked" : "is-open"}"
      data-city-id="${city.id}"
      data-owner-faction="${ownerFactionId ?? "neutral"}"
      aria-current="${selected ? "true" : "false"}"
      style="${factionVars(ownerFactionId)} --x:${position.x}%; --y:${position.y}%;"
    >
      ${art && hero ? `<img src="${art.cardImage}" alt="${hero.name}" draggable="false" />` : `<i class="conquest-empty-city-dot" aria-hidden="true">城</i>`}
      <div>
        <strong>${city.name}</strong>
        <span>${ownerFactionName} · ${hero?.name ?? "空城"}</span>
        <small>${stateLabel} · ${formatRecommendedPower(city.recommendedPower)}</small>
        <em>${city.historicalNote}</em>
      </div>
    </button>
  `;
}

function getConquestRouteGuide(conquest: MetaProgressionState["conquest"]): {
  conqueredCount: number;
  frontierCount: number;
  progressPercent: number;
  recommendedCity?: (typeof conquestCities)[number];
  totalCount: number;
  unlockedCount: number;
} {
  const totalCount = conquestCities.length;
  const conqueredCount = conquestCities.filter((city) => conquest.cities[city.id]?.conquered).length;
  const unlockedCities = conquestCities.filter((city) => conquest.cities[city.id]?.unlocked);
  const frontierCities = unlockedCities
    .filter((city) => !conquest.cities[city.id]?.conquered)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        a.recommendedPower - b.recommendedPower ||
        conquestCityOrder[a.id] - conquestCityOrder[b.id]
    );
  return {
    conqueredCount,
    frontierCount: frontierCities.length,
    progressPercent: Math.round((conqueredCount / totalCount) * 100),
    recommendedCity: frontierCities[0],
    totalCount,
    unlockedCount: unlockedCities.length
  };
}

function getCityOwnerFactionId(
  city: (typeof conquestCities)[number],
  conquest: MetaProgressionState["conquest"]
): FactionId | undefined {
  const progress = conquest.cities[city.id];
  if (progress?.conquered && progress.occupyingFactionId) {
    return progress.occupyingFactionId;
  }
  const gatekeeper = city.gatekeeperHeroId ? heroes.find((hero) => hero.id === city.gatekeeperHeroId) : undefined;
  return gatekeeper?.factionId;
}

function getFactionDef(factionId: FactionId | undefined) {
  return factionId ? factions.find((faction) => faction.id === factionId) : undefined;
}

function getFactionName(factionId: FactionId | undefined): string {
  return getFactionDef(factionId)?.name ?? "無陣營";
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
        <small>${locked && recruitCity ? `攻下 ${recruitCity.name} 後加入` : testAvailable ? "測試模式：可直接出戰，不改變招降進度" : `熟練 Lv.${mastery.level} · 生命 +${mastery.level}% · 傷害 +${mastery.level}%`}</small>
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

function factionVars(factionId: FactionId | undefined): string {
  const faction = getFactionDef(factionId);
  if (!faction) {
    return "--art-primary:#4b4034; --art-secondary:#17110f; --art-accent:#a58a62; --faction:#4b4034; --accent:#a58a62; --owner-bg:#2b241d;";
  }
  return `--art-primary:${faction.palette.primary}; --art-secondary:${faction.palette.secondary}; --art-accent:${faction.palette.accent}; --faction:${faction.palette.primary}; --accent:${faction.palette.accent}; --owner-bg:${faction.palette.primary};`;
}

function formatRecommendedPower(power: number): string {
  return `建議戰力 ${power}`;
}

function formatMenuResources(resources: MetaResources): string {
  const parts: string[] = [];
  if (resources.merit > 0) {
    parts.push(`戰功 ${resources.merit}`);
  }
  if (resources.provisions > 0) {
    parts.push(`軍糧 ${resources.provisions}`);
  }
  if (resources.renown > 0) {
    parts.push(`聲望 ${resources.renown}`);
  }
  return parts.length > 0 ? parts.join(" / ") : "無可領取";
}

function hasAnyMenuResource(resources: MetaResources): boolean {
  return resources.merit > 0 || resources.provisions > 0 || resources.renown > 0;
}

function getTrainingCompanionHeroIds(selectedHeroId: HeroId, collection: CollectionState, testMode: boolean): HeroId[] {
  const selectedHero = heroes.find((hero) => hero.id === selectedHeroId) ?? heroes[0];
  const ownedOrAvailable = (heroId: HeroId) => {
    const art = characterArtById[heroId];
    return testMode || Boolean(collection[art.id]?.owned);
  };
  const candidates = [
    ...heroes.filter((hero) => hero.id !== selectedHeroId && hero.factionId === selectedHero.factionId && ownedOrAvailable(hero.id)),
    ...heroes.filter((hero) => hero.id !== selectedHeroId && ownedOrAvailable(hero.id)),
    ...heroes.filter((hero) => hero.id !== selectedHeroId && hero.factionId === selectedHero.factionId),
    ...heroes.filter((hero) => hero.id !== selectedHeroId)
  ];
  const unique: HeroId[] = [];
  for (const hero of candidates) {
    if (!unique.includes(hero.id)) {
      unique.push(hero.id);
    }
    if (unique.length >= 2) {
      break;
    }
  }
  return unique;
}
