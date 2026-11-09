# Slide

En 16:9-ramme for presentasjoner. Alt inni skaleres med bredden (container-enheter), så samme slide fungerer stor, som miniatyr og i et dokument.

**Markup:** `<div class="b-slide">` med `b-slide__kicker`, `b-slide__title`, `b-slide__body` og `b-slide__foot`. Andre barn får `2.4cqw` avstand.

- Én tanke per slide. Tittelen er påstanden, ikke temaet: «Hopp per runde økte i R4», ikke «Resultater».
- Diagrammer tegnes med `Blyant.figure`: akser med `line`, søyler med `rect` + `hatch`.
- Eksempeldata merkes som eksempeldata i kicker eller bunntekst.
