#!/usr/bin/env node
/*
 * AUDIT AUTOMATIQUE du moteur de chiffrage BatiSpot Devis.
 * Auto-adaptatif : découvre tous les catalogues/parsers → nouveaux métiers audités sans y toucher.
 * Vérifie : syntaxe, intégrité catalogues, règles orphelines, normalisation accents,
 *           collisions de mots-clés entre métiers, cas limites géo.
 * Sortie : rapport + code retour ≠ 0 si un problème BLOQUANT est détecté (pour le cron).
 * Usage : node audit_devis.js
 */
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const DIR = path.join(__dirname, "js");
global.window = global;

const problemes = [];        // bloquants
const avertissements = [];   // à surveiller
const P = (m) => problemes.push(m);
const W = (m) => avertissements.push(m);

// 0. Syntaxe de tous les fichiers JS
const jsFiles = fs.readdirSync(DIR).filter((f) => f.endsWith(".js"));
for (const f of jsFiles) {
  try { cp.execFileSync("node", ["-c", path.join(DIR, f)], { stdio: "pipe" }); }
  catch (e) { P(`SYNTAXE cassée : js/${f}`); }
}

// Charger le socle + tous les catalogues + parsers (ordre : parser.js d'abord pour extraireNombre)
function safeReq(f) { try { require(path.join(DIR, f)); return true; } catch (e) { P(`CHARGEMENT échoué : js/${f} (${e.message.slice(0,60)})`); return false; } }
safeReq("parser.js"); safeReq("pricing-geo.js");
jsFiles.filter((f) => f.startsWith("pricing-") && f !== "pricing-geo.js").forEach(safeReq);
jsFiles.filter((f) => f.startsWith("parser-")).forEach(safeReq);

// Découverte des métiers : window.CATALOGUE_XXX + parser source
const UNITES = new Set(["u", "m²", "ml", "forfait", "h"]);
const metiers = {};
for (const key of Object.keys(global)) {
  if (/^CATALOGUE_[A-Z]+$/.test(key)) {
    const nom = key.replace("CATALOGUE_", "").toLowerCase();
    metiers[nom] = { cat: global[key], parserFile: null };
  }
}
// Associer les fichiers parser (parser-<metier>.js, + parser.js pour peinture)
for (const f of jsFiles.filter((x) => x.startsWith("parser"))) {
  const src = fs.readFileSync(path.join(DIR, f), "utf8");
  const mm = f === "parser.js" ? "peinture" : f.replace("parser-", "").replace(".js", "");
  if (metiers[mm]) metiers[mm].parserFile = { f, src };
}

// 1. Intégrité des catalogues
for (const [m, o] of Object.entries(metiers)) {
  for (const [k, v] of Object.entries(o.cat)) {
    if (typeof v.prixRef !== "number" || v.prixRef <= 0) P(`${m}: prix invalide sur "${k}" (${v.prixRef})`);
    if (!UNITES.has(v.unite)) P(`${m}: unité invalide sur "${k}" (${v.unite})`);
    if (!v.label) P(`${m}: label manquant sur "${k}"`);
  }
}

// 2. Règles parser orphelines + 3. accents + coverage
const actions = (src) => [...src.matchAll(/action:\s*"([a-z_]+)"/g)].map((x) => x[1]);
const kwsOf = (src) => { const r = []; for (const m of src.matchAll(/cles:\s*\[([^\]]+)\]/g)) for (const w of m[1].matchAll(/"([^"]+)"/g)) r.push(w[1]); return r; };
for (const [m, o] of Object.entries(metiers)) {
  if (!o.parserFile) { W(`${m}: pas de fichier parser associé`); continue; }
  const src = o.parserFile.src;
  if (!src.includes('normalize("NFD")')) P(`${m}: normalisation accents ABSENTE dans ${o.parserFile.f}`);
  if (m !== "peinture") {
    const orph = [...new Set(actions(src))].filter((a) => !o.cat[a]);
    if (orph.length) P(`${m}: règles orphelines → ${orph.join(", ")}`);
    const sansRegle = Object.keys(o.cat).filter((k) => !src.includes(`"${k}"`) && k !== "deplacement" && !k.startsWith("main_oeuvre"));
    if (sansRegle.length > Math.max(3, Object.keys(o.cat).length * 0.35)) W(`${m}: ${sansRegle.length} clés sans règle voix (manuel OK, mais couverture faible)`);
  }
}

// 4. Collisions mots-clés entre métiers (hors mots génériques)
const GENERIQUES = new Set(["deposer", "déposer", "depose", "dépose", "deplacement", "raccordement"]);
const kwByMetier = {};
for (const [m, o] of Object.entries(metiers)) if (o.parserFile) kwByMetier[m] = new Set(kwsOf(o.parserFile.src).filter((k) => !GENERIQUES.has(k)));
const noms = Object.keys(kwByMetier);
for (let i = 0; i < noms.length; i++) for (let j = i + 1; j < noms.length; j++) {
  const inter = [...kwByMetier[noms[i]]].filter((x) => kwByMetier[noms[j]].has(x));
  if (inter.length) W(`collision mots-clés ${noms[i]} ∩ ${noms[j]} (sur-détection possible en multi) : ${inter.slice(0, 10).join(", ")}`);
}

// 5. Géo cas limites
if (typeof window.coefZoneFromCP === "function") {
  const cas = [["75011", 1.25], ["92100", 1.15], ["15000", 0.90], ["44000", 1.05], ["99999", 1.00], ["", 1.00]];
  for (const [cp2, exp] of cas) { const g = window.coefZoneFromCP(cp2); if (g !== exp) P(`géo: CP ${cp2 || "(vide)"} → ${g}, attendu ${exp}`); }
} else P("géo: coefZoneFromCP absente");

// Rapport
const date = new Date().toISOString().slice(0, 16).replace("T", " ");
console.log(`\n===== AUDIT DEVIS BatiSpot — ${date} =====`);
console.log(`Métiers audités : ${Object.keys(metiers).join(", ")} (${Object.keys(metiers).length})`);
console.log(`Prestations totales : ${Object.values(metiers).reduce((s, o) => s + Object.keys(o.cat).length, 0)}`);
console.log(`\nBLOQUANTS : ${problemes.length}`);
problemes.forEach((p) => console.log("  ❌ " + p));
console.log(`\nAVERTISSEMENTS : ${avertissements.length}`);
avertissements.forEach((a) => console.log("  ⚠️  " + a));
console.log(problemes.length ? "\n=> ÉCHEC (bloquants à corriger)" : "\n=> ✅ OK (aucun bloquant)");
process.exit(problemes.length ? 1 : 0);
