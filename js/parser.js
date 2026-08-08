/*
 * PARSER LANGAGE NATUREL → LIGNES DE DEVIS (métier peinture)
 * ---------------------------------------------------------
 * MVP : parser déterministe par mots-clés + extraction de quantités.
 * ⚠️ C'est la couche qui sera REMPLACÉE par un vrai appel LLM (Claude) plus tard,
 *    qui gérera mieux le langage libre / la voix. Le format de sortie restera identique
 *    → le reste de l'app ne bougera pas quand on branchera l'IA.
 *
 * Entrée : texte libre ("chambre de 12m2, murs et plafond, avec rebouchage")
 * Sortie : { pieces:[...], suggestions:[{cle, quantite, raison}], besoinPrecision:[...] }
 */

// Mots-clés → clé catalogue
const REGLES = [
  { cles: ["mur", "murs"],                         action: "peinture_mur" },
  { cles: ["plafond", "plafonds"],                 action: "peinture_plafond" },
  { cles: ["porte", "portes", "boiserie", "boiseries", "fenetre", "fenetres", "fenêtre", "fenêtres", "volet", "volets"], action: "peinture_boiserie", parQuantite: true },
  { cles: ["plinthe", "plinthes"],                 action: "peinture_plinthes" },
  { cles: ["reboucher", "rebouchage", "fissure", "fissures", "trou", "trous"], action: "prepa_rebouchage" },
  { cles: ["enduit", "lissage", "lisser"],         action: "prepa_enduit" },
  { cles: ["sous-couche", "sous couche", "primaire", "impression"], action: "prepa_sous_couche" },
  { cles: ["papier peint", "papier"],              action: "detecte_papier" }, // ambigu → précision
  { cles: ["décoller", "decoller", "décollage", "arracher"], action: "decollage_papier" },
  { cles: ["toile de verre", "toile"],             action: "pose_toile_verre" },
];

const MOTS_PIECES = {
  chambre: 12, salon: 22, "séjour": 24, sejour: 24, cuisine: 10,
  "salle de bain": 6, sdb: 6, "salle d'eau": 5, wc: 2, toilettes: 2,
  couloir: 6, entrée: 5, entree: 5, bureau: 10, dressing: 5, garage: 18,
};

/** Extrait les nombres suivis de m² / m2 / mètres carrés (PAS "m" nu = hauteur/longueur). */
function extraireSurfaces(txt) {
  const res = [];
  // On exige explicitement une unité de SURFACE (m², m2, mètres carrés) — jamais "m" seul,
  // sinon "3 m de haut" ou "5 m de plinthes" serait pris comme surface au sol (bug C1).
  const re = /(\d+(?:[.,]\d+)?)\s*(?:m²|m2|m\.?c\.?|mètres?\s*carrés?|metres?\s*carres?)/gi;
  let m;
  while ((m = re.exec(txt)) !== null) {
    res.push(parseFloat(m[1].replace(",", ".")));
  }
  return res;
}

/** Extrait un nombre d'unités ("3 portes", "deux portes"). */
function extraireNombre(txt, motCle) {
  const chiffres = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
  const re = new RegExp(`(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\\s+${motCle}`, "i");
  const m = txt.match(re);
  if (!m) return 1;
  return chiffres[m[1].toLowerCase()] || parseInt(m[1], 10) || 1;
}

/** Compte les éléments boisés cités (portes + fenêtres + volets) et somme leurs quantités. */
function compterBoiseries(txt) {
  let total = 0, trouve = false;
  ["porte", "fenetre", "fenêtre", "volet"].forEach((mot) => {
    if (txt.includes(mot)) { trouve = true; total += extraireNombre(txt, mot); }
  });
  return trouve ? total : 1;
}

/**
 * Parse un texte en propositions de lignes de devis.
 * Renvoie des SUGGESTIONS (l'artisan valide/ajuste ensuite — jamais imposé).
 */
function parserDevis(texteBrut, { estimerSurfaceMurs, ligneDevis }) {
  const txt = (texteBrut || "").toLowerCase();
  const suggestions = [];
  const besoinPrecision = [];
  const notes = [];

  // 1) Détecter les pièces + surfaces
  const surfaces = extraireSurfaces(txt);
  let surfaceSol = surfaces.length ? surfaces[0] : null;
  let pieceDetectee = null;
  for (const [nom, surfaceDefaut] of Object.entries(MOTS_PIECES)) {
    if (txt.includes(nom)) {
      pieceDetectee = nom;
      if (surfaceSol == null) { surfaceSol = surfaceDefaut; notes.push(`Surface "${nom}" estimée à ${surfaceDefaut} m² (à confirmer).`); }
      break;
    }
  }

  const surfaceMurs = surfaceSol ? estimerSurfaceMurs(surfaceSol) : null;
  const surfacePlafond = surfaceSol || null;

  // Multi-surfaces / multi-pièces : ne pas ignorer silencieusement (M1)
  if (surfaces.length > 1) {
    besoinPrecision.push(`Plusieurs surfaces détectées (${surfaces.join(", ")} m²). J'ai chiffré sur ${surfaces[0]} m² — vérifiez et ajoutez les pièces manquantes à la main.`);
  }

  // 2) Appliquer les règles mots-clés
  const dejaAjoute = new Set();
  for (const regle of REGLES) {
    const match = regle.cles.some((k) => txt.includes(k));
    if (!match) continue;

    if (regle.action === "detecte_papier") {
      const veutDecoller = /d[ée]coll|arrach|enlev|retir/i.test(txt);
      const veutPoser = /pose[rz]?|tapiss|installer|mettre/i.test(txt);
      if (veutDecoller) {
        // "decollage_papier" est géré par sa propre règle. Si l'artisan POSE aussi du neuf
        // (réno : décoller l'ancien + poser le nouveau), on ajoute la pose (revenu à ne pas perdre).
        if (veutPoser && !dejaAjoute.has("pose_papier_peint")) {
          dejaAjoute.add("pose_papier_peint");
          suggestions.push({ cle: "pose_papier_peint", quantite: surfaceMurs || surfaceSol || 0, raison: "pose de papier peint neuf" });
        }
      } else if (veutPoser) {
        if (!dejaAjoute.has("pose_papier_peint")) {
          dejaAjoute.add("pose_papier_peint");
          suggestions.push({ cle: "pose_papier_peint", quantite: surfaceMurs || surfaceSol || 0, raison: "pose de papier peint" });
        }
      } else {
        besoinPrecision.push("Vous avez parlé de « papier peint » : c'est à POSER ou à DÉCOLLER ?");
      }
      continue;
    }
    if (dejaAjoute.has(regle.action)) continue;
    dejaAjoute.add(regle.action);

    let quantite = 0;
    const item = { cle: regle.action };
    switch (regle.action) {
      case "peinture_mur":
      case "prepa_rebouchage":
      case "prepa_enduit":
      case "prepa_sous_couche":
      case "decollage_papier":
      case "pose_toile_verre":
        quantite = surfaceMurs || 0;
        if (!surfaceMurs) besoinPrecision.push(`Quelle surface de murs pour « ${CATALOGUE_LABEL(regle.action)} » ?`);
        break;
      case "peinture_plafond":
        quantite = surfacePlafond || 0;
        if (!surfacePlafond) besoinPrecision.push("Quelle surface de plafond ?");
        break;
      case "peinture_boiserie":
        quantite = compterBoiseries(txt);
        break;
      case "peinture_plinthes":
        quantite = surfaceSol ? Math.round(4 * Math.sqrt(surfaceSol)) : 0; // périmètre
        break;
      default:
        quantite = surfaceMurs || 0;
    }
    suggestions.push({ cle: regle.action, quantite, raison: pieceDetectee ? `détecté pour ${pieceDetectee}` : "détecté" });
  }

  // 3) Toujours suggérer préparation + protection si peinture détectée (bonnes pratiques = marge)
  const aPeinture = suggestions.some((s) => s.cle.startsWith("peinture_"));
  if (aPeinture) {
    if (!dejaAjoute.has("protection_chantier")) {
      suggestions.push({ cle: "protection_chantier", quantite: 1, raison: "recommandé (protection sols/meubles)" });
    }
    if (!dejaAjoute.has("prepa_sous_couche") && surfaceMurs) {
      notes.push("Pensez à la sous-couche si le support est neuf ou poreux.");
    }
  }

  // Prestation non reconnue mais contexte détecté → le dire (m1)
  if (!suggestions.length && (pieceDetectee || surfaceSol)) {
    besoinPrecision.push("Je n'ai pas reconnu de prestation précise — ajoutez-la à la main avec « + Ajouter une prestation ».");
  }

  return {
    piece: pieceDetectee,
    surfaceSol,
    surfaceMurs,
    suggestions,
    besoinPrecision,
    notes,
  };
}

// Helper label (chargé depuis le catalogue si dispo)
let _CAT = null;
function CATALOGUE_LABEL(cle) {
  if (_CAT && _CAT[cle]) return _CAT[cle].label;
  return cle;
}
function setCatalogue(cat) { _CAT = cat; }

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parserDevis, extraireSurfaces, extraireNombre, setCatalogue };
}
if (typeof window !== "undefined") {
  window.parserDevis = parserDevis;
  window.extraireSurfaces = extraireSurfaces;
  window.extraireNombre = extraireNombre;
  window.setCatalogue = setCatalogue;
}
