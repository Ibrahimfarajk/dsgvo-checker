# Contributing

Danke fuers Mitmachen.

## Bug reports

Bitte Issue oeffnen mit:
- URL die gecheckt wurde (oder ein anonymisierter HTML-Snippet wenn die URL nicht oeffentlich ist)
- Was hat der Checker gefunden / nicht gefunden
- Was haettest du erwartet

## Neue Tracker-Patterns

Patterns leben in `functions/api/check.js` unter `TRACKER_PATTERNS`. Format:

```javascript
{
  re: /https?:\/\/example-tracker\.com/i,
  rule: "Klartextname des Trackers",
  rechtsgrundlage: "§ 25 TTDSG / DSGVO Art. 6",
  schweregrad: "SICHER" | "WAHRSCHEINLICH" | "HINWEIS",
  fix: "Konkrete Loesung"
}
```

Bitte pro PR maximal 3-5 neue Patterns, damit Review machbar bleibt.

Wichtig: Patterns sollen **eindeutig** sein, keine False-Positives. Lieber strikt halten und einen Pattern weniger.

## Pull-Requests

1. Fork
2. Branch von `main`
3. Patterns hinzufuegen + im PR-Body kurz die Rechtsgrundlage erklaeren
4. Wenn moeglich Test im `tests/`-Ordner ergaenzen

## Code-Style

Vanilla JavaScript, keine Build-Pipeline. Halte es einfach.
