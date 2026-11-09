# Button

Knapp med blyantkant. Standard er en tom ramme; `b-btn--primary` fylles med grafitt og brukes til hovedhandlingen, høyst én per visning.

**Markup:** `<button class="b-btn">Avbryt</button>`. Lenker kan bruke samme klasse.

| Klasse | Bruk |
| --- | --- |
| `b-btn` | Vanlig handling. |
| `b-btn--primary` | Det siden er til for: «Lagre brettet», «Spill». |
| `b-btn--marker` | Tusj-knapp. Én oppfordring du vil at øyet skal finne. Ikke sammen med primary i samme rad. |
| `b-btn--quiet` | Uten ramme, bølget understrek. Sekundære valg. |
| `b-btn--sm`, `b-btn--icon` | Mindre knapp; kvadratisk ikonknapp (husk `aria-label`). |

- Verb først, vanlig norsk: «Meld meg på», ikke «Påmelding».
- Deaktiver med `disabled` eller `aria-disabled="true"`.
- Kall `Blyant.ink(rot)` etter at knappene er i DOM for å få ekte blyantstrek.
