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
