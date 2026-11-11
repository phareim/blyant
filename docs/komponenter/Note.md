# Note

Notatlapp med teip. Står litt skjevt og kaster skygge, som en gul lapp på et ark.

**Markup:** `<div class="b-note">…</div>`. Farger: `b-note--blue`, `--green`, `--red`, `--purple`. Juster vinkelen med `style="--b-tilt: 1deg"`.

- Én eller to lapper per visning. De skal føles som noe noen har klistret på, ikke som layout.
- Tekst i `t-note` for håndskrevne beskjeder, eller `t-h3` + `t-small` for et lite tips.
- Teipen sitter litt ulikt på hver lapp: `Blyant.ink` flytter den inntil en tidel av bredden til siden og et par piksler opp eller ned, og vrir den inntil 4,5°. Plasseringen regnes ut fra lappens klasse og tekst, så den er lik hver gang siden lastes. Uten `Blyant.ink` sitter teipen midt på.
- Sett plasseringen selv med `--b-tape-x` (standard `50%`), `--b-tape-y` (`-10px`) og `--b-tape-tilt` (`2deg`) i lappens `style`; da lar `Blyant.ink` den stå.
- En lapp som lages i kode og ikke ligger inni det `Blyant.ink` får, teipes med `Blyant.tape(node, seed)`. Gi et fast tall som `seed` (for eksempel fra lappens id) når lappen skal se lik ut selv om teksten endres.
- Skallet `clean` retter opp lappen og fjerner teipen.
