# Game2D

Rigg for 2D-spill. Et spill er en enkel beskrivelse i JSON-form, og riggen kjører den: fysikk, kamera, poeng, liv, skjermbilder, lyd og styring med taster, mus og fingre. Figurene er egne tegninger (et lerret eller et bilde med gjennomsiktig bakgrunn) eller innebygde former tegnet med `Blyant.rough` og fargeblyant. Alt følger Papir og Kull.

```js
var spill = new Blyant.Game2D(el, {
  title: "Stjernejakten",
  kind: "platform",
  world: { width: 2400, height: 700, sky: "--dust-blue" },
  sprites: { katt: { image: tegningen }, eple: { shape: "apple" } },
  things: [
    { role: "player", sprite: "katt", x: 120, y: 570 },
    { role: "solid", x: 700, y: 470, w: 240, h: 40 },
    { role: "collect", sprite: "eple", x: 700, y: 400 },
    { role: "hazard", x: 1000, y: 580, move: "patrol", range: 220 },
    { role: "goal", x: 2200, y: 555, say: "Hit!" }
  ]
}, { sound: true });
spill.on("win", function (r) { console.log(r.score, r.lives, r.time); });
```

- Flaten må ha en høyde. Riggen fyller den med ett lerret og legger poeng, liv og skjermbilder oppå i HTML. Elementet får klassen `b-game`.
- Riggen kaster aldri på en rar beskrivelse. Tall klemmes, ukjente verdier får en standard, og det er alltid nøyaktig én spiller. `Blyant.Game2D.clean(spec)` gir beskrivelsen slik riggen ville kjørt den, uten å røre siden. `spill.spec` er den samme.
- Enheter: `x` går mot høyre og `y` nedover fra øverste venstre hjørne av verden. `x` og `y` er midten av tingen. Bakken er 80 enheter tykk (`Blyant.Game2D.GROUND`), så overkanten ligger på `world.height − 80`. Ting som ville havnet nede i bakken, løftes opp på den.
- Et hopp når omtrent 225 enheter opp (ganger `player.jump`), og en fjær omtrent 550. Legg plattformer deretter.

## Beskrivelsen

| Felt | Verdi | Standard |
| --- | --- | --- |
| `title` | tekst på startskjermen | ingen |
| `kind` | `"platform"`, `"topdown"`, `"catch"`, `"runner"`, `"fly"` | `"platform"` |
| `world.width`, `world.height` | 400–12000, 300–4000 | etter slag, og stor nok til tingene |
| `world.sky` | farge: et lett strøk fargeblyant over arket | bart ark |
| `world.ground`, `world.groundColor` | `false` tar bort bakken; farge på bakken | bakke i grafitt |
| `view.height` | hvor mange enheter som vises i høyden | minst av `world.height` og 900 |
| `player.speed`, `player.jump`, `player.doubleJump` | enheter i sekundet, 0,5–2, `true` | 340, 1, `false` |
| `sprites[id]` | `{ image, shape, color }`: en tegning, en innebygd form, en farge | |
| `things[]` | opptil 400 ting, se under | |
| `spawn[]` | opptil 6: `{ every, from, max, things }`. Hvert `every` sekund (0,3–10) kommer én tilfeldig av `things` inn fra kanten `from`: `"top"`, `"right"` eller `"left"` | `max` 12 samtidig |
| `rules.lives` | 1–9 | 3 |
| `rules.win` | `"goal"`, `"collect"`, `"score"`, `"survive"` | mål hvis det finnes, ellers samle alt, ellers poeng (catch), ellers holde ut |
| `rules.score`, `rules.time` | poeng som trengs; sekunder | 10; 45 for `"survive"`, ellers ingen tid |
| `text.start`, `text.win`, `text.lose` | tekst på skjermbildene | etter regelen, «Du klarte det!», «Prøv igjen» |

En ting:

| Felt | Verdi | Standard |
| --- | --- | --- |
| `role` | `"player"`, `"solid"`, `"collect"`, `"hazard"`, `"goal"`, `"decor"`, `"spring"` | `"decor"` |
| `sprite` | en id i `sprites`, eller navnet på en form | et utseende etter rollen |
| `x`, `y` | midten av tingen | på bakken |
| `size` | høyden; bredden følger tegningen | 96 spiller, 56 samle, 72 fare, 130 mål, 140 pynt, 54 fjær |
| `w`, `h` | en boks i stedet for `size` | 200 × 44 for en `solid` uten figur |
| `move` | `"still"`, `"patrol"`, `"chase"`, `"float"`, `"wander"`, `"fall"` | `"still"` |
| `axis`, `range`, `speed` | `"x"` eller `"y"`, hvor langt, hvor fort | 220 enheter, 90 i sekundet |
| `points` | poeng for en `collect` | 1 |
| `layer`, `parallax` | bare pynt: `"back"` eller `"front"`; 1 følger verden, 0,5 henger etter som noe langt unna | `"back"`, 1 |
| `say` | opptil 80 tegn: en lapp som spretter opp når spilleren rører tingen | |

- **platform**: tyngdekraft, gå og hopp. `solid` og bakken bærer. Kameraet følger spilleren. Et fall ut av verden koster et liv, og spilleren begynner igjen fra start. `spring` sender spilleren høyt. En `solid` med `move: "patrol"` er en plattform som flytter seg og tar spilleren med.
- **topdown**: sett ovenfra, uten tyngdekraft. Åtte retninger, `solid` er vegger, og verden har en blyantvegg rundt seg.
- **catch**: hele verden vises. Spilleren står nederst og går til siden, og ting faller fra `spawn`. Uten `spawn` blir tingene med rollen `collect` og `hazard` det som faller. Det som når bakken, er borte.
- **runner**: spilleren løper av seg selv, og du hopper. Med regelen `"goal"` er det seier ved målet eller ved enden av verden. Med en annen regel kommer banen rundt igjen til regelen er oppfylt.
- **fly**: som runner, men i lufta: et trykk gir et vingeslag. Bakken, taket og `solid` koster et liv.
- En `hazard` koster et liv, og spilleren blinker og kan ikke skades på et øyeblikk. I platform og runner kan spilleren hoppe oppå en `hazard` som beveger seg: den er borte, og det gir ett poeng. En som står stille, gjør alltid vondt.
- `"patrol"` går fram og tilbake rundt startstedet, `"chase"` går mot spilleren innenfor 500 enheter, `"float"` dupper, `"wander"` rusler rundt, `"fall"` faller til den lander. Ting fra `spawn` faller fra toppen og går rett bortover fra sidene; `"float"`, `"chase"` og `"wander"` gir dem en annen gange, og `"patrol"` fra siden går langs bakken.
- Går tiden ut, er det tap, bortsett fra med `"survive"`, der det er seier.

## Figurer og farger

- En tegning (`image`: `HTMLCanvasElement`, `HTMLImageElement` eller `ImageBitmap`) tegnes som den er, aldri farget, og speilvendes etter retningen. Tegn figurer som ser mot høyre. Et bilde som ikke er lastet ennå, får en form til det kommer.
- Formene: `Blyant.Game2D.shapes` gir navnene. `star`, `heart`, `coin`, `gem`, `cloud`, `tree`, `bush`, `flower`, `rock`, `box`, `ball`, `spike`, `flag`, `door`, `key`, `fish`, `apple`, `mushroom`, `sun`, `moon`, `hill`, `house`, `ghost`, `slime`, `bird`, `figure`, `spring`, `drop`, `bomb`. En ukjent form blir `ball`. Navnet på en form kan stå rett i `sprite`.
- Uten `sprite` får tingen et utseende etter rollen: `figure` for spilleren, `star`, `flag`, `spring`, `spike` eller `slime` for farer, og en skravert blyantboks for `solid`.
- En farge er et token (`"--dust-red"`), en CSS-farge, eller et vanlig fargeord («rød», `"blue"`), som blir den støvete fargeblyanten. `sprites: { gress: { color: "--dust-green" } }` på en `solid` gir en grønn blyantboks.
- Tegningene lever: de koker svakt seks ganger i sekundet, klemmes og strekkes i hopp og landing, og det som samles, spretter bort i blyantgnister. Med `prefers-reduced-motion` står alt stille, og skjermen rister ikke.

## Styring og API

- Taster: piltaster eller WASD, mellomrom eller pil opp for hopp og vingeslag, P for pause, Enter for start.
- Berøring: knappene kommer fram på berøringsskjermer, eller ved første berøring. platform har ← → til venstre og hopp til høyre. I runner og fly er hele skjermen knappen. I catch følger spilleren fingeren, og i topdown går spilleren dit fingeren holdes.
- `spill.start()`, `pause()`, `resume()`, `reset()` (tilbake til startskjermen) og `destroy()`. `spill.state` er `"ready"`, `"playing"`, `"paused"`, `"won"` eller `"lost"`. `spill.score` og `spill.lives` kan leses underveis.
- `spill.on(navn, fn)` lytter på `"start"`, `"win"`, `"lose"`, `"score"` og `"hurt"`. `fn` får `{ score, lives, time }`, der `time` er sekunder spilt. `spill.off(navn, fn)` tar lytteren bort.
- Valg: `{ sound: false }` slår av lydene, `{ autostart: true }` hopper over startskjermen, `{ seed: 7 }` gir de samme tilfeldighetene hver gang.
- Spillet tar pause når fanen skjules. Kall `destroy()` når visningen forlates: da er lerretet, lytterne og lyden borte.
- Hold en bane liten: en skjermbredde eller tre, fem til ti ting å samle, én ny idé om gangen. Et kort spill som kan vinnes, er morsommere enn et langt.
