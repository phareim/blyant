# Check

Avkrysningsboks, radioknapp og bryter. Haken er tegnet med blyant og spretter inn.

**Markup:** `<label class="b-check"><input type="checkbox"><span class="b-check__box"></span>Vis naboer</label>`. Radio: legg til `b-check--radio`. Bryter: `<label class="b-switch"><input type="checkbox"><span class="b-switch__track"></span><span>Lyd</span></label>`.

- Den ekte `input` ligger skjult inni, så tastatur og skjermleser virker som vanlig.
- Bruk bryter for noe som slår seg av og på med en gang (lyd, skravur). Bruk avkrysning for valg som lagres med et skjema.
- En påslått bryter fylles med `marker`.
