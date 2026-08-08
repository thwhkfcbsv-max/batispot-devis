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
    { cles: ["tableau électrique", "tableau electrique", "tableau", "coffret", "tgbt", "armoire electrique", "tableau de repartition"], action: "tableau_electrique", compte: true, motCompte: "tableau" },
    { cles: ["prise", "prises", "prise de courant", "pc", "prise 16a", "prise 2p+t"],   action: "pose_prise",         compte: true, motCompte: "prise" },
    { cles: ["interrupteur", "va-et-vient", "va et vient", "va-et-vients", "inter", "bouton poussoir", "permutateur"], action: "pose_interrupteur",  compte: true, motCompte: "interrupteur" },
    { cles: ["spot", "spots", "encastré", "encastre", "downlight", "spot led"],         action: "pose_spot",          compte: true, motCompte: "spot" },
    { cles: ["luminaire", "lustre", "suspension", "plafonnier", "reglette", "dalle led"], action: "pose_luminaire",   compte: true, motCompte: "luminaire" },
    { cles: ["point lumineux", "applique", "appliques", "point d'eclairage", "sortie dcl", "hublot"], action: "pose_point_lumineux",compte: true, motCompte: "point" },
    { cles: ["disjoncteur", "différentiel", "differentiel", "protection", "interrupteur differentiel", "id", "ddr", "30ma", "module"], action: "pose_disjoncteur",   compte: true, motCompte: "disjoncteur" },
    { cles: ["tirage", "câble", "cable", "circuit", "ligne dédiée", "ligne dediee"],    action: "tirage_cable",       compte: true, motCompte: "circuit" },
    { cles: ["mise à la terre", "mise a la terre", "prise de terre", "terre"],         action: "mise_terre" },
    { cles: ["vmc", "ventilation"],                                                    action: "pose_vmc",           compte: true, motCompte: "vmc" },
    { cles: ["borne", "recharge", "voiture électrique", "voiture electrique", "véhicule", "vehicule", "wallbox", "irve", "prise renforcee"], action: "borne_recharge", compte: true, motCompte: "borne" },
    { cles: ["radiateur", "convecteur", "panneau rayonnant", "inertie"],               action: "radiateur_elec",     compte: true, motCompte: "radiateur" },

    // --- Circuits spécialisés & alimentation d'appareils ---
    { cles: ["prise 32a", "prise plaque", "prise force", "prise specialisee"],          action: "prise_32a",         compte: true, motCompte: "prise" },
    { cles: ["plaque", "cuisson", "four", "cuisiniere", "circuit specialise", "32a", "sortie de cable"], action: "circuit_32a", compte: true, motCompte: "circuit" },
    { cles: ["contacteur", "jour nuit", "heures creuses", "hc"],                        action: "contacteur_jn",     compte: true, motCompte: "contacteur" },
    { cles: ["chauffe-eau", "chauffe eau", "ballon", "cumulus", "ecs", "eau chaude"],   action: "raccord_ballon" },
    { cles: ["climatisation", "clim", "pac", "pompe a chaleur", "raccordement clim"],   action: "raccord_clim",      compte: true, motCompte: "clim" },
    { cles: ["prise exterieure", "prise etanche", "ip44", "prise jardin"],              action: "prise_ext",         compte: true, motCompte: "prise" },

    // --- Cheminements (saignées, goulottes, gaines) ---
    { cles: ["saignee", "rainure", "rainurage", "encastrement", "sillon", "scellement"], action: "saignee",          compte: true, motCompte: "saignee" },
    { cles: ["goulotte", "moulure", "baguette", "apparent", "saillie"],                 action: "goulotte",          compte: true, motCompte: "goulotte" },
    { cles: ["gaine", "icta", "fourreau", "tube", "tpc"],                               action: "gaine_icta",        compte: true, motCompte: "gaine" },

    // --- Protections complémentaires & tableau ---
    { cles: ["parafoudre", "parasurtenseur", "protection foudre", "surtension"],        action: "parafoudre" },
    { cles: ["tableau divisionnaire", "divisionnaire", "secondaire", "sous-tableau", "sous tableau", "coffret annexe"], action: "tableau_div" },
    { cles: ["delesteur", "delestage", "gestionnaire energie"],                         action: "delesteur" },

    // --- Chauffage électrique (complément) ---
    { cles: ["plancher chauffant", "sol chauffant", "film chauffant", "plancher rayonnant", "chauffage au sol"], action: "plancher_chauffant", compte: true, motCompte: "plancher" },

    // --- Confort & automatismes ---
    { cles: ["extracteur", "aerateur", "ventilateur sdb", "extraction", "aeration"],    action: "extracteur_sdb" },
    { cles: ["detecteur mouvement", "detecteur presence", "minuterie", "capteur"],      action: "detecteur_mouvement", compte: true, motCompte: "detecteur" },
    { cles: ["variateur", "gradateur", "dimmer"],                                       action: "variateur",         compte: true, motCompte: "variateur" },
    { cles: ["telerupteur"],                                                            action: "telerupteur",       compte: true, motCompte: "telerupteur" },
    { cles: ["gache electrique", "portier", "ouvre-porte", "ventouse"],                 action: "gache_elec" },
    { cles: ["sonnette", "carillon"],                                                   action: "sonnette",          compte: true, motCompte: "sonnette" },

    // --- Conformité & diagnostic ---
    { cles: ["consuel", "attestation", "conformite", "mise sous tension"],              action: "consuel" },
    { cles: ["diagnostic", "etat installation", "controle electrique", "verification"], action: "diagnostic_elec" },

    // --- Dépannage & chantier ---
    { cles: ["coffret chantier", "branchement provisoire", "coffret provisoire"],       action: "coffret_chantier" },
    { cles: ["dépannage", "depannage", "recherche de panne", "court-circuit", "court circuit", "disjoncte ", "panne"], action: "depannage_elec" },

    { cles: ["déposer", "deposer", "dépose", "depose", "enlever l'ancien", "ancien tableau"], action: "depose_appareil" },
  ];

  function count(txt, r) {
    if (!r.compte) return 1;
    return window.extraireNombre ? window.extraireNombre(txt, r.motCompte) : 1;
  }

  function parserDevisElectricite(texteBrut) {
    var txt = (texteBrut || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    var suggestions = [];
    var besoinPrecision = [];
    var notes = [];
    var deja = {};

    REGLES_ELEC.forEach(function (r) {
      var match = r.cles.some(function (k) { return txt.indexOf(k.normalize("NFD").replace(/[̀-ͯ]/g, "")) !== -1; });
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
