/* =========================================================
   BatiSpot Devis — instrumentation d'usage (funnel + blocages + campagnes)
   Insert anon dans devis_events (RLS : insert only). Fire-and-forget, jamais bloquant.
   - internal : true si l'appareil est marque interne (localStorage devix_internal=1) → exclu des stats.
   - utm : source/medium/campaign captures a l'arrivee (mesure des campagnes ciblees).
   ========================================================= */
(function () {
  "use strict";
  var ENDPOINT = "https://cisniwhaiydazdpzvino.supabase.co/rest/v1/devis_events";
  var KEY = "sb_publishable_LUXdyprriDy-_wcr7-r8Yw_3N8AP_s1";

  function sid() {
    try {
      var s = localStorage.getItem("devix_sid");
      if (!s) {
        s = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
        localStorage.setItem("devix_sid", s);
      }
      return s;
    } catch (e) { return null; }
  }

  // Capture les UTM a l'arrivee et les memorise (attribution des campagnes ciblees).
  function utm() {
    try {
      var p = new URLSearchParams(location.search);
      var got = {};
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
        var v = p.get(k); if (v) got[k] = v.slice(0, 80);
      });
      if (Object.keys(got).length) localStorage.setItem("devix_utm", JSON.stringify(got));
      var stored = localStorage.getItem("devix_utm");
      return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
  }

  function isInternal() {
    try { return !!localStorage.getItem("devix_internal"); } catch (e) { return false; }
  }

  window.BSTrack = function (type, meta) {
    try {
      var uid = (window.BSAuth && window.BSAuth.user && window.BSAuth.user()) ? window.BSAuth.user().id : null;
      var u = utm();
      var m = meta || null;
      if (u) { m = m || {}; m.utm = u; }
      fetch(ENDPOINT, {
        method: "POST",
        headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          session_id: sid(), event_type: String(type), user_id: uid, internal: isInternal(),
          meta: m, page: location.pathname, ua: (navigator.userAgent || "").slice(0, 180),
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  };
})();
