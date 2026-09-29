// ============================================================
// pdf-extract.js — analiza un PDF cualquiera que el usuario
// importe y decide, igual que se hizo a mano para "Los juegos
// del hambre", cuál es la mejor estrategia:
//
//   A) Texto real reflowable  → si el PDF tiene texto seleccionable
//   B) Páginas como imagen    → si el PDF es un escaneo sin texto
//
// Todo ocurre en el propio dispositivo: el PDF nunca sale del
// teléfono/computadora del usuario.
// ============================================================
const PdfExtract = (function () {

  async function loadPdf(arrayBuffer) {
    const task = pdfjsLib.getDocument({ data: arrayBuffer });
    return task.promise;
  }

  async function sampleTextDensity(pdf) {
    const n = Math.min(8, pdf.numPages);
    let chars = 0;
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      content.items.forEach((it) => { chars += (it.str || "").trim().length; });
    }
    return chars / n; // caracteres promedio por página muestreada
  }

  // ---------- Modo texto: reconstruye párrafos y títulos ----------
  async function extractText(pdf, onProgress) {
    const lines = []; // { text, fontSize, page, y }

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      let curLine = null;

      content.items.forEach((item) => {
        const str = item.str;
        if (str === undefined) return;
        const y = Math.round(item.transform[5]);
        const fontSize = Math.abs(item.transform[3]) || Math.abs(item.transform[0]) || 10;

        if (curLine && Math.abs(curLine.y - y) <= 2) {
          curLine.text += str;
          curLine.fontSize = Math.max(curLine.fontSize, fontSize);
        } else {
          if (curLine && curLine.text.trim()) lines.push(curLine);
          curLine = { text: str, fontSize: fontSize, page: p, y: y };
        }
        if (item.hasEOL && curLine) {
          if (curLine.text.trim()) lines.push(curLine);
          curLine = null;
        }
      });
      if (curLine && curLine.text.trim()) lines.push(curLine);
      if (onProgress) onProgress(p, pdf.numPages);
    }

    if (lines.length === 0) return { title: null, blocks: [] };

    // tamaño de letra "normal" = el más frecuente (moda)
    const freq = {};
    lines.forEach((l) => {
      const k = Math.round(l.fontSize);
      freq[k] = (freq[k] || 0) + 1;
    });
    let bodySize = 12, bestCount = -1;
    Object.keys(freq).forEach((k) => {
      if (freq[k] > bestCount) { bestCount = freq[k]; bodySize = Number(k); }
    });

    // espaciado típico entre líneas normales, para detectar cambios de párrafo
    const gaps = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].page !== lines[i - 1].page) continue;
      if (Math.round(lines[i - 1].fontSize) !== bodySize) continue;
      const g = Math.abs(lines[i - 1].y - lines[i].y);
      if (g > 0 && g < bodySize * 4) gaps.push(g);
    }
    gaps.sort((a, b) => a - b);
    const typicalGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : bodySize * 1.3;

    const blocks = [];
    let paraBuf = "";

    function flushPara() {
      const t = paraBuf.replace(/\s+/g, " ").trim();
      if (t) blocks.push({ type: "p", text: t });
      paraBuf = "";
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const text = l.text.trim();
      if (!text) continue;
      const isHeading = l.fontSize >= bodySize * 1.22 && text.length <= 90;

      if (isHeading) {
        flushPara();
        blocks.push({ type: "heading", text: text });
        continue;
      }

      const prev = lines[i - 1];
      const sameParaPage = prev && prev.page === l.page;
      const gap = sameParaPage ? Math.abs(prev.y - l.y) : 0;
      const bigGap = sameParaPage && gap > typicalGap * 1.7;

      if (bigGap) flushPara();
      paraBuf += (paraBuf ? " " : "") + text;
    }
    flushPara();

    const firstHeading = blocks.find((b) => b.type === "heading");
    return { title: firstHeading ? firstHeading.text : null, blocks: blocks };
  }

  // ---------- Modo imagen: renderiza cada página como imagen ----------
  async function extractImages(pdf, onProgress, onPageBlob) {
    const targetWidth = 1400;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const scale = targetWidth / base.width;
      const viewport = page.getViewport({ scale: Math.min(Math.max(scale, 1), 2.5) });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/webp", 0.82);
      });
      await onPageBlob(p - 1, blob);
      canvas.width = 0; canvas.height = 0; // liberar memoria
      if (onProgress) onProgress(p, pdf.numPages);
    }
  }

  // ---------- Punto de entrada ----------
  async function analyze(file, onProgress) {
    const buf = await file.arrayBuffer();
    const pdf = await loadPdf(buf);
    const density = await sampleTextDensity(pdf);
    const mode = density < 25 ? "image" : "text";
    return { pdf, mode, numPages: pdf.numPages };
  }

  return { analyze, extractText, extractImages };
})();
