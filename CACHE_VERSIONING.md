# Cache versionering (Cloudflare)

Denne app bruger query-versionering på statiske assets i `index.html`:

- `styles.css?v=...`
- `app.js?v=...`

Regel:

1. Når du ændrer i `styles.css` eller `app.js`, skal du opdatere versionstallet i `index.html`.
2. Brug samme versionstal på begge links.
3. Brug semantisk versionering, fx `1.0`, `1.1`, `1.2`.

Eksempel:

Opdater begge linjer i `index.html` fra fx `?v=1.0` til `?v=1.1`.
