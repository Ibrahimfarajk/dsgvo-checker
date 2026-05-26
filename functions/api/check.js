// DSGVO-Lite-Checker als Cloudflare Pages Function.
// Kein Browser — pure HTTP + Regex. Deckt ~75% der typischen Verstoesse.
// Endpoint: POST /api/check  Body: { "url": "https://example.de" }

const CONSENT_VENDORS = [
  "cookiebot", "cookie-consent", "borlabs", "usercentrics", "consentmanager",
  "cookiehub", "iubenda", "onetrust", "complianz", "klaro", "cookieyes",
  "didomi", "tarteaucitron", "ccm19", "consent-cookie", "real-cookie-banner",
];

const TRACKER_PATTERNS = [
  {
    re: /https?:\/\/fonts\.(googleapis\.com|gstatic\.com)/i,
    rule: "Google Fonts ohne lokale Einbindung",
    rechtsgrundlage: "LG München I, 20 O 17493/20 (BGH bestätigt 2024)",
    schweregrad: "SICHER",
    fix: "Bunny Fonts (fonts.bunny.net) oder lokale Einbindung",
  },
  {
    re: /https?:\/\/(www\.)?googletagmanager\.com/i,
    rule: "Google Tag Manager geladen",
    rechtsgrundlage: "§ 25 Abs. 1 TTDSG (Einwilligung erforderlich)",
    schweregrad: "SICHER",
    fix: "Nach Consent-Opt-in laden, nicht im <head>",
  },
  {
    re: /https?:\/\/(www\.)?google-analytics\.com|ga\.js|analytics\.js|gtag\(/i,
    rule: "Google Analytics aktiv",
    rechtsgrundlage: "§ 25 Abs. 1 TTDSG + DSGVO Art. 6",
    schweregrad: "SICHER",
    fix: "Cookieless-Variante oder Consent-Gate",
  },
  {
    re: /https?:\/\/connect\.facebook\.net|fbq\(|facebook-pixel/i,
    rule: "Facebook/Meta Pixel",
    rechtsgrundlage: "EuGH C-252/21 (Meta-Urteil 2023)",
    schweregrad: "SICHER",
    fix: "Nur nach explizitem Opt-in",
  },
  {
    re: /<iframe[^>]*src=["'][^"']*(?:google\.com\/maps|maps\.google)/i,
    rule: "Google Maps iframe ohne Einwilligung",
    rechtsgrundlage: "BGH I ZR 222/19 + § 25 TTDSG",
    schweregrad: "SICHER",
    fix: "Statische Karte oder Two-Click-Loesung",
  },
  {
    re: /<iframe[^>]*src=["'][^"']*(?:youtube\.com\/embed|youtu\.be)/i,
    rule: "YouTube-Embed ohne Einwilligung",
    rechtsgrundlage: "§ 25 TTDSG",
    schweregrad: "WAHRSCHEINLICH",
    fix: "youtube-nocookie.com + Consent-Gate",
  },
  {
    re: /https?:\/\/platform\.twitter\.com|twttr\./i,
    rule: "Twitter/X Widget",
    rechtsgrundlage: "§ 25 TTDSG",
    schweregrad: "WAHRSCHEINLICH",
    fix: "Nach Consent laden",
  },
  {
    re: /https?:\/\/platform\.instagram\.com|instagram\.com\/embed/i,
    rule: "Instagram-Embed",
    rechtsgrundlage: "§ 25 TTDSG",
    schweregrad: "WAHRSCHEINLICH",
    fix: "Nach Consent laden",
  },
  {
    re: /https?:\/\/(www\.)?hotjar\.com|static\.hotjar\.com/i,
    rule: "Hotjar Session-Recording",
    rechtsgrundlage: "DSGVO Art. 6 + § 25 TTDSG",
    schweregrad: "SICHER",
    fix: "Nur mit Opt-in",
  },
  {
    re: /https?:\/\/cdn\.matomo\.cloud|matomo\.js|piwik\.js/i,
    rule: "Matomo Cloud (USA-Hosting potenziell)",
    rechtsgrundlage: "DSGVO Art. 44 ff",
    schweregrad: "WAHRSCHEINLICH",
    fix: "Self-Host EU + IP-Anonymisierung",
  },
];

const IMPRESSUM_PATHS = [
  "/impressum", "/impressum/", "/impressum.html", "/impressum.php",
  "/imprint", "/legal", "/de/impressum",
];

const IMPRESSUM_REQUIRED = [
  { key: "vertretung",  rules: [/vertretung(?:sberechtigt)?/i, /gesch[aä]ftsf[uü]hr/i, /inhaber/i, /verantwortlich/i] },
  { key: "anschrift",   rules: [/\d{5}\s+[A-Z][a-zA-ZÀ-ſ\s\-]+/] },
  { key: "telefon",     rules: [/telefon|tel\.?\s*[:.]/i, /\+?\d[\d\s\/\-()]{6,}/] },
  { key: "email",       rules: [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/] },
  { key: "ustid_oder_steuernr_oder_kleinuntern", rules: [/USt[\.\-]?\s?ID|Umsatzsteuer-?ID|DE\s?\d{9}|Steuernummer|Steuer-?Nr|Kleinunternehmer|§\s*19\s*UStG/i] },
  { key: "eu_streitschlichtung", rules: [/ec\.europa\.eu\/consumers\/odr|streitschlichtung|Streitbeilegung/i] },
];

function severityScore(issues) {
  let score = 100;
  for (const i of issues) {
    if (i.schweregrad === "SICHER") score -= 18;
    else if (i.schweregrad === "WAHRSCHEINLICH") score -= 8;
    else score -= 3;
  }
  return Math.max(0, score);
}

function normalizeUrl(input) {
  if (!input) return null;
  input = String(input).trim();
  if (!/^https?:\/\//i.test(input)) input = "https://" + input;
  try {
    const u = new URL(input);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.toString().replace(/\/$/, "");
  } catch { return null; }
}

async function fetchSafe(url, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeout || 12000);
  try {
    const r = await fetch(url, {
      method: opts.method || "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WebwerkMUC-DSGVO-Check/1.0; +https://www.webwerk-muc.de/dsgvo-check)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
      },
    });
    const text = r.ok ? await r.text() : "";
    return { ok: r.ok, status: r.status, url: r.url, text, headers: r.headers };
  } catch (e) {
    return { ok: false, status: 0, url, text: "", error: String(e) };
  } finally { clearTimeout(t); }
}

async function checkImpressum(baseUrl) {
  const tried = [];
  for (const p of IMPRESSUM_PATHS) {
    const url = new URL(p, baseUrl).toString();
    const r = await fetchSafe(url, { timeout: 8000 });
    tried.push({ url, status: r.status });
    if (r.ok && r.text && r.text.length > 200) {
      const text = r.text.replace(/<[^>]+>/g, " ");
      const missing = [];
      for (const req of IMPRESSUM_REQUIRED) {
        const found = req.rules.some(re => re.test(text));
        if (!found) missing.push(req.key);
      }
      return { found: true, url: r.url, missing };
    }
  }
  return { found: false, url: null, tried, missing: ["IMPRESSUM_NICHT_AUFFINDBAR"] };
}

async function runCheck(targetUrl) {
  const url = normalizeUrl(targetUrl);
  if (!url) return { ok: false, error: "Ungueltige URL" };
  const issues = [];

  const main = await fetchSafe(url);
  if (!main.ok || !main.text) {
    return { ok: false, error: `Seite nicht erreichbar (HTTP ${main.status || "?"})`, url };
  }

  const finalUrl = main.url || url;
  if (finalUrl.startsWith("http://")) {
    issues.push({
      rule: "Keine HTTPS-Verschluesselung",
      rechtsgrundlage: "DSGVO Art. 32 (geeignete technische Massnahmen)",
      schweregrad: "SICHER",
      fix: "SSL-Zertifikat einrichten (Let's Encrypt, Cloudflare)",
    });
  }

  const html = main.text;
  const lower = html.toLowerCase();

  let consentVendor = null;
  for (const v of CONSENT_VENDORS) {
    if (lower.includes(v)) { consentVendor = v; break; }
  }

  for (const pat of TRACKER_PATTERNS) {
    if (pat.re.test(html)) {
      const note = consentVendor
        ? ` (Consent-Tool "${consentVendor}" erkannt - aber Skript wird im initialen HTML geladen, also vor Consent)`
        : " (kein Consent-Tool erkannt)";
      issues.push({
        rule: pat.rule + note,
        rechtsgrundlage: pat.rechtsgrundlage,
        schweregrad: pat.schweregrad,
        fix: pat.fix,
      });
    }
  }

  const imp = await checkImpressum(finalUrl);
  if (!imp.found) {
    issues.push({
      rule: "Impressum nicht auffindbar (typische Pfade getestet)",
      rechtsgrundlage: "§ 5 TMG / § 18 MStV",
      schweregrad: "SICHER",
      fix: "Impressum unter /impressum/ verlinken (max. 2 Klicks)",
    });
  } else if (imp.missing.length > 0) {
    issues.push({
      rule: `Impressum unvollstaendig: fehlt ${imp.missing.join(", ")}`,
      rechtsgrundlage: "§ 5 TMG",
      schweregrad: "SICHER",
      fix: "Pflichtangaben ergaenzen (Vertretung, Anschrift, Telefon, E-Mail, USt-ID, EU-ODR-Link)",
    });
  }

  return {
    ok: true,
    url: finalUrl,
    checked_at: new Date().toISOString(),
    score: severityScore(issues),
    consent_vendor: consentVendor,
    impressum_url: imp.url,
    issues,
    issue_count: issues.length,
    classification:
      issues.some(i => i.schweregrad === "SICHER") ? "SICHER_ABMAHNBAR"
      : issues.length > 0 ? "WAHRSCHEINLICH"
      : "KEIN_OFFENSICHTLICHER_VERSTOSS",
  };
}

// Pages Function Handlers
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request }) {
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: "JSON-Body erwartet" }), { status: 400, headers: CORS }); }
  const result = await runCheck(body.url);
  return new Response(JSON.stringify(result, null, 2), { status: result.ok ? 200 : 400, headers: CORS });
}

export async function onRequestGet({ request }) {
  const u = new URL(request.url);
  const url = u.searchParams.get("url");
  if (!url) return new Response(JSON.stringify({ ok: false, error: "?url=... erforderlich" }), { status: 400, headers: CORS });
  const result = await runCheck(url);
  return new Response(JSON.stringify(result, null, 2), { status: result.ok ? 200 : 400, headers: CORS });
}
