// ============================================================
// page-turn.js — animación de "hoja que se dobla y gira" (3D).
// No sabe nada del contenido del libro: sólo recibe HTML de
// páginas ya preparadas y anima la transición entre ellas.
// ============================================================
function createPageTurn(opts) {
  const stage = opts.stageEl;
  const leaf = opts.leafEl;
  const leafFront = opts.leafFrontEl;
  const leafBack = opts.leafBackEl;
  const leafShadow = opts.leafShadowEl;
  const pageUnder = opts.pageUnderEl;
  const getPageHtml = opts.getPageHtml; // (index) => html string | null
  const getTotalPages = opts.getTotalPages; // () => number
  const onChange = opts.onChange || function () {};

  let current = 0;
  let animating = false;
  let dragging = false;
  let dragDir = null; // 'next' | 'prev'
  let startX = 0, startY = 0, lastAngle = 0;

  function total() {
    return getTotalPages();
  }

  function setStatic(index) {
    leaf.style.transition = "none";
    leaf.classList.remove("origin-left");
    leaf.style.transform = "rotateY(0deg)";
    leafShadow.style.opacity = "0";
    leafFront.innerHTML = getPageHtml(index) || "";
    pageUnder.innerHTML = "";
    current = index;
  }

  function goTo(index, opts2) {
    opts2 = opts2 || {};
    index = Math.max(0, Math.min(total() - 1, index));
    setStatic(index);
    if (!opts2.silent) onChange(current);
  }

  function canGo(dir) {
    if (animating) return false;
    if (dir === "next") return current < total() - 1;
    if (dir === "prev") return current > 0;
    return false;
  }

  function beginDrag(dir) {
    if (!canGo(dir)) return false;
    dragging = true;
    dragDir = dir;
    animating = false;
    leaf.style.transition = "none";
    leafFront.innerHTML = getPageHtml(current) || "";

    if (dir === "next") {
      leaf.classList.add("origin-left");
      pageUnder.innerHTML = getPageHtml(current + 1) || "";
    } else {
      leaf.classList.remove("origin-left");
      pageUnder.innerHTML = getPageHtml(current - 1) || "";
    }
    return true;
  }

  function updateDrag(deltaX, viewportWidth) {
    if (!dragging) return;
    // Distancia de arrastre necesaria para un giro completo:
    // algo menor que el ancho completo para que se sienta ágil.
    const span = Math.max(120, viewportWidth * 0.85);
    let progress = Math.abs(deltaX) / span;
    if (progress > 1) progress = 1 + (progress - 1) * 0.15; // resistencia elástica
    progress = Math.min(progress, 1.15);

    let angle;
    if (dragDir === "next") {
      angle = -progress * 180;
    } else {
      angle = progress * 180;
    }
    lastAngle = angle;
    leaf.style.transform = "rotateY(" + angle + "deg)";
    const shadowOpacity = Math.min(1, Math.abs(angle) / 95);
    leafShadow.style.opacity = String(shadowOpacity * 0.7);
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    const progress = Math.min(1, Math.abs(lastAngle) / 180);
    const commit = progress > 0.32;
    animateFinish(commit);
  }

  function animateFinish(commit) {
    animating = true;
    leaf.style.transition = "transform 280ms cubic-bezier(.22,.61,.36,1)";
    leafShadow.style.transition = "opacity 280ms ease";

    const targetAngle = commit ? (dragDir === "next" ? -180 : 180) : 0;
    leaf.style.transform = "rotateY(" + targetAngle + "deg)";
    leafShadow.style.opacity = commit ? "0" : "0";

    const done = function () {
      leaf.removeEventListener("transitionend", done);
      leaf.style.transition = "none";
      leafShadow.style.transition = "none";
      animating = false;
      if (commit) {
        const newIndex = dragDir === "next" ? current + 1 : current - 1;
        setStatic(newIndex);
        onChange(current);
      } else {
        leaf.classList.remove("origin-left");
        leaf.style.transform = "rotateY(0deg)";
        leafShadow.style.opacity = "0";
        pageUnder.innerHTML = "";
      }
      dragDir = null;
    };
    leaf.addEventListener("transitionend", done);
    // Salvaguarda por si transitionend no llega (algunos navegadores móviles)
    setTimeout(function () {
      if (animating) done();
    }, 420);
  }

  function step(dir) {
    if (!canGo(dir)) return;
    beginDrag(dir);
    // fuerza un reflow antes de animar
    // eslint-disable-next-line no-unused-expressions
    leaf.offsetHeight;
    lastAngle = dir === "next" ? -180 : 180;
    animateFinish(true);
  }

  return {
    goTo: goTo,
    next: function () { step("next"); },
    prev: function () { step("prev"); },
    beginDrag: beginDrag,
    updateDrag: updateDrag,
    endDrag: endDrag,
    isDragging: function () { return dragging; },
    isAnimating: function () { return animating; },
    current: function () { return current; },
  };
}
