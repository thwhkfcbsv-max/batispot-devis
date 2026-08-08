/* =========================================================
   BatiSpot Devis — instrumentation d'usage (funnel + blocages)
   Insert anon dans devis_events (RLS : insert only). Fire-and-forget, jamais bloquant.
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

  window.BSTrack = function (type, meta) {
    try {
      var uid = (window.BSAuth && window.BSAuth.user && window.BSAuth.user()) ? window.BSAuth.user().id : null;
      fetch(ENDPOINT, {
        method: "POST",
        headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          session_id: sid(), event_type: String(type), user_id: uid,
          meta: meta || null, page: location.pathname, ua: (navigator.userAgent || "").slice(0, 180),
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  };
})();
