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
  pose_baignoire:   { label: "Pose baignoire",                       unite: "u",       prixRef: 350, aide: "Pose + raccordement baignoire (hors fourniture)" },
  chauffe_eau:      { label: "Pose / remplacement chauffe-eau",      unite: "u",       prixRef: 350, aide: "Dépose + pose ballon (hors fourniture)" },
  pose_radiateur:   { label: "Pose radiateur",                       unite: "u",       prixRef: 200, aide: "Pose + raccordement radiateur (hors fourniture)" },
  point_eau:        { label: "Création point d'eau (arrivée + évac.)", unite: "u",     prixRef: 300, aide: "Amenée d'eau + évacuation" },
  debouchage:       { label: "Débouchage canalisation",              unite: "forfait", prixRef: 120, aide: "Débouchage simple" },
  recherche_fuite:  { label: "Recherche de fuite",                   unite: "forfait", prixRef: 200, aide: "Détection de fuite" },
  deplacement:      { label: "Déplacement",                          unite: "forfait", prixRef: 45,  aide: "Frais de déplacement" },

  // --- Lot CHAUFFAGE ---
  pose_chaudiere_gaz:    { label: "Pose chaudière gaz à condensation",       unite: "u",       prixRef: 1100, aide: "Pose chaudière murale gaz condensation (hors fourniture)" },
  pose_pac_air_eau:      { label: "Pose PAC air/eau",                        unite: "u",       prixRef: 3000, aide: "Pose pompe à chaleur aérothermie air/eau (hors fourniture)" },
  pose_pac_air_air:      { label: "Pose PAC air/air (clim réversible)",      unite: "u",       prixRef: 1600, aide: "Pose climatisation réversible split (hors fourniture)" },
  pose_ballon_thermo:    { label: "Pose ballon thermodynamique",             unite: "u",       prixRef: 800,  aide: "Pose chauffe-eau thermodynamique (hors fourniture)" },
  pose_plancher_chauffant:{ label: "Pose plancher chauffant hydraulique",    unite: "m²",      prixRef: 55,   aide: "Pose plancher chauffant à eau (hors fourniture)" },
  desembouage:           { label: "Désembouage circuit radiateurs",         unite: "forfait", prixRef: 450,  aide: "Curage / désembouage du circuit de chauffage" },
  entretien_chaudiere:   { label: "Entretien / révision chaudière",         unite: "forfait", prixRef: 110,  aide: "Contrat / passage d'entretien annuel" },
  ramonage:              { label: "Ramonage conduit",                       unite: "forfait", prixRef: 80,   aide: "Ramonage conduit / tubage" },
  pose_seche_serviettes: { label: "Pose sèche-serviettes",                   unite: "u",       prixRef: 180,  aide: "Pose radiateur sèche-serviettes (hors fourniture)" },
  pose_thermostat:       { label: "Pose thermostat / robinet thermostatique",unite: "u",       prixRef: 90,   aide: "Pose régulation / tête thermostatique (hors fourniture)" },

  // --- Lot SANITAIRE (compléments) ---
  pose_wc_suspendu:      { label: "Pose WC suspendu + bâti-support",         unite: "u",       prixRef: 350,  aide: "Pose bâti-support + cuvette suspendue (hors fourniture)" },
  pose_meuble_vasque:    { label: "Pose meuble vasque",                      unite: "u",       prixRef: 160,  aide: "Pose meuble sous-vasque + raccordement (hors fourniture)" },
  pose_colonne_douche:   { label: "Pose colonne / ensemble de douche",       unite: "u",       prixRef: 150,  aide: "Pose colonne / barre de douche (hors fourniture)" },
  pose_douche_italienne: { label: "Pose douche à l'italienne (étanchéité)",  unite: "u",       prixRef: 600,  aide: "Receveur extra-plat / plain-pied + étanchéité + siphon de sol" },
  pose_paroi_douche:     { label: "Pose paroi de douche / pare-baignoire",   unite: "u",       prixRef: 180,  aide: "Pose paroi de douche ou pare-baignoire (hors fourniture)" },
  pose_evier:            { label: "Pose évier de cuisine",                   unite: "u",       prixRef: 150,  aide: "Pose + raccordement évier de cuisine (hors fourniture)" },
  raccord_electromenager:{ label: "Raccordement lave-linge / lave-vaisselle",unite: "u",       prixRef: 90,   aide: "Arrivée + évacuation machine (hors fourniture)" },
  pose_adoucisseur:      { label: "Pose adoucisseur d'eau",                  unite: "u",       prixRef: 450,  aide: "Pose adoucisseur / traitement anti-calcaire (hors fourniture)" },
  pose_groupe_securite:  { label: "Pose groupe de sécurité",                 unite: "u",       prixRef: 90,   aide: "Pose groupe de sécurité / soupape chauffe-eau (hors fourniture)" },

  // --- Lot RÉSEAU ---
  reseau_alimentation:   { label: "Création réseau d'alimentation (PER/cuivre)", unite: "ml",  prixRef: 60,   aide: "Création alimentation eau (PER / cuivre / multicouche)" },
  reseau_evacuation:     { label: "Création réseau d'évacuation",            unite: "ml",      prixRef: 65,   aide: "Création évacuation eaux usées (PVC)" },
  deplacement_reseau:    { label: "Déplacement d'arrivée/évacuation d'eau",  unite: "forfait", prixRef: 350,  aide: "Modification / déplacement d'un réseau existant" },
  pose_vmc:              { label: "Pose VMC",                                unite: "u",       prixRef: 500,  aide: "Pose ventilation simple / double flux (hors fourniture)" },
};

if (typeof window !== "undefined") window.CATALOGUE_PLOMBERIE = CATALOGUE_PLOMBERIE;
if (typeof module !== "undefined" && module.exports) module.exports = { CATALOGUE_PLOMBERIE };
