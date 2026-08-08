/* =========================================================
   WIZARD ONBOARDING + utilitaires marque/sécurité
   Chargé AVANT app.js → expose window.esc, window.setBrand.
   ========================================================= */
(function () {
  "use strict";

  // ---------- Sécurité : échappement HTML (anti-XSS) ----------
  // Toute donnée saisie par l'utilisateur passée à innerHTML DOIT être échappée.
  window.esc = function (s) {
    if (s == null) return "";
    return String(s)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  };

  // ---------- Marque : applique la couleur de l'artisan ----------
  // Calcule un texte lisible (blanc/encre) selon la luminance de la couleur.
  // Insère une image dans un conteneur de façon sûre (pas d'innerHTML).
  window.setImg = function (el, src) {
    if (!el) return;
    el.textContent = "";
    if (!src) return;
    const img = document.createElement("img");
    img.src = src; img.alt = ""; el.appendChild(img);
  };

  // ---------- Marque : applique la couleur de l'artisan ----------
  window.setBrand = function (hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || "")) hex = "#0F5132";
    document.documentElement.style.setProperty("--brand", hex);
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    document.documentElement.style.setProperty("--brand-ink", lum > 0.62 ? "#12202E" : "#FFFFFF");
  };

  const store = {
    get profil() { try { return JSON.parse(localStorage.getItem("devix_profil")) || {}; } catch { return {}; } },
    set profil(v) { localStorage.setItem("devix_profil", JSON.stringify(v)); },
    get onboarded() { return localStorage.getItem("devix_onboarded") === "1"; },
    set onboarded(v) { localStorage.setItem("devix_onboarded", v ? "1" : "0"); },
  };

  // Palette de couleurs de marque proposées (métiers du bâtiment)
  const PALETTE = ["#0F5132", "#15324B", "#1D4E89", "#C0392B", "#B7791F", "#6D28D9", "#0D9488", "#B45309", "#0B7285", "#111827"];

  const $ = (id) => document.getElementById(id);
  const app = $("appRoot"), wiz = $("wizard");

  // Si déjà onboardé → on saute le wizard.
  function boot() {
    const p = store.profil;
    window.setBrand(p.couleur || "#0F5132");
    if (store.onboarded) { wiz.classList.remove("open"); app.style.display = "flex"; return; }
    wiz.classList.add("open"); app.style.display = "none";
    initWizard();
  }

  function initWizard() {
    let step = 0;
    const steps = document.querySelectorAll(".wz-step");
    const dots = document.querySelectorAll(".wz-progress .dot");
    const data = { nom: "", contact: "", tel: "", email: "", siret: "", couleur: "#0F5132", logo: "" };

    // Swatches
    const sw = $("swatches");
    PALETTE.forEach((c, i) => {
      const el = document.createElement("div");
      el.className = "swatch" + (c === data.couleur ? " sel" : "");
      el.style.background = c; el.dataset.c = c;
      el.addEventListener("click", () => { data.couleur = c; $("wzColor").value = c; refreshColor(); markSel(); });
      sw.appendChild(el);
    });
    function markSel() { sw.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("sel", s.dataset.c === data.couleur)); }
    $("wzColor").addEventListener("input", (e) => { data.couleur = e.target.value; refreshColor(); markSel(); });

    function refreshColor() {
      window.setBrand(data.couleur);
      // maj aperçus (logo box + soc)
      refreshPreview();
    }
    function refreshPreview() {
      const initiale = (data.nom || "B").trim().charAt(0).toUpperCase();
      ["pvLogo1", "pvLogo2"].forEach((id) => {
        const el = $(id); if (!el) return;
        if (data.logo) window.setImg(el, data.logo);
        else el.textContent = initiale;
      });
      ["pvSoc1", "pvSoc2"].forEach((id) => { const el = $(id); if (el) el.textContent = data.nom || "Votre entreprise"; });
    }

    // Champs entreprise
    const bind = (id, key) => $(id).addEventListener("input", (e) => { data[key] = e.target.value; refreshPreview(); });
    bind("wzNom", "nom"); bind("wzContact", "contact"); bind("wzTel", "tel"); bind("wzEmail", "email"); bind("wzSiret", "siret");

    // Logo upload
    $("wzLogoBtn").addEventListener("click", () => $("wzLogoFile").click());
    $("wzLogoFile").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      // Type : whitelist stricte (accept="image/*" est contournable). Pas de SVG (vecteur script).
      if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) { alert("Format accepté : PNG, JPG ou WEBP."); e.target.value = ""; return; }
      if (f.size > 1.5 * 1024 * 1024) { alert("Logo trop lourd (max 1,5 Mo)."); e.target.value = ""; return; }
      const reader = new FileReader();
      reader.onload = () => {
        data.logo = reader.result;
        window.setImg($("wzLogoPrev"), data.logo);
        refreshPreview();
      };
      reader.readAsDataURL(f);
    });

    // Navigation
    const btnNext = $("wzNext"), btnBack = $("wzBack");
    function show(n) {
      step = Math.max(0, Math.min(steps.length - 1, n));
      steps.forEach((s, i) => s.classList.toggle("on", i === step));
      dots.forEach((d, i) => d.classList.toggle("on", i <= step));
      btnBack.classList.toggle("hidden", step === 0);
      btnNext.textContent = step === 0 ? "Commencer" : (step === steps.length - 1 ? "Créer mon premier devis" : "Continuer");
      if (step === 3) $("wzHi").textContent = data.contact ? data.contact.split(" ")[0] : (data.nom || "l'artisan");
      window.scrollTo(0, 0);
    }
    btnNext.addEventListener("click", () => {
      if (step === 1 && !data.nom.trim()) { $("wzNom").focus(); $("wzNom").style.borderColor = "#FFC24B"; return; }
      if (step === steps.length - 1) { finish(); return; }
      show(step + 1);
    });
    btnBack.addEventListener("click", () => show(step - 1));

    // « Essayer d'abord » : saute le wizard, on demandera les infos au 1er export.
    const btnSkip = $("wzSkip");
    if (btnSkip) btnSkip.addEventListener("click", () => {
      store.profil = { nom: "", couleur: data.couleur || "#1A6B45" };
      store.onboarded = true;
      window.setBrand(data.couleur || "#1A6B45");
      wiz.classList.remove("open");
      app.style.display = "flex";
      if (window.__afterOnboard) window.__afterOnboard();
    });

    function finish() {
      const profil = { nom: data.nom, contact: data.contact, tel: data.tel, email: data.email, siret: data.siret, adresse: data.adresse || "", forme: data.forme || "", couleur: data.couleur, logo: data.logo, decennale: data.decennale || "" };
      // Écriture tolérante au quota localStorage (logo lourd sur Safari mobile) — bug M4.
      try {
        store.profil = profil;
      } catch (err) {
        try { store.profil = { ...profil, logo: "" }; alert("Logo trop lourd pour être enregistré, il a été retiré. Vous pourrez le rajouter plus tard."); }
        catch (e2) { /* on continue quand même : le profil reste en mémoire pour la session */ }
      }
      store.onboarded = true;
      window.setBrand(data.couleur);
      wiz.classList.remove("open");
      app.style.display = "flex";
      if (window.__afterOnboard) window.__afterOnboard();
    }

    refreshPreview();
    show(0);
  }

  // expose un reset (pour tests / re-onboarding)
  window.__resetOnboarding = function () { localStorage.removeItem("devix_onboarded"); location.reload(); };

  document.addEventListener("DOMContentLoaded", boot);
  if (document.readyState !== "loading") boot();
})();
