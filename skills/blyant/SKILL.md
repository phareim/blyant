---
name: blyant
description: Use when you build or style anything people look at (a web page, an app, a game's HUD or menus, a document, a presentation, a dashboard, a chart, a prototype, a wireframe, a Claude artifact) and neither the user nor the project names another look. Blyant is Petter's own hand-drawn pencil design system (npm `blyant`, source `~/github/blyant`) and the default. Also use when a page built on Blyant needs an element Blyant lacks, and whenever you change Blyant itself. Another look counts when a brand or style book is named (Zaptec, Miles, Neon Dreams, Eventyrland, Alvheim, Ganymede) or the project already has an established look of its own. Trigger on blyant, «skisse», «håndtegnet», «wireframe», «lag en side», «ny app», «lag et dashbord».
---

# Blyant

Blyant er standard-designsystemet. Det gjelder alt som skal ses: nettsider, apper, spill-HUD, dokumenter, presentasjoner, dashbord, grafer, prototyper og artefakter. Bruk det når verken Petter eller prosjektet sier noe annet.

**Noe annet er sagt** når Petter navngir en merkevare eller stil, når en skill for den finnes (`zaptec-design`, `miles-design`, `neon-dreams-design`, `style-books` for Eventyrland, Alvheim og Ganymede), eller når prosjektet allerede har sitt eget utseende i CSS, tokens eller en stilbok. Da styrer det, og du flytter ikke prosjektet over på Blyant uten at Petter ber om det. `make-interfaces-feel-better` og `tufte-viz` er tillegg som bygger videre på Blyant, ikke noe som erstatter det. Grafer i Blyant tegnes med `Blyant.chart`.

## Før du tegner

1. Les `~/github/blyant/README.md`. Den har prinsippene, fargene, typografien, strekene, 3D, grafene og flatene (nettside, dokument, blogg, presentasjon, spill, dashbord).
2. Slå opp komponenten du trenger i `~/github/blyant/docs/komponenter/<Navn>.md`. API-et står i `~/github/blyant/src/blyant.d.ts`.
3. Se hvordan det ser ut: <https://phareim.github.io/blyant/>. Kodeeksempler finner du i `~/github/blyant/examples/hex-skisse/`.

Uten `~/github/blyant` på maskinen (for eksempel i en sky-økt eller på en annen maskin): klon `https://github.com/phareim/blyant`, eller les de samme filene på GitHub.

Komponentene er Button, Field, Check, Box, Note, Tag, Marker, Nav, Tabs, Table, Placeholder, Slide, Rough, Sketch3D, HexBoard, LineChart, BarChart, ScatterChart, Segments, Stat, Frames, Prose, Sidenote, Entries, Empty, Menu, Toast, Editor og Checklist. Lista i `@ds-bundle`-linja øverst i `~/github/blyant/src/blyant.js` er alltid den riktige.

## Ta det inn

**Nettsider og apper:** bruk alltid en fast versjon. Finn den nyeste med `npm view blyant version`.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/blyant@X.Y.Z/dist/blyant.css">
<!-- bare for Sketch3D / HexBoard: three r147 før blyant.js -->
<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/blyant@X.Y.Z/dist/blyant.js"></script>
<body class="b-page"> … <script>Blyant.ink(document)</script>
```

Med byggeverktøy (Vite, Nuxt): `npm install blyant@X.Y.Z`, og importer `blyant/dist/blyant.css` og `blyant/dist/blyant.js`. Fontene lastes fra Google Fonts gjennom `@import` i `blyant.css`. Skal siden virke uten nett, importerer du `blyant/dist/blyant-core.css` og leverer Caveat, Architects Daughter og Cutive Mono selv (`@fontsource`). I Vue, Nuxt og React laster du `blyant.js` bare i nettleseren (i Nuxt: en `plugins/blyant.client.ts`), og kaller `Blyant.watch(document.body)` én gang i stedet for `Blyant.ink`. Da følger blyantstrekene med når rammeverket tegner siden på nytt.

**Artefakter i Claude:** en artefakt kan bare hente stilark fra Google Fonts, og skript bare i versjoner som er minst to uker gamle. En jsDelivr-lenke til Blyant virker derfor ikke. Legg `dist/blyant.css` og `dist/blyant.js` inline i siden, slik `examples/hex-skisse/index.html` er bygget. Ta dem fra `~/github/blyant/dist/`, eller last ned den faste versjonen fra jsDelivr hvis repoet ikke er der. Ikke bruk `components/bundle.css` fra Design System-artefakten: den mangler tokenene og Kull-temaet.

Lys og mørk følger `prefers-color-scheme`. `data-theme="light"` eller `"dark"` på `<html>` overstyrer. Temaene heter Papir og Kull.

Til et ferdig design med en merkevare skriver du et nytt skall med `data-skin`, slik README-en viser. Klassene i markupen blir stående.

## Når noe mangler

Bruk det som finnes før du lager noe nytt. Når siden trenger et element Blyant ikke har, avgjør du om det kan brukes igjen:

- **Kan det brukes igjen** (et element som lett dukker opp i en annen side, et annet spill eller et annet dokument, som en ny kontroll, et korttype, en graf eller en tilstand)? **Bygg det inn i Blyant først.** Gjør arbeidet i `~/github/blyant` og følg `~/github/blyant/CLAUDE.md`: kilden, komponentdokumentet, forhåndsvisningen, typene, README-en, testflaten og skjermbildene. Gi så ut en ny versjon (se under), og bruk den versjonen i prosjektet. Ikke lag en lokal kopi i prosjektet som skal «flyttes inn senere».
- **Er det bare for dette prosjektet** (innhold, oppsett eller en vri bare denne siden trenger)? Lag det lokalt i prosjektet, men bygg det av Blyant-tokens (`var(--ink)`, `var(--paper-2)`, `var(--line)`, `var(--stroke-pencil)`, `var(--space-4)`, `--dust-*`, `--chart-*`) og Blyant-strek (`data-ink`, `Blyant.rough`), så det ser ut som resten.

Er du i tvil, regn det som noe som kan brukes igjen. Si i rapporten hva som ble lagt inn i Blyant, og hva som ble laget lokalt.

## Når Blyant endres

Hver endring i det pakken leverer (`src/`, `tokens.json`) gir en ny versjon på npm, gitt ut i samme økt. `~/github/blyant/CLAUDE.md` har stegene, og `python3 release.py` gjør dem. Til slutt gjelder dette:

- Versjonen gis ut fra `main`. Gjøres arbeidet på en gren eller i en PR, gis den ut etter merge.
- Utgivelsen er ferdig når `npm view blyant version` viser den nye versjonen. At taggen er pushet, er ikke nok.
- Oppdater så den faste versjonen i prosjektet som trengte endringen.
