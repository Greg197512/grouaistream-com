/* GrouAI Stream — wspólny silnik landing page lead-gen (Google Ads).
   Łapie gclid + utm z URL, wysyła lead do huba (z wymaganą zgodą RODO),
   odpala konwersję Google Ads. Statyczne = szybkie = wysoki Quality Score.

   >>> GREG: gdy założysz konwersję w Google Ads, wklej tu swoje ID i label: <<< */
window.GROUAI_LEAD_CONFIG = {
  HUB_URL: "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/capture-lead",
  // Z Google Ads → Cele → Konwersje → (Twoja akcja) → „Konfiguracja tagu":
  GOOGLE_ADS_ID: "AW-XXXXXXXXXX",        // np. AW-1234567890  (zostaw XX = konwersje wyłączone)
  CONVERSION_LABEL: "XXXXXXXXXXXXXXXXXX", // etykieta konwersji
};

(function () {
  var cfg = window.GROUAI_LEAD_CONFIG;

  // --- gclid + utm z adresu URL ---
  var qs = new URLSearchParams(location.search);
  function pick(k) { return qs.get(k) || ""; }
  var tracking = {
    gclid: pick("gclid"),
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_term: pick("utm_term"),
    utm_content: pick("utm_content"),
    landing_path: location.pathname,
  };
  // zapamiętaj gclid między podstronami
  try {
    if (tracking.gclid) localStorage.setItem("groua_gclid", tracking.gclid);
    else tracking.gclid = localStorage.getItem("groua_gclid") || "";
  } catch (e) {}

  // --- Google Ads gtag (tylko gdy ID uzupełnione) ---
  var adsReady = cfg.GOOGLE_ADS_ID && cfg.GOOGLE_ADS_ID.indexOf("X") === -1;
  if (adsReady) {
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + cfg.GOOGLE_ADS_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", cfg.GOOGLE_ADS_ID);
  }
  function fireConversion() {
    if (adsReady && cfg.CONVERSION_LABEL.indexOf("X") === -1) {
      window.gtag("event", "conversion", { send_to: cfg.GOOGLE_ADS_ID + "/" + cfg.CONVERSION_LABEL });
    }
    if (window.dataLayer) window.dataLayer.push({ event: "lead_captured" });
  }

  // --- obsługa formularza ---
  window.initLeadForm = function (segment) {
    var form = document.getElementById("lead-form");
    var msg = document.getElementById("lead-msg");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = (form.email.value || "").trim();
      var consent = form.consent && form.consent.checked;
      if (!email) { show("Podaj adres e-mail.", true); return; }
      if (!consent) { show("Zaznacz zgodę, żebyśmy mogli się odezwać.", true); return; }
      var btn = form.querySelector("button[type=submit]");
      if (btn) { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = "Wysyłam…"; }

      var payload = Object.assign({
        email: email,
        name: form.name ? (form.name.value || "").trim() : "",
        company: form.company ? (form.company.value || "").trim() : "",
        brief: form.brief ? (form.brief.value || "").trim() : "",
        segment: segment,
        consent: true,
        website: form.website ? form.website.value : "", // honeypot
      }, tracking);

      fetch(cfg.HUB_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) {
            if (d.fire_conversion) fireConversion();
            form.style.display = "none";
            var ty = document.getElementById("lead-thankyou");
            if (ty) ty.style.display = "block";
          } else {
            show(d && d.error === "consent_required" ? "Zaznacz zgodę." : "Coś poszło nie tak — spróbuj ponownie.", true);
            if (btn) { btn.disabled = false; btn.textContent = btn.dataset.t; }
          }
        })
        .catch(function () {
          show("Błąd połączenia — spróbuj ponownie za chwilę.", true);
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.t; }
        });
    });
    function show(t, err) {
      if (!msg) return;
      msg.textContent = t;
      msg.style.color = err ? "#ff8a8a" : "#7CFF9B";
    }
  };
})();
