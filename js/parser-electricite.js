/*
 * PARSER LANGAGE NATUREL → LIGNES DE DEVIS (métier électricité)
 * -------------------------------------------------------------------
 * Déterministe, à base de mots-clés + comptage d'unités.
 * Même format de sortie que parserDevis → le reste de l'app ne bouge pas.
 * Réutilise window.extraireNombre (défini dans parser.js).
 */
(function () {
  "use strict";

  const REGLES_ELEC = [
    { cles: ["tableau électrique", "tableau electrique", "tableau", "coffret"],       action: "tableau_electrique", compte: true, motCompte: "tableau" },
    { cles: ["prise", "prises"],                                                       action: "pose_prise",         compte: true, motCompte: "prise" },
    { cles: ["interrupteur", "va-et-vient", "va et vient", "va-et-vients"],            action: "pose_interrupteur",  compte: true, motCompte: "interrupteur" },
    { cles: ["spot", "spots", "encastré", "encastre"],                                 action: "pose_spot",          compte: true, motCompte: "spot" },
    { cles: ["luminaire", "lustre", "suspension", "plafonnier"],                       action: "pose_luminaire",     compte: true, motCompte: "luminaire" },
    { cles: ["point lumineux", "applique", "appliques"],                               action: "pose_point_lumineux",compte: true, motCompte: "point" },
    { cles: ["disjoncteur", "différentiel", "differentiel", "protection"],             action: "pose_disjoncteur",   compte: true, motCompte: "disjoncteur" },
    { cles: ["tirage", "câble", "cable", "circuit", "ligne dédiée", "ligne dediee", "saignée", "saignee"], action: "tirage_cable", compte: true, motCompte: "circuit" },
    { cles: ["mise à la terre", "mise a la terre", "prise de terre", "terre"],         action: "mise_terre" },
    { cles: ["vmc", "ventilation"],                                                    action: "pose_vmc",           compte: true, motCompte: "vmc" },
    { cles: ["borne", "recharge", "voiture électrique", "voiture electrique", "véhicule", "vehicule"], action: "borne_recharge", compte: true, motCompte: "borne" },
    { cles: ["déposer", "deposer", "dépose", "depose", "enlever l'ancien", "ancien tableau"], action: "depose_appareil" },
  ];

  function count(txt, r) {
    if (!r.compte) return 1;
    return window.extraireNombre ? window.extraireNombre(txt, r.motCompte) : 1;
  }

  function parserDevisElectricite(texteBrut) {
    var txt = (texteBrut || "").toLowerCase();
    var suggestions = [];
    var besoinPrecision = [];
    var notes = [];
    var deja = {};

    REGLES_ELEC.forEach(function (r) {
      var match = r.cles.some(function (k) { return txt.indexOf(k) !== -1; });
      if (!match) return;
      if (deja[r.action]) return;
      deja[r.action] = true;
      suggestions.push({ cle: r.action, quantite: count(txt, r), raison: "détecté" });
    });

    if (suggestions.length && !deja["deplacement"]) {
      suggestions.push({ cle: "deplacement", quantite: 1, raison: "recommandé (frais de déplacement)" });
    }

    if (!suggestions.length) {
      besoinPrecision.push("Je n'ai pas reconnu de prestation — ajoutez-la avec « + Ajouter une prestation » (prise, interrupteur, tableau, spot…).");
    }

    return { piece: null, surfaceSol: null, surfaceMurs: null, suggestions: suggestions, besoinPrecision: besoinPrecision, notes: notes };
  }

  if (typeof window !== "undefined") window.parserDevisElectricite = parserDevisElectricite;
})();
