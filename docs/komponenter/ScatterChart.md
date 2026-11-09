# ScatterChart

Punktdiagram for sammenhengen mellom to mål. Høyst tre serier, fordi hver prikk kan ligge ved siden av hvilken som helst annen.

```js
Blyant.chart.scatter(el, {
  title: "Tid mot antall hopp", xLabel: "Sekunder", yLabel: "Hopp",
  series: [
    { name: "Mus", points: [[42, 18, "Ada"], [84, 33, "Ola"]] },
    { name: "Tastatur", points: [[36, 24, "Kim"], [58, 37, "Siv"]] }
  ],
  labelPoints: ["Ola", "Siv"]   // skriv navn bare ved de punktene historien handler om
});
```

- Prikkene har en ring av papir rundt seg, så de holder seg lesbare når de overlapper.
- Pekeren treffer nærmeste punkt innenfor 24px; du trenger ikke treffe midt på prikken.
- Flere enn tre serier: slå sammen til «Andre» eller del opp i små grafer.
