# Empty

Tom tilstand: en liten tegning, én linje som sier hva som mangler, og et notat under.

**Markup:** `<div class="b-empty"><svg class="b-empty__art" data-doodle="ark" aria-hidden="true"></svg><div class="b-empty__body"><p class="b-empty__title">Neste notat er ikke skrevet ennå</p><p class="b-empty__text">Venter på inspirasjon.</p></div></div>`.

- `Blyant.ink(rot)` tegner alle `svg[data-doodle]`. Tegningene er `ark` (blankt ark med blyant: ikke skrevet ennå), `ide` (lyspære: forslag, tips) og `ukjent` (skilt med spørsmålstegn: siden finnes ikke). `Blyant.doodle(svg, navn)` tegner én.
- `b-empty--center` stiller tegningen over teksten, midt på flaten. Bruk den når den tomme tilstanden er hele siden, som på en 404-side.
- Si hva som mangler, og hva leseren kan gjøre. «Fant ikke siden» med en lenke hjem er nok.
- Tittelen er en setning, ikke en feilkode. Notatet under kan gjerne være personlig.
- Uten JavaScript vises teksten uten tegning. Den må derfor stå på egne ben.
