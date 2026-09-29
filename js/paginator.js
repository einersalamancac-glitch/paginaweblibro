// ============================================================
// paginator.js — parte el contenido de un libro (título +
// bloques de texto) en páginas que caben exactamente en la
// pantalla actual. El texto nunca se corta a mitad de palabra:
// la prosa queda siempre íntegra y continua entre páginas, sin
// justificación forzada ni espacios distorsionados.
// ============================================================
const Paginator = (function () {

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function makeMeasurer(pageW, pageH) {
    const el = document.getElementById("measurer");
    el.style.width = pageW + "px";
    el.style.height = pageH + "px";
    el.innerHTML = "";
    return el;
  }

  function overflow(bodyEl) {
    return bodyEl.scrollHeight > bodyEl.clientHeight + 1;
  }

  function fitWords(words, pEl, bodyEl) {
    let lo = 1, hi = words.length, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      pEl.textContent = words.slice(0, mid).join(" ");
      if (overflow(bodyEl)) hi = mid - 1; else { best = mid; lo = mid + 1; }
    }
    return best;
  }

  function titlePageHtml(title, author) {
    return `<div class="page-content"><div class="book-title-block">
      <div class="t-title">${esc(title || "Sin título")}</div>
      ${author ? `<div class="t-translator">${esc(author)}</div>` : ""}
    </div></div>`;
  }

  function paginate(book, pageW, pageH) {
    const measurer = makeMeasurer(pageW, pageH);
    const pages = [];
    const toc = [];

    pages.push({ html: titlePageHtml(book.title, book.author), isSpecial: true });

    let pageBuf = { blocksHtml: [] };

    function bodyHtml() { return pageBuf.blocksHtml.join(""); }

    function startNewPage() { pageBuf = { blocksHtml: [] }; }

    function commitPage() {
      const html = `<div class="page-content"><div class="page-body">${bodyHtml()}</div></div>`;
      pages.push({ html: html, isSpecial: false });
      pageBuf = null;
    }

    function renderMeasurerState() {
      measurer.innerHTML = `<div class="page-content"><div class="page-body">${bodyHtml()}</div></div>`;
      return measurer.querySelector(".page-body");
    }

    const units = book.blocks.slice();
    let uIdx = 0;

    while (uIdx < units.length) {
      const unit = units[uIdx];

      if (unit.type === "heading") {
        if (!pageBuf) startNewPage();
        pageBuf.blocksHtml.push(`<h4 class="block-heading hfit"></h4>`);
        let bodyEl = renderMeasurerState();
        let hEl = bodyEl.querySelector(".hfit:last-of-type");
        hEl.textContent = unit.text;

        if (!overflow(bodyEl)) {
          pageBuf.blocksHtml[pageBuf.blocksHtml.length - 1] =
            `<h4 class="block-heading">${esc(unit.text)}</h4>`;
          toc.push({ pageIndex: pages.length, title: unit.text });
          uIdx++;
          continue;
        }

        // no cabe en lo que queda de esta página: pasamos a una nueva
        pageBuf.blocksHtml.pop();
        if (pageBuf.blocksHtml.length > 0) {
          commitPage();
          startNewPage();
          continue; // reintenta el mismo heading en página nueva
        }
        // página vacía y aun así no cabe entero (título muy largo):
        // lo partimos por palabras como un párrafo
        const words = unit.text.split(" ");
        pageBuf.blocksHtml.push(`<h4 class="block-heading hfit2"></h4>`);
        bodyEl = renderMeasurerState();
        hEl = bodyEl.querySelector(".hfit2:last-of-type");
        const n = Math.max(1, fitWords(words, hEl, bodyEl));
        pageBuf.blocksHtml[pageBuf.blocksHtml.length - 1] =
          `<h4 class="block-heading">${esc(words.slice(0, n).join(" "))}</h4>`;
        toc.push({ pageIndex: pages.length, title: unit.text });
        commitPage();
        startNewPage();
        if (n < words.length) {
          units.splice(uIdx + 1, 0, { type: "p", text: words.slice(n).join(" ") });
        }
        uIdx++;
        continue;
      }

      if (unit.type === "p") {
        const words = unit.text.split(" ");
        let idx = 0;
        let firstSeg = true;
        while (idx < words.length) {
          if (!pageBuf) startNewPage();
          const cls = firstSeg ? "" : " cont";
          pageBuf.blocksHtml.push(`<p class="pfit${cls}"></p>`);
          let bodyEl = renderMeasurerState();
          const pEl = bodyEl.querySelector("p.pfit:last-of-type");
          const remaining = words.slice(idx);

          pEl.textContent = remaining.join(" ");
          if (!overflow(bodyEl)) {
            pageBuf.blocksHtml[pageBuf.blocksHtml.length - 1] =
              `<p class="${cls.trim()}">${esc(remaining.join(" "))}</p>`;
            idx = words.length;
            firstSeg = false;
            continue;
          }

          const n = fitWords(remaining, pEl, bodyEl);
          if (n <= 0) {
            pageBuf.blocksHtml.pop();
            if (pageBuf.blocksHtml.length === 0) {
              pageBuf.blocksHtml.push(`<p class="${cls.trim()}">${esc(remaining[0])}</p>`);
              idx += 1;
              firstSeg = false;
            }
            commitPage();
            startNewPage();
            continue;
          }

          pageBuf.blocksHtml[pageBuf.blocksHtml.length - 1] =
            `<p class="${cls.trim()}">${esc(remaining.slice(0, n).join(" "))}</p>`;
          idx += n;
          firstSeg = false;
          commitPage();
          startNewPage();
        }
        uIdx++;
        continue;
      }

      uIdx++;
    }

    if (pageBuf && pageBuf.blocksHtml.length > 0) commitPage();
    measurer.innerHTML = "";

    return { pages: pages, toc: toc };
  }

  return { paginate: paginate };
})();
