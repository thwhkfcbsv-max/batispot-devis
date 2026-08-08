/* =========================================================
   BatiSpot Devis — Auth (magic-link) + sync cloud
   Chargé APRÈS vendor/supabase.js, AVANT app.js.
   Expose window.BSAuth.
   -----------------------------------------------------------
   Principe : l'app reste 100% utilisable sans compte (essai libre,
   localStorage). Le login n'intervient QUE pour sauver dans le cloud
   ou envoyer un devis. À la connexion, on fusionne local <-> cloud
   (aucune perte) puis le cloud devient la sauvegarde de l'artisan.
   ========================================================= */
(function () {
  "use strict";

  var SUPABASE_URL = "https://cisniwhaiydazdpzvino.supabase.co";
  var SUPABASE_ANON = "sb_publishable_LUXdyprriDy-_wcr7-r8Yw_3N8AP_s1";

  // Mêmes clés localStorage que l'app (app.js / wizard.js)
  var K_PROFIL = "devix_profil";
  var K_BIBLIO = "devix_bibliotheque";
  var K_COMPTEUR = "devix_compteur";

  var client = null;
  try {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    });
  } catch (e) {
    // supabase-js absent (offline au tout premier chargement) → mode local seul.
    client = null;
  }

  var _user = null;
  var _listeners = [];
  function notify() { _listeners.forEach(function (cb) { try { cb(_user); } catch (e) {} }); }

  // ---------- Helpers localStorage ----------
  function lget(k, fallback) { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch (e) { return fallback; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // uuid v4 (fallback si crypto.randomUUID absent) — cohérent avec app.js
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8); return v.toString(16);
    });
  }

  // ---------- Mapping snap (local) <-> row (cloud) ----------
  function snapToRow(snap) {
    return {
      id: snap.id,                       // identité stable (uuid) = clé de conflit
      user_id: _user && _user.id,
      numero: snap.numero,
      type: snap.type || "devis",
      statut: snap.statut || "brouillon",
      client_nom: (snap.client && snap.client.nom) || null,
      total_ttc: snap.totalTTC != null ? snap.totalTTC : null,
      piece: snap.piece || null,
      data: snap,
    };
  }
  function rowToSnap(row) {
    var s = row.data || {};
    s.id = row.id;
    s.numero = row.numero;
    s.type = row.type;
    s.statut = row.statut;
    if (row.total_ttc != null && s.totalTTC == null) s.totalTTC = row.total_ttc;
    return s;
  }
  // Clé d'identité = id stable. Fallback type:numero pour d'éventuels vieux snaps sans id.
  function docKey(s) { return s.id || ((s.type || "devis") + ":" + s.numero); }
  function ts(s) { return Date.parse(s && s.date) || 0; }

  // ---------- Cloud : profil ----------
  function pushProfil() {
    if (!client || !_user) return Promise.resolve();
    var p = lget(K_PROFIL, {});
    if (!p || !Object.keys(p).length) return Promise.resolve();
    var row = {
      user_id: _user.id, nom: p.nom || null, contact: p.contact || null, tel: p.tel || null,
      email: p.email || null, siret: p.siret || null, adresse: p.adresse || null, forme: p.forme || null,
      tva_intra: p.tvaIntra || null, decennale: p.decennale || null, mediateur: p.mediateur || null,
      couleur: p.couleur || null, logo: p.logo || null, compteur: lget(K_COMPTEUR, 0) || 0,
    };
    return client.from("profils_artisan").upsert(row, { onConflict: "user_id" })
      .then(function (r) { if (r.error) console.warn("[BSAuth] pushProfil", r.error.message); });
  }
  function pullProfil() {
    if (!client || !_user) return Promise.resolve(null);
    return client.from("profils_artisan").select("*").eq("user_id", _user.id).maybeSingle()
      .then(function (r) { return r.error ? null : r.data; });
  }

  // ---------- Cloud : documents ----------
  function pushDoc(snap) {
    if (!client || !_user) return Promise.resolve();
    if (!snap.id) snap.id = uuid();
    return client.from("documents").upsert(snapToRow(snap), { onConflict: "id" })
      .then(function (r) { if (r.error) console.warn("[BSAuth] pushDoc", r.error.message); });
  }
  function pullDocs() {
    if (!client || !_user) return Promise.resolve([]);
    return client.from("documents").select("*").eq("user_id", _user.id).order("created_at", { ascending: false })
      .then(function (r) { return r.error ? [] : (r.data || []).map(rowToSnap); });
  }

  // ---------- Fusion local <-> cloud à la connexion ----------
  function fullSync() {
    if (!client || !_user) return Promise.resolve();
    return Promise.all([pullDocs(), pullProfil()]).then(function (res) {
      var cloudDocs = res[0] || [];
      var cloudProfil = res[1];

      // --- Devis : union par clé, on garde le plus récent (date) ---
      var localDocs = lget(K_BIBLIO, []);
      var byKey = {};
      cloudDocs.forEach(function (s) { byKey[docKey(s)] = s; });
      localDocs.forEach(function (s) {
        var k = docKey(s);
        if (!byKey[k] || ts(s) >= ts(byKey[k])) byKey[k] = s;
      });
      var merged = Object.keys(byKey).map(function (k) { return byKey[k]; })
        .sort(function (a, b) { return ts(b) - ts(a); });
      merged.forEach(function (s) { if (!s.id) s.id = uuid(); }); // garantit un id stable partout
      lset(K_BIBLIO, merged);
      // Pousse tout le fusionné vers le cloud (convergence, idempotent)
      var pushes = merged.map(function (s) { return pushDoc(s); });

      // --- Compteur : max(local, cloud) ---
      var localCompteur = lget(K_COMPTEUR, 0) || 0;
      var cloudCompteur = (cloudProfil && cloudProfil.compteur) || 0;
      var maxNum = merged.reduce(function (m, s) { return Math.max(m, s.numero || 0); }, 0);
      var compteur = Math.max(localCompteur, cloudCompteur, maxNum);
      try { localStorage.setItem(K_COMPTEUR, String(compteur)); } catch (e) {}

      // --- Profil : local prime s'il a un nom, sinon on descend le cloud ---
      var localProfil = lget(K_PROFIL, {});
      if (localProfil && localProfil.nom) {
        pushes.push(pushProfil());
      } else if (cloudProfil && cloudProfil.nom) {
        lset(K_PROFIL, {
          nom: cloudProfil.nom, contact: cloudProfil.contact, tel: cloudProfil.tel, email: cloudProfil.email,
          siret: cloudProfil.siret, adresse: cloudProfil.adresse, forme: cloudProfil.forme,
          tvaIntra: cloudProfil.tva_intra, decennale: cloudProfil.decennale, mediateur: cloudProfil.mediateur,
          couleur: cloudProfil.couleur, logo: cloudProfil.logo,
        });
        if (cloudProfil.couleur && window.setBrand) window.setBrand(cloudProfil.couleur);
      }
      return Promise.all(pushes);
    }).then(function () {
      if (window.__onCloudSynced) window.__onCloudSynced();
    }).catch(function (e) { console.warn("[BSAuth] fullSync", e); });
  }

  // ---------- API publique ----------
  var BSAuth = {
    available: !!client,
    user: function () { return _user; },
    isLoggedIn: function () { return !!_user; },
    onChange: function (cb) { _listeners.push(cb); if (_user !== undefined) cb(_user); },

    sendMagicLink: function (email) {
      if (!client) return Promise.reject(new Error("offline"));
      var redirect = location.origin + location.pathname;
      return client.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: redirect, shouldCreateUser: true },
      }).then(function (r) { if (r.error) throw r.error; return r; });
    },

    // Connexion par code à 6 chiffres (iOS PWA, ou fallback si le lien ne reconnecte pas).
    verifyOtp: function (email, code) {
      if (!client) return Promise.reject(new Error("offline"));
      return client.auth.verifyOtp({ email: email, token: (code || "").trim(), type: "email" })
        .then(function (r) { if (r.error) throw r.error; return r; });
    },

    signOut: function () {
      if (!client) return Promise.resolve();
      return client.auth.signOut().then(function () {
        _user = null; notify();
      });
    },

    pushProfil: pushProfil,
    pushDoc: pushDoc,
    fullSync: fullSync,
  };
  window.BSAuth = BSAuth;

  // ---------- Bootstrap session ----------
  if (client) {
    client.auth.getSession().then(function (r) {
      _user = (r.data && r.data.session && r.data.session.user) || null;
      notify();
    });
    client.auth.onAuthStateChange(function (event, session) {
      var was = _user;
      _user = (session && session.user) || null;
      notify();
      // Connexion fraîche (magic link ou premier login) → fusion cloud
      if (_user && event === "SIGNED_IN" && (!was || was.id !== _user.id)) {
        fullSync();
      }
    });
  } else {
    _user = null;
    notify();
  }
})();
