/*
 * MOTEUR DE CHIFFRAGE — ÉLECTRICITÉ
 * ------------------------------------------------------
 * Chiffrage DÉTERMINISTE (pas d'IA qui devine les prix).
 * Prix marché de référence FR 2026 = MAIN D'ŒUVRE / POSE, hors fourniture
 * (l'artisan ajoute le matériel et ajuste chaque tarif — il garde la main).
 * Sources : grilles tarifaires électricien FR 2026 (ootravaux, prix-pose,
 * mon-electricien, travaux.com) — milieu de fourchette, ajustable.
 * ligneDevis/calculerTotaux (pricing-peinture.js) sont génériques et réutilisés.
 * Objectif : couvrir TOUS les lots courants d'un électricien.
 */

// --- Catalogue électricité (prix marché de référence, €/unité HT, pose/MO seule) ---
const CATALOGUE_ELECTRICITE = {
  main_oeuvre_elec:    { label: "Main d'œuvre électricien",             unite: "h",       prixRef: 60,  aide: "Taux horaire (45–80 €/h selon région)" },

  // Appareillage (prises, interrupteurs, réseau)
  pose_prise:          { label: "Pose / remplacement prise",            unite: "u",       prixRef: 90,  aide: "Remplacement ~50 € ; création avec circuit ~120 €" },
  pose_interrupteur:   { label: "Pose / remplacement interrupteur",     unite: "u",       prixRef: 55,  aide: "Interrupteur, va-et-vient simple" },
  prise_rj45:          { label: "Pose prise réseau RJ45",               unite: "u",       prixRef: 80,  aide: "Prise informatique / réseau (courants faibles)" },
  prise_tv:            { label: "Pose prise TV / antenne",              unite: "u",       prixRef: 70,  aide: "Prise télévision / antenne" },

  // Éclairage
  pose_point_lumineux: { label: "Pose point lumineux / applique",       unite: "u",       prixRef: 90,  aide: "Création point lumineux (hors fourniture)" },
  pose_spot:           { label: "Pose spot encastré",                   unite: "u",       prixRef: 60,  aide: "Par spot (hors fourniture)" },
  pose_luminaire:      { label: "Pose luminaire / lustre",              unite: "u",       prixRef: 80,  aide: "Pose et raccordement (hors fourniture)" },
  eclairage_ext:       { label: "Éclairage extérieur",                  unite: "u",       prixRef: 120, aide: "Point lumineux extérieur / projecteur" },

  // Tableau & protections
  tableau_electrique:  { label: "Remplacement tableau électrique",      unite: "u",       prixRef: 650, aide: "Dépose + pose tableau (main d'œuvre, hors fourniture)" },
  pose_disjoncteur:    { label: "Ajout disjoncteur / différentiel",     unite: "u",       prixRef: 90,  aide: "Ajout d'une protection au tableau" },
  tableau_comm:        { label: "Tableau de communication (VDI)",       unite: "u",       prixRef: 250, aide: "Coffret de communication / brassage" },
  mise_terre:          { label: "Mise à la terre",                      unite: "forfait", prixRef: 200, aide: "Prise de terre / mise à la terre" },
  mise_normes:         { label: "Mise aux normes installation",         unite: "forfait", prixRef: 350, aide: "Mise en conformité (selon relevé)" },
  renovation_elec:     { label: "Rénovation électrique (par pièce)",    unite: "u",       prixRef: 450, aide: "Réfection complète d'une pièce (points, circuits)" },

  // Chauffage électrique
  radiateur_elec:      { label: "Pose radiateur / convecteur électrique", unite: "u",     prixRef: 150, aide: "Pose et raccordement (hors fourniture)" },
  seche_serviette:     { label: "Pose sèche-serviettes électrique",     unite: "u",       prixRef: 180, aide: "Pose et raccordement (hors fourniture)" },
  thermostat:          { label: "Pose thermostat / programmateur",      unite: "u",       prixRef: 120, aide: "Thermostat, programmateur de chauffage" },

  // Circuits / gros œuvre élec
  tirage_cable:        { label: "Tirage de câble / création circuit",   unite: "u",       prixRef: 130, aide: "Circuit dédié (saignée + câble)" },

  // Sécurité & confort
  daaf:                { label: "Pose détecteur de fumée (DAAF)",       unite: "u",       prixRef: 40,  aide: "Détecteur avertisseur autonome (obligatoire)" },
  interphone:          { label: "Pose interphone / visiophone",         unite: "u",       prixRef: 250, aide: "Interphone ou visiophone (hors fourniture)" },
  alarme:              { label: "Pose alarme / système sécurité",       unite: "forfait", prixRef: 350, aide: "Centrale + détecteurs (selon config)" },
  volet_roulant:       { label: "Motorisation volet roulant",          unite: "u",       prixRef: 250, aide: "Motorisation volet / branchement" },
  motorisation_portail:{ label: "Motorisation portail",                unite: "u",       prixRef: 550, aide: "Motorisation portail (hors fourniture)" },
  pose_vmc:            { label: "Pose VMC",                             unite: "u",       prixRef: 400, aide: "Pose et raccordement VMC (hors fourniture)" },
  borne_recharge:      { label: "Pose borne de recharge VE",           unite: "u",       prixRef: 600, aide: "Installation borne (hors fourniture + ligne dédiée)" },

  // Circuits spécialisés & alimentation d'appareils
  circuit_32a:         { label: "Circuit spécialisé 32A (plaque/four)", unite: "u",      prixRef: 140, aide: "Sortie de câble / circuit dédié 32A (cuisson)" },
  prise_32a:           { label: "Prise 32A spécialisée (force)",       unite: "u",       prixRef: 120, aide: "Prise plaque / prise force spécialisée" },
  contacteur_jn:       { label: "Contacteur jour/nuit",                unite: "u",       prixRef: 55,  aide: "Contacteur heures creuses (chauffe-eau)" },
  raccord_ballon:      { label: "Raccordement chauffe-eau / ballon",   unite: "u",       prixRef: 150, aide: "Raccordement ballon ECS / cumulus" },
  raccord_clim:        { label: "Raccordement climatisation / PAC (part élec)", unite: "u", prixRef: 180, aide: "Alimentation électrique clim / pompe à chaleur" },
  prise_ext:           { label: "Prise extérieure étanche",            unite: "u",       prixRef: 110, aide: "Prise étanche IP44 (jardin / extérieur)" },

  // Cheminements (saignées, goulottes, gaines)
  saignee:             { label: "Saignée / encastrement mur",          unite: "ml",      prixRef: 22,  aide: "Rainurage + scellement (au mètre linéaire)" },
  goulotte:            { label: "Goulotte / moulure apparente",        unite: "ml",      prixRef: 15,  aide: "Pose apparente en saillie (au mètre linéaire)" },
  gaine_icta:          { label: "Gaine ICTA / fourreau",               unite: "ml",      prixRef: 8,   aide: "Passage de gaine / fourreau (au mètre linéaire)" },

  // Protections complémentaires & tableau
  parafoudre:          { label: "Pose parafoudre",                     unite: "u",       prixRef: 110, aide: "Protection contre les surtensions" },
  tableau_div:         { label: "Tableau divisionnaire / secondaire",  unite: "u",       prixRef: 300, aide: "Sous-tableau / coffret annexe" },
  delesteur:           { label: "Délesteur / gestionnaire d'énergie",  unite: "u",       prixRef: 140, aide: "Délestage / gestion de charge" },

  // Chauffage électrique (complément)
  plancher_chauffant:  { label: "Plancher / film chauffant électrique", unite: "m²",     prixRef: 45,  aide: "Plancher rayonnant / film chauffant (au m²)" },

  // Confort & automatismes
  extracteur_sdb:      { label: "Pose extracteur / aérateur SdB",      unite: "u",       prixRef: 110, aide: "Extraction / aération salle de bain" },
  detecteur_mouvement: { label: "Pose détecteur mouvement / minuterie", unite: "u",      prixRef: 80,  aide: "Détecteur de présence / minuterie" },
  variateur:           { label: "Pose variateur / gradateur",          unite: "u",       prixRef: 70,  aide: "Variateur / gradateur (dimmer)" },
  telerupteur:         { label: "Pose télérupteur",                    unite: "u",       prixRef: 85,  aide: "Télérupteur (commande va-et-vient multiple)" },
  gache_elec:          { label: "Pose gâche électrique / portier",     unite: "u",       prixRef: 130, aide: "Gâche / ouvre-porte / ventouse" },
  sonnette:            { label: "Pose sonnette / carillon",            unite: "u",       prixRef: 70,  aide: "Sonnette / carillon" },

  // Conformité & diagnostic
  consuel:             { label: "Attestation Consuel / conformité",    unite: "forfait", prixRef: 200, aide: "Attestation Consuel / mise sous tension" },
  diagnostic_elec:     { label: "Diagnostic installation électrique",  unite: "forfait", prixRef: 130, aide: "État / contrôle de l'installation" },

  // Dépannage & divers
  depannage_elec:      { label: "Dépannage / recherche de panne",      unite: "forfait", prixRef: 90,  aide: "Diagnostic + intervention" },
  coffret_chantier:    { label: "Coffret / branchement provisoire chantier", unite: "forfait", prixRef: 250, aide: "Coffret de chantier / branchement provisoire" },
  depose_appareil:     { label: "Dépose ancien appareil",              unite: "u",       prixRef: 40,  aide: "Dépose d'un appareil existant" },
  deplacement:         { label: "Déplacement",                         unite: "forfait", prixRef: 45,  aide: "Frais de déplacement" },
};

if (typeof window !== "undefined") window.CATALOGUE_ELECTRICITE = CATALOGUE_ELECTRICITE;
if (typeof module !== "undefined" && module.exports) module.exports = { CATALOGUE_ELECTRICITE };
