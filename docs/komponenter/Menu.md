# Menu

En liten lapp med valg: kommandopalett, forslag mens du skriver, innstillinger.

**Markup:**

```html
<ul class="b-menu" role="listbox">
  <li class="b-menu__label">Dokumenter</li>
  <li class="b-menu__item is-active" role="option" aria-selected="true">
    <span class="b-menu__text">Slik bygger du en hex-verden</span>
    <span class="b-menu__hint">W-RASK-HOPPER-REV</span>
  </li>
  <li class="b-menu__item" role="option"><span class="b-menu__text">Dagens dato</span><span class="b-menu__hint">/dato</span></li>
</ul>
```

- Menyen er en lapp oppå arket. Plasser den selv (`position: absolute`) ved det som åpnet den, og kall `Blyant.ink(menyen)` når den vises.
- Raden under pekeren eller piltastene får `is-active` eller `aria-selected="true"` og ligger på `paper-2`. Bare én rad om gangen.
- `b-menu__hint` står til høyre i `t-code`: en tast, en kommando eller en id. Den er valgfri.
- Valg der ett er i bruk (tema, sortering): `role="menuitemradio"` med `aria-checked="true"` eller `"false"` på hver rad. Den valgte får en hake foran.
- `b-menu__label` deler opp en lang meny. `b-menu__empty` sier at ingenting passer: «Ingenting passer.»
- Rader kan være `<li>`, `<button>` eller `<a>`. Menyen må kunne styres med piltaster, Enter og Esc; det skriver du selv.
