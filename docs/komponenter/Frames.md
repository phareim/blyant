# Frames

Tegneserieruter: fyller en vilkårlig flate med et vilkårlig antall ruter. Flaten kuttes i to, igjen og igjen, til antallet er nådd. Rammene tegnes med blyant oppå.

```js
var side = Blyant.frames(el, {
  count: 6,        // antall ruter
  geometry: 0.6,   // 0 = rolig rutenett, 1 = skjeve kutt, diagonaler og en rute lagt oppå
  seed: 4,         // samme seed gir samme side
  render: function (rute, i) { rute.body.textContent = "Rute " + (i + 1); }
});
side.update({ geometry: 1 });
```

Eller rett i HTML, med ett barn per rute:

```html
<div id="side" data-geometry="0.4" style="aspect-ratio: 16 / 9">
  <div>Først</div><div>Så</div><div>Til slutt</div>
</div>
<script>Blyant.frames(document.getElementById("side"));</script>
```

- Flaten må ha en høyde: sett `height` eller `aspect-ratio` på elementet. Siden legges ut på nytt når størrelsen endrer seg, med samme seed.
- Hver rute har `el` (hele polygonet, til bakgrunn og skravur) og `body` (det største rette rektangelet inni, til innhold). Legg tekst i `body`, så klippes den aldri av en skrå kant. `body` er en størrelses-container, så `cqmin` skalerer teksten med ruta.
- `render(rute, i, ny)` kalles ved hver utlegging. `rute.points`, `rute.bbox` og `rute.safe` er i piksler.
- Rutene ligger i leserekkefølge i DOM-en: øverst til nederst, venstre til høyre.
- `geometry` fra 0,7 legger én rute (to ved mange ruter) litt på skrå oppå de andre. Den kan stikke noen piksler utenfor flaten.
- Hold deg til 12–14 ruter på en flate. På smale flater blir rutene ellers for små til innhold.
- `Blyant.frames.layout(w, h, opts)` gir bare polygonene, uten DOM. Bruk den til canvas eller three.js.
- `numbers: true` skriver rutenummeret i hjørnet mens siden er en skisse.
