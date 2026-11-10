# Sidenote

Fotnote som står i margen, ved siden av setningen den hører til.

**Markup:** sett `.b-sidenotes` på artikkelen, og legg dette der tallet skal stå:

```html
<label class="b-sidenote__ref" for="n1"></label><input class="b-sidenote__toggle" type="checkbox" id="n1"><span class="b-sidenote">Selve notatet.</span>
```

- Tallene telles av seg selv. Hver note trenger bare en unik `id`.
- Fra 1100px og opp står notatet i høyre marg. `.b-sidenotes` setter av plassen: `--b-sidenote-w` (220px) og `--b-sidenote-gap` (36px).
- På smalere skjermer er notatet skjult til leseren trykker på tallet. Da åpner det seg under linja.
- Ingen JavaScript. Tallet er en `label` for en skjult avkrysningsboks.
- Hold notatet til én eller to setninger. Det som trengs for å forstå teksten, hører hjemme i teksten.
