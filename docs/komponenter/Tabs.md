# Tabs

Faner som deler et panel i flere visninger.

**Markup:** `<div class="b-tabs" role="tablist"><button class="b-tab" role="tab" aria-selected="true">…</button>…</div>`.

- Du styrer `aria-selected` og panelet selv. Kall `Blyant.reink(tabs)` etter bytte, så den valgte fanen får blyantstreken.
- Bruk 2–5 faner med korte navn. Flere enn det er en meny.
