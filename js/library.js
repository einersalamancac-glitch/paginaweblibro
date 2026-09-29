// ============================================================
// library.js — pantalla de biblioteca: lista de libros, importar
// un PDF nuevo (detectando si conviene texto real o páginas-imagen)
// y borrar libros.
// ============================================================
const Library = (function () {
  const grid = document.getElementById("lib-grid");
  const empty = document.getElementById("lib-empty");
  const fab = document.getElementById("fab-add");
  const fileInput = document.getElementById("file-input");

  const progressOverlay = document.getElementById("import-progress");
  const progressText = document.getElementById("import-progress-text");
  const progressFill = document.getElementById("import-progress-fill");

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function setProgress(text, ratio) {
    progressText.textContent = text;
    progressFill.style.width = Math.round(ratio * 100) + "%";
  }

  async function refresh() {
    const books = await DB.getAllBooks();
    grid.innerHTML = "";
    empty.classList.toggle("hidden", books.length > 0);
    books.forEach((book) => grid.appendChild(renderCard(book)));
  }

  function renderCard(book) {
    const card = document.createElement("div");
    card.className = "book-card";

    const cover = document.createElement("div");
    cover.className = "book-cover";
    cover.textContent = book.title || "Sin título";
    card.appendChild(cover);

    const info = document.createElement("div");
    info.className = "book-info";
    const t = document.createElement("div");
    t.className = "book-title";
    t.textContent = book.title || "Sin título";
    info.appendChild(t);

    const track = document.createElement("div");
    track.className = "book-progress-track";
    const fill = document.createElement("div");
    fill.className = "book-progress-fill";
    const ratio = book.numPages > 1 ? Math.min(1, (book.lastPageIndex || 0) / (book.numPages - 1)) : 0;
    fill.style.width = Math.round(ratio * 100) + "%";
    track.appendChild(fill);
    info.appendChild(track);
    card.appendChild(info);

    const del = document.createElement("button");
    del.className = "book-del";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Eliminar libro");
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm('¿Eliminar "' + (book.title || "este libro") + '" de tu biblioteca?')) {
        await DB.deleteBook(book.id);
        refresh();
      }
    });
    card.appendChild(del);

    card.addEventListener("click", () => App.showReaderScreen(book.id));
    return card;
  }

  async function importFile(file) {
    progressOverlay.classList.remove("hidden");
    setProgress("Analizando el PDF…", 0.03);
    try {
      const { pdf, mode, numPages } = await PdfExtract.analyze(file);
      const id = uuid();
      const titleGuess = file.name.replace(/\.pdf$/i, "");

      if (mode === "text") {
        setProgress("Leyendo el texto…", 0.1);
        const { title, blocks } = await PdfExtract.extractText(pdf, (p, total) => {
          setProgress("Leyendo página " + p + " de " + total + "…", 0.1 + 0.8 * (p / total));
        });
        await DB.putBlocks(id, blocks);
        await DB.putBook({
          id, title: title || titleGuess, author: null, mode: "text",
          numPages: 0, lastPageIndex: 0, addedAt: Date.now(),
        });
      } else {
        setProgress("Convirtiendo páginas…", 0.1);
        await DB.putBook({
          id, title: titleGuess, author: null, mode: "image",
          numPages: numPages, lastPageIndex: 0, addedAt: Date.now(),
        });
        await PdfExtract.extractImages(
          pdf,
          (p, total) => setProgress("Página " + p + " de " + total + "…", 0.1 + 0.85 * (p / total)),
          (index, blob) => DB.putImagePage(id, index, blob)
        );
      }

      setProgress("Listo", 1);
      setTimeout(() => {
        progressOverlay.classList.add("hidden");
        refresh();
      }, 250);
    } catch (err) {
      console.error(err);
      progressOverlay.classList.add("hidden");
      alert("No se pudo importar este PDF. Puede que esté dañado o protegido. Detalle: " + (err && err.message ? err.message : err));
    }
  }

  fab.addEventListener("click", () => {
    if (!window.pdfjsLib || !navigator.onLine) {
      alert("Para importar un libro nuevo necesitas conexión a internet (para leer los que ya importaste no hace falta).");
      return;
    }
    fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (file) importFile(file);
  });

  return { refresh };
})();
