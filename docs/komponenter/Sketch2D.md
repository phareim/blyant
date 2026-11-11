# Sketch2D

Blyanten over et ferdig bilde: et lerret fra et spill, pikselkunst, et foto, en videorute. Samme hånd som Sketch3D: kanten mellom to flater blir en kontur tegnet to ganger med skjelving, lys blir skravur i tre retninger, farge blir fargeblyant med papirkorn. Ren WebGL, ingen avhengigheter. Følger Papir og Kull: på mørkt ark tegnes det lyse med kritt.

```js
const pencil = new Blyant.Sketch2D({ lineWidth: 1.1, detail: 0.55, hatchGap: 5.5, grid: 16 });
function frame(t) {
  tegnSpillet(spill);                       // ditt eget 2D-lerret, uten lys
  pencil.render(spill, { pixel: 4, light: lyskart, origin: [kamera.x, kamera.y], time: t / 1000 });
  requestAnimationFrame(frame);
}
el.appendChild(pencil.canvas);              // eller ctx.drawImage(pencil.canvas, 0, 0)
```

- `render(kilde, { pixel })`: `pixel` er skjermpiksler per kildepiksel. Pikselkunst vil ha 3–5. Et foto tegnes med `pixel: 1` og `smooth: true`.
- `light` er et bilde til, like stort som kilden: lyst der lyset faller. Det blir skravur, og en farget lampe blir et lett strøk fargeblyant. `lightRef` (0–1) sier hvilken lyshet som er vanlig lys. Uten `light` leser blyanten bildets egen lyshet.
- `origin: [x, y]` er hvor utsnittet ligger i en større verden, i kildepiksler. Da følger hånda verden, og streken står stille når kameraet flytter seg.
- `exposure` løfter et mørkt bilde før blyanten leser det (2 passer for nattscener): mer av arket blir stående bart. `shade` er hvor hardt blyanten trykker, `colour` hvor mye fargeblyant (0 er bare grafitt), `detail` hvor liten forskjell mellom to farger som fortsatt får en strek.
- `grid` tegner rutepapir: én rute per så mange kildepiksler. Bruk flisestørrelsen i et flisespill.
- `mix` (0–1) i `render` lar skissen komme fram i flekker over kilden. Bruk det til en overgang.
- `set({ … })` endrer valgene. `paper`, `ink` og `faint` tar et token (`"--paper"`), en hex eller en CSS-farge; uten dem brukes Blyants egne. `boil: true` lar streken koke. Slå det av ved `prefers-reduced-motion`.
- `pencil.ok` er `false` uten WebGL. Da legges bildet lett på arket i stedet, så siden fortsatt kan leses.
- Lerretet er like stort som skissen i skjermpiksler. Sett CSS-bredden selv på en skjerm med høy tetthet, og gi `pixelRatio` samme tall, så blir streken like tykk som ellers i Blyant.
- `pencil.dispose()` når visningen forlates.
