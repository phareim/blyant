# Checklist

Gjøremål: en rute å krysse av i, selve saken, og et kort notat til høyre.

**Markup:**

```html
<ul class="b-checklist">
  <li class="b-checklist__item">
    <label class="b-check"><input type="checkbox" aria-label="Ferdig"><span class="b-check__box"></span></label>
    <a class="b-checklist__title" href="…">Tegn kartet over myra</a>
    <span class="b-checklist__meta">I dag</span>
  </li>
  <li class="b-checklist__item is-done">
    <label class="b-check"><input type="checkbox" aria-label="Ferdig" checked><span class="b-check__box"></span></label>
    <a class="b-checklist__title" href="…">Spiss blyantene</a>
  </li>
  <li class="b-checklist__item">
    <span class="b-checklist__mark" aria-hidden="true">↻</span>
    <a class="b-checklist__title" href="…">Vann plantene</a>
    <span class="b-checklist__meta">Hver mandag</span>
  </li>
</ul>
```

- Ruta er en vanlig `Check`. Den har ingen synlig tekst, så `input` trenger `aria-label`.
- `is-done` på raden stryker tittelen med blyant og gjør den lysere. Sett den sammen med `checked`; du styrer begge selv.
- Tittelen er en lenke når saken har en egen side, en `<button>` i en plukkliste (se under), ellers en `<span>`. Lange titler kuttes med «…».
- `b-checklist__mark` står i stedet for ruta på rader som ikke kan krysses av: `↻` for noe som gjentar seg, `·` for et utkast. Ett tegn, og meningen står også et annet sted (i notatet, i et filter eller på saken sin side).
- `b-checklist__meta` er valgfri: en frist, et navn, en dato. Hold den kort, og skjul den på smale skjermer hvis tittelen trenger plassen.
- `b-checklist__desc` er en valgfri andre linje under tittelen, i `ink-soft`: sitatet fra en utheving, starten på en tekst. Den står sist i raden, på linje med tittelen, og kuttes med «…» etter én linje. Rader uten den ser ut som før.
- `is-active` legger raden på `paper-2`. Bruk den på raden piltastene står på. Bare én om gangen.
- En blyantstrek skiller radene. Er lista tom, sett en `Empty` i stedet.
- Skal noe bare velges, ikke gjøres, er det en `Menu` eller en rad med `Check`.

**Plukkliste.** Tittelen kan være en `<button>` som velger raden, for eksempel i et `Sheet` der du velger en kilde. Hele raden er da knappen, men ruta og lenker i raden ligger oppå og kan trykkes for seg. En rad som ikke kan velges, får `disabled` på knappen: tittelen blir lysere, og raden reagerer ikke på pekeren.

```html
<ul class="b-checklist">
  <li class="b-checklist__item">
    <span class="b-checklist__mark" aria-hidden="true">·</span>
    <button class="b-checklist__title" type="button">Kartet over myra</button>
    <span class="b-checklist__meta">Reader</span>
    <span class="b-checklist__desc">«Ti hexer med vann, tre med skog og en sti tvers over.»</span>
  </li>
  <li class="b-checklist__item">
    <span class="b-checklist__mark" aria-hidden="true">·</span>
    <button class="b-checklist__title" type="button" disabled>Notater fra mandag</button>
    <span class="b-checklist__meta">Brukt</span>
  </li>
</ul>
```
