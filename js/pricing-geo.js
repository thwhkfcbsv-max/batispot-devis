/*
 * AJUSTEMENT GÉOGRAPHIQUE DES PRIX
 * ------------------------------------------------------
 * Les prix de référence du catalogue sont NATIONAUX (médiane marché).
 * On les multiplie par un coefficient selon la zone où travaille l'artisan
 * (déduit du code postal). L'artisan garde la main : il peut ajuster chaque ligne.
 * Coefficients issus d'un audit marché FR 2026 (écarts prix facturés par zone).
 * Paris ×1,25 → rural ×0,90. Défaut 1,00 pour toute zone non listée (neutre).
 */
(function () {
  "use strict";
  const COEF = {};
  const set = (coef, deps) => deps.split(",").forEach((d) => { COEF[d.trim()] = coef; });
  set(1.25, "75");                                                   // Paris intra-muros
  set(1.15, "92,93,94");                                             // Petite couronne
  set(1.10, "77,78,91,95,06,69,74,33,73,2A,2B,83");                  // Grande couronne + métropoles premium
  set(1.05, "13,31,44,59,67,35,34,38,21,76,68,84");                  // Grandes métropoles standard
  set(0.90, "03,04,05,07,08,09,10,11,12,15,16,18,19,23,24,32,36,39,40,43,46,47,48,50,52,53,55,58,61,65,70,79,81,82,88,89"); // Rural

  // Code postal → coefficient de zone.
  function coefZoneFromCP(cp) {
    if (!cp) return 1.00;
    cp = String(cp).replace(/\D/g, "");
    if (cp.length === 4) cp = "0" + cp; // dépt 01-09 saisi sans le zéro ("6000" → "06000")
    let dep = cp.slice(0, 2);
    if (dep === "20") dep = (parseInt(cp.slice(0, 3), 10) < 202) ? "2A" : "2B"; // Corse
    const c = COEF[dep];
    return (typeof c === "number") ? c : 1.00;
  }

  if (typeof window !== "undefined") {
    window.coefZoneFromCP = coefZoneFromCP;
    window.COEF_ZONE = COEF;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { coefZoneFromCP, COEF };
})();
