import "./styles/main.css";
import { App } from "./components/App";
import { Game } from "./game/core/Game";
import { Leaderboard, safeStorage } from "./game/scoring/Leaderboard";
import { Settings } from "./game/settings/Settings";
import { setLocale, t } from "./i18n";

/** Wait for the Uyghur and numeric fonts (bounded, so a slow CDN never blocks play). */
async function loadFonts(timeoutMs = 3500): Promise<void> {
  if (!("fonts" in document)) return;
  const fonts = Promise.allSettled([
    document.fonts.load('32px "ALKATIP Basma"', "ئالەم جەڭچىسى"),
    document.fonts.load('32px "Noto Sans Arabic"', "ئالەم"),
    document.fonts.load('700 32px "Chakra Petch"', "0123456789"),
  ]);
  await Promise.race([fonts, new Promise((r) => setTimeout(r, timeoutMs))]);
}

async function boot(): Promise<void> {
  const storage = safeStorage();
  const settings = new Settings(storage);
  setLocale(settings.values.locale);

  const loading = document.getElementById("loading")!;
  loading.querySelector(".game-title")!.textContent = t("app.title");
  loading.querySelector("p")!.textContent = t("app.loading");

  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const game = new Game(canvas, settings, new Leaderboard(storage));
  new App(game, document.getElementById("stage")!, document.getElementById("screens")!, storage);
  game.startLoop();

  await loadFonts();
  game.finishLoading();
  loading.classList.add("done");

  // Debug handle for automated tests / dev tools.
  (window as unknown as { __game?: Game }).__game = game;
}

void boot();
