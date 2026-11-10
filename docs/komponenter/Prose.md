# Prose

Løpende tekst: artikler, notater og blogginnlegg som kommer rett fra Markdown.

**Markup:** `<article class="b-prose b-flow"><h1>…</h1><p class="b-meta"><time>1. august 2026</time><span>4 min</span></p><p>…</p></article>`.

- `.b-prose` gir vanlige HTML-elementer blyantstil. `.b-flow` legger luft mellom dem, så du slipper å sette marg på hvert avsnitt. Juster avstanden med `--b-flow`.
- Overskrifter får mer luft over seg enn under, så de hører til teksten som følger.
- `.b-meta` er linja under tittelen: dato, lesetid, forfatter. Små, store bokstaver i `ink-soft`.
- Bilder settes i `<figure>` med `<figcaption>`. Bildeteksten er et notat under bildet, ikke en overskrift.
- Hold spalten smal. Avsnitt stopper på 65 tegn av seg selv.
- Én overstrykning eller to per avsnitt, og ett `<blockquote>` per skjermhøyde. Lange tekster tåler mindre pynt enn korte.
