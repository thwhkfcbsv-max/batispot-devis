/* =========================================================
   PAD DE SIGNATURE ÉLECTRONIQUE
   Signature manuscrite (doigt/souris) → image + horodatage.
   Niveau : signature électronique SIMPLE (eIDAS) — valable pour
   l'acceptation d'un devis artisan (« bon pour accord »).
   ========================================================= */
(function () {
  "use strict";

  function createSignaturePad(canvas) {
    const ctx = canvas.getContext("2d");
    let drawing = false, dirty = false, last = null;

    function resize() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "#12202E";
      // Le resize efface les pixels du canvas → le tracé est perdu.
      // On repart donc de "vide" pour ne pas valider une signature blanche (bug M2).
      dirty = false;
    }
    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    function start(e) { e.preventDefault(); drawing = true; last = pos(e); }
    function move(e) {
      if (!drawing) return; e.preventDefault();
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; dirty = true;
    }
    function end() { drawing = false; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    resize();
    window.addEventListener("resize", resize);

    return {
      clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; },
      isEmpty() { return !dirty; },
      toDataURL() { return dirty ? canvas.toDataURL("image/png") : null; },
      resize,
    };
  }

  window.createSignaturePad = createSignaturePad;
})();
