/*
 * MOTEUR DE CHIFFRAGE — PEINTURE / RÉNOVATION INTÉRIEURE
 * ------------------------------------------------------
 * Cœur du produit : chiffrage DÉTERMINISTE (pas d'IA qui devine les prix).
 * Prix marché de référence FR 2026 (fourni HT, main d'œuvre incluse, ratios courants).
 * L'artisan AJUSTE chaque tarif (il garde la main → jamais un prix faux imposé).
 *
 * Toutes les valeurs sont en €/unité, HT. Sources : ratios pros peinture bâtiment FR
 * (fourchettes marché ; volontairement au milieu de fourchette, ajustables).
 */

// --- Catalogue des prestations peinture (prix marché de référence, €/unité HT) ---
const CATALOGUE_PEINTURE = {
  // clé : { label, unite, prixRef (marché), aide }
  peinture_mur:        { label: "Peinture murs (2 couches)",            unite: "m²", prixRef: 28,  aide: "Application 2 couches sur murs préparés" },
  peinture_plafond:    { label: "Peinture plafond (2 couches)",         unite: "m²", prixRef: 32,  aide: "Plafond, 2 couches (surcoût vs mur)" },
  peinture_boiserie:   { label: "Peinture boiseries / portes",          unite: "u",  prixRef: 65,  aide: "Par porte ou élément boisé (face + chants)" },
  peinture_plinthes:   { label: "Peinture plinthes",                    unite: "ml", prixRef: 6,   aide: "Par mètre linéaire de plinthe" },

  // Préparation (souvent oubliée = marge perdue)
  prepa_lessivage:     { label: "Lessivage / dégraissage murs",         unite: "m²", prixRef: 8,   aide: "Nettoyage/dégraissage du support avant peinture" },
  prepa_poncage:       { label: "Ponçage / égrenage",                   unite: "m²", prixRef: 10,  aide: "Ponçage/égrenage pour accroche (support ancien)" },
  prepa_rebouchage:    { label: "Rebouchage / petits travaux",          unite: "m²", prixRef: 12,  aide: "Rebouchage fissures, trous, ponçage léger" },
  prepa_enduit:        { label: "Enduit de lissage complet",            unite: "m²", prixRef: 18,  aide: "Enduit sur toute la surface (support dégradé)" },
  prepa_ratissage_mur: { label: "Ratissage complet mur",               unite: "m²", prixRef: 30,  aide: "Enduit pelliculaire sur mur pour finition lisse" },
  prepa_ratissage_plafond: { label: "Ratissage complet plafond",       unite: "m²", prixRef: 38,  aide: "Enduit pelliculaire sur plafond (surcoût vs mur)" },
  prepa_bandes_placo:  { label: "Bandes / joints de placo",             unite: "m²", prixRef: 10,  aide: "Jointoiement + bande à joint, finition placo" },
  prepa_sous_couche:   { label: "Sous-couche / primaire d'accroche",    unite: "m²", prixRef: 7,   aide: "Impression avant peinture (support neuf/poreux)" },
  traitement_humidite: { label: "Traitement anti-humidité / moisissure", unite: "m²", prixRef: 30, aide: "Traitement anti-fongique (salpêtre, moisissure)" },
  decollage_papier:    { label: "Décollage papier peint",               unite: "m²", prixRef: 9,   aide: "Dépose ancien revêtement mural" },

  // Revêtements
  pose_toile_verre:    { label: "Pose toile de verre",                  unite: "m²", prixRef: 22,  aide: "Fourniture + pose toile de verre (hors peinture)" },
  pose_papier_peint:   { label: "Pose papier peint",                    unite: "m²", prixRef: 25,  aide: "Pose (hors fourniture papier)" },

  // Éléments à l'unité
  peinture_radiateur:  { label: "Peinture radiateur",                   unite: "u",  prixRef: 90,  aide: "Par radiateur (fonte/acier, démontage léger)" },
  peinture_tuyaux:     { label: "Peinture tuyaux / canalisations",      unite: "forfait", prixRef: 60, aide: "Tuyauterie, gaines, conduites apparentes" },
  peinture_porte_placard: { label: "Peinture porte de placard",         unite: "u",  prixRef: 60,  aide: "Par façade/porte de placard (coulissant compris)" },
  peinture_fenetre_bois: { label: "Peinture fenêtre bois",              unite: "u",  prixRef: 120, aide: "Par châssis/croisée bois (face + dormant)" },
  vernis_boiseries:    { label: "Vernis / vitrification boiseries",     unite: "u",  prixRef: 65,  aide: "Vernis, vitrification ou lasure d'un élément boisé" },
  laque_finition:      { label: "Laque / finition laquée",             unite: "u",  prixRef: 110, aide: "Laquage / finition tendue par élément" },

  // Surfaces spécifiques
  peinture_volets:     { label: "Peinture volets bois",                 unite: "u",  prixRef: 45,  aide: "Par volet / persienne / contrevent" },
  peinture_facade:     { label: "Peinture façade extérieure",           unite: "m²", prixRef: 35,  aide: "Ravalement / peinture façade, crépi extérieur" },
  peinture_sol_resine: { label: "Peinture sol / résine époxy",          unite: "m²", prixRef: 40,  aide: "Sol béton peint / résine époxy (garage, atelier)" },
  patine_beton_cire:   { label: "Patine / béton ciré / effet déco",     unite: "m²", prixRef: 170, aide: "Béton ciré, stuc, tadelakt, enduit décoratif" },
  peinture_escalier:   { label: "Peinture escalier / rampe",            unite: "forfait", prixRef: 250, aide: "Marches, rampe, garde-corps, cage d'escalier" },

  // Divers / forfaits
  protection_chantier: { label: "Protection & installation chantier",   unite: "forfait", prixRef: 80,  aide: "Bâches, adhésifs, protection sols/meubles" },
  nettoyage_fin:       { label: "Nettoyage fin de chantier",            unite: "forfait", prixRef: 60,  aide: "Nettoyage et repli" },
  deplacement:         { label: "Déplacement",                          unite: "forfait", prixRef: 40,  aide: "Frais de déplacement (selon distance)" },
};

// --- Ratios utiles pour estimer les surfaces à partir d'une pièce ---
// (aide au parsing : "chambre de 12 m²" → surface murs ≈ ...)
const RATIOS = {
  hauteurSousPlafond: 2.5,          // m par défaut
  ratioMursSurSol: 2.6,             // surface murs ≈ surface sol × 2.6 (pièce standard h2.5)
  deductionOuvertures: 0.85,        // -15% pour portes/fenêtres
};

/**
 * Estime la surface de murs à partir d'une surface au sol (m²).
 * Utile quand l'artisan dit "une chambre de 12 m²".
 */
function estimerSurfaceMurs(surfaceSol, { hauteur = RATIOS.hauteurSousPlafond } = {}) {
  if (!surfaceSol || surfaceSol <= 0) return 0;
  // périmètre approché d'une pièce ~ carrée : 4 × √surface
  const perimetre = 4 * Math.sqrt(surfaceSol);
  const surfaceMursBrute = perimetre * hauteur;
  return Math.round(surfaceMursBrute * RATIOS.deductionOuvertures);
}

/**
 * Convertit une saisie en nombre >= 0, en acceptant la VIRGULE décimale française
 * ("30,5" → 30.5). Renvoie 0 si invalide. Évite les NaN qui font disparaître une ligne.
 */
function num(x) {
  if (typeof x === "number") return isFinite(x) ? Math.max(0, x) : 0;
  if (x == null) return 0;
  const n = parseFloat(String(x).replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? Math.max(0, n) : 0;
}

/**
 * Construit une ligne de devis chiffrée.
 * @param {string} cle - clé du catalogue
 * @param {number|string} quantite
 * @param {object} tarifsPerso - overrides {cle: prix} de l'artisan
 * @returns {object} ligne { cle, label, unite, quantite, prixUnitaire, total, source }
 */
function ligneDevis(cle, quantite, tarifsPerso = {}) {
  // Utilise le catalogue ACTIF (fusionné multi-métier via setCatalogue) ; repli sur peinture.
  const CAT = (typeof window !== "undefined" && window.__CAT_ACTIF) ? window.__CAT_ACTIF : CATALOGUE_PEINTURE;
  const item = CAT[cle] || CATALOGUE_PEINTURE[cle];
  if (!item) return null;
  const prixPerso = tarifsPerso[cle];
  // prix : perso si fourni ; sinon prix marché AJUSTÉ à la zone géographique de l'artisan (× coef).
  const coefZone = (typeof window !== "undefined" && window.__ZONE_COEF) ? window.__ZONE_COEF : 1;
  const prixUnitaire = (prixPerso != null && prixPerso !== "") ? num(prixPerso) : Math.round(item.prixRef * coefZone * 100) / 100;
  // forfait => quantité toujours 1 (jamais multipliée par une surface)
  const qte = item.unite === "forfait" ? 1 : num(quantite);
  return {
    cle,
    label: item.label,
    unite: item.unite,
    quantite: qte,
    prixUnitaire,
    total: Math.round(qte * prixUnitaire * 100) / 100,
    source: (prixPerso != null && prixPerso !== "") ? "perso" : "marché",
    aide: item.aide,
  };
}

/**
 * Calcule les totaux d'un devis.
 * @param {Array} lignes
 * @param {object} opts - { tva: 0.10|0.20, remise: 0 }
 */
function calculerTotaux(lignes, { tva = 0.10, remise = 0 } = {}) {
  // tva bornée [0, 0.20] et virgule FR tolérée (comme les prix) — jamais de NaN
  tva = Math.min(0.20, Math.max(0, num(tva)));
  // remise bornée à [0, 1] (0 à 100 %) — évite total négatif ou majoration cachée
  remise = Math.min(1, Math.max(0, Number(remise) || 0));
  const sousTotal = lignes.reduce((s, l) => s + (Number(l.total) || 0), 0);
  const montantRemise = Math.round(sousTotal * remise * 100) / 100;
  const baseHT = sousTotal - montantRemise;
  const montantTVA = Math.round(baseHT * tva * 100) / 100;
  const totalTTC = Math.round((baseHT + montantTVA) * 100) / 100;
  return {
    sousTotalHT: Math.round(sousTotal * 100) / 100,
    remise: montantRemise,
    tauxTVA: tva,
    baseHT: Math.round(baseHT * 100) / 100,
    montantTVA,
    totalTTC,
  };
}

// TVA : 10% rénovation logement +2 ans (cas courant peinture), 20% sinon,
// 5,5% réno énergétique, 0% franchise en base (auto-entrepreneurs, art. 293 B CGI).
const TVA_OPTIONS = [
  { taux: 0.10, label: "10 % — rénovation logement > 2 ans" },
  { taux: 0.20, label: "20 % — taux normal" },
  { taux: 0.055, label: "5,5 % — rénovation énergétique" },
  { taux: 0, label: "Franchise en base (TVA non applicable, art. 293 B du CGI)" },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CATALOGUE_PEINTURE, RATIOS, estimerSurfaceMurs, ligneDevis, calculerTotaux, TVA_OPTIONS };
}
// Export navigateur : les const top-level ne sont PAS sur window automatiquement.
if (typeof window !== "undefined") {
  window.CATALOGUE_PEINTURE = CATALOGUE_PEINTURE;
  window.RATIOS = RATIOS;
  window.estimerSurfaceMurs = estimerSurfaceMurs;
  window.num = num;
  window.ligneDevis = ligneDevis;
  window.calculerTotaux = calculerTotaux;
  window.TVA_OPTIONS = TVA_OPTIONS;
}
