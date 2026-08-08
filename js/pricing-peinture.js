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
  peinture_boiserie:   { label: "Peinture boiseries / portes",          unite: "u",  prixRef: 55,  aide: "Par porte ou élément boisé (face + chants)" },
  peinture_plinthes:   { label: "Peinture plinthes",                    unite: "ml", prixRef: 6,   aide: "Par mètre linéaire de plinthe" },

  // Préparation (souvent oubliée = marge perdue)
  prepa_rebouchage:    { label: "Rebouchage / petits travaux",          unite: "m²", prixRef: 8,   aide: "Rebouchage fissures, trous, ponçage léger" },
  prepa_enduit:        { label: "Enduit de lissage complet",            unite: "m²", prixRef: 18,  aide: "Enduit sur toute la surface (support dégradé)" },
  prepa_sous_couche:   { label: "Sous-couche / primaire d'accroche",    unite: "m²", prixRef: 7,   aide: "Impression avant peinture (support neuf/poreux)" },
  decollage_papier:    { label: "Décollage papier peint",               unite: "m²", prixRef: 9,   aide: "Dépose ancien revêtement mural" },

  // Revêtements
  pose_toile_verre:    { label: "Pose toile de verre",                  unite: "m²", prixRef: 22,  aide: "Fourniture + pose toile de verre (hors peinture)" },
  pose_papier_peint:   { label: "Pose papier peint",                    unite: "m²", prixRef: 20,  aide: "Pose (hors fourniture papier)" },

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
  const item = CATALOGUE_PEINTURE[cle];
  if (!item) return null;
  const prixPerso = tarifsPerso[cle];
  // prix : perso si fourni (borné >= 0, virgule FR acceptée), sinon prix marché
  const prixUnitaire = (prixPerso != null && prixPerso !== "") ? num(prixPerso) : item.prixRef;
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
