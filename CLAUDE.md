# Blyant

Håndtegnet designsystem. Vanilla JS og CSS, ingen avhengigheter. Brukeren skriver norsk; svar, commit-meldinger og dokumentasjon er på norsk (bokmål).

## Kilder og bygg

- `src/` og `tokens.json` er kilden. `dist/` og `examples/hex-skisse/index.html` er generert: kjør `python3 build.py` og commit resultatet.
- `docs/komponenter/<Navn>.md` er retningslinjene per komponent. `designsystem/forhandsvisning/<Navn>.html` er forhåndsvisningen i Design System-artefakten.
- Ny komponent: legg navnet i `@ds-bundle`-linja øverst i `src/blyant.js`, skriv `docs/komponenter/<Navn>.md` og `designsystem/forhandsvisning/<Navn>.html`, og oppdater `src/blyant.d.ts` og README.
- Sjekk visuelle endringer med Playwright-skjermbilder av `examples/hex-skisse/index.html`, i både lyst (Papir) og mørkt (Kull) tema og på mobilbredde.

## Design System-artefakten i Claude

Blyant er publisert som en Design System-artefakt: https://claude.ai/artifact/PHdDmrVn92a3Ly1Vx4398B

Artefakten er en kopi og følger ikke repoet av seg selv. Når noe i `src/`, `tokens.json`, `docs/komponenter/` eller `designsystem/` endres og pushes til `main`, bygg og publiser artefakten på nytt i samme økt:

1. Oppdater `lastChange` i `designsystem/design-system.json` (tid og en kort norsk merknad om hva som er nytt).
2. `python3 build.py --ds` legger filene i `build/ds/project/`.
3. Les artefakten først (`action: "read"` med `paths` for filene du skal erstatte), og sjekk at den ikke har endringer som mangler i repoet. Har den det, hent dem inn i repoet først.
4. Publiser til artefaktens URL med `root: build/ds`, `file_path: build/ds/project/design-system.json`, og alle filene under `build/ds/project/` i `files`. `components/index.d.ts` må ha `contentType: "text/plain"`.

## Hex-skisse-artefakten i Claude

Testflaten er også publisert som en artefakt: https://claude.ai/artifact/Eh4C4o74E2GKVp1y14DbMs. Design System-artefakten lenker dit. Når `examples/hex-skisse/` eller biblioteket endres: kjør `python3 build.py`, les artefakten, og publiser `examples/hex-skisse/index.html` til den URL-en.

## Publisering

- GitHub Pages bygges av `.github/workflows/pages.yml` ved push til `main`.
- npm-pakken `blyant` publiseres av `.github/workflows/npm.yml` når en tag `v<versjon>` pushes. Versjonen i taggen må være lik `version` i `package.json`. Oppdater også jsDelivr-lenkene i README.
