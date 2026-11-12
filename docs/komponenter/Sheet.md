# Sheet

Et hevet ark som legges over siden for én kort oppgave: publisere, velge, bekrefte. På en bred skjerm står det midt på, et stykke ned under navigasjonen. På en telefon ligger det nederst på skjermen. Bak arket ligger et slør av papir.

**Markup:**

```html
<div class="b-sheet-scrim" hidden>
  <section class="b-sheet" role="dialog" aria-modal="true" aria-labelledby="ark-tittel" tabindex="-1">
    <header class="b-sheet__head">
      <h2 class="b-sheet__title" id="ark-tittel">Publiser «Om brygga»</h2>
      <button class="b-sheet__close" type="button" aria-label="Lukk"></button>
    </header>
    <div class="b-sheet__body">
      <label class="b-field"><span class="b-field__label">Adresse</span><input class="b-input" value="om-brygga"></label>
      <label class="b-check"><input type="checkbox" checked><span class="b-check__box"></span>Vis på forsiden</label>
    </div>
    <footer class="b-sheet__foot">
      <p class="b-sheet__note">Utkastet blir liggende.</p>
      <button class="b-btn" type="button">Avbryt</button>
      <button class="b-btn b-btn--primary" type="button">Publiser</button>
    </footer>
  </section>
</div>
```

Med `<dialog>` er sløret selve dialogen. Da gir nettleseren Esc, fokus og en side som ikke kan nås bak arket:

```html
<dialog class="b-sheet-scrim" aria-labelledby="kilde-tittel">
  <div class="b-sheet">
    <header class="b-sheet__head"><h2 class="b-sheet__title" id="kilde-tittel">Velg en kilde</h2><button class="b-sheet__close" type="button" aria-label="Lukk"></button></header>
    <div class="b-sheet__body">…</div>
    <footer class="b-sheet__foot"><button class="b-btn" type="button">Avbryt</button></footer>
  </div>
</dialog>
<script>
  dialog.showModal();
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });   // et trykk på sløret
</script>
```

| Klasse | Bruk |
| --- | --- |
| `b-sheet-scrim` | Sløret: dekker skjermen (`position: fixed`), papir med 60 % dekning. Skjules med `hidden`, eller er en `<dialog>`. Ligger under toastene. |
| `b-sheet` | Arket: `paper-2`, skygge og blyantstrek rundt, som en hevet `Box`. 32rem bredt, høyst 80 % av høyden. |
| `b-sheet__head` | Raden øverst: tittelen og eventuelt lukkeknappen. |
| `b-sheet__title` | Tittelen i håndskrift. Si hva oppgaven er: «Publiser», «Velg en kilde». |
| `b-sheet__close` | Valgfri knapp med et tegnet kryss. Trenger `aria-label="Lukk"`. |
| `b-sheet__body` | Innholdet. Det er bare denne delen som ruller når arket blir for høyt. |
| `b-sheet__foot` | Knappene nederst, til høyre, under en blyantstrek. |
| `b-sheet__note` | Valgfri myk linje i foten, til venstre for knappene. |

- Ett ark, én oppgave. Kan oppgaven ikke gjøres på et halvt minutt, hører den hjemme på en egen side.
- Den viktigste knappen står sist i foten og er `b-btn--primary`. «Avbryt» står foran den. Verb først: «Publiser», «Velg», «Slett utkastet».
- Når sløret er smalere enn 640px, ligger arket nederst på skjermen i full bredde. Sidene og bunnen står like utenfor skjermkanten, så blyanten tegner bare toppen. Knappene deler bredden. Bunnen gir plass til `safe-area-inset-bottom`.
- Sløret måler seg selv (container query), ikke skjermen. Et ark i et sidepanel (`position: absolute` på sløret inne i panelet) blir derfor et ark nederst når panelet er smalt.
- Kall `Blyant.ink(rot)` for blyantstreken, eller `Blyant.watch(rot)` i en side som et rammeverk tegner på nytt. Streken tegnes når arket blir synlig.
- `--b-sheet-width` setter bredden (standard `32rem`) og `--b-sheet-top` avstanden fra toppen (standard `12vh`).
- Arket glir inn: ned fra toppen på en bred skjerm, opp fra bunnen på telefon. Med `prefers-reduced-motion` kommer det bare fram.

**Oppførsel.** Blyant har ingen JavaScript for arket. Med `<dialog>` og `showModal()` gjør nettleseren det meste. Med et vanlig slør gjør appen dette selv:

- Åpne: fjern `hidden`, og flytt fokus inn i arket, til det første feltet eller til arket selv (`tabindex="-1"`). Husk hva som hadde fokus.
- Lukk på Esc, på et trykk på sløret (`event.target === sløret`), på lukkeknappen og på «Avbryt». Gi fokus tilbake til det som åpnet arket.
- Tab går rundt inne i arket. Enklest er `inert` på resten av siden mens arket er åpent.
- Lås siden bak: `overflow: hidden` på `<html>` mens arket er åpent.
- `role="dialog"`, `aria-modal="true"` og `aria-labelledby` som peker på tittelen. På `<dialog>` står `aria-labelledby` på dialogen.
