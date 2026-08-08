/*
 * PARSER LANGAGE NATUREL → LIGNES DE DEVIS (métier couverture / toiture)
 * -------------------------------------------------------------------
 * Déterministe, à base de mots-clés + comptage d'unités / surfaces.
 * Même format de sortie que parserDevis → le reste de l'app ne bouge pas.
 * Réutilise window.extraireNombre + window.extraireSurfaces (parser.js).
 *
 * q: "surface" → quantité = m² détectés | "compte" → nb via motCompte | sinon 1 (ml/forfait).
 * Mots-clés en minuscules SANS accent : la normalisation NFD s'occupe des accents.
 */
(function () {
  "use strict";

  const REGLES_COUV = [
    // --- Dépose & structure de couverture ---
    { cles: ["depose", "deposer", "enlever l'ancienne couverture", "retirer les tuiles", "demontage toiture", "depose couverture", "arracher la toiture"], action: "depose_couverture", q: "surface" },
    { cles: ["tuiles", "toiture tuile", "couverture tuile", "refection tuile", "tuile mecanique", "tuile plate", "tuile terre cuite"], action: "refection_tuiles", q: "surface" },
    { cles: ["ardoise", "ardoises"],                                                    action: "refection_ardoises", q: "surface" },
    { cles: ["couverture zinc", "toiture zinc", "toit en zinc", "toiture en zinc", "joint debout", "zinc a joint"], action: "couverture_zinc", q: "surface" },
    { cles: ["bac acier", "bac-acier", "bacacier", "tole ondulee", "tole nervuree", "toiture tole"], action: "couverture_bac_acier", q: "surface" },
    { cles: ["epdm", "toit plat", "toiture plate", "membrane", "etancheite toit", "toiture terrasse"], action: "toiture_epdm", q: "surface" },
    { cles: ["ecran sous-toiture", "ecran sous toiture", "ecran de sous-toiture", "ecran sous", "ecran hpv"], action: "ecran_sous_toiture", q: "surface" },
    { cles: ["liteau", "liteaux", "liteaunage", "litelage", "voligeage", "volige", "voliges", "lattage"], action: "liteaux_voligeage", q: "surface" },

    // --- Zinguerie linéaire ---
    { cles: ["faitage", "faitiere", "faitieres", "faitage a sec"],                      action: "faitage" },
    { cles: ["aretier", "aretiers"],                                                    action: "aretier" },
    { cles: ["noue", "noues", "noue de toiture", "noue metallique"],                    action: "noue" },
    { cles: ["solin", "solins", "solin d'etancheite", "bande de solin", "solin plomb"], action: "solin" },
    { cles: ["rive de toit", "rive de toiture", "rives de toiture", "tuile de rive", "planche de rive", "bandeau de rive"], action: "rive" },

    // --- Évacuation des eaux pluviales ---
    { cles: ["gouttiere", "gouttieres", "goutiere", "gouttiere pendante"],              action: "pose_gouttiere" },
    { cles: ["cheneau", "cheneaux", "chenaux"],                                         action: "pose_cheneau" },
    { cles: ["descente", "descentes", "descente d'eau", "tuyau de descente", "eau pluviale", "evacuation eaux", "gargouille"], action: "descente_ep" },

    // --- Fenêtres & sorties de toit ---
    { cles: ["velux", "fenetre de toit", "fenetres de toit"],                           action: "pose_velux", q: "compte", motCompte: "velux" },
    { cles: ["chassis de toit", "tabatiere", "lucarne", "chassis de toiture"],          action: "pose_chassis", q: "compte", motCompte: "chassis" },
    { cles: ["sortie de toit", "chatiere", "fourreau", "closoir", "chapeau de ventilation", "tuile a douille"], action: "sortie_toit", q: "compte", motCompte: "sortie" },

    // --- Entretien & traitement ---
    { cles: ["demoussage", "demousser", "anti-mousse", "antimousse", "enlever la mousse", "traitement mousse"], action: "demoussage", q: "surface" },
    { cles: ["hydrofuge", "hydrofugation", "impermeabilisation", "impermeabilisant"],   action: "hydrofuge", q: "surface" },
    { cles: ["nettoyage", "nettoyer", "lavage toiture", "karcher", "haute pression"],   action: "nettoyage_toiture", q: "surface" },

    // --- Réparation & étanchéité ---
    { cles: ["fuite", "infiltration", "recherche de fuite", "reparer une fuite", "tuile cassee", "tuiles cassees", "tuile fissuree", "urgence toiture"], action: "reparation_fuite" },

    // --- Isolation ---
    { cles: ["isolation", "isoler", "combles", "laine de verre", "laine de roche", "sarking", "sous rampant", "rampants"], action: "isolation_combles", q: "surface" },
    { cles: ["pare-vapeur", "pare vapeur", "frein-vapeur", "frein vapeur", "membrane pare-vapeur"], action: "pare_vapeur", q: "surface" },

    // --- Sécurité & accès ---
    { cles: ["ligne de vie", "harnais", "point d'ancrage", "securite antichute", "dispositif antichute", "antichute"], action: "ligne_vie" },
    { cles: ["echafaudage", "echafaudages", "echafaud"],                                action: "echafaudage" },

    // --- Main d'œuvre explicite ---
    { cles: ["main d'oeuvre", "main d oeuvre", "couvreur", "taux horaire", "heures couvreur", "heure de couvreur"], action: "main_oeuvre_couv", q: "compte", motCompte: "heure" },
  ];

  function qte(txt, r, surface) {
    if (r.q === "compte") return window.extraireNombre ? window.extraireNombre(txt, r.motCompte) : 1;
    if (r.q === "surface") return surface != null ? surface : 0;
    return 1; // ml / forfait par défaut (l'artisan ajuste)
  }

  function parserDevisCouverture(texteBrut) {
    var txt = (texteBrut || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    var suggestions = [];
    var besoinPrecision = [];
    var notes = [];
    var deja = {};

    // Surface de toiture (m² / m2 / mètres carrés) — jamais "m" seul.
    var surfaces = window.extraireSurfaces ? window.extraireSurfaces(txt) : [];
    var surface = surfaces.length ? surfaces[0] : null;
    if (surfaces.length > 1) {
      besoinPrecision.push("Plusieurs surfaces détectées (" + surfaces.join(", ") + " m²). J'ai chiffré sur " + surfaces[0] + " m² — vérifiez les autres à la main.");
    }

    REGLES_COUV.forEach(function (r) {
      var match = r.cles.some(function (k) { return window.contientMot ? window.contientMot(txt, k) : txt.indexOf(k.normalize("NFD").replace(/[̀-ͯ]/g, "")) !== -1; });
      if (!match) return;
      if (deja[r.action]) return;
      deja[r.action] = true;
      var q = qte(txt, r, surface);
      if (r.q === "surface" && !q) besoinPrecision.push("Quelle surface (m²) pour « " + r.action + " » ?");
      suggestions.push({ cle: r.action, quantite: q, raison: "détecté" });
    });

    if (suggestions.length && !deja["deplacement"]) {
      suggestions.push({ cle: "deplacement", quantite: 1, raison: "recommandé (frais de déplacement)" });
    }

    if (!suggestions.length) {
      besoinPrecision.push("Je n'ai pas reconnu de prestation — ajoutez-la avec « + Ajouter une prestation » (tuiles, ardoise, gouttière, velux, démoussage…).");
    }

    return { piece: null, surfaceSol: surface, surfaceMurs: null, suggestions: suggestions, besoinPrecision: besoinPrecision, notes: notes };
  }

  if (typeof window !== "undefined") window.parserDevisCouverture = parserDevisCouverture;
})();
