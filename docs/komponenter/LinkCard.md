# LinkCard

Et forhåndsvisningskort for en lenke eller en artikkel: et bilde øverst, nettstedet, tittelen, en kort beskrivelse og en fot med valg. Til en lenke som er limt inn på en tavle, og til lister og lesere.

**Markup:**

```html
<a class="b-linkcard" href="https://skisseboka.no/hex-kart">
  <img class="b-linkcard__image" src="omslag.jpg" alt="" onerror="this.remove()">
  <span class="b-linkcard__site">skisseboka.no</span>
  <strong class="b-linkcard__title">Slik tegner du et hex-kart for hånd</strong>
  <p class="b-linkcard__desc">Start med midten, tegn ringene utover og la strekene skjelve litt.</p>
</a>

<article class="b-linkcard">
  <img class="b-linkcard__image" src="omslag.jpg" alt="" onerror="this.remove()">
  <span class="b-linkcard__site">blyant.phareim.no</span>
  <strong class="b-linkcard__title"><a href="https://blyant.phareim.no">Grafitt bærer alt</a></strong>
  <p class="b-linkcard__desc">Farge er en effekt du legger på det ene leseren skal finne.</p>
  <div class="b-linkcard__foot">
    <label class="b-check"><input type="checkbox"><span class="b-check__box"></span>Legg i Reader</label>
  </div>
</article>

<article class="b-linkcard b-linkcard--compact">
  <span class="b-linkcard__site">skisseboka.no</span>
  <strong class="b-linkcard__title"><a href="https://skisseboka.no/blyant-forst">Blyanten først, pynten etterpå</a></strong>
  <p class="b-linkcard__desc">«En skisse holder lenger enn et ferdig design.»</p>
  <div class="b-linkcard__foot"><span class="b-linkcard__from">Reader · utheving</span></div>
</article>
```

| Klasse | Bruk |
| --- | --- |
| `b-linkcard` | Kortet, på `<a>` eller `<article>`. `paper-2` med blyantstrek rundt. |
| `b-linkcard__image` | Omslagsbildet øverst, i et fast 16:9-felt (`object-fit: cover`) med en blyantstrek under. |
| `b-linkcard__site` | Nettstedet eller vertsnavnet, i Cutive Mono og `ink-soft`. Én linje, kuttes med «…». |
| `b-linkcard__title` | Tittelen i håndskrift. Høyst tre linjer, så «…». |
| `b-linkcard__desc` | Beskrivelsen i `ink-soft`. Høyst tre linjer. |
| `b-linkcard__foot` | En rad for valg nederst, for eksempel en `Check` eller en `Tag`, skilt fra resten med en strek. |
| `b-linkcard__from` | En myk tekstlinje i foten som sier hvor kortet kommer fra: «Reader · utheving». Én linje, kuttes med «…». Står i samme høyde som en `Check` ved siden av. |
| `b-linkcard--compact` | Uten bildefelt, tettere, tittelen høyst to linjer. Til lister og små plasser på en tavle. |
| `b-linkcard--row` | Bildet som et kvadratisk miniatyrbilde til venstre, teksten til høyre. Smalere enn 360px stables kortet som vanlig. |

- Delene står i rekkefølgen over, og hver av dem kan utelates. Uten `b-linkcard__image` får kortet ikke noe bildefelt og ingen tom plass.
- Et bilde som ikke lastes, skal ikke vise nettleserens ødelagte ikon. Sett `onerror="this.remove()"` på `<img>`, så forsvinner bildefeltet. Bildet er pynt ved siden av tittelen og får `alt=""`.
- Hele kortet er én lenke: bruk `<a class="b-linkcard">`. Det løfter seg litt når pekeren er over, og får fokusringen rundt seg.
- Har foten valg (`Check`, knapper), kan ikke kortet være en `<a>`, for lenker kan ikke inneholde kontroller. Bruk `<article class="b-linkcard">` og legg lenken i tittelen: `<strong class="b-linkcard__title"><a href="…">…</a></strong>`. Lenken dekker da hele kortet, og valgene i foten ligger oppå og kan trykkes.
- Kall `Blyant.ink(rot)` for blyantstreken, eller `Blyant.watch(rot)` i en side som et rammeverk tegner på nytt. Streken følger kortet når det endrer størrelse, også når et bilde fjernes.
- Rad-varianten måler bredden på seg selv (container query). Den trenger en bredde fra forelderen: en celle i et rutenett, en blokk eller en fast `width`. `--b-linkcard-thumb` setter størrelsen på miniatyrbildet (standard 96px).
- All tekst kommer fra siden. Hold nettstedet til vertsnavnet (`skisseboka.no`, ikke hele adressen) og beskrivelsen til et par setninger.
- Kortene i et rutenett står med `space-8` mellom seg. Ikke legg et lenkekort inni en `b-box`.
