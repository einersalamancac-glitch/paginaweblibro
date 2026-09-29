// ============================================================
// reader.js — pantalla de lectura de un libro concreto: arma las
// páginas (texto reflowable o imágenes), controla el giro de
// página, los gestos, el índice, los marcadores y el zoom de letra.
// ============================================================
const Reader = (function () {
  const screenReader = document.getElementById("screen-reader");
  const viewport = document.getElementById("viewport");
  const stage = document.getElementById("stage");
  const leaf = document.getElementById("leaf");
  const leafFront = document.getElementById("leaf-front");
  const leafBack = document.getElementById("leaf-back");
  const leafShadow = document.getElementById("leaf-shadow");
  const pageUnder = document.getElementById("page-under");

  const readerTitle = document.getElementById("reader-title");
  const pageIndicator = document.getElementById("page-indicator");
  const progressSlider = document.getElementById("progress-slider");
  const btnBack = document.getElementById("btn-back-library");
  const btnOpenIndex = document.getElementById("btn-open-index");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const btnBookmarkHere = document.getElementById("btn-bookmark-here");
  const tapPrev = document.getElementById("tap-prev");
  const tapNext = document.getElementById("tap-next");
  const zoomOut = document.getElementById("zoom-out");
  const zoomIn = document.getElementById("zoom-in");

  const sideOverlay = document.getElementById("side-overlay");
  const btnSideClose = document.getElementById("btn-side-close");
  const sideTabs = document.querySelectorAll(".side-tab");
  const tabToc = document.getElementById("tab-toc");
  const tabMarks = document.getElementById("tab-marks");
  const marksList = document.getElementById("marks-list");
  const btnAddBookmark = document.getElementById("btn-add-bookmark");

  let currentBook = null;
  let PAGES = [];
  let TOC = [];
  let pageTurn = null;
  let chromeVisible = false;
  let resizeTimer = null;
  let objectUrls = [];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function isOpenBook() { return !!currentBook; }

  function showChrome(show) {
    chromeVisible = show;
    screenReader.classList.toggle("chrome-visible", show);
  }
  function toggleChrome() { showChrome(!chromeVisible); }

  function revokeUrls() {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    objectUrls = [];
  }

  // ---------------------------------------------------------
  // Construcción de páginas
  // ---------------------------------------------------------
  function stageSize() { return { w: stage.clientWidth, h: stage.clientHeight }; }

  async function buildTextPages() {
    const blocks = await DB.getBlocks(currentBook.id);
    const size = stageSize();
    const result = Paginator.paginate(
      { title: currentBook.title, author: currentBook.author, blocks: blocks || [] },
      size.w, size.h
    );
    PAGES = result.pages;
    TOC = result.toc;
  }

  async function buildImagePages() {
    revokeUrls();
    const imgs = await DB.getImagePages(currentBook.id);
    PAGES = imgs.map((rec) => {
      const url = URL.createObjectURL(rec.blob);
      objectUrls.push(url);
      return { html: `<div class="img-page"><img src="${url}" alt="Página ${rec.index + 1}"></div>`, isSpecial: false };
    });
    TOC = [];
  }

  function renderToc() {
    tabToc.innerHTML = "";
    if (currentBook.mode === "image") {
      const p = document.createElement("p");
      p.style.cssText = "padding:16px;font-size:13px;color:var(--app-text-dim);";
      p.textContent = "Este libro se muestra como páginas escaneadas: usa la barra de progreso para saltar de página.";
      tabToc.appendChild(p);
      return;
    }
    if (TOC.length === 0) {
      const p = document.createElement("p");
      p.style.cssText = "padding:16px;font-size:13px;color:var(--app-text-dim);";
      p.textContent = "No se detectaron títulos de capítulo en este PDF.";
      tabToc.appendChild(p);
      return;
    }
    TOC.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "list-item";
      btn.textContent = item.title;
      btn.addEventListener("click", () => {
        pageTurn.goTo(item.pageIndex);
        sideOverlay.classList.add("hidden");
        showChrome(false);
      });
      tabToc.appendChild(btn);
    });
  }

  async function renderBookmarks() {
    const list = await DB.getBookmarks(currentBook.id);
    marksList.innerHTML = "";
    if (list.length === 0) {
      const p = document.createElement("p");
      p.style.cssText = "padding:0 16px;font-size:13px;color:var(--app-text-dim);";
      p.textContent = "Todavía no tienes marcadores en este libro.";
      marksList.appendChild(p);
      return;
    }
    list.forEach((bm) => {
      const row = document.createElement("div");
      row.className = "list-item";
      const left = document.createElement("div");
      left.innerHTML = (bm.label || ("Página " + (bm.pageIndex + 1))) +
        "<small>Página " + (bm.pageIndex + 1) + " / " + PAGES.length + "</small>";
      left.style.cursor = "pointer";
      left.addEventListener("click", () => {
        pageTurn.goTo(bm.pageIndex);
        sideOverlay.classList.add("hidden");
        showChrome(false);
      });
      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "✕";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        await DB.deleteBookmark(bm.bid);
        renderBookmarks();
      });
      row.appendChild(left);
      row.appendChild(del);
      marksList.appendChild(row);
    });
  }

  function updateUiForPage(index) {
    const total = PAGES.length;
    pageIndicator.textContent = "Página " + (index + 1) + " / " + total;
    progressSlider.max = String(Math.max(0, total - 1));
    progressSlider.value = String(index);
    DB.updateBookProgress(currentBook.id, index);
  }

  async function build(preserveRatio) {
    screenReader.classList.add("loading");
    await new Promise((r) => setTimeout(r, 15));

    if (currentBook.mode === "text") {
      await buildTextPages();
    } else {
      await buildImagePages();
    }
    await DB.putBook(Object.assign({}, currentBook, { numPages: PAGES.length }));

    if (!pageTurn) {
      pageTurn = createPageTurn({
        stageEl: stage, leafEl: leaf, leafFrontEl: leafFront, leafBackEl: leafBack,
        leafShadowEl: leafShadow, pageUnderEl: pageUnder,
        getPageHtml: (i) => (PAGES[i] ? PAGES[i].html : null),
        getTotalPages: () => PAGES.length,
        onChange: updateUiForPage,
      });
    }

    let target = 0;
    if (typeof preserveRatio === "number") {
      target = Math.round(preserveRatio * (PAGES.length - 1));
    } else {
      target = currentBook.lastPageIndex || 0;
    }
    target = clamp(target, 0, PAGES.length - 1);
    pageTurn.goTo(target);
    renderToc();
    screenReader.classList.remove("loading");
  }

  async function open(bookId) {
    currentBook = await DB.getBook(bookId);
    if (!currentBook) { App.showLibrary(); return; }
    readerTitle.textContent = currentBook.title || "Sin título";
    showChrome(false);
    await build();
  }

  function close() {
    if (currentBook) DB.updateBookProgress(currentBook.id, pageTurn ? pageTurn.current() : 0);
    revokeUrls();
    currentBook = null;
    PAGES = []; TOC = [];
  }

  async function onFontScaleChanged() {
    if (!currentBook || currentBook.mode !== "text") return;
    const ratio = pageTurn ? pageTurn.current() / Math.max(1, PAGES.length - 1) : 0;
    await build(ratio);
  }

  // ---------------------------------------------------------
  // Gestos táctiles
  // ---------------------------------------------------------
  let ptrActive = false, ptrId = null, startX = 0, startY = 0, decided = false, isDragGesture = false;
  const TAP_MAX_MOVE = 10, DRAG_THRESHOLD = 8;

  function onPointerDown(e) {
    if (e.target.closest(".chrome") || e.target.closest(".overlay") || e.target.closest("#zoom-float")) return;
    if (!pageTurn || pageTurn.isAnimating()) return;
    ptrActive = true; ptrId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    decided = false; isDragGesture = false;
    viewport.setPointerCapture && viewport.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!ptrActive || e.pointerId !== ptrId) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!decided) {
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        decided = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          isDragGesture = true;
          pageTurn.beginDrag(dx < 0 ? "next" : "prev");
        }
      }
    }
    if (isDragGesture) { e.preventDefault(); pageTurn.updateDrag(dx, stage.clientWidth); }
  }
  function onPointerUp(e) {
    if (!ptrActive || e.pointerId !== ptrId) return;
    ptrActive = false;
    if (isDragGesture) {
      pageTurn.endDrag();
    } else {
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) < TAP_MAX_MOVE && Math.abs(dy) < TAP_MAX_MOVE) handleTap(e.clientX);
    }
    decided = false; isDragGesture = false;
  }
  function handleTap(clientX) {
    const w = window.innerWidth, ratio = clientX / w;
    if (ratio < 0.28) pageTurn.prev();
    else if (ratio > 0.72) pageTurn.next();
    else toggleChrome();
  }

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerUp);
  tapPrev.addEventListener("click", () => pageTurn && pageTurn.prev());
  tapNext.addEventListener("click", () => pageTurn && pageTurn.next());

  document.addEventListener("keydown", (e) => {
    if (!isOpenBook()) return;
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowRight") pageTurn.next();
    else if (e.key === "ArrowLeft") pageTurn.prev();
    else if (e.key === " ") { e.preventDefault(); pageTurn.next(); }
    else if (e.key === "Backspace") { e.preventDefault(); pageTurn.prev(); }
    else if (e.key === "Escape") sideOverlay.classList.add("hidden");
  });

  // ---------------------------------------------------------
  // Controles
  // ---------------------------------------------------------
  btnBack.addEventListener("click", () => { close(); App.showLibrary(); });

  btnOpenIndex.addEventListener("click", async () => {
    await renderBookmarks();
    sideOverlay.classList.remove("hidden");
  });
  btnSideClose.addEventListener("click", () => sideOverlay.classList.add("hidden"));
  sideOverlay.addEventListener("click", (e) => { if (e.target === sideOverlay) sideOverlay.classList.add("hidden"); });

  sideTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      sideTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const which = tab.dataset.tab;
      tabToc.classList.toggle("hidden", which !== "toc");
      tabMarks.classList.toggle("hidden", which !== "marks");
    });
  });

  btnAddBookmark.addEventListener("click", async () => {
    if (!pageTurn) return;
    await DB.addBookmark(currentBook.id, pageTurn.current(), "Página " + (pageTurn.current() + 1));
    renderBookmarks();
  });
  btnBookmarkHere.addEventListener("click", async () => {
    if (!pageTurn) return;
    await DB.addBookmark(currentBook.id, pageTurn.current(), "Página " + (pageTurn.current() + 1));
    btnBookmarkHere.textContent = "★";
    setTimeout(() => { btnBookmarkHere.textContent = "☆"; }, 900);
  });

  progressSlider.addEventListener("change", () => {
    if (pageTurn) pageTurn.goTo(parseInt(progressSlider.value, 10));
  });

  btnFullscreen.addEventListener("click", () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      (el.requestFullscreen && el.requestFullscreen()) || (el.webkitRequestFullscreen && el.webkitRequestFullscreen());
    } else {
      (document.exitFullscreen && document.exitFullscreen()) || (document.webkitExitFullscreen && document.webkitExitFullscreen());
    }
  });

  zoomOut.addEventListener("click", (e) => {
    e.stopPropagation();
    App.setFontScaleDirect(App.getFontScale() - App.FONT_STEP);
    onFontScaleChanged();
  });
  zoomIn.addEventListener("click", (e) => {
    e.stopPropagation();
    App.setFontScaleDirect(App.getFontScale() + App.FONT_STEP);
    onFontScaleChanged();
  });

  window.addEventListener("resize", () => {
    if (!isOpenBook()) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const ratio = pageTurn ? pageTurn.current() / Math.max(1, PAGES.length - 1) : 0;
      build(ratio);
    }, 250);
  });
  window.addEventListener("orientationchange", () => {
    if (!isOpenBook()) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const ratio = pageTurn ? pageTurn.current() / Math.max(1, PAGES.length - 1) : 0;
      build(ratio);
    }, 350);
  });

  return { open, close, isOpenBook, onFontScaleChanged };
})();
