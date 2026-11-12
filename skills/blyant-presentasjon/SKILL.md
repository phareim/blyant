---
name: blyant-presentasjon
description: Use when Petter wants a presentation, a deck, slides, a talk or a PowerPoint and no other brand is named. Covers three moments. Planning a deck in conversation, slide by slide, as a small JSON definition. Exporting that definition to a .pptx built on the Blyant PowerPoint template. Working on a Blyant deck inside PowerPoint (Claude for PowerPoint), where the theme is called «Blyant X.Y.Z Papir» or «Kull». Trigger on «presentasjon», «foredrag», «slides», «lysbilder», «deck», «powerpoint», «pptx», «lag en slide», and whenever the open deck uses the Blyant template.
---

# Blyant-presentasjon

Blyant er Petters håndtegnede designsystem. Presentasjoner i Blyant lages på PowerPoint-malen, og denne skillen dekker hele veien: fra samtalen der presentasjonen blir til, gjennom eksporten til `.pptx`, og videre i PowerPoint.

Petter jobber slik: han snakker seg gjennom presentasjonen med Claude til grunnoppsettet sitter, og flikker så på detaljene i PowerPoint. Derfor er det tre faser, og fila som er fasiten, bytter underveis.

| Fase | Fasiten er | Du gjør |
| --- | --- | --- |
| 1. Samtalen | definisjonen (`<navn>.json`) | Foreslår slides, oppsett og tekst. Holder definisjonen oppdatert. |
| 2. Eksporten | definisjonen | Kjører `lag_presentasjon.py` og ser over resultatet. |
| 3. PowerPoint | `.pptx`-fila | Endrer i PowerPoint. Eksporterer ikke over fila. |

## Slik ser en Blyant-slide ut

- **Én tanke per slide.** Det som ikke får plass, hører hjemme i notatene eller på neste slide.
- **Tittelen er påstanden, ikke temaet.** «Hopp per runde økte i R4», ikke «Resultater».
- **Stikkordet** over tittelen sier hvor vi er: delen, kilden eller «eksempeldata». Det settes i store bokstaver av malen, så skriv det vanlig.
- **Farge er effekt.** Gul tusj brukes på det ene øyet skal finne, og bare én gang per slide. Støvfargene (`dust-*`) brukes sparsomt. Uthevingsfargene 1–6 er graf-farger og brukes bare på serier i en graf.
- **Avsnitt før punkter.** Første nivå i en tekstboks er et avsnitt uten punkt. Bruk punkter bare når innholdet faktisk er en liste, og hold dem korte.
- **Manuset står i notatene**, ikke på sliden.
- **Eksempeldata merkes** som eksempeldata i stikkordet eller bunnteksten.
- **Tre skrifter, ingen andre:** Caveat (titler og brødtekst), Architects Daughter (stikkord, notater, bildetekster) og Cutive Mono (bunntekst og tall i kolonne).
- **Blyantstrek, ikke linjal.** Rammer, piler og skiller er tegnet med `Blyant.rough` og ligger i oppsettene. Ikke tegn rette PowerPoint-linjer eller standardformer ved siden av dem.
- **Papir og Kull.** Papir er det lyse arket og standardvalget. Kull er det samme i mørket. De kan blandes: Kull på tittel og seksjon, Papir på innholdet.

## Oppsettene

Malen har seksten oppsett, de samme i Papir og Kull. Feltene heter det samme som plassholderne i PowerPoint (se dem i valgruten).

| Oppsett | Til | Felt |
| --- | --- | --- |
| Tittel | Forsiden | stikkord, tittel, undertittel |
| Seksjon | Starten på en ny del | stikkord, tittel, tekst |
| Tittel og innhold | Det vanlige: tekst eller tabell under en påstand | stikkord, tittel, innhold |
| To kolonner | To ting som settes opp mot hverandre | stikkord, tittel, innhold venstre, innhold høyre |
| Tre bokser | Tre likestilte poeng | stikkord, tittel, overskrift 1–3, tekst 1–3 |
| Bilde og tekst | Tekst til venstre, bilde til høyre | stikkord, tittel, tekst, bilde, bildetekst |
| Bilde | Ett stort bilde | stikkord, tittel, bilde, bildetekst |
| To bilder | Før og etter | stikkord, tittel, bilde 1–2, bildetekst 1–2 |
| Tre bilder | En rekke: før, underveis, etter | stikkord, tittel, bilde 1–3, bildetekst 1–3 |
| Fullskjerm bilde | Bildet er hele lysbildet | bilde |
| Fullskjerm video | Det samme for en video | video (settes inn i PowerPoint) |
| Stort tall | Ett tall med tusj under, og hva det betyr | stikkord, tittel, merkelapp, tall, fotnote, tekst |
| Notatlapp | Det ene de skal huske, på en gul lapp | stikkord, tittel, tekst, notat |
| Innhold og margnotat | Innhold med en kommentar og en pil i margen | stikkord, tittel, innhold, margnotat |
| Bare tittel | En figur som tegnes selv | stikkord, tittel |
| Tomt | Bare ramma | ingen |

`python3 lag_presentasjon.py --oppsett` skriver ut den samme lista rett fra malen, og er den som gjelder hvis tabellen her er blitt gammel.

Et bildefelt uten bilde viser ruta med kryss (`Placeholder`). Det er meningen: ruta sier at noe mangler, og Petter kan slippe et bilde på den i PowerPoint.

## Fase 1: samtalen

Snakk om presentasjonen som en disposisjon, ikke som JSON. For hver slide: oppsettet, tittelen (påstanden) og det som står på den. Spør heller hva publikum skal sitte igjen med enn hvor mange slides det skal være.

Hold definisjonen oppdatert i en fil, `<navn>.json`, ved siden av bildene den bruker. I en samtale uten filer holder du den i samtalen og skriver den til fil når den skal eksporteres.

```json
{
  "tittel": "Hex-skisse etter fem runder",
  "tema": "papir",
  "bunntekst": "Hex-skisse · eksempeldata",
  "slides": [
    {"oppsett": "Tittel", "tema": "kull", "stikkord": "Testflaten · november 2026",
     "tittel": "Hex-skisse etter\nfem runder", "undertittel": "Hva vi lærte av fem spillere."},
    {"oppsett": "Tittel og innhold", "stikkord": "Hva vi endret", "tittel": "Tre grep ga flyten",
     "innhold": ["Ingen av grepene var store, men de virket ==sammen==.",
                 ["En tydelig start-hex.", "Færre farger.", ["Bare tusj på neste trekk."]]],
     "notater": "Det du sier til denne sliden."},
    {"oppsett": "To bilder", "tittel": "Start-hexen er lettere å finne nå",
     "bilde 1": "for.png", "bildetekst 1": "Før", "bildetekst 2": "Etter"},
    {"oppsett": "Tittel og innhold", "tittel": "Bom per runde gikk ned",
     "innhold": {"tabell": [["Runde", "Bom"], ["R1", 9], ["R2", 8]]}}
  ]
}
```

- **Øverst:** `tittel` (navnet på presentasjonen), `tema` (`papir` eller `kull`), `bunntekst`, `dato` (`true` for dagens dato, eller en tekst), `nummer` (`false` skjuler lysbildenummeret) og `blyant` (en fast versjon av malen, for eksempel `"0.12.0"`). `tema`, `bunntekst`, `dato` og `nummer` kan også settes på én slide.
- **Tekst:** en streng er ett avsnitt, og `\n` er linjeskift. En liste er flere avsnitt. En liste inni en liste er punkter, og enda en liste inni der er underpunkter. `==ord==` får gul tusj, `**ord**` blir fet.
- **Bilde:** en filsti (PNG, JPEG eller GIF) i forhold til definisjonen, eller `{"fil": "…", "alt": "…"}`. Bildet beskjæres så det fyller ruta. I et innholdsfelt kan du skrive `{"bilde": "…"}`, og da vises hele bildet.
- **Tabell:** `{"tabell": [[hode], [rad], …], "kolonner": [3, 2, 2]}` i et innholdsfelt. Første rad er hodet. `kolonner` er bredden på kolonnene i forhold til hverandre og kan sløyfes. Kolonner med tall høyrestilles.
- **Notater:** `notater` på en slide blir manuset i notatfeltet.
- Feltnavn kan skrives med stor eller liten bokstav, med mellomrom eller understrek.

`eksempel.json` i denne mappa er en hel definisjon.

Det definisjonen ikke kan: video, SVG, grafer og egne tegninger. En graf lager du med `Blyant.chart` og setter inn som PNG, eller du lar feltet stå tomt og setter inn en graf i PowerPoint (den får graf-fargene fra temaet). Trengs et oppsett som ikke finnes, og som kan brukes igjen, bygges det inn i malen (`mal/potx.py` i Blyant-repoet, se skillen `blyant`), ikke rundt den.

## Fase 2: eksporten

```bash
python3 lag_presentasjon.py presentasjon.json            # skriver presentasjon.pptx
```

`lag_presentasjon.py` ligger i denne mappa og trenger bare Python 3. Det finner malen (`blyant-eksempel.pptx`) ved siden av seg selv, i `dist/` i Blyant-repoet eller i `node_modules/blyant/dist/`, og laster den ellers ned fra npm. `--mal <sti>` peker på en bestemt fil, `--versjon X.Y.Z` velger en fast versjon, og `-o` gir fila et annet navn.

Skriptet stopper med en melding hvis et oppsett, et felt eller et bilde ikke finnes, og det advarer om det retningslinjene kan måle: tusj flere ganger på én slide, en slide uten tittel, en tittel som er for lang, og for mye tekst. Rett definisjonen og kjør på nytt.

Se over resultatet før du sier at det er ferdig, når LibreOffice finnes: `soffice --headless --convert-to pdf presentasjon.pptx`, gjør PDF-en om til bilder og se på hver slide. Caveat, Architects Daughter og Cutive Mono må være installert, ellers stemmer ikke bildet. LibreOffice viser bunnteksten midtstilt i sin egen skrift. Det er ikke en feil i fila.

Når du gir fila til Petter, si hvilke felt som står tomme (bilder som mangler, video som skal inn), og at skriftene må være installert på maskinen der den åpnes.

## Fase 3: i PowerPoint

Når Petter har åpnet fila i PowerPoint, er det `.pptx`-fila som gjelder. Skriptet nekter å skrive over en fil som er lagret fra PowerPoint. Kommer det nye slides fra en samtale etter dette, eksporteres de til en ny fil og limes inn, eller de lages direkte i PowerPoint.

Du kjenner igjen en Blyant-presentasjon på temanavnet («Blyant 0.12.0 Papir» eller «Kull») og på oppsettene i tabellen over. Jobber du i den, gjelder dette:

- **Ny slide:** velg et oppsett fra tabellen, i samme tema som slidene rundt, og fyll ut plassholderne. Ikke legg til en tekstboks der oppsettet har en plassholder, og ikke bygg en slide av frie tekstbokser når et oppsett passer.
- **Ikke flytt eller omformater plassholderne.** Størrelse, skrift og plass kommer fra oppsettet. Er en slide kommet ut av form, er «Tilbakestill» riktig grep.
- **Farger:** bare temafargene. Tekst 1 og 2 til tekst, Bakgrunn 1 og 2 til ark, de egendefinerte (`marker`, `dust-*`) til effekt. Uthevingsfarge 1–6 er forbeholdt graf-serier.
- **Tusj:** uthevingsfarge på teksten med den egendefinerte fargen `marker`, og tekstfargen `on-marker`. Én gang per slide.
- **Former:** en ny form er et ark i Bakgrunn 2 med blyantkant, slik temaet gir den. Trenger sliden en ramme, en pil eller et skille, kopier en av blyantstrekene som finnes i presentasjonen (de heter «Blyantstrek», «Boks», «Pil», «Skille» og «Ramme»), i stedet for å tegne en rett linje. Trengs en ny håndtegnet figur, lages den med `Blyant.rough` utenfor PowerPoint og settes inn som bilde.
- **Grafer og tabeller:** en graf får graf-fargene av temaet. Fjern rutenett, skygger og 3D. En tabell bruker tabellstilen «Blyant».
- **Tekst:** hold deg til reglene øverst. Blir teksten for lang for boksen, kort den ned eller del sliden, ikke krymp skriften.
- **Ikke endre lysbildemalen** eller oppsettene i en presentasjon. Mangler noe som kan brukes igjen, si fra: det hører hjemme i malen i Blyant-repoet, og kommer med neste versjon.

Skal presentasjonen over på en nyere versjon av malen: Utforming → Temaer → Bla gjennom etter temaer, og velg den nye `blyant.potx`.
