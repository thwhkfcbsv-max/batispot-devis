/*
 * MOTEUR DE CHIFFRAGE — PLOMBERIE / CHAUFFAGE
 * ------------------------------------------------------
 * Chiffrage DÉTERMINISTE (pas d'IA qui devine les prix).
 * Prix marché de référence FR 2026 = MAIN D'ŒUVRE / POSE, hors fourniture
 * (l'artisan ajoute le matériel et ajuste chaque tarif — il garde la main).
 * Sources : grilles tarifaires plombier FR 2026 (needhelp, travaux.com,
 * renovationettravaux) — milieu de fourchette, ajustable.
 * Le catalogue seul est spécifique au métier ; ligneDevis/calculerTotaux
 * (définis dans pricing-peinture.js) sont génériques et réutilisés.
 */

// --- Catalogue plomberie/chauffage (prix marché de référence, €/unité HT, pose seule) ---
const CATALOGUE_PLOMBERIE = {
  main_oeuvre:      { label: "Main d'œuvre plombier",                unite: "h",       prixRef: 55,  aide: "Taux horaire (45–75 €/h selon région)" },
  pose_wc:          { label: "Pose WC",                              unite: "u",       prixRef: 180, aide: "Pose WC (hors fourniture)" },
  depose_appareil:  { label: "Dépose ancien appareil",              unite: "u",       prixRef: 60,  aide: "Dépose et évacuation d'un appareil existant" },
  pose_lavabo:      { label: "Pose lavabo / vasque / évier",         unite: "u",       prixRef: 170, aide: "Pose + raccordement (hors fourniture)" },
  pose_mitigeur:    { label: "Pose mitigeur / robinet",              unite: "u",       prixRef: 150, aide: "Remplacement robinetterie (hors fourniture)" },
  pose_mitigeur_th: { label: "Mitigeur thermostatique douche",       unite: "u",       prixRef: 280, aide: "Pose mitigeur thermostatique (hors fourniture)" },
  pose_douche:      { label: "Pose douche + receveur",               unite: "u",       prixRef: 250, aide: "Pose receveur + raccordement (hors fourniture)" },
  pose_baignoire:   { label: "Pose baignoire",                       unite: "u",       prixRef: 300, aide: "Pose + raccordement baignoire (hors fourniture)" },
  chauffe_eau:      { label: "Pose / remplacement chauffe-eau",      unite: "u",       prixRef: 350, aide: "Dépose + pose ballon (hors fourniture)" },
  pose_radiateur:   { label: "Pose radiateur",                       unite: "u",       prixRef: 200, aide: "Pose + raccordement radiateur (hors fourniture)" },
  point_eau:        { label: "Création point d'eau (arrivée + évac.)", unite: "u",     prixRef: 300, aide: "Amenée d'eau + évacuation" },
  debouchage:       { label: "Débouchage canalisation",              unite: "forfait", prixRef: 120, aide: "Débouchage simple" },
  recherche_fuite:  { label: "Recherche de fuite",                   unite: "forfait", prixRef: 200, aide: "Détection de fuite" },
  deplacement:      { label: "Déplacement",                          unite: "forfait", prixRef: 45,  aide: "Frais de déplacement" },
};

if (typeof window !== "undefined") window.CATALOGUE_PLOMBERIE = CATALOGUE_PLOMBERIE;
if (typeof module !== "undefined" && module.exports) module.exports = { CATALOGUE_PLOMBERIE };
