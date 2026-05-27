# dsgvo-checker

> Schneller, kostenloser DSGVO/GDPR-Check für Webseiten — als Cloudflare Pages Function oder Standalone-Worker. Kein Browser, kein Backend, kein Lock-In.

**Live-Demo:** https://www.webwerk-muc.de/dsgvo-check/

Prüft eine deutsche Website auf die häufigsten Abmahn-Trigger:

- Google Fonts ohne lokale Einbindung (LG München I, 20 O 17493/20)
- Google Tag Manager / Analytics ohne Consent (§ 25 TTDSG)
- Meta/Facebook Pixel, Hotjar, Matomo Cloud
- Google Maps & YouTube Embeds ohne Two-Click-Lösung (BGH I ZR 222/19)
- Fehlende HTTPS-Verschlüsselung (DSGVO Art. 32)
- Impressum: Auffindbarkeit + Pflichtangaben (§ 5 TMG)

Antwort kommt als JSON mit Score (0–100), Verstößen, Rechtsgrundlage und konkreter Lösung.

## Warum noch ein DSGVO-Checker?

Bestehende Tools sind entweder hinter Mail-Wall, schicken die geprüfte URL an Werbenetzwerke, oder benötigen eine schwere Browser-Engine. Dieser hier:

- Läuft als **stateless Cloudflare Worker / Pages Function** — eine Datei, kein Server, kein Logging.
- Ist **MIT-lizenziert** und auf Eigen-Hosting ausgelegt (in ~30 Sekunden self-deployable).
- Verlässt sich nur auf reine HTTP-Requests + Regex — deckt damit ca. 75 % der typischen Verstöße ab. Was Browser-basierte Scanner zusätzlich finden (lazy-loaded Tracker per JS), wird offen kommuniziert, nicht überverkauft.
- Hat **deutsche Rechtsgrundlagen direkt verlinkt** — keine US-zentrierten Audits.

## Quick Start (Self-Host auf Cloudflare Pages)

```bash
git clone https://github.com/Ibrahimfarajk/dsgvo-checker.git
cd dsgvo-checker
npx wrangler pages deploy . --project-name=dsgvo-check
```

Dann erreichbar unter `https://dsgvo-check.<your>.pages.dev/api/check`. Cloudflare-Free-Tier reicht für 100.000 Checks pro Tag.

## API

### POST `/api/check`

Request:

```json
{ "url": "https://example.de" }
```

Response:

```json
{
  "ok": true,
  "url": "https://example.de/",
  "checked_at": "2026-05-26T23:21:13.767Z",
  "score": 64,
  "consent_vendor": null,
  "impressum_url": "https://example.de/impressum",
  "issues": [
    {
      "rule": "Google Fonts ohne lokale Einbindung (kein Consent-Tool erkannt)",
      "rechtsgrundlage": "LG München I, 20 O 17493/20 (BGH bestätigt 2024)",
      "schweregrad": "SICHER",
      "fix": "Bunny Fonts (fonts.bunny.net) oder lokale Einbindung"
    }
  ],
  "issue_count": 1,
  "classification": "SICHER_ABMAHNBAR"
}
```

### GET `/api/check?url=...`

Gleiche Logik, für CLI-Tests:

```bash
curl 'https://your-deployment/api/check?url=example.de'
```

## Klassifikation

| classification | Bedeutung |
|---|---|
| `KEIN_OFFENSICHTLICHER_VERSTOSS` | Keiner der getesteten Hard-Trigger gefunden. **Kein Freibrief** — manuelles Review empfohlen. |
| `WAHRSCHEINLICH` | Mindestens ein Verstoß mittlerer Schwere (z.B. YouTube ohne Consent). |
| `SICHER_ABMAHNBAR` | Mindestens ein Verstoß mit eindeutiger BGH/EuGH/LG-Grundlage. |

## Was der Checker NICHT findet

Transparenz ist wichtiger als ein hübscher Score. Diese Verstöße werden vom Lite-Check **nicht** erfasst:

- Tracker, die erst durch JavaScript nachgeladen werden (kein Browser)
- Cookies, die vor Consent gesetzt werden, aber kein bekanntes Pattern enthalten
- Server-Logs ohne Anonymisierung
- Auftragsverarbeitungsverträge (AVV) und Datenschutzerklärungs-Inhalte
- Drittland-Übermittlungen ohne Standardvertragsklauseln

Für eine vollständige Prüfung dieser Punkte → manuelles Audit (oder PR welcome).

## Eigene Trigger-Patterns ergänzen

Alle Regeln stehen in [`functions/api/check.js`](functions/api/check.js) in der Konstante `TRACKER_PATTERNS`. Format:

```javascript
{
  re: /https?:\/\/dein-tracker\.com/i,
  rule: "Klartextname des Tools",
  rechtsgrundlage: "Kurz-Verweis auf Norm/Urteil",
  schweregrad: "SICHER" | "WAHRSCHEINLICH" | "HINWEIS",
  fix: "Was tun, um den Verstoß zu beheben"
}
```

PRs mit weiteren Patterns sehr willkommen.

## Lizenz

MIT — siehe [LICENSE](LICENSE).

## Wer hat das gebaut

Ibrahim Faraj · [Webwerk MUC](https://www.webwerk-muc.de) — Webdesign-Agentur in München mit Fokus auf rechtssichere Handwerker-Websites.

Wenn der Check auf deiner Seite Verstöße findet und du sie nicht selbst beheben willst: [WhatsApp](https://wa.me/4917632588555) oder [kontakt@webwerk-muc.de](mailto:kontakt@webwerk-muc.de). Festpreis-Reparatur in 5–10 Werktagen.

---

## English

A fast, free German GDPR / TTDSG compliance scanner for websites. Single-file Cloudflare Pages Function, no browser, MIT-licensed.

Pattern-based detection of the most common abmahn-able (cease-and-desist) triggers under German privacy law: Google Fonts without local hosting, Tag Manager / Analytics / Pixel without consent, Maps / YouTube embeds without two-click loader, missing HTTPS, missing or incomplete Impressum (§ 5 TMG).

Patterns and rules are German-law-centric. PRs to extend to other jurisdictions are welcome.
