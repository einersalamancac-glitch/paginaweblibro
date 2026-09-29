// ============================================================
// app.js — arranque general: aplica el tema de lectura guardado,
// cambia entre la pantalla de biblioteca y la de lector, y maneja
// el panel de ajustes (color de fondo, tipografía, tamaño de letra).
// ============================================================
const App = (function () {
  const root = document.documentElement;
  const screenLibrary = document.getElementById("screen-library");
  const screenReader = document.getElementById("screen-reader");

  const FONT_MIN = 0.75, FONT_MAX = 1.9, FONT_STEP = 0.1;
  let fontScale = 1;

  function applyTheme(theme) {
    root.style.setProperty("--read-bg", theme.bg);
    root.style.setProperty("--read-text", theme.text);
    root.style.setProperty("--read-font", theme.font);
    root.style.setProperty("--font-scale", theme.fontScale);
  }

  async function loadTheme() {
    const theme = await DB.getSetting("theme", {
      bg: "#050505",
      text: "#e9e6df",
      font: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif",
      fontScale: 1,
    });
    fontScale = theme.fontScale || 1;
    applyTheme(theme);
    return theme;
  }

  async function saveTheme(partial) {
    const current = await DB.getSetting("theme", {
      bg: "#050505", text: "#e9e6df",
      font: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif",
      fontScale: 1,
    });
    const merged = Object.assign({}, current, partial);
    await DB.setSetting("theme", merged);
    applyTheme(merged);
    return merged;
  }

  function showLibrary() {
    screenReader.classList.add("hidden");
    screenLibrary.classList.remove("hidden");
    Library.refresh();
  }

  function showReaderScreen(bookId) {
    screenLibrary.classList.add("hidden");
    screenReader.classList.remove("hidden");
    Reader.open(bookId);
  }

  // ---------------- Panel de ajustes ----------------
  const settingsOverlay = document.getElementById("settings-overlay");
  const btnOpenSettings = document.getElementById("btn-open-settings");
  const btnCloseSettings = document.getElementById("btn-close-settings");
  const bgSwatches = document.getElementById("bg-swatches");
  const customBg = document.getElementById("custom-bg");
  const fontFamilyGroup = document.getElementById("font-family-group");
  const setFontVal = document.getElementById("set-font-val");

  function refreshSettingsUi(theme) {
    Array.from(bgSwatches.children).forEach((sw) => {
      sw.classList.toggle("active", sw.dataset.bg.toLowerCase() === theme.bg.toLowerCase());
    });
    Array.from(fontFamilyGroup.children).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.font === theme.font);
    });
    setFontVal.textContent = Math.round(theme.fontScale * 100) + "%";
    customBg.value = theme.bg;
  }

  btnOpenSettings.addEventListener("click", async () => {
    const theme = await loadTheme();
    refreshSettingsUi(theme);
    settingsOverlay.classList.remove("hidden");
  });
  btnCloseSettings.addEventListener("click", () => settingsOverlay.classList.add("hidden"));
  settingsOverlay.addEventListener("click", (e) => { if (e.target === settingsOverlay) settingsOverlay.classList.add("hidden"); });

  bgSwatches.addEventListener("click", async (e) => {
    const sw = e.target.closest(".swatch");
    if (!sw) return;
    const theme = await saveTheme({ bg: sw.dataset.bg, text: sw.dataset.text });
    refreshSettingsUi(theme);
  });
  customBg.addEventListener("input", async () => {
    // contraste automático simple: fondo claro → texto oscuro, y viceversa
    const hex = customBg.value.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const text = lum > 0.55 ? "#181818" : "#efe9dd";
    const theme = await saveTheme({ bg: customBg.value, text: text });
    refreshSettingsUi(theme);
  });
  fontFamilyGroup.addEventListener("click", async (e) => {
    const btn = e.target.closest(".opt-btn");
    if (!btn) return;
    const theme = await saveTheme({ font: btn.dataset.font });
    refreshSettingsUi(theme);
  });

  document.getElementById("set-font-minus").addEventListener("click", async () => {
    const t = await DB.getSetting("theme", { fontScale: 1 });
    const v = Math.max(FONT_MIN, Math.round((t.fontScale - FONT_STEP) * 100) / 100);
    const theme = await saveTheme({ fontScale: v });
    refreshSettingsUi(theme);
    if (Reader.isOpenBook()) Reader.onFontScaleChanged();
  });
  document.getElementById("set-font-plus").addEventListener("click", async () => {
    const t = await DB.getSetting("theme", { fontScale: 1 });
    const v = Math.min(FONT_MAX, Math.round((t.fontScale + FONT_STEP) * 100) / 100);
    const theme = await saveTheme({ fontScale: v });
    refreshSettingsUi(theme);
    if (Reader.isOpenBook()) Reader.onFontScaleChanged();
  });

  function getFontScale() { return fontScale; }
  function setFontScaleDirect(v) {
    fontScale = Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(v * 100) / 100));
    root.style.setProperty("--font-scale", fontScale);
    DB.getSetting("theme", {}).then((t) => DB.setSetting("theme", Object.assign({}, t, { fontScale })));
  }

  async function init() {
    await loadTheme();
    showLibrary();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // en un entorno sin https (p. ej. abriendo el archivo local),
        // el navegador no permite service workers: no pasa nada,
        // la app sigue funcionando igual, solo sin modo sin conexión.
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    showLibrary, showReaderScreen,
    FONT_MIN, FONT_MAX, FONT_STEP,
    getFontScale, setFontScaleDirect,
  };
})();
