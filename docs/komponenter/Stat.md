# Stat

Nøkkeltall: når historien er ett tall, er tallet grafen. Etikett, verdi, endring mot en navngitt periode og en liten trendlinje.

```js
Blyant.chart.stat(el, {
  label: "Spillere siste 7 dager", value: 1284,
  delta: 12, deltaUnit: "%", deltaLabel: "mot forrige periode",
  upIsGood: true, trend: [880, 910, 960, 1010, 1120, 1284]
});
Blyant.chart.spark(el, values);   // bare trendlinja
```

- Endringen har alltid pil og fortegn. Grønn eller rød bakgrunn betyr bra eller dårlig, ikke opp eller ned: sett `upIsGood: false` når mindre er bedre.
- Verdien står i Caveat med proporsjonale sifre. Bruk ett nøkkeltall-rad per visning.
- Én serie til en graf blir et nøkkeltall, ikke en stolpe alene.
