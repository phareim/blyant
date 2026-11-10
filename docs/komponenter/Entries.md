# Entries

Liste over innlegg, notater eller dokumenter: dato, tittel og én linje om hva det er.

**Markup:** `<ul class="b-entries"><li class="b-entry"><time class="b-entry__meta" datetime="2026-08-01">1. august 2026</time><a class="b-entry__title" href="…">Velkommen</a><p class="b-entry__summary">…</p></li></ul>`.

- Nyeste øverst. Datoen står over tittelen, så øyet finner den først.
- Tittelen er lenken. Hele innlegget skal ikke være klikkbart; da kan ikke leseren markere tekst.
- En blyantstrek skiller innleggene. Den siste har ingen strek under seg.
- `b-entry__summary` er valgfri. Skriv én setning, ikke begynnelsen av teksten.
- Er lista kort eller tom, sett en `Empty` under den i stedet for å fylle på med noe annet.
- `b-entries--compact` gir én linje per innlegg: tittelen til venstre i brødskrift, `b-entry__meta` til høyre. Bruk den når lista er lang og titlene er det du leter etter, som i en dokumentliste. Lange titler kuttes med «…».
