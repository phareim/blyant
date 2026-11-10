# Editor

Flaten du skriver på: et notat, et utkast, en lang tekst i Markdown.

**Markup:** `<textarea class="b-editor" placeholder="Skriv …"></textarea>`, eller `class="b-editor"` på en `contenteditable` eller på innholdsnoden i en kodeeditor (CodeMirror: `.cm-content`).

- Teksten står i Caveat, 22px med linjehøyde 1,5. Det er litt større enn brødtekst, fordi du ser på den lenge. Juster med `--b-editor-size`.
- Flaten har ingen ramme. Arket er rammen. Hold spalten på rundt 34em.
- Markøren er `ink`. Markert tekst er strøket over med tusj (`marker`).
- Editorer som viser Markdown mens du skriver, setter delene på linjene og tegnene:
  - `b-editor__h1`, `b-editor__h2`, `b-editor__h3` på overskriftslinjer.
  - `b-editor__syntax` på tegnene som er Markdown (`#`, `**`, `>`, `-`). De står i `ink-soft`, så teksten bærer siden.
  - `b-editor__quote` på sitatlinjer, `b-editor__code` på kode, `b-editor__rule` på en `<span>` som tegner `---` som en blyantstrek.
  - `b-editor__placeholder` på plassholderen når editoren lager den selv.
- Uthevet tekst er Caveat 700. Kursiv finnes ikke i Caveat; nettleseren skråstiller, og det ser ut som fortere håndskrift.
- Ikke legg verktøylinje over flaten. Handlinger hører hjemme i en `Menu` eller på tastaturet.
