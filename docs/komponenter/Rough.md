# Rough

Håndtegnede SVG-former. `Blyant.rough.*` gir tilbake en `d`-streng; `Blyant.figure(svg, shapes)` tegner en hel figur med fargeblyant-fyll og grafittkorn.

```js
Blyant.figure(svg, [
  { type: "hex", cx: 60, cy: 60, r: 40, fill: "var(--marker)" },
  { type: "arrow", x1: 110, y1: 90, x2: 200, y2: 40 },
  { type: "hatch", points: [[220, 20], [300, 20], [300, 100], [220, 100]], gap: 7 }
]);
```

| Type | Felt |
| --- | --- |
| `line` | `x1 y1 x2 y2` |
| `rect` | `x y w h` |
| `circle`, `ellipse` | `cx cy r` / `cx cy rx ry` |
| `hex` | `cx cy r`, `flat` for flat topp |
| `poly`, `curve` | `points`, `closed` |
| `arrow` | `x1 y1 x2 y2`, `bend` |
| `hatch` | `points`, `gap`, `angle` |

Felles: `fill`, `fillOpacity`, `stroke`, `width`, `wobble`, `seed`. Samme `seed` gir samme strek. Standard skjelving leses fra `--b-wobble`, så skallet `clean` gir rette linjer.

**Grafittkorn.** `Blyant.draw(svg, d, stil)` tegner en `d`-streng med korn; `{ grain: false }` slår det av. Filterområdet legges rundt hver strek, fordi Safari og alle nettlesere på iPhone ikke tegner noe som helst når området er større enn 4096 × 4096 skjermpiksler. En strek som er større enn omtrent 1300 × 1300 px (regnet for 3× skjerm), tegnes uten korn i stedet for å forsvinne. `Blyant.drawParts` deler en slik strek i én `<path>` per delstrek, så hver side av et stort omriss beholder kornet; `figure`, `ink` og `frames` gjør det selv. I en SVG som vises forstørret, for eksempel en tavle med zoom, gjelder grensen etter forstørrelsen: slå av kornet når zoomen er stor.
