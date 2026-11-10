# Field

Tekstfelt, nedtrekksliste og tekstområde med etikett og hjelpetekst.

**Markup:**

```html
<label class="b-field">
  <span class="b-field__label">E-post</span>
  <input class="b-input" type="email" id="mail">
  <span class="b-field__hint">Vi sender maks én e-post i uka.</span>
</label>
```

- Etiketten står alltid over feltet, i `t-label`. Ikke bruk plassholdertekst som etikett.
- Nedtrekksliste: pakk `select.b-input` i `<span class="b-select">` for den tegnede pila.
- Feil: `aria-invalid="true"` på feltet og `b-field__hint--error` på hjelpeteksten. Teksten sier hva som er galt og hvordan det fikses.
- Kall `Blyant.reink(skjema)` etter at du har endret feiltilstand.
- `b-input--line` er et felt uten boks, bare en blyantstrek å skrive på. Bruk det til filter og søk over en liste, der en boks ville tatt oppmerksomheten fra lista. Feltet trenger fortsatt et navn: `aria-label` når det ikke har synlig etikett.
