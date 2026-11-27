# Paint

Malepenselen: oljemaling med tekstur på et 2D-lerret. Et strøk er en bunt bust som legger tykk, dekkende maling med riller etter hårene, rygger som fanger lyset, en kant og en skygge under. Går penselen tom, eller trykker hånda lett, fester malingen seg bare på trådene i lerretet. Dras strøket gjennom våt maling, blir fargen med i busten. Rent canvas 2D, ingen avhengigheter. Samme frø og samme punkter gir samme piksler, så et lagret strøk kan males opp igjen i en annen størrelse.

```js
const s = new Blyant.Paint.Stroke(vått, {            // vått: 2D-konteksten til et gjennomsiktig lag
  color: "#c9463d", width: 28, seed: 1234,
  pick: (x, y) => fargenPåBildet(x, y),              // "#rrggbb" der det ligger våt maling, ellers null
});
lerret.onpointermove = e => s.add({ x: e.offsetX, y: e.offsetY, p: e.pressure });
lerret.onpointerup = () => {
  s.end();
  bilde.drawImage(vått.canvas, 0, 0);                // legg strøket på bildet, og tøm det våte laget
  lagre({ punkter, picked: s.picked });              // svarene fra pick følger strøket
};
```

- Det våte laget holder bare strøket som males nå. Skyggen legges under malingen og ryggene oppå, og det går bare på et lag for seg. Når strøket er ferdig, legges laget over bildet med `drawImage` og tømmes. `s.box` er `[x0, y0, x1, y1]` rundt alt strøket har malt, skyggen medregnet.
- `add({ x, y, p })` tar ett punkt om gangen, `p` er trykket fra 0 til 1 (uten `p` regnes 0,5). `Blyant.Paint.stroke(ctx, punkter, valg)` maler et helt strøk og gir `{ picked, box }`.
- `width` er bredden i brukerenheter (2–200). Under 6 blir strøket en ren strek med en kant. `load` (0,3–2) er hvor mye maling penselen har med seg: hvor langt den går før den blir tørr.
- `pick(x, y)` spørres omtrent én gang per bredde penselen flytter seg. Motoren leser aldri piksler selv. Skal et lagret strøk males opp igjen, gir du `picked` i stedet for `pick`, så blir det likt.
- `light: [x, y]` er retningen lyset kommer fra på skjermen (standard `[-0.6, -0.8]`, oppe til venstre). Konteksten kan være skalert, flyttet og dreid: størrelsene følger med, lyset står stille.
- `Blyant.Paint.fill(ctx, ringer, { color, seed, width, angle })` dekker en lukket form med penselstrøk: parallelle strøk på skrå og et tykkere strøk langs kanten. `ringer` er `[[x, y, x, y, …], …]`, og en ring inni en annen blir et hull. `angle` er i grader. Samme regel om det våte laget.
- `Blyant.Paint.weave(ctx, w, h, { color, strength })` tegner lerretet som bakgrunn: samme vev som den tørre penselen fester seg i, så malingen treffer trådene.
- `Blyant.Paint.hand([x, y, x, y, …], width, seed)` gjør en punktliste om til punkter med trykket til en hånd som lander, trykker og løfter. Bruk den til strøk som ikke kommer fra en penn.
- Lerretet er lin, uansett tema: gi flata en lys, varm farge (`#f7f0e1`), også i Kull.
