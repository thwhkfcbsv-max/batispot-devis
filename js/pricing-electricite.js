/*
 * MOTEUR DE CHIFFRAGE — ÉLECTRICITÉ
 * ------------------------------------------------------
 * Chiffrage DÉTERMINISTE (pas d'IA qui devine les prix).
 * Prix marché de référence FR 2026 = MAIN D'ŒUVRE / POSE, hors fourniture
 * (l'artisan ajoute le matériel et ajuste chaque tarif — il garde la main).
 * Sources : grilles tarifaires électricien FR 2026 (ootravaux, prix-pose,
 * mon-electricien, travaux.com) — milieu de fourchette, ajustable.
 * ligneDevis/calculerTotaux (pricing-peinture.js) sont génériques et réutilisés.
 */

// --- Catalogue électricité (prix marché de référence, €/unité HT, pose seule) ---
const CATALOGUE_ELECTRICITE = {
  main_oeuvre_elec:  { label: "Main d'œuvre électricien",            unite: "h",       prixRef: 55,  aide: "Taux horaire (45–80 €/h selon région)" },
  pose_prise:        { label: "Pose / remplacement prise",           unite: "u",       prixRef: 90,  aide: "Remplacement simple ~50 € ; création avec circuit ~120 €" },
  pose_interrupteur: { label: "Pose / remplacement interrupteur",    unite: "u",       prixRef: 55,  aide: "Interrupteur, va-et-vient simple" },
  pose_point_lumineux:{ label: "Pose point lumineux / applique",     unite: "u",       prixRef: 90,  aide: "Création point lumineux (hors fourniture)" },
  pose_spot:         { label: "Pose spot encastré",                  unite: "u",       prixRef: 60,  aide: "Par spot (hors fourniture)" },
  pose_luminaire:    { label: "Pose luminaire / lustre",             unite: "u",       prixRef: 80,  aide: "Pose et raccordement (hors fourniture)" },
  tableau_electrique:{ label: "Remplacement tableau électrique",     unite: "u",       prixRef: 650, aide: "Dépose + pose tableau (main d'œuvre, hors fourniture)" },
  pose_disjoncteur:  { label: "Ajout disjoncteur / différentiel",    unite: "u",       prixRef: 90,  aide: "Ajout d'une protection au tableau" },
  tirage_cable:      { label: "Tirage de câble / création circuit",  unite: "u",       prixRef: 130, aide: "Création d'un circuit dédié (saignée + câble)" },
  mise_terre:        { label: "Mise à la terre",                     unite: "forfait", prixRef: 200, aide: "Prise de terre / mise à la terre" },
  pose_vmc:          { label: "Pose VMC",                            unite: "u",       prixRef: 250, aide: "Pose et raccordement VMC (hors fourniture)" },
  borne_recharge:    { label: "Pose borne de recharge VE",          unite: "u",       prixRef: 600, aide: "Installation borne (hors fourniture + hors ligne dédiée)" },
  depose_appareil:   { label: "Dépose ancien appareil",             unite: "u",       prixRef: 40,  aide: "Dépose d'un appareil existant" },
  deplacement:       { label: "Déplacement",                        unite: "forfait", prixRef: 45,  aide: "Frais de déplacement" },
};

if (typeof window !== "undefined") window.CATALOGUE_ELECTRICITE = CATALOGUE_ELECTRICITE;
if (typeof module !== "undefined" && module.exports) module.exports = { CATALOGUE_ELECTRICITE };
