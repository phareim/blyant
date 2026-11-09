# HexBoard

En ferdig hex-verden på Sketch3D: terreng i trinn, trær, steiner, vann, seks fargesteiner å samle og en figur som hopper med squash-and-stretch.

```js
const board = new Blyant.HexBoard(el, {
  radius: 4, seed: 11, gems: 6,
  onCollect: (found, total) => { /* oppdater HUD */ },
  onMove: ([q, r]) => {}
});
board.goTo(2, -1);   // går dit hex for hex
board.step(1);       // ett hopp mot nordøst
board.reset();       // legg ut steinene igjen
```

- Taster: ← → snur, ↑ ↓ hopper fram og tilbake, Q E A D Z C hopper rett til en nabo. Klikk eller trykk går dit langs korteste vei. Hjulet zoomer.
- Sett `board.enabled = false` når brettet ikke er synlig, og `board.sketch.stop()` for å spare batteri.
- `Blyant.hexgrid` har matematikken: `DIRS`, `toXZ`, `dist`, `ring`, `path`.
