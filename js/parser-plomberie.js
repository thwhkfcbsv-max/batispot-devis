/*
 * PARSER LANGAGE NATUREL → LIGNES DE DEVIS (métier plomberie/chauffage)
 * -------------------------------------------------------------------
 * Déterministe, à base de mots-clés + comptage d'unités (pas de surface).
 * Même format de sortie que parserDevis (peinture) → le reste de l'app ne bouge pas.
 * Réutilise window.extraireNombre (défini dans parser.js).
 */
(function () {
  "use strict";

  // Chaque règle : mots-clés → clé du catalogue plomberie. compte=true → quantité = nb d'unités cité.
  const REGLES_PLOMB = [
    { cles: ["wc", "toilette", "toilettes", "cuvette"],                 action: "pose_wc",          compte: true, motCompte: "wc" },
    { cles: ["lavabo", "vasque", "evier", "évier", "lave-main", "lave main"], action: "pose_lavabo", compte: true, motCompte: "lavabo" },
    { cles: ["baignoire"],                                              action: "pose_baignoire",   compte: true, motCompte: "baignoire" },
    { cles: ["douche", "receveur"],                                     action: "pose_douche",      compte: true, motCompte: "douche" },
    { cles: ["chauffe-eau", "chauffe eau", "cumulus", "ballon", "chauffe-eaux"], action: "chauffe_eau", compte: true, motCompte: "chauffe" },
    { cles: ["radiateur", "radiateurs"],                                action: "pose_radiateur",   compte: true, motCompte: "radiateur" },
    { cles: ["mitigeur", "robinet", "robinetterie", "robinets", "mitigeurs"], action: "pose_mitigeur", compte: true, motCompte: "mitigeur", altCompte: "robinet" },
    { cles: ["point d'eau", "point d eau", "arrivée d'eau", "arrivee d eau", "alimentation eau", "évacuation", "evacuation"], action: "point_eau", compte: true, motCompte: "point" },
    { cles: ["déboucher", "deboucher", "débouchage", "debouchage", "bouché", "bouche", "bouchée", "engorg"], action: "debouchage" },
    { cles: ["fuite", "recherche de fuite", "détection", "detection"],  action: "recherche_fuite" },
    { cles: ["déposer", "deposer", "dépose", "depose", "enlever", "retirer l'ancien", "ancien wc", "ancien lavabo"], action: "depose_appareil", compte: true, motCompte: "wc" },
  ];

  function count(txt, r) {
    if (!r.compte) return 1;
    var n = window.extraireNombre ? window.extraireNombre(txt, r.motCompte) : 1;
    if ((n === 1) && r.altCompte && window.extraireNombre) {
      var n2 = window.extraireNombre(txt, r.altCompte);
      if (n2 > 1) n = n2;
    }
    return n;
  }

  function parserDevisPlomberie(texteBrut) {
    var txt = (texteBrut || "").toLowerCase();
    var suggestions = [];
    var besoinPrecision = [];
    var notes = [];
    var deja = {};

    // "thermostatique" → mitigeur thermostatique (surcoût) plutôt que mitigeur simple
    var thermo = /thermostatiqu/.test(txt);

    REGLES_PLOMB.forEach(function (r) {
      var match = r.cles.some(function (k) { return txt.indexOf(k) !== -1; });
      if (!match) return;
      var action = r.action;
      if (action === "pose_mitigeur" && thermo) action = "pose_mitigeur_th";
      if (deja[action]) return;
      deja[action] = true;
      suggestions.push({ cle: action, quantite: count(txt, r), raison: "détecté" });
    });

    // Déplacement suggéré si au moins une intervention (bonne pratique, ajustable/supprimable)
    if (suggestions.length && !deja["deplacement"]) {
      suggestions.push({ cle: "deplacement", quantite: 1, raison: "recommandé (frais de déplacement)" });
    }

    if (!suggestions.length) {
      besoinPrecision.push("Je n'ai pas reconnu de prestation — ajoutez-la avec « + Ajouter une prestation » (WC, lavabo, chauffe-eau, radiateur…).");
    }

    return { piece: null, surfaceSol: null, surfaceMurs: null, suggestions: suggestions, besoinPrecision: besoinPrecision, notes: notes };
  }

  if (typeof window !== "undefined") window.parserDevisPlomberie = parserDevisPlomberie;
})();
