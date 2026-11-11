# Toolbar

En liten flytende palett med ikonknapper, for verktøy på et lerret eller en tavle: flytt, tegn, skriv, slett. Under den kan en kompakt rad holde valgene for verktøyet som er i bruk: farge, tykkelse, tekststørrelse.

**Markup:**

```html
<div class="b-toolbar" role="toolbar" aria-label="Verktøy">
  <button class="b-toolbar__btn" type="button" aria-pressed="true" aria-label="Flytt" title="Flytt"><svg viewBox="0 0 64 64" aria-hidden="true"></svg></button>
  <button class="b-toolbar__btn" type="button" aria-pressed="false" aria-label="Blyant" title="Blyant"><svg viewBox="0 0 64 64" aria-hidden="true"></svg></button>
  <span class="b-toolbar__sep"></span>
  <button class="b-toolbar__btn b-toolbar__btn--marker" type="button" aria-label="Spør om hjelp" title="Spør om hjelp"><svg viewBox="0 0 64 64" aria-hidden="true"></svg></button>
</div>

<div class="b-toolbar b-toolbar--compact" role="toolbar" aria-label="Blyant">
  <button class="b-toolbar__swatch" type="button" style="--b-swatch: var(--ink)" aria-pressed="true" aria-label="Grafitt" title="Grafitt"></button>
  <button class="b-toolbar__swatch" type="button" style="--b-swatch: var(--dust-red)" aria-pressed="false" aria-label="Rød" title="Rød"></button>
  <span class="b-toolbar__sep"></span>
  <button class="b-toolbar__size" type="button" style="--b-size: 4px" aria-pressed="true" aria-label="Tynn" title="Tynn"></button>
  <button class="b-toolbar__size" type="button" style="--b-size: 9px" aria-pressed="false" aria-label="Tykk" title="Tykk"></button>
  <span class="b-toolbar__sep"></span>
  <button class="b-toolbar__text" type="button" aria-pressed="true" aria-label="Overskrift" title="Overskrift">Aa</button>
</div>
```

- Paletten er en lapp oppå lerretet. Plasser den selv med `position: fixed` eller `absolute`, og hold den unna kantene på telefon med `env(safe-area-inset-*)`, for eksempel `bottom: max(var(--space-4), env(safe-area-inset-bottom))`. Kall `Blyant.ink(paletten)` når den vises, så får den blyantstrek rundt seg.
- `b-toolbar--vertical` stabler knappene i en søyle langs kanten. `b-toolbar--compact` er raden med valg for verktøyet som er i bruk; knappene er mindre enn 44px, så hold hovedverktøyene i den vanlige størrelsen.
- Tegn ikonene med `Blyant.figure` eller `Blyant.rough` i en `viewBox` på 64×64, i `ink`. Høyst én effektfarge som fyll. Ikonet får `aria-hidden="true"`, knappen får `aria-label` og `title` med det samme ordet.
- Verktøyet som er i bruk har `aria-pressed="true"` og ligger på `paper-3`. Bare ett om gangen. Knapper som gjør noe med en gang (angre, slett) har ikke `aria-pressed`.
- `b-toolbar__btn--marker` er den ene handlingen som betyr mest, på tusj. Høyst én per palett.
- `is-busy` på en knapp lar ikonet kruse seg som en blyant i arbeid mens noe holder på. Sett `aria-busy="true"` på knappen samtidig. Uten bevegelse (`prefers-reduced-motion`) står streken stille.
- `disabled` gråner ut en knapp som ikke kan brukes nå, som «Angre» uten noe å angre.
- `b-toolbar__sep` deler paletten i grupper. `b-toolbar__swatch` er en farge (`--b-swatch`), `b-toolbar__size` en tykkelse (`--b-size`, prikken er så stor som streken), `b-toolbar__text` et tekstvalg som «Aa».
- Gi paletten `role="toolbar"` og en `aria-label`. Piltastene flytter fokus mellom knappene (roving tabindex), og det skriver du selv.
- Hold den liten: bare verktøy, ingen tekst ved siden av ikonene. Det som trenger forklaring, hører hjemme i en `b-menu` eller i siden.
