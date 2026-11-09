# Segments

Én helhet delt i deler: en segmentert stolpe i stedet for kake- eller smultringdiagram. Bredden er andelen; prosenten står på en papirlapp inni delen når den får plass.

```js
Blyant.chart.segments(el, {
  title: "Hvordan spillerne styrer", unit: "hopp",
  parts: [
    { name: "Klikk med mus", value: 4610 },
    { name: "Piltaster", value: 3120 },
    { name: "Q E A D Z C", value: 1490 },
    { name: "Trykk på skjerm", value: 780 }
  ]
});
```

- Høyst seks deler. Legenden navngir delene i samme rekkefølge og gjentar ingen tall.
- En del som er for smal til prosenten viser den i verktøytipset og tabellen.
