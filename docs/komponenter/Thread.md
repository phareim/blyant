# Thread

En samtale i ren tekst mellom leseren og én annen, for eksempel Claude: kommentarer under et dokument, eller et smalt sidepanel ved en tavle. Bare CSS, ingen JavaScript.

**Markup:**

```html
<ol class="b-thread" aria-live="polite">
  <li class="b-thread__msg b-thread__msg--own">
    <p class="b-thread__who">Petter <time datetime="2026-11-11T14:02">i går 14:02</time></p>
    <p class="b-thread__text">Er avsnittet om skravur for langt?</p>
  </li>
  <li class="b-thread__msg">
    <p class="b-thread__who">Claude <time datetime="2026-11-11T14:03">i går 14:03</time></p>
    <p class="b-thread__text">Litt. Stryk den andre setningen.</p>
  </li>
  <li class="b-thread__msg b-thread__msg--pending">
    <p class="b-thread__who">Claude</p>
    <p class="b-thread__text"><span class="b-thread__dots" aria-hidden="true"></span> skriver …</p>
  </li>
  <li class="b-thread__msg b-thread__msg--failed">
    <p class="b-thread__who">Claude</p>
    <p class="b-thread__text">Fikk ikke svart. <button type="button" class="b-thread__retry">Prøv igjen</button></p>
  </li>
</ol>
<form class="b-thread__form">
  <textarea class="b-input b-thread__input" rows="2" placeholder="Skriv en kommentar" aria-label="Kommentar"></textarea>
  <button class="b-btn" type="submit">Send</button>
</form>
```

- Eldste melding øverst. Hver melding er hvem som skriver, når, og teksten.
- `b-thread__msg--own` er leserens egen kommentar. Den står inn fra venstre på en lapp i `paper-2`, mens den andre skriver rett på arket. Det er grafitt og plass, ikke farge, som skiller dem, så siden leses som skrift og ikke som chat-bobler. Ligger samtalen allerede på `paper-2`, setter du lappen med `--b-thread-own: var(--paper-3)` på `.b-thread`.
- `b-thread__text` er ren tekst. Sett den med `textContent`, ikke `innerHTML`. Linjeskift blir stående, og lange ord og adresser brytes så de aldri går ut av spalten.
- `b-thread__who` er stille: navnet i `ink-soft`, tiden mindre i `Cutive Mono`. Gi `<time>` en `datetime`. Navnet står alltid der, også på leserens egne kommentarer: det er det som sier hvem som skriver for skjermlesere og i en utskrift.
- `b-thread__msg--pending`: den andre skriver. `b-thread__dots` er tre blyantprikker som tar tur, og står stille ved `prefers-reduced-motion`. Ordet «skriver …» bærer meningen. Bytt hele `<li>` mot svaret når det kommer.
- `b-thread__msg--failed`: et lite ✗ i `dust-red` foran teksten. Si hva som gikk galt, og gi én handling: `b-thread__retry` er en lenkeaktig knapp i teksten, med fokusring og 44 px treffflate på berøringsskjerm.
- `aria-live="polite"` på lista gjør at nye meldinger leses opp. Legg den på når lista allerede er tegnet, ikke mens den fylles første gang.
- `b-thread__form` setter tekstfeltet så bredt som plassen tillater, med knappen ved siden av, nederst. Under omtrent 360 px faller knappen ned under feltet, til høyre. Feltet og knappen er vanlige `Field`- og `Button`-klasser, og `Blyant.ink` tegner streken rundt dem. Selve samtalen trenger ingen blyantstrek.
- Skjemaet kan stå over eller under lista; avstanden mellom dem kommer av seg selv. Send med knappen og med ⌘/Ctrl + Enter, og la Enter alene gi linjeskift.
- Er samtalen tom, la skjemaet stå alene, eller sett en `Empty` over det.
