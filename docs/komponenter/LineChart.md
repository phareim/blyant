# LineChart

Linjediagram for utvikling over tid. Én eller flere serier, valgfri skravert flate under, direkte etiketter ved enden av hver linje, krysshår og ett verktøytips med alle seriene.

```js
const chart = Blyant.chart.line(el, {
  title: "Spillere per dag", subtitle: "Unike spillere per brett",
  x: ["3.11", "4.11", "5.11", "6.11"], xLabel: "Dag",
  series: [
    { name: "Hex-flaten", values: [140, 162, 171, 180] },
    { name: "Myra", values: [90, 88, 97, 104] }
  ],
  area: false, unit: "spillere", height: 280
});
chart.update({ x, series });   // nye data, samme farger
chart.table(true);             // vis tabellen i stedet for grafen
```

- Konsumenten gir en tom boks; grafen fyller bredden og tegner seg på nytt når den endrer størrelse.
- Én akse. To mål med ulik skala blir to grafer, aldri to y-akser.
- Opptil fire serier får navnet sitt ved linjeenden; flere enn det leses fra legenden og verktøytipset.
- `null` i `values` gir et hull i linja. Piltastene flytter krysshåret når grafen har fokus.
