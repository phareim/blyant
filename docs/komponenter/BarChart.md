# BarChart

Stolpediagram: loddrett eller vannrett, én serie, grupperte serier eller stablet. `highlight` legger overstrykningstusj bak den ene kategorien historien handler om og graner ut resten.

```js
Blyant.chart.bar(el, {
  title: "Hopp per runde", categories: ["R1", "R2", "R3", "R4", "R5"],
  series: [{ name: "Hopp", values: [14, 22, 19, 31, 27] }],
  highlight: 3            // R4 får tusj, de andre blir grafitt
});
Blyant.chart.bar(el, { categories, series: [fullført, gaOpp, tidenGikkUt], stacked: true });
Blyant.chart.bar(el, { categories, series, horizontal: true });
```

- Én serie har én farge (`chart-1`) og ingen legende; tittelen sier hva som vises. Ikke farg stolper etter størrelse.
- Stolpene er høyst 24px tykke, står på én grunnlinje og har 2px papir mellom stablede deler.
- Verdien står over stolpen bare der den hjelper: totalen i stablede, alle i små enkeltserier, ellers den uthevede.
- Hele kategoribåndet er treffflaten for verktøytipset.
