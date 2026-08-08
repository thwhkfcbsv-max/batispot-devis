/*
 * MOTEUR DE CHIFFRAGE — COUVERTURE (TOITURE)
 * ------------------------------------------------------
 * Chiffrage DÉTERMINISTE (pas d'IA qui devine les prix).
 * Prix marché de référence FR 2026 = MAIN D'ŒUVRE / POSE, hors fourniture
 * (l'artisan ajoute le matériel et ajuste chaque tarif — il garde la main).
 * Sources : grilles tarifaires couvreur FR 2026 (ootravaux, travaux.com,
 * prix-pose, prix-travaux-m2, renovbox) — milieu de fourchette, ajustable.
 * ligneDevis/calculerTotaux (pricing-peinture.js) sont génériques et réutilisés.
 * Objectif : couvrir TOUS les lots courants d'un couvreur / zingueur.
 */

// --- Catalogue couverture (prix marché de référence, €/unité HT, pose/MO seule) ---
const CATALOGUE_COUVERTURE = {
  main_oeuvre_couv:    { label: "Main d'œuvre couvreur",                unite: "h",       prixRef: 55,  aide: "Taux horaire (45–70 €/h selon région)" },

  // Dépose & structure de couverture
  depose_couverture:   { label: "Dépose ancienne couverture",          unite: "m²",      prixRef: 22,  aide: "Dépose + évacuation (20–30 €/m²)" },
  refection_tuiles:    { label: "Réfection toiture tuiles",            unite: "m²",      prixRef: 50,  aide: "Pose seule (fourniture tuiles en sus)" },
  refection_ardoises:  { label: "Réfection toiture ardoises",          unite: "m²",      prixRef: 80,  aide: "Pose seule, technique (fourniture en sus)" },
  couverture_zinc:     { label: "Couverture zinc (joint debout)",      unite: "m²",      prixRef: 90,  aide: "Pose seule zinc (fourniture en sus)" },
  couverture_bac_acier:{ label: "Couverture bac acier",                unite: "m²",      prixRef: 35,  aide: "Pose seule bac acier / tôle (fourniture en sus)" },
  toiture_epdm:        { label: "Toiture plate / membrane EPDM",       unite: "m²",      prixRef: 40,  aide: "Étanchéité toit plat, MO 30–50 €/m²" },
  ecran_sous_toiture:  { label: "Écran sous-toiture",                  unite: "m²",      prixRef: 12,  aide: "Pose écran HPV (5–20 €/m²)" },
  liteaux_voligeage:   { label: "Pose liteaux / voligeage",            unite: "m²",      prixRef: 25,  aide: "Liteaunage / volige (15–50 €/m²)" },

  // Zinguerie linéaire (faîtage, arêtier, noue, solin, rive)
  faitage:             { label: "Faîtage",                             unite: "ml",      prixRef: 40,  aide: "Faîtage / faîtière (30–70 €/ml)" },
  aretier:             { label: "Arêtier",                             unite: "ml",      prixRef: 45,  aide: "Arêtier (30–70 €/ml)" },
  noue:                { label: "Noue",                                unite: "ml",      prixRef: 55,  aide: "Noue (40–90 €/ml)" },
  solin:               { label: "Solin",                               unite: "ml",      prixRef: 40,  aide: "Solin d'étanchéité (25–55 €/ml)" },
  rive:                { label: "Rive",                                unite: "ml",      prixRef: 30,  aide: "Rive / bandeau de rive" },

  // Évacuation des eaux pluviales
  pose_gouttiere:      { label: "Pose gouttière",                      unite: "ml",      prixRef: 35,  aide: "Pose gouttière (zinc/PVC), fourniture en sus" },
  pose_cheneau:        { label: "Pose chéneau",                        unite: "ml",      prixRef: 55,  aide: "Chéneau posé (60–120 €/ml fourniture comprise)" },
  descente_ep:         { label: "Descente d'eau pluviale",            unite: "ml",      prixRef: 30,  aide: "Descente EP posée (fourniture en sus)" },

  // Fenêtres & sorties de toit
  pose_velux:          { label: "Pose velux / fenêtre de toit",       unite: "u",       prixRef: 350, aide: "Pose seule (250–500 €/u)" },
  pose_chassis:        { label: "Pose châssis de toit",               unite: "u",       prixRef: 300, aide: "Châssis / tabatière / lucarne (hors fourniture)" },
  sortie_toit:         { label: "Fourreau / sortie de toit",          unite: "u",       prixRef: 90,  aide: "Chatière, sortie de toit, closoir ventilé" },

  // Entretien & traitement
  demoussage:          { label: "Démoussage toiture",                 unite: "m²",      prixRef: 15,  aide: "Démoussage + anti-mousse (10–30 €/m²)" },
  hydrofuge:           { label: "Traitement hydrofuge",               unite: "m²",      prixRef: 20,  aide: "Hydrofuge (15–40 €/m²)" },
  nettoyage_toiture:   { label: "Nettoyage toiture",                  unite: "m²",      prixRef: 12,  aide: "Nettoyage haute pression (9–15 €/m²)" },

  // Réparation & étanchéité
  reparation_fuite:    { label: "Réparation fuite / recherche infiltration", unite: "forfait", prixRef: 250, aide: "Recherche + réparation localisée (150–400 €)" },

  // Isolation
  isolation_combles:   { label: "Isolation combles / sous-toiture",   unite: "m²",      prixRef: 40,  aide: "Isolation (20–80 €/m² selon technique)" },
  pare_vapeur:         { label: "Pose écran pare-vapeur",             unite: "m²",      prixRef: 12,  aide: "Frein/pare-vapeur, étanchéité à l'air" },

  // Sécurité & accès
  ligne_vie:           { label: "Ligne de vie / sécurité",            unite: "forfait", prixRef: 300, aide: "Dispositif antichute / point d'ancrage" },
  echafaudage:         { label: "Échafaudage",                         unite: "forfait", prixRef: 600, aide: "Montage / location (≈10–15 €/m²)" },

  // Divers
  deplacement:         { label: "Déplacement",                        unite: "forfait", prixRef: 45,  aide: "Frais de déplacement" },
};

if (typeof window !== "undefined") window.CATALOGUE_COUVERTURE = CATALOGUE_COUVERTURE;
if (typeof module !== "undefined" && module.exports) module.exports = { CATALOGUE_COUVERTURE };
