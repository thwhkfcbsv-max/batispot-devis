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
    // --- Prestations spécifiques (placées AVANT les règles générales qu'elles remplacent, cf. SUPPRESS) ---
    // Lot SANITAIRE (compléments)
    { cles: ["wc suspendu", "bati-support", "bati support", "geberit", "cuvette suspendue"], action: "pose_wc_suspendu", compte: true, motCompte: "wc" },
    { cles: ["meuble vasque", "meuble sous-vasque", "meuble sdb", "sous-vasque"], action: "pose_meuble_vasque", compte: true, motCompte: "meuble" },
    { cles: ["evier", "evier cuisine", "evier de cuisine", "sous plan"], action: "pose_evier", compte: true, motCompte: "evier" },
    { cles: ["douche italienne", "douche a l'italienne", "receveur extra-plat", "a carreler", "plain-pied", "siphon de sol"], action: "pose_douche_italienne" },
    { cles: ["colonne de douche", "ensemble douche", "barre de douche", "douchette"], action: "pose_colonne_douche", compte: true, motCompte: "colonne" },
    { cles: ["paroi douche", "paroi de douche", "pare-douche", "pare-baignoire", "cabine"], action: "pose_paroi_douche", compte: true, motCompte: "paroi" },
    { cles: ["adoucisseur", "anti-calcaire", "traitement eau"],         action: "pose_adoucisseur" },
    { cles: ["groupe de securite", "soupape", "securite chauffe-eau"],  action: "pose_groupe_securite" },
    { cles: ["raccordement lave-linge", "lave-linge", "lave-vaisselle", "arrivee machine", "robinet machine"], action: "raccord_electromenager" },
    // Lot CHAUFFAGE
    { cles: ["thermodynamique", "chauffe-eau thermo", "chauffe eau thermo", "ballon thermo"], action: "pose_ballon_thermo" },
    { cles: ["seche-serviette", "seche serviette", "radiateur salle de bain", "porte-serviette"], action: "pose_seche_serviettes", compte: true, motCompte: "serviette" },
    { cles: ["entretien chaudiere", "revision", "maintenance chaudiere"], action: "entretien_chaudiere" },
    { cles: ["chaudiere", "gaz", "condensation", "chaudiere murale"],    action: "pose_chaudiere_gaz" },
    { cles: ["pompe a chaleur", "pac", "air eau", "air/eau", "aerothermie"], action: "pose_pac_air_eau" },
    { cles: ["clim reversible", "air air", "air/air", "split", "multisplit", "monosplit", "climatisation"], action: "pose_pac_air_air" },
    { cles: ["plancher chauffant", "pcrbt", "dalle chauffante", "plancher hydraulique"], action: "pose_plancher_chauffant" },
    { cles: ["desembouage", "desembouer", "curage circuit", "boues"],    action: "desembouage" },
    { cles: ["ramonage", "conduit", "tubage"],                          action: "ramonage" },
    // Lot RÉSEAU (placé AVANT point_eau + evacuation, cf. SUPPRESS)
    { cles: ["deplacer arrivee", "deplacer evacuation", "modifier reseau"], action: "deplacement_reseau" },
    { cles: ["tuyauterie", "alimentation", "cuivre", "multicouche", "canalisation eau"], action: "reseau_alimentation" },
    { cles: ["evacuation", "eaux usees", "pvc", "descente", "colonne eu"], action: "reseau_evacuation" },
    { cles: ["vmc", "ventilation", "simple flux", "double flux", "extracteur"], action: "pose_vmc" },

    // --- Règles générales (historiques) ---
    { cles: ["wc", "toilette", "toilettes", "cuvette"],                 action: "pose_wc",          compte: true, motCompte: "wc" },
    { cles: ["lavabo", "vasque", "lave-main", "lave main"],             action: "pose_lavabo",      compte: true, motCompte: "lavabo" },
    { cles: ["baignoire"],                                              action: "pose_baignoire",   compte: true, motCompte: "baignoire" },
    { cles: ["douche", "receveur"],                                     action: "pose_douche",      compte: true, motCompte: "douche" },
    { cles: ["chauffe-eau", "chauffe eau", "cumulus", "ballon", "chauffe-eaux"], action: "chauffe_eau", compte: true, motCompte: "chauffe" },
    { cles: ["radiateur", "radiateurs"],                                action: "pose_radiateur",   compte: true, motCompte: "radiateur" },
    { cles: ["mitigeur", "robinet", "robinetterie", "robinets", "mitigeurs"], action: "pose_mitigeur", compte: true, motCompte: "mitigeur", altCompte: "robinet" },
    { cles: ["point d'eau", "point d eau", "arrivée d'eau", "arrivee d eau", "alimentation eau", "évacuation", "evacuation"], action: "point_eau", compte: true, motCompte: "point" },
    { cles: ["déboucher", "deboucher", "débouchage", "debouchage", "bouché", "bouche", "bouchée", "engorg"], action: "debouchage" },
    { cles: ["fuite", "recherche de fuite", "détection", "detection"],  action: "recherche_fuite" },
    { cles: ["déposer", "deposer", "dépose", "depose", "enlever", "retirer l'ancien", "ancien wc", "ancien lavabo"], action: "depose_appareil", compte: true, motCompte: "wc" },
    // Thermostat en DERNIER : "mitigeur thermostatique" reste géré par pose_mitigeur → pose_mitigeur_th (cf. SUPPRESS)
    { cles: ["thermostat", "regulation", "robinet thermostatique", "tete thermostatique", "vanne"], action: "pose_thermostat", compte: true, motCompte: "thermostat" },
  ];

  // Suppression : ne pas ajouter l'action (clé) si une action plus spécifique déjà détectée est présente.
  // Évite les doublons quand une prestation spécifique et une règle générale matchent la même phrase.
  const SUPPRESS = {
    pose_wc:            ["pose_wc_suspendu"],
    pose_lavabo:        ["pose_meuble_vasque"],
    pose_douche:        ["pose_douche_italienne", "pose_colonne_douche", "pose_paroi_douche"],
    chauffe_eau:        ["pose_ballon_thermo"],
    pose_chaudiere_gaz: ["entretien_chaudiere"],
    reseau_evacuation:  ["deplacement_reseau"],
    point_eau:          ["reseau_alimentation", "reseau_evacuation", "deplacement_reseau"],
    pose_thermostat:    ["pose_mitigeur", "pose_mitigeur_th"],
  };

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
    var txt = (texteBrut || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    var suggestions = [];
    var besoinPrecision = [];
    var notes = [];
    var deja = {};

    // "thermostatique" → mitigeur thermostatique (surcoût) plutôt que mitigeur simple
    var thermo = /thermostatiqu/.test(txt);

    REGLES_PLOMB.forEach(function (r) {
      var match = r.cles.some(function (k) { return txt.indexOf(k.normalize("NFD").replace(/[̀-ͯ]/g, "")) !== -1; });
      if (!match) return;
      var action = r.action;
      if (action === "pose_mitigeur" && thermo) action = "pose_mitigeur_th";
      if (SUPPRESS[action] && SUPPRESS[action].some(function (a) { return deja[a]; })) return;
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
