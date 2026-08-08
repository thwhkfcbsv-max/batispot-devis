/* =========================================================
   DEVIX — logique application (MVP peinture)
   Persistance locale (localStorage). Voix via Web Speech API.
   ========================================================= */
(function () {
  "use strict";

  const { CATALOGUE_PEINTURE, estimerSurfaceMurs, ligneDevis, calculerTotaux, TVA_OPTIONS } = window;
  setCatalogue(CATALOGUE_PEINTURE);

  // ---- État ----
  let etat = {
    lignes: [],            // lignes du devis courant
    tva: 0.10,
    remise: 0,
    piece: null,
    ecran: "saisie",       // saisie | devis | apercu
    signature: null,       // {img, dateStr} une fois le client a signé
    echeancier: null,      // {preset, lignes:[{label,pct}]}
    client: null,          // {nom, adresse}
  };

  // Presets de termes de paiement (échéancier)
  const ECHEANCIERS = {
    comptant: { nom: "Comptant", lignes: [{ label: "À réception des travaux", pct: 100 }] },
    "30-70":  { nom: "30 / 70", lignes: [{ label: "Acompte à la commande", pct: 30 }, { label: "Solde à la livraison", pct: 70 }] },
    "40-60":  { nom: "40 / 60", lignes: [{ label: "Acompte à la commande", pct: 40 }, { label: "Solde à la fin", pct: 60 }] },
    "30-40-30": { nom: "30 / 40 / 30", lignes: [{ label: "À la commande", pct: 30 }, { label: "À mi-chantier", pct: 40 }, { label: "À la livraison", pct: 30 }] },
  };

  const store = {
    get profil() { try { return JSON.parse(localStorage.getItem("devix_profil")) || {}; } catch { return {}; } },
    set profil(v) { localStorage.setItem("devix_profil", JSON.stringify(v)); },
    get tarifs() { try { return JSON.parse(localStorage.getItem("devix_tarifs")) || {}; } catch { return {}; } },
    set tarifs(v) { localStorage.setItem("devix_tarifs", JSON.stringify(v)); },
    get compteur() { return parseInt(localStorage.getItem("devix_compteur") || "0", 10); },
    set compteur(v) { localStorage.setItem("devix_compteur", String(v)); },
    get devis() { try { return JSON.parse(localStorage.getItem("devix_bibliotheque")) || []; } catch { return []; } },
    set devis(v) { try { localStorage.setItem("devix_bibliotheque", JSON.stringify(v)); } catch (e) { toast("Mémoire pleine : devis non enregistré. Videz d'anciens devis."); } },
  };

  // Identifiant stable (uuid v4) — l'identité d'un devis, indépendante du numéro d'affichage.
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8); return v.toString(16);
    });
  }
  // Rétro-remplissage : les anciens devis sans id en reçoivent un (une seule fois).
  (function backfillIds() {
    const l = store.devis; let changed = false;
    l.forEach((d) => { if (!d.id) { d.id = uuid(); changed = true; } });
    if (changed) store.devis = l;
  })();

  // Sauvegarde le devis courant dans la bibliothèque (crée ou met à jour par id stable).
  function sauverDevis(statut) {
    if (!etat.lignes.length) return;
    if (!etat.id) etat.id = uuid();
    const t = calculerTotaux(etat.lignes, { tva: etat.tva, remise: etat.remise });
    const num = etat.numero || (store.compteur + 1);
    const snap = {
      id: etat.id,
      numero: num,
      date: new Date().toISOString(),
      dateStr: new Date().toLocaleDateString("fr-FR"),
      client: etat.client ? { ...etat.client } : null,
      lignes: etat.lignes.map((l) => ({ ...l })),
      tva: etat.tva, echeancier: etat.echeancier ? JSON.parse(JSON.stringify(etat.echeancier)) : null,
      signature: etat.signature ? { ...etat.signature } : null,
      totalTTC: t.totalTTC,
      statut: statut || (etat.signature ? "signé" : "brouillon"),
      piece: etat.piece || null,
    };
    const liste = store.devis;
    const i = liste.findIndex((d) => d.id === snap.id);
    if (i >= 0) liste[i] = snap;
    else { store.compteur = Math.max(store.compteur, num); liste.unshift(snap); } // réserve le numéro dès la 1re sauvegarde
    store.devis = liste;
    // Sync cloud (si connecté) — sinon reste local (mode essai).
    if (window.BSAuth && window.BSAuth.isLoggedIn()) window.BSAuth.pushDoc(snap);
  }

  // Recharge un devis stocké dans l'état courant (par id, fallback numéro pour l'existant).
  function reprendreDevis(idOrNum) {
    const d = store.devis.find((x) => x.id === idOrNum) || store.devis.find((x) => x.numero === idOrNum);
    if (!d) return;
    etat.id = d.id || uuid();
    etat.lignes = d.lignes.map((l) => ({ ...l }));
    etat.tva = d.tva; etat.echeancier = d.echeancier;
    etat.signature = d.signature; etat.client = d.client;
    etat.numero = d.numero; etat._exporte = true; etat.piece = d.piece;
    etat._precisions = []; etat._notes = [];
    goto("devis");
  }

  // ---- Helpers DOM ----
  const $ = (id) => document.getElementById(id);
  const eur = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  // =========================================================
  // NAVIGATION
  // =========================================================
  function goto(ecran) {
    etat.ecran = ecran;
    $("screenSaisie").classList.toggle("hidden", ecran !== "saisie");
    $("screenDevis").classList.toggle("hidden", ecran !== "devis");
    $("screenApercu").classList.toggle("hidden", ecran !== "apercu");
    $("screenBiblio").classList.toggle("hidden", ecran !== "biblio");
    $("bottombar").classList.toggle("hidden", ecran === "saisie" || ecran === "biblio");
    if (ecran === "biblio") renderBibliotheque();
    if (ecran === "devis") { $("btnAction").textContent = "Aperçu du devis"; renderDevis(); renderEcheancier(); }
    if (ecran === "apercu") { $("btnAction").textContent = "Enregistrer / envoyer le PDF"; renderApercu(); }
    window.scrollTo(0, 0);
  }

  // =========================================================
  // SAISIE + GÉNÉRATION
  // =========================================================
  const txt = $("txtSaisie");
  txt.addEventListener("input", () => { $("btnGenerer").disabled = txt.value.trim().length < 4; });

  document.querySelectorAll(".chip").forEach((c) => {
    c.addEventListener("click", () => { txt.value = c.dataset.ex; txt.dispatchEvent(new Event("input")); txt.focus(); });
  });

  $("btnGenerer").addEventListener("click", genererDevis);

  function genererDevis() {
    const saisie = txt.value.trim();
    if (saisie.length < 4) return;

    // >>> ICI, plus tard : appel LLM (Claude) au lieu du parser local.
    //     Le parser renvoie déjà le bon format → le branchement sera transparent.
    const res = parserDevis(saisie, { estimerSurfaceMurs, ligneDevis });

    if (!res.suggestions.length) {
      toast("Je n'ai pas reconnu de prestation. Reformulez ou ajoutez à la main.");
      etat.lignes = [];
      etat.piece = null;
      goto("devis");
      return;
    }

    const tarifs = store.tarifs;
    etat.lignes = res.suggestions
      .map((s) => ligneDevis(s.cle, s.quantite, tarifs))
      .filter(Boolean);
    etat.piece = res.piece;
    etat.id = uuid();        // identité stable du nouveau devis
    etat.signature = null;   // nouveau devis → signature remise à zéro
    etat.echeancier = null;  // et échéancier réinitialisé au preset par défaut
    etat.client = null;      // et coordonnées client vidées (pas d'héritage du devis précédent)
    etat.numero = store.compteur + 1;  // numéro d'affichage prédit (réservé à la 1re sauvegarde)
    etat._exporte = false;
    etat._precisions = res.besoinPrecision || [];
    etat._notes = res.notes || [];
    goto("devis");
  }

  // =========================================================
  // DICTÉE VOCALE (Web Speech API)
  // =========================================================
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recog = null, recording = false;
  const micBtn = $("btnMic"), micHint = $("micHint");

  if (SR) {
    recog = new SR();
    recog.lang = "fr-FR"; recog.continuous = true; recog.interimResults = true;
    let base = "";
    recog.onresult = (e) => {
      let interim = "", finals = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals += r[0].transcript; else interim += r[0].transcript;
      }
      if (finals) base = (base + " " + finals).trim();
      txt.value = (base + " " + interim).trim();
      txt.dispatchEvent(new Event("input"));
    };
    recog.onerror = (e) => { micHint.textContent = e.error === "not-allowed" ? "Micro refusé — autorisez l'accès." : "Erreur micro, réessayez."; stopRec(); };
    recog.onend = () => { if (recording) { try { recog.start(); } catch {} } };
    micBtn.addEventListener("click", () => { recording ? stopRec() : startRec(base = txt.value.trim()); });
  } else {
    micHint.textContent = "Dictée non dispo sur ce navigateur — écrivez.";
    micBtn.style.opacity = ".4";
  }
  function startRec(existing) {
    try { recog.start(); recording = true; micBtn.classList.add("rec"); micBtn.textContent = "⏹"; micHint.textContent = "Je vous écoute…"; }
    catch { /* déjà démarré */ }
  }
  function stopRec() {
    recording = false; micBtn.classList.remove("rec"); micBtn.textContent = "🎤";
    micHint.textContent = "Touchez le micro pour dicter";
    try { recog.stop(); } catch {}
  }

  // =========================================================
  // RENDU DU DEVIS ÉDITABLE
  // =========================================================
  function renderDevis() {
    const c = $("lignesContainer");
    $("devisTitre").textContent = etat.piece ? `Devis — ${cap(etat.piece)}` : "Votre devis";
    const t = calculerTotaux(etat.lignes, { tva: etat.tva, remise: etat.remise });
    $("devisSousTitre").textContent = `${etat.lignes.length} prestation(s) · Total ${eur(t.totalTTC)} TTC`;

    // Précisions à demander
    const pc = $("precisions"); pc.innerHTML = "";
    (etat._precisions || []).forEach((q) => {
      const d = document.createElement("div"); d.className = "precision";
      d.innerHTML = `<div><b>À préciser</b><p>${esc(q)}</p></div>`; pc.appendChild(d);
    });

    // Lignes
    c.innerHTML = "";
    if (!etat.lignes.length) {
      c.innerHTML = `<div class="empty"><div class="big">📝</div>Aucune prestation.<br>Ajoutez-en une ci-dessous.</div>`;
    }
    etat.lignes.forEach((l, i) => {
      const row = document.createElement("div"); row.className = "ligne";
      row.innerHTML = `
        <div class="lib">${esc(l.label)}</div>
        <div class="tot">${eur(l.total)}</div>
        <div class="meta">
          <span class="tag ${l.source === "perso" ? "perso" : "marche"}">${l.source === "perso" ? "mon prix" : "prix marché"}</span>
          <span>${eur(l.prixUnitaire)}/${esc(l.unite)}</span>
        </div>
        <div class="qte-edit">
          <input type="text" inputmode="decimal" aria-label="Quantité (${esc(l.label)})" value="${l.quantite}" data-i="${i}" data-f="qte">
          <span class="u">${esc(l.unite)}</span>
          <input type="text" inputmode="decimal" aria-label="Prix unitaire (${esc(l.label)})" value="${l.prixUnitaire}" data-i="${i}" data-f="pu" style="width:70px">
          <span class="u">€/${esc(l.unite)}</span>
          <button class="del" data-i="${i}" title="Supprimer" aria-label="Supprimer ${esc(l.label)}">✕</button>
        </div>`;
      c.appendChild(row);
    });

    c.querySelectorAll("input[data-f]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const i = +e.target.dataset.i, f = e.target.dataset.f, v = window.num(e.target.value);
        if (f === "qte") etat.lignes[i].quantite = v;
        if (f === "pu") {
          etat.lignes[i].prixUnitaire = v; etat.lignes[i].source = "perso";
          const tagEl = e.target.closest(".ligne").querySelector(".tag");
          if (tagEl) { tagEl.className = "tag perso"; tagEl.textContent = "mon prix"; }
        }
        etat.lignes[i].total = Math.round(etat.lignes[i].quantite * etat.lignes[i].prixUnitaire * 100) / 100;
        invaliderSignature();
        renderTotaux(); renderEcheancier(); // rafraîchit aussi les montants d'échéances
        // MAJ total de la ligne sans re-render (garde le focus de l'input édité)
        e.target.closest(".ligne").querySelector(".tot").textContent = eur(etat.lignes[i].total);
      });
    });
    c.querySelectorAll(".del").forEach((b) => b.addEventListener("click", (e) => {
      etat.lignes.splice(+e.target.dataset.i, 1); invaliderSignature(); renderDevis(); renderEcheancier();
    }));

    renderTotaux();
  }

  function renderTotaux() {
    const t = calculerTotaux(etat.lignes, { tva: etat.tva, remise: etat.remise });
    const tvaOpts = TVA_OPTIONS.map((o) => `<option value="${o.taux}" ${o.taux === etat.tva ? "selected" : ""}>${o.label}</option>`).join("");
    $("totaux").innerHTML = `
      <div class="row"><span>Sous-total HT</span><span>${eur(t.sousTotalHT)}</span></div>
      <div class="row"><span>TVA</span><span><select id="selTva">${tvaOpts}</select></span></div>
      <div class="row"><span>Montant TVA</span><span>${eur(t.montantTVA)}</span></div>
      <div class="row ttc"><span>Total TTC</span><span>${eur(t.totalTTC)}</span></div>`;
    $("selTva").addEventListener("change", (e) => { etat.tva = parseFloat(e.target.value); invaliderSignature(); renderTotaux(); renderEcheancier(); });
    $("devisSousTitre").textContent = `${etat.lignes.length} prestation(s) · Total ${eur(t.totalTTC)} TTC`;
  }

  // Le montant a changé → une signature déjà apposée ne correspond plus : on l'invalide.
  function invaliderSignature() {
    if (etat.signature) { etat.signature = null; toast("Devis modifié — signature à refaire."); }
  }

  // ---- Échéancier / termes de paiement ----
  function renderEcheancier() {
    if (!etat.echeancier) etat.echeancier = { preset: "30-70", lignes: ECHEANCIERS["30-70"].lignes.map((l) => ({ ...l })) };
    const t = calculerTotaux(etat.lignes, { tva: etat.tva, remise: etat.remise });
    const ech = etat.echeancier;
    const sommePct = ech.lignes.reduce((s, l) => s + (Number(l.pct) || 0), 0);

    const presets = Object.entries(ECHEANCIERS).map(([id, p]) =>
      `<button class="ech-preset ${ech.preset === id ? "on" : ""}" data-preset="${id}">${p.nom}</button>`).join("");

    const lignes = ech.lignes.map((l, i) => `
      <div class="ech-line">
        <input class="el-lab" aria-label="Libellé échéance ${i + 1}" value="${esc(l.label)}" data-i="${i}" data-f="label" style="text-align:left;font-family:inherit">
        <input type="text" inputmode="decimal" aria-label="Pourcentage échéance ${i + 1}" value="${l.pct}" data-i="${i}" data-f="pct">
        <span class="el-mont">${eur((t.totalTTC * (Number(l.pct) || 0)) / 100)}</span>
      </div>`).join("");

    $("echeancierCard").innerHTML = `
      <div class="ech-head"><span class="t">Conditions de règlement</span></div>
      <div class="ech-presets">${presets}</div>
      ${lignes}
      <div class="ech-sum ${sommePct === 100 ? "ok" : "ko"}">Total échéances : ${sommePct} %${sommePct === 100 ? " ✓" : " (doit faire 100 %)"}</div>`;

    $("echeancierCard").querySelectorAll(".ech-preset").forEach((b) => b.addEventListener("click", (e) => {
      const id = e.target.dataset.preset;
      etat.echeancier = { preset: id, lignes: ECHEANCIERS[id].lignes.map((l) => ({ ...l })) };
      invaliderSignature();
      renderEcheancier();
    }));
    // MàJ en place SANS re-render (préserve le focus pendant la saisie du %) — bug M3
    $("echeancierCard").querySelectorAll("input[data-f]").forEach((inp) => inp.addEventListener("input", (e) => {
      const i = +e.target.dataset.i, f = e.target.dataset.f;
      ech.lignes[i][f] = f === "pct" ? window.num(e.target.value) : e.target.value;
      ech.preset = "perso";
      invaliderSignature();
      if (f === "pct") {
        e.target.closest(".ech-line").querySelector(".el-mont").textContent = eur((t.totalTTC * ech.lignes[i].pct) / 100);
        const somme = ech.lignes.reduce((s, l) => s + (Number(l.pct) || 0), 0);
        const sumEl = $("echeancierCard").querySelector(".ech-sum");
        sumEl.className = "ech-sum " + (somme === 100 ? "ok" : "ko");
        sumEl.textContent = `Total échéances : ${somme} %` + (somme === 100 ? " ✓" : " (doit faire 100 %)");
      }
    }));
  }

  // Somme des % de l'échéancier (pour garde-fou avant aperçu).
  function echeancierValide() {
    if (!etat.echeancier) return true;
    const s = etat.echeancier.lignes.reduce((a, l) => a + (Number(l.pct) || 0), 0);
    return Math.round(s) === 100;
  }

  // ---- Ajout de prestation ----
  $("btnAddLigne").addEventListener("click", () => {
    const list = $("addList"); list.innerHTML = "";
    Object.entries(CATALOGUE_PEINTURE).forEach(([cle, it]) => {
      const b = document.createElement("button");
      b.className = "add-ligne"; b.style.textAlign = "left"; b.style.marginBottom = "8px";
      b.innerHTML = `<b>${it.label}</b><br><span style="font-size:12px;color:#6B7A8C">${it.prixRef} €/${it.unite} · ${it.aide}</span>`;
      b.addEventListener("click", () => {
        etat.lignes.push(ligneDevis(cle, it.unite === "forfait" ? 1 : 0, store.tarifs));
        invaliderSignature();
        closeSheet("sheetAdd"); renderDevis(); renderEcheancier();
        toast("Prestation ajoutée — indiquez la quantité.");
      });
      list.appendChild(b);
    });
    openSheet("sheetAdd");
  });

  // =========================================================
  // APERÇU (rendu type devis pro)
  // =========================================================
  function renderApercu() {
    const p = store.profil;            // données saisies par l'artisan → À ÉCHAPPER (esc)
    const t = calculerTotaux(etat.lignes, { tva: etat.tva, remise: etat.remise });
    const num = "DEV-" + String(etat.numero || (store.compteur + 1)).padStart(4, "0");
    const date = new Date().toLocaleDateString("fr-FR");
    // Les labels viennent de notre catalogue (sûrs) ; les quantités/prix sont numériques.
    const rows = etat.lignes.map((l) => `
      <tr><td>${esc(l.label)}</td><td class="r">${l.quantite} ${esc(l.unite)}</td>
      <td class="r">${eur(l.prixUnitaire)}</td><td class="r">${eur(l.total)}</td></tr>`).join("");

    const initiale = (p.nom || "B").trim().charAt(0).toUpperCase();
    const coordsTel = [p.tel, p.email].filter(Boolean).map(esc).join(" · ");
    const cli = (etat.client && etat.client.nom)
      ? `Client : ${esc(etat.client.nom)}${etat.client.adresse ? " — " + esc(etat.client.adresse) : ""}`
      : `+ Ajouter les coordonnées du client`;

    $("apercuContent").innerHTML = `
      <div class="band"></div>
      <div class="inner">
        <div class="entete">
          <div>
            <div class="logo-box" id="apLogo">${esc(initiale)}</div>
            <div class="soc">${esc(p.nom) || "Votre entreprise"}</div>
            <div class="coords">${esc(p.contact) || ""}${p.forme ? "<br>" + esc(p.forme) : ""}${p.adresse ? "<br>" + esc(p.adresse) : ""}${coordsTel ? "<br>" + coordsTel : ""}${p.siret ? "<br>SIRET " + esc(p.siret) : ""}${p.tvaIntra ? " · TVA " + esc(p.tvaIntra) : ""}</div>
          </div>
          <div class="num"><div class="lab">DEVIS</div><div class="v">${num}<br>${date}</div></div>
        </div>
        <div class="cli" id="apCli" style="cursor:pointer">${cli}</div>
        <table>
          <thead><tr><th>Prestation</th><th class="r">Qté</th><th class="r">P.U. HT</th><th class="r">Total HT</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="tfin">
          <div>Total HT : ${eur(t.baseHT)}</div>
          <div>TVA (${(t.tauxTVA * 100).toLocaleString("fr-FR")} %) : ${eur(t.montantTVA)}</div>
          <div class="ttc">Total TTC : ${eur(t.totalTTC)}</div>
        </div>
        ${echBlock(t.totalTTC)}
        <div class="legal">
          ${(etat.client && (etat.client.debut || etat.client.duree)) ? `Travaux : ${etat.client.debut ? "début prévu " + esc(etat.client.debut) : ""}${etat.client.debut && etat.client.duree ? " · " : ""}${etat.client.duree ? "durée estimée " + esc(etat.client.duree) : ""}.<br>` : ""}
          Devis gratuit, valable 30 jours à compter du ${date}. Reçu avant l'exécution des travaux.
          ${etat.tva === 0 ? "TVA non applicable, art. 293 B du CGI. " : ""}${p.decennale ? "Assurance décennale : " + esc(p.decennale) + ". " : ""}
          <br>Contrat conclu hors établissement : délai de rétractation de 14 jours à compter de la signature. Pour l'exercer, notifiez votre décision${p.email ? " à " + esc(p.email) : " au professionnel"}${p.adresse ? " (" + esc(p.adresse) + ")" : ""} ; un formulaire type de rétractation est disponible sur simple demande. Les travaux ne débutent pas avant l'expiration de ce délai, sauf demande écrite de votre part.
          ${p.mediateur ? "<br>Médiation de la consommation : " + esc(p.mediateur) + "." : ""}
        </div>
        ${signBlock()}
      </div>
      ${etat.signature ? "" : `<button class="btn-sign-cta" id="btnSign">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        Faire signer le client
      </button>`}`;
    if (p.logo) window.setImg($("apLogo"), p.logo);
    const bs = $("btnSign"); if (bs) bs.addEventListener("click", openSignature);
    const ac = $("apCli"); if (ac) ac.addEventListener("click", openClient);
  }

  // ---- Coordonnées client ----
  function openClient() {
    const c = etat.client || {};
    $("clNom").value = c.nom || ""; $("clAdresse").value = c.adresse || "";
    $("clDebut").value = c.debut || ""; $("clDuree").value = c.duree || "";
    openSheet("sheetClient");
  }
  $("clSave").addEventListener("click", () => {
    etat.client = { nom: $("clNom").value.trim(), adresse: $("clAdresse").value.trim(), debut: $("clDebut").value.trim(), duree: $("clDuree").value.trim() };
    invaliderSignature();
    closeSheet("sheetClient");
    renderApercu();
    toast("Client enregistré ✓");
  });

  // Bloc échéancier dans l'aperçu (conditions de règlement + montants).
  function echBlock(totalTTC) {
    const ech = etat.echeancier;
    if (!ech || !ech.lignes.length) return "";
    if (ech.lignes.length === 1 && ech.lignes[0].pct >= 100) return ""; // comptant → inutile de détailler
    const rows = ech.lignes.map((l) =>
      `<div class="ae-row"><span>${esc(l.label)} (${l.pct} %)</span><span class="m">${eur((totalTTC * (Number(l.pct) || 0)) / 100)} TTC</span></div>`).join("");
    return `<div class="ap-ech"><div class="ae-t">Conditions de règlement</div>${rows}</div>`;
  }

  // Bloc signature dans le devis : signé (image + horodatage) ou à signer.
  function signBlock() {
    if (etat.signature) {
      return `<div class="ap-sign"><div class="col signed">
        <span class="lbl">Bon pour accord — signé par le client</span>
        <img src="${etat.signature.img}" alt="Signature">
        <span class="stamp">✓ Signé électroniquement le ${esc(etat.signature.dateStr)}</span>
      </div></div>`;
    }
    return `<div class="ap-sign">
      <div class="col"><span class="lbl">Date + « Bon pour accord »</span></div>
      <div class="col"><span class="lbl">Signature du client</span></div>
    </div>`;
  }

  // =========================================================
  // BARRE DU BAS
  // =========================================================
  $("btnRetour").addEventListener("click", () => {
    if (etat.ecran === "apercu") goto("devis");
    else if (etat.ecran === "devis") goto("saisie");
  });
  $("btnAction").addEventListener("click", () => {
    if (etat.ecran === "devis") {
      if (!etat.lignes.length) { toast("Ajoutez au moins une prestation."); return; }
      if (!echeancierValide()) { toast("Les échéances doivent totaliser 100 %."); return; }
      goto("apercu");
    } else if (etat.ecran === "apercu") {
      exportPDF();
    }
  });

  // Export PDF via l'impression navigateur (iOS/Android : "Enregistrer en PDF" / partager).
  function exportPDF() {
    // Bêta : login OPTIONNEL. L'artisan obtient son PDF sans compte (essai gratuit sans friction).
    // Le compte reste proposé (bouton « Mon compte » + bannière bibliothèque) pour la sauvegarde cloud.
    if (!store.profil.nom) {
      toast("Complétez d'abord le nom de votre entreprise.");
      $("btnProfil").click();
      return;
    }
    if (!etat.client || !etat.client.nom) {
      toast("Ajoutez d'abord les coordonnées du client (obligatoire).");
      openClient();
      return;
    }
    // Le numéro est réservé par sauverDevis dès la 1re sauvegarde (plus de double comptage).
    etat._exporte = true;
    sauverDevis("envoyé");
    setTimeout(() => window.print(), 60);
  }

  function partager() {
    const p = store.profil;
    const num = "DEV-" + String(etat.numero || (store.compteur + 1)).padStart(4, "0");
    const t = calculerTotaux(etat.lignes, { tva: etat.tva, remise: etat.remise });
    let texte = `DEVIS ${num} — ${p.nom || "BatiSpot Devis"}\n\n`;
    if (etat.client && etat.client.nom) texte += `Client : ${etat.client.nom}\n\n`;
    etat.lignes.forEach((l) => { texte += `• ${l.label} : ${l.quantite} ${l.unite} × ${eur(l.prixUnitaire)} = ${eur(l.total)}\n`; });
    texte += `\nTotal HT : ${eur(t.baseHT)}\nTVA : ${eur(t.montantTVA)}\nTOTAL TTC : ${eur(t.totalTTC)}`;
    if (etat.echeancier && etat.echeancier.lignes.length > 1) {
      texte += `\n\nRèglement :`;
      etat.echeancier.lignes.forEach((l) => { texte += `\n- ${l.label} (${l.pct} %) : ${eur((t.totalTTC * l.pct) / 100)} TTC`; });
    }
    texte += `\n\nDevis valable 30 jours.`;
    if (navigator.share) {
      navigator.share({ title: "Devis " + num, text: texte }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(texte);
      toast("Devis copié — collez-le dans un email ou WhatsApp.");
    }
  }

  // =========================================================
  // PROFIL
  // =========================================================
  // =========================================================
  // BIBLIOTHÈQUE
  // =========================================================
  $("btnBiblio").addEventListener("click", () => goto("biblio"));
  document.querySelector(".brand-logo").addEventListener("click", (e) => { e.preventDefault(); goto("saisie"); });

  function renderBibliotheque() {
    const liste = store.devis;
    const c = $("biblioListe");
    const logged = window.BSAuth && window.BSAuth.isLoggedIn();
    $("biblioSous").textContent = !liste.length
      ? "Vos devis seront enregistrés ici."
      : logged
        ? `${liste.length} devis synchronisé(s) dans votre compte.`
        : `${liste.length} devis enregistré(s) sur cet appareil.`;
    c.innerHTML = "";
    // Bannière : en mode essai (non connecté), inviter à sauvegarder en ligne.
    if (!logged && window.BSAuth && window.BSAuth.available) {
      const banner = document.createElement("button");
      banner.className = "cloud-banner";
      banner.innerHTML = `<span class="cb-ic">🔒</span><span>Vos devis sont sur cet appareil.<br><b>Connectez-vous</b> pour les sauvegarder en ligne — gratuit.</span>`;
      banner.addEventListener("click", () => openLogin());
      c.appendChild(banner);
    }
    if (!liste.length) {
      const empty = document.createElement("div");
      empty.className = "biblio-empty";
      empty.innerHTML = `<div class="big">📄</div>Aucun devis pour l'instant.<br>Créez votre premier devis.<br><button id="biblioNew">+ Nouveau devis</button>`;
      c.appendChild(empty);
      $("biblioNew").addEventListener("click", () => goto("saisie"));
      return;
    }
    const nouveau = document.createElement("button");
    nouveau.className = "add-ligne"; nouveau.textContent = "+ Nouveau devis";
    nouveau.addEventListener("click", () => goto("saisie"));
    c.appendChild(nouveau);
    const badge = { "brouillon": "brouillon", "envoyé": "envoye", "signé": "signe" };
    liste.forEach((d) => {
      const cli = d.client && d.client.nom ? d.client.nom : "Sans client";
      const st = d.statut || "brouillon";
      const card = document.createElement("div");
      card.className = "biblio-card";
      card.innerHTML = `
        <div class="bc-main">
          <div class="bc-num">DEV-${String(d.numero).padStart(4, "0")}</div>
          <div class="bc-cli">${esc(cli)}</div>
          <div class="bc-meta">${esc(d.dateStr || "")}${d.piece ? " · " + esc(d.piece) : ""}</div>
        </div>
        <div class="bc-right">
          <div class="bc-tot">${eur(d.totalTTC || 0)}</div>
          <span class="bc-badge ${badge[st] || "brouillon"}">${esc(st)}</span>
        </div>`;
      card.addEventListener("click", () => reprendreDevis(d.id || d.numero));
      c.appendChild(card);
    });
  }

  $("btnProfil").addEventListener("click", () => {
    const p = store.profil;
    $("pfNom").value = p.nom || ""; $("pfContact").value = p.contact || "";
    $("pfAdresse").value = p.adresse || ""; $("pfForme").value = p.forme || "";
    $("pfTel").value = p.tel || ""; $("pfEmail").value = p.email || ""; $("pfSiret").value = p.siret || "";
    $("pfTvaIntra").value = p.tvaIntra || ""; $("pfDecennale").value = p.decennale || "";
    $("pfMediateur").value = p.mediateur || "";
    $("pfComptable").value = p.comptable || "";
    $("pfColor").value = p.couleur || "#0F5132";
    openSheet("sheetProfil");
  });
  $("pfSave").addEventListener("click", () => {
    const prev = store.profil;
    store.profil = {
      ...prev,
      nom: $("pfNom").value, contact: $("pfContact").value,
      adresse: $("pfAdresse").value, forme: $("pfForme").value,
      tel: $("pfTel").value, email: $("pfEmail").value, siret: $("pfSiret").value,
      tvaIntra: $("pfTvaIntra").value, decennale: $("pfDecennale").value,
      mediateur: $("pfMediateur").value, comptable: $("pfComptable").value.trim(), couleur: $("pfColor").value,
    };
    window.setBrand($("pfColor").value);
    if (window.BSAuth && window.BSAuth.isLoggedIn()) window.BSAuth.pushProfil();
    closeSheet("sheetProfil"); toast("Profil enregistré ✓");
  });

  // =========================================================
  // COMPTE / CONNEXION (lien magique)
  // =========================================================
  let _loginSent = "";
  function openLogin(context) { renderLogin(context); openSheet("sheetLogin"); }

  function renderLogin(context) {
    const body = $("loginBody");
    const user = window.BSAuth && window.BSAuth.user();
    if (user) {
      body.innerHTML = `
        <h3>Mon compte</h3>
        <p class="sub">Connecté : <b>${esc(user.email || "")}</b><br>Vos devis sont sauvegardés en ligne et vous les retrouvez sur tous vos appareils.</p>
        <button class="save" id="lgOut" style="background:#fff;color:var(--brand);border:1.5px solid var(--brand)">Se déconnecter</button>`;
      $("lgOut").addEventListener("click", () => {
        window.BSAuth.signOut().then(() => { renderLogin(); toast("Déconnecté."); });
      });
      return;
    }
    if (_loginSent) {
      body.innerHTML = `
        <h3>Vérifiez vos emails</h3>
        <p class="sub">On a envoyé un lien <b>et un code</b> à <b>${esc(_loginSent)}</b>.<br>Cliquez le lien, ou entrez le code à 6 chiffres ci-dessous (recommandé sur iPhone).</p>
        <div class="field"><label for="lgCode">Code reçu par email</label><input id="lgCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" style="letter-spacing:6px;font-size:20px;text-align:center"></div>
        <button class="save" id="lgVerify">Me connecter</button>
        <div style="display:flex;gap:16px;justify-content:center;margin-top:12px">
          <button id="lgResend" style="background:none;border:none;color:var(--brand);font:inherit;cursor:pointer;text-decoration:underline">Renvoyer</button>
          <button id="lgChange" style="background:none;border:none;color:#6B7A8C;font:inherit;cursor:pointer;text-decoration:underline">Changer d'email</button>
        </div>`;
      const verify = () => {
        const code = $("lgCode").value.trim();
        if (!/^\d{6}$/.test(code)) { $("lgCode").focus(); $("lgCode").style.borderColor = "#E4572E"; return; }
        const b = $("lgVerify"); b.disabled = true; b.textContent = "Connexion…";
        window.BSAuth.verifyOtp(_loginSent, code).then(() => {
          closeSheet("sheetLogin"); _loginSent = ""; toast("Connecté ✓");
        }).catch(() => { b.disabled = false; b.textContent = "Me connecter"; toast("Code invalide ou expiré."); });
      };
      $("lgVerify").addEventListener("click", verify);
      $("lgCode").addEventListener("keydown", (e) => { if (e.key === "Enter") verify(); });
      $("lgResend").addEventListener("click", () => {
        window.BSAuth.sendMagicLink(_loginSent).then(() => toast("Lien renvoyé ✓")).catch(() => toast("Patientez 1 min avant de renvoyer."));
      });
      $("lgChange").addEventListener("click", () => { _loginSent = ""; renderLogin(context); });
      return;
    }
    const titre = context === "send" ? "Enregistrez et envoyez votre devis" : "Créez votre compte gratuit";
    const sousTitre = context === "send"
      ? "Votre devis est prêt. Créez un compte gratuit pour l'enregistrer en ligne et l'envoyer à votre client — c'est immédiat."
      : "Un compte gratuit pour sauvegarder vos devis en ligne et les retrouver partout.";
    body.innerHTML = `
      <h3>${titre}</h3>
      <p class="sub">${sousTitre}</p>
      <div class="field"><label for="lgEmail">Votre email</label><input id="lgEmail" type="email" inputmode="email" autocomplete="email" placeholder="vous@exemple.fr"></div>
      <button class="save" id="lgSend">Recevoir mon lien de connexion</button>
      <p class="sub" style="margin-top:10px;font-size:12px">Sans mot de passe : on vous envoie un lien à cliquer. Gratuit, aucune carte demandée.</p>`;
    const send = () => {
      const email = $("lgEmail").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $("lgEmail").focus(); $("lgEmail").style.borderColor = "#E4572E"; return; }
      const btn = $("lgSend"); btn.disabled = true; btn.textContent = "Envoi…";
      window.BSAuth.sendMagicLink(email).then(() => {
        _loginSent = email; renderLogin(context);
      }).catch((e) => {
        btn.disabled = false; btn.textContent = "Recevoir mon lien de connexion";
        toast(e && /rate/i.test(e.message || "") ? "Trop d'essais, réessayez dans 1 min." : "Envoi impossible, vérifiez l'email.");
      });
    };
    $("lgSend").addEventListener("click", send);
    $("lgEmail").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  }

  function updateAccountBtn(user) {
    const b = $("btnAccount"); if (!b) return;
    b.style.color = user ? "var(--brand)" : "";
    b.title = user ? ("Compte : " + (user.email || "")) : "Mon compte";
  }
  $("btnAccount").addEventListener("click", () => openLogin());
  if (window.BSAuth) window.BSAuth.onChange((user) => { updateAccountBtn(user); if ($("sheetLogin").classList.contains("open")) renderLogin(); });

  // Fusion cloud terminée (après connexion) → rafraîchir la bibliothèque + feedback.
  window.__onCloudSynced = () => {
    if (etat.ecran === "biblio") renderBibliotheque();
    toast("Devis synchronisés ✓");
  };

  // ---- Partager l'app ----
  function shareApp() {
    const url = "https://devis.batispot.pro";
    const data = {
      title: "BatiSpot Devis",
      text: "Je fais mes devis en parlant, en 30 secondes — essaie, c'est gratuit :",
      url,
    };
    if (navigator.share) {
      navigator.share(data).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(data.text + " " + url).then(() => toast("Lien copié — collez-le dans un message."), () => toast(url));
    } else {
      toast(url);
    }
  }
  $("btnShare").addEventListener("click", shareApp);

  // =========================================================
  // TARIFS PERSO
  // =========================================================
  $("btnTarifs").addEventListener("click", () => {
    const tf = store.tarifs;
    const list = $("tarifsList"); list.innerHTML = "";
    Object.entries(CATALOGUE_PEINTURE).forEach(([cle, it]) => {
      const val = tf[cle] != null ? tf[cle] : "";
      const row = document.createElement("div"); row.className = "tarif-row";
      row.innerHTML = `<div><div class="lbl">${it.label}</div><div class="u2">marché : ${it.prixRef} €/${it.unite}</div></div>
        <input type="number" inputmode="decimal" placeholder="${it.prixRef}" value="${val}" data-cle="${cle}">
        <div class="u2">€/${it.unite}</div>`;
      list.appendChild(row);
    });
    openSheet("sheetTarifs");
  });
  $("tfSave").addEventListener("click", () => {
    const tf = {};
    $("tarifsList").querySelectorAll("input[data-cle]").forEach((inp) => {
      const v = parseFloat(inp.value);
      if (!isNaN(v) && v > 0) tf[inp.dataset.cle] = v;
    });
    store.tarifs = tf;
    closeSheet("sheetTarifs"); toast("Vos tarifs sont enregistrés ✓");
  });

  // =========================================================
  // SIGNATURE ÉLECTRONIQUE
  // =========================================================
  let pad = null;
  function openSignature() {
    openSheet("sheetSign");
    // init le pad après ouverture (canvas doit être visible pour la taille)
    setTimeout(() => {
      if (!pad) pad = window.createSignaturePad($("signCanvas"));
      else pad.resize();
      pad.clear();
      $("signPh").classList.remove("gone");
    }, 60);
  }
  $("signClear").addEventListener("click", () => { if (pad) pad.clear(); $("signPh").classList.remove("gone"); });
  $("signCanvas").addEventListener("pointerdown", () => $("signPh").classList.add("gone"));
  $("signCanvas").addEventListener("touchstart", () => $("signPh").classList.add("gone"), { passive: true });
  $("signValid").addEventListener("click", () => {
    if (!pad || pad.isEmpty()) { toast("Le client doit signer d'abord."); return; }
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR") + " à " + now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    etat.signature = { img: pad.toDataURL(), dateStr };
    sauverDevis("signé");
    closeSheet("sheetSign");
    renderApercu();
    toast("Devis signé ✓");
  });

  // =========================================================
  // SHEETS
  // =========================================================
  function openSheet(id) { $(id).classList.add("open"); }
  function closeSheet(id) { $(id).classList.remove("open"); }
  document.querySelectorAll(".sheet").forEach((s) => {
    s.addEventListener("click", (e) => { if (e.target === s) s.classList.remove("open"); });
  });

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // ---- Service worker (PWA offline) — désactivé en dev local (évite le cache) ----
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  if ("serviceWorker" in navigator && !isLocal && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  // Après l'onboarding (wizard terminé) → écran de saisie.
  window.__afterOnboard = () => goto("saisie");

  // Démarrage
  goto("saisie");
})();
