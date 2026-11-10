# Toast

En kort beskjed som ligger oppå siden et øyeblikk, med høyst én handling.

**Markup:**

```html
<div class="b-toasts">
  <div class="b-toast" role="status">
    <span>Dokumentet er slettet.</span>
    <button class="b-toast__action" type="button">Angre</button>
  </div>
</div>
```

- `b-toasts` holder beskjedene nederst midt på skjermen. Bruk bare `b-toast` hvis du plasserer den selv.
- Si hva som skjedde, i én setning. Handlingen er ett verb: «Angre», «Prøv igjen».
- Feil: `b-toast--error` setter ✗ i `dust-red` foran teksten. Teksten sier hva som gikk galt.
- Beskjeden forsvinner av seg selv etter noen sekunder. Det som krever et svar, hører hjemme i siden, ikke i en toast.
- Kall `Blyant.ink(toasten)` når den vises, så får den blyantstrek rundt seg.
