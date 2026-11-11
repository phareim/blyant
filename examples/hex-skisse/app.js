(function () {
  "use strict";
  var B = window.Blyant;
  var R = B.rough;
  var viewEl = document.getElementById("view");
  var root = document.documentElement;

  function svgEl(w, h, cls) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 " + w + " " + h);
    s.setAttribute("aria-hidden", "true");
    if (cls) s.setAttribute("class", cls);
    return s;
  }
  function figureInto(host, w, h, shapes) {
    var s = svgEl(w, h);
    host.appendChild(s);
    B.figure(s, shapes);
    return s;
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* --------------------------------------------------------------- */
  /* Views                                                            */
  /* --------------------------------------------------------------- */
  var VIEWS = {};

  /* ---------- Hex-flaten (game) ---------- */
  var game = null;          // { el, board } — created once, kept alive
  VIEWS.spill = {
    title: "Hex-flaten",
    render: function (host) {
      if (!game) game = makeGame();
      host.appendChild(game.el);
      var th = document.createElement("section");
      th.className = "stack-lg";
      th.innerHTML = '<div class="sec-head"><h2>Muligheter i systemet</h2><p>Samme blyant, samme tokens, sju andre flater. Klikk på en skisse for å hoppe dit.</p></div><div class="thumbs" id="thumbs"></div>';
      host.appendChild(th);
      var grid = th.querySelector("#thumbs");
      [["nettside", "Nettside", "Navigasjon, hero, kort, skjema, tabell og bunntekst."],
        ["dokument", "Dokument", "Artikkel med ingress, overstrykning, margnotater og figur."],
        ["presentasjon", "Presentasjon", "16:9-slides med håndtegnede diagrammer."],
        ["grafer", "Grafer", "Linjer, stolper, punkter og nøkkeltall i blyant."],
        ["ruter", "Tegneserieruter", "Fyll en flate med ruter, fra rolig rutenett til skjeve kutt."],
        ["former", "Former i 2D og 3D", "Rå streker, skravur, fargeblyanter og three.js-laben."],
        ["system", "System", "Farger, skrift, avstander og alle komponentene."]].forEach(function (t) {
          var a = document.createElement("a");
          a.className = "thumb";
          a.href = "#" + t[0];
          a.innerHTML = '<div class="thumb__ink b-box" data-ink="box"><div class="thumb__frame"><div class="thumb__stage b-page" inert aria-hidden="true"></div></div></div>' +
            '<div><div class="thumb__title">' + t[1] + '</div><div class="thumb__text">' + t[2] + "</div></div>";
          grid.appendChild(a);
          var stage = a.querySelector(".thumb__stage");
          VIEWS[t[0]].render(stage, { thumb: true });
          a.__stage = stage;
        });
      requestAnimationFrame(function () { fitThumbs(grid); });
      game.board.enabled = true;
      game.board.sketch.start(function (dt, t) { game.board.tick(dt, t); });
      setTimeout(function () { game.board.sketch.resize(); }, 0);
    },
    leave: function () {
      if (game) { game.board.enabled = false; game.board.sketch.stop(); }
    }
  };
  function fitThumbs(grid) {
    Array.prototype.forEach.call(grid.querySelectorAll(".thumb"), function (a) {
      var frame = a.querySelector(".thumb__frame"), st = a.__stage;
      var k = frame.clientWidth / 1200;
      st.style.transform = "scale(" + k + ")";
    });
  }
  window.addEventListener("resize", function () { var g = document.getElementById("thumbs"); if (g) fitThumbs(g); });

  function makeGame() {
    var el = document.createElement("section");
    el.className = "game";
    el.innerHTML =
      '<div class="stage b-box" data-ink="box" style="padding:0">' +
      '  <div class="stage__canvas" id="hex-canvas" aria-label="Hex-flate. Bruk piltastene eller klikk på en hex for å hoppe." role="application" tabindex="0"></div>' +
      '  <div class="stage__hud">' +
      '    <div class="counter" aria-live="polite"><span id="gem-count">0 av 6</span><span class="counter__gems" id="gem-dots"></span></div>' +
      '  </div>' +
      '  <div class="done b-note" id="done" hidden><div class="t-h3">Alle seks funnet!</div><p class="t-small" style="margin:6px 0 12px">Figuren har hoppet seg gjennom hele flaten.</p><button class="b-btn b-btn--sm" type="button" id="again">Legg ut steinene igjen</button></div>' +
      '  <div class="stage__hint"><span class="b-scribble">klikk en hex → hopp dit</span></div>' +
      "</div>" +
      '<aside class="side">' +
      '  <div class="stack">' +
      '    <span class="b-label">Testflate</span>' +
      "    <h1>Hex-flaten</h1>" +
      '    <p class="b-lead">En liten figur, 61 sekskanter og seks fargesteiner å finne. Alt er tegnet av samme blyant-shader.</p>' +
      "  </div>" +
      '  <ul class="keys">' +
      '    <li><span class="k"><span class="b-kbd">←</span><span class="b-kbd">→</span></span><span>Snu figuren</span></li>' +
      '    <li><span class="k"><span class="b-kbd">↑</span><span class="b-kbd">↓</span></span><span>Hopp fram eller tilbake</span></li>' +
      '    <li><span class="k"><span class="b-kbd">Q</span><span class="b-kbd">E</span><span class="b-kbd">A</span><span class="b-kbd">D</span><span class="b-kbd">Z</span><span class="b-kbd">C</span></span><span>Hopp rett til en nabo</span></li>' +
      '    <li><span class="k"><span class="b-kbd" style="font-family:var(--b-body)">klikk</span></span><span>Gå dit, hex for hex</span></li>' +
      "  </ul>" +
      '  <div class="toggles">' +
      '    <label class="b-switch"><input type="checkbox" id="t-boil"><span class="b-switch__track"></span><span>Kokende strek</span></label>' +
      '    <label class="b-switch"><input type="checkbox" id="t-hatch" checked><span class="b-switch__track"></span><span>Skravering</span></label>' +
      "  </div>" +
      '  <hr class="b-rule" style="margin:0">' +
      '  <p class="t-small" style="color:var(--ink-soft)">Lyst = <mark>overstrykning</mark> på hexen under pekeren. Blekgule hexer er nabofeltene du kan hoppe til nå.</p>' +
      "</aside>";
    var holder = el.querySelector("#hex-canvas");
    var dots = el.querySelector("#gem-dots");
    var tokens = ["--dust-red", "--dust-orange", "--dust-yellow", "--dust-green", "--dust-blue", "--dust-purple"];
    tokens.forEach(function (t) { var i = document.createElement("i"); i.style.setProperty("--c", "var(" + t + ")"); dots.appendChild(i); });
    // the stage must be in the DOM to size the renderer: mount into the view first
    viewEl.appendChild(el);
    var board = new B.HexBoard(holder, {
      radius: 4, seed: 11, gems: 6,
      onCollect: function (n, total) {
        el.querySelector("#gem-count").textContent = n + " av " + total;
        Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle("on", i < n); });
        el.querySelector("#done").hidden = n < total;
      }
    });
    holder.addEventListener("pointerdown", function () { holder.focus({ preventScroll: true }); });
    el.querySelector("#again").addEventListener("click", function () { board.reset(); });
    el.querySelector("#t-boil").addEventListener("change", function (e) { board.sketch.set({ boil: e.target.checked }); });
    el.querySelector("#t-hatch").addEventListener("change", function (e) { board.sketch.set({ hatch: e.target.checked }); });
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) el.querySelector("#t-boil").disabled = true;
    viewEl.removeChild(el);
    return { el: el, board: board };
  }

  /* ---------- Nettside ---------- */
  VIEWS.nettside = {
    title: "Nettside",
    render: function (host, o) {
      o = o || {};
      var s = document.createElement("div");
      s.className = "site";
      s.innerHTML =
        (o.thumb ? "" : '<div class="site-bar"><a class="back" href="#spill">← Til hex-flaten</a></div>') +
        '<section class="hero">' +
        '  <div class="stack-lg">' +
        '    <span class="b-label">Grafitt spill · vinter 2026</span>' +
        '    <h1 class="b-display">Små spill, tegnet <mark>for hånd</mark></h1>' +
        '    <p class="b-lead">Vi lager rolige brettspill for nettleseren. Hver figur starter som en blyantskisse og får aldri mer pynt enn den trenger.</p>' +
        '    <div class="row"><a class="b-btn b-btn--primary" href="#spill">Spill hex-flaten</a><a class="b-btn" href="#dokument">Les hvordan den er laget</a></div>' +
        "  </div>" +
        '  <div class="hero__art"><div class="b-ph" style="--ratio:4/3"><span>skjermbilde av spillet</span></div>' +
        '    <div class="b-note hero__note"><span class="t-note">nytt brett hver fredag!</span></div></div>' +
        "</section>" +
        '<section class="stack-lg"><div class="sec-head"><h2>Hva du får</h2></div><div class="features" id="feat"></div></section>' +
        '<section class="two">' +
        '  <div class="stack-lg"><div class="sec-head"><h2>Priser</h2><p>Alle brett er gratis å prøve. Betal bare for det du vil beholde.</p></div>' +
        '    <div class="b-table-wrap"><table class="b-table"><thead><tr><th>Pakke</th><th>Brett</th><th class="num">Pris</th></tr></thead><tbody>' +
        "      <tr><td>Skisse</td><td>3 brett, uten lagring</td><td class=\"num\">0 kr</td></tr>" +
        "      <tr><td>Blokk <span class=\"b-tag b-tag--marker\">Mest valgt</span></td><td>24 brett og egne baner</td><td class=\"num\">49 kr</td></tr>" +
        "      <tr><td>Atelier</td><td>Alt, pluss baneeditor</td><td class=\"num\">129 kr</td></tr>" +
        "    </tbody></table></div>" +
        '    <div class="b-callout"><span class="b-callout__mark">!</span><p>Prisene er per måned. Du kan si opp når som helst, og banene du har laget blir liggende.</p></div>' +
        "  </div>" +
        '  <form class="form b-box" id="signup" novalidate>' +
        '    <h3>Få beskjed om nye brett</h3>' +
        '    <div class="grid2"><label class="b-field"><span class="b-field__label">Navn</span><input class="b-input" id="f-name" placeholder="Kari Nordmann" autocomplete="name"></label>' +
        '    <label class="b-field"><span class="b-field__label">E-post</span><input class="b-input" id="f-mail" type="email" placeholder="kari@eksempel.no" autocomplete="email"><span class="b-field__hint" id="f-mail-hint">Vi sender maks én e-post i uka.</span></label></div>' +
        '    <label class="b-field"><span class="b-field__label">Favorittform</span><span class="b-select"><select class="b-input" id="f-shape"><option>Sekskant</option><option>Firkant</option><option>Trekant</option></select></span></label>' +
        '    <label class="b-field"><span class="b-field__label">Ønsker til neste brett</span><textarea class="b-input" id="f-wish" placeholder="Flere fjell, færre trær …"></textarea></label>' +
        '    <div class="row" role="radiogroup" aria-label="Hvor ofte"><label class="b-check b-check--radio"><input type="radio" name="freq" id="f-w" checked><span class="b-check__box"></span>Hver uke</label><label class="b-check b-check--radio"><input type="radio" name="freq" id="f-m"><span class="b-check__box"></span>Hver måned</label></div>' +
        '    <label class="b-check"><input type="checkbox" id="f-terms"><span class="b-check__box"></span>Jeg vil også teste brett før de slippes</label>' +
        '    <div class="row"><button class="b-btn b-btn--marker" type="submit">Meld meg på</button><span class="b-small" id="f-status" aria-live="polite"></span></div>' +
        "  </form>" +
        "</section>" +
        '<section class="quotes">' +
        '  <figure class="quote" style="margin:0"><blockquote>«Det føles som å spille i margen på en mattebok.»</blockquote><footer><span class="b-avatar">IL</span>Ingrid L., testspiller</footer></figure>' +
        '  <figure class="quote" style="margin:0"><blockquote>«Jeg skisset et brett på lunsjen og spilte det samme kveld.»</blockquote><footer><span class="b-avatar">ØH</span>Øystein H., baneeditor</footer></figure>' +
        "</section>" +
        '<footer class="foot"><span>© 2026 Grafitt spill</span><span>Kontakt · Personvern · Presse</span></footer>';
      host.appendChild(s);
      var feat = s.querySelector("#feat");
      [["Hex for hex", "Brett bygget av sekskanter. Hver flytt er et lite hopp, aldri en lang løpetur.",
        [{ type: "hex", cx: 22, cy: 36, r: 15 }, { type: "hex", cx: 48, cy: 22, r: 15, fill: "var(--marker)" }, { type: "hex", cx: 48, cy: 50, r: 15 }]],
       ["Tegnet først", "Alle figurer begynner som blyantstreker. Farge kommer bare der den betyr noe.",
        [{ type: "curve", points: [[8, 50], [22, 18], [38, 40], [54, 12], [68, 30]] }, { type: "circle", cx: 54, cy: 46, r: 9, fill: "var(--dust-red)" }]],
       ["Bygg selv", "Tegn en bane i editoren og del lenken. Ingen konto trengs.",
        [{ type: "rect", x: 8, y: 14, w: 42, h: 40 }, { type: "arrow", x1: 30, y1: 34, x2: 68, y2: 18 }, { type: "hatch", points: [[8, 14], [50, 14], [50, 54], [8, 54]], gap: 6 }]]
      ].forEach(function (f) {
        var d = document.createElement("div");
        d.className = "feature";
        figureInto(d, 76, 64, f[2]);
        d.insertAdjacentHTML("beforeend", "<h3>" + f[0] + "</h3><p>" + f[1] + "</p>");
        feat.appendChild(d);
      });
      if (!o.thumb) {
        var form = s.querySelector("#signup");
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var mail = s.querySelector("#f-mail"), hint = s.querySelector("#f-mail-hint");
          var ok = /.+@.+\..+/.test(mail.value);
          mail.setAttribute("aria-invalid", ok ? "false" : "true");
          hint.className = "b-field__hint" + (ok ? "" : " b-field__hint--error");
          hint.textContent = ok ? "Vi sender maks én e-post i uka." : "Skriv en e-postadresse med @, for eksempel kari@eksempel.no.";
          s.querySelector("#f-status").textContent = ok ? "Du står på lista. (Dette er en demo, ingenting ble sendt.)" : "";
          B.reink(form);
        });
      }
    }
  };

  /* ---------- Dokument ---------- */
  VIEWS.dokument = {
    title: "Dokument",
    render: function (host, o) {
      o = o || {};
      var d = document.createElement("article");
      d.className = "doc";
      d.innerHTML =
        '<div class="doc__main">' +
        (o.thumb ? "" : '<a class="back" href="#spill">← Til hex-flaten</a>') +
        '  <span class="b-label">Notat · Spillmekanikk</span>' +
        "  <h1>Slik bygger du en hex-verden</h1>" +
        '  <div class="doc__meta"><span class="b-avatar" style="width:34px;height:34px;font-size:16px">PH</span><span>Skrevet i skisseboka</span><span>·</span><span>9. november 2026</span><span>·</span><span>4 min lesing</span></div>' +
        '  <p class="b-lead">Sekskanter gir seks like naboer. Det gjør hoppene rettferdige og tegningen rolig.</p>' +
        '  <div class="doc__p"><p>Et kvadratisk rutenett har to slags naboer: de fire på sidene og de fire på skrå. På en hex-flate er <mark>alle seks naboene like langt unna</mark>. Figuren kan derfor hoppe i hvilken som helst retning uten at noen vei er en snarvei.</p>' +
        '    <div class="margin-note" aria-hidden="' + (o.thumb ? "true" : "false") + '"><span class="t-note" style="color:var(--ink-soft)">dette er hele poenget!</span></div></div>' +
        "  <h2>Aksiale koordinater</h2>" +
        "  <p>Hver hex får to tall, <code>q</code> og <code>r</code>. Den tredje aksen, <code>s = −q − r</code>, trenger du sjelden å lagre. Avstanden mellom to hexer er halvparten av summen av forskjellene langs alle tre aksene.</p>" +
        '  <figure class="figure" id="hexfig"><figcaption>Figur 1. Sentrum er (0, 0). Pila viser et hopp mot nordøst: q + 1, r − 1.</figcaption></figure>' +
        '  <div class="b-table-wrap"><table class="b-table"><thead><tr><th>Retning</th><th class="num">Δq</th><th class="num">Δr</th><th>Tast</th></tr></thead><tbody>' +
        '    <tr><td>Øst</td><td class="num">+1</td><td class="num">0</td><td><span class="b-kbd">D</span></td></tr>' +
        '    <tr><td>Nordøst</td><td class="num">+1</td><td class="num">−1</td><td><span class="b-kbd">E</span></td></tr>' +
        '    <tr><td>Nordvest</td><td class="num">0</td><td class="num">−1</td><td><span class="b-kbd">Q</span></td></tr>' +
        '    <tr><td>Vest</td><td class="num">−1</td><td class="num">0</td><td><span class="b-kbd">A</span></td></tr>' +
        '    <tr><td>Sørvest</td><td class="num">−1</td><td class="num">+1</td><td><span class="b-kbd">Z</span></td></tr>' +
        '    <tr><td>Sørøst</td><td class="num">0</td><td class="num">+1</td><td><span class="b-kbd">C</span></td></tr>' +
        "  </tbody></table></div>" +
        "  <h2>Fra hex til tegning</h2>" +
        "  <p>Midtpunktet i verden regnes ut fra koordinatene. Med spisse topper og størrelse <code>s</code> blir det:</p>" +
        "  <pre><code>x = s · √3 · (q + r / 2)\nz = s · 1.5 · r\n\nBlyant.hexgrid.toXZ(q, r, s)  // gjør det samme</code></pre>" +
        '  <div class="b-callout"><span class="b-callout__mark">↳</span><p>Hold et lite mellomrom mellom hexene (93 % størrelse). Da finner blyant-shaderen kanten mellom to like høye felt, fordi dybden hopper i sprekken.</p></div>' +
        "  <blockquote>Tegn rammen først. Pynten kan komme når reglene sitter.</blockquote>" +
        "  <h3>Sjekkliste før du gir brettet farge</h3>" +
        "  <ul><li>Alle felt kan nås fra start, eller er bevisst stengt.</li><li>Ingen sti er kortere enn tre hopp til nærmeste stein.</li><li>Farge brukes bare på det spilleren skal lete etter.</li></ul>" +
        "  <hr>" +
        '  <div class="footnotes"><span>1. Aksiale koordinater er en forenkling av kubiske koordinater der q + r + s = 0.</span><span>2. Brettet i testflaten har radius 4, altså 61 felt.</span></div>' +
        "</div>";
      host.appendChild(d);
      // Figure: axial hex grid with labels and a hop arrow
      var fig = d.querySelector("#hexfig");
      var W = 600, H = 300, s = svgEl(W, H), size = 34, cx = W / 2, cy = H / 2;
      fig.insertBefore(s, fig.firstChild);
      var shapes = [];
      B.hexgrid.ring(1).concat([[2, -1], [-2, 1], [1, -2], [-1, 2]]).forEach(function (c, i) {
        var xz = B.hexgrid.toXZ(c[0], c[1], size);
        var isNE = c[0] === 1 && c[1] === -1, isC = c[0] === 0 && c[1] === 0;
        shapes.push({ type: "hex", cx: cx + xz[0], cy: cy + xz[1], r: size - 2, fill: isNE ? "var(--marker)" : isC ? "var(--paper-3)" : null, fillOpacity: 0.9, seed: 5 + i });
      });
      var ne = B.hexgrid.toXZ(1, -1, size);
      shapes.push({ type: "arrow", x1: cx + 6, y1: cy - 6, x2: cx + ne[0] - 8, y2: cy + ne[1] + 10, bend: 0.25, width: 2.2 });
      B.figure(s, shapes);
      B.hexgrid.ring(1).forEach(function (c) {
        var xz = B.hexgrid.toXZ(c[0], c[1], size);
        var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", cx + xz[0]); t.setAttribute("y", cy + xz[1] + 5);
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("style", "font-family:var(--b-mono);font-size:12px;fill:var(--ink)");
        t.textContent = c[0] + "," + c[1];
        s.appendChild(t);
      });
      var note = document.createElementNS("http://www.w3.org/2000/svg", "text");
      note.setAttribute("x", cx + 120); note.setAttribute("y", 40);
      note.setAttribute("style", "font-family:var(--b-note);font-size:18px;fill:var(--ink-soft)");
      note.textContent = "hopp → nordøst";
      s.appendChild(note);
      // margin note arrow
      var mn = d.querySelector(".margin-note");
      var ms = svgEl(70, 36); mn.insertBefore(ms, mn.firstChild);
      B.figure(ms, [{ type: "arrow", x1: 66, y1: 30, x2: 6, y2: 10, bend: -0.3, width: 1.4 }]);
    }
  };

  /* ---------- Presentasjon ---------- */
  var SLIDES = [
    function (el) {
      el.innerHTML = '<span class="b-slide__kicker">Blyant · designsystem</span><h2 class="b-slide__title">Skisse først,<br>stil etterpå</h2><p class="b-slide__body">Et håndtegnet system for spill, nettsider, dokumenter og slides.</p><div class="slide-art" data-art="hexes"></div><div class="b-slide__foot"><span>Grafitt spill</span><span>01</span></div>';
    },
    function (el) {
      el.innerHTML = '<span class="b-slide__kicker">Arkitektur</span><h2 class="b-slide__title">Tre lag</h2><div class="slide-cols">' +
        '<div class="b-box"><h3>Struktur</h3><span>Klasser og layout. Endres aldri når designet kommer.</span></div>' +
        '<div class="b-box"><h3>Skall</h3><span>Font, strek og hjørner. Det eneste laget som byttes når merkevaren kommer.</span></div>' +
        '<div class="b-box"><h3>Effekt</h3><span>Seks støvete farger og <mark>overstrykning</mark>. Brukes sparsomt.</span></div>' +
        '</div><div class="b-slide__foot"><span>Grafitt spill</span><span>02</span></div>';
    },
    function (el) {
      el.innerHTML = '<span class="b-slide__kicker">Testflaten · eksempeldata</span><h2 class="b-slide__title">Hopp per runde</h2><div class="slide-art" data-art="bars"></div><div class="b-slide__foot"><span>Fem testrunder, oppdiktede tall</span><span>03</span></div>';
    },
    function (el) {
      el.innerHTML = '<span class="b-slide__kicker">Videre</span><h2 class="b-slide__title">Neste steg</h2><div class="slide-list"><span>1. Tegn rammene i Blyant.</span><span>2. Test flyten med ekte innhold.</span><span>3. Legg på merkevaren som et nytt skall.</span></div><div class="b-slide__foot"><span>Grafitt spill</span><span>04</span></div>';
    }
  ];
  function drawSlideArt(el) {
    var a = el.querySelector("[data-art]");
    if (!a) return;
    if (a.dataset.art === "hexes") {
      var s = svgEl(900, 170); a.appendChild(s);
      var cols = ["var(--dust-red)", "var(--dust-orange)", "var(--dust-yellow)", "var(--dust-green)", "var(--dust-blue)", "var(--dust-purple)"];
      var sh = [];
      for (var i = 0; i < 9; i++) sh.push({ type: "hex", cx: 430 + i * 52 + (i % 2) * 0, cy: 70 + (i % 2) * 45, r: 28, fill: i % 3 === 1 ? cols[i % 6] : null, seed: 30 + i });
      sh.push({ type: "arrow", x1: 360, y1: 120, x2: 440, y2: 80, bend: 0.3 });
      B.figure(s, sh);
    } else {
      var data = [["R1", 14], ["R2", 22], ["R3", 19], ["R4", 31], ["R5", 27]];
      var s2 = svgEl(900, 300); a.appendChild(s2);
      var sh2 = [{ type: "line", x1: 80, y1: 260, x2: 860, y2: 260 }, { type: "line", x1: 80, y1: 260, x2: 80, y2: 20 }];
      data.forEach(function (d, i) {
        var h = d[1] / 35 * 230, x = 140 + i * 140;
        sh2.push({ type: "rect", x: x, y: 260 - h, w: 80, h: h, seed: 70 + i });
        sh2.push({ type: "hatch", points: [[x, 260 - h], [x + 80, 260 - h], [x + 80, 260], [x, 260]], gap: i === 3 ? 4 : 8, seed: 90 + i });
      });
      B.figure(s2, sh2);
      data.forEach(function (d, i) {
        var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", 180 + i * 140); t.setAttribute("y", 290); t.setAttribute("text-anchor", "middle");
        t.setAttribute("style", "font-family:var(--b-body);font-size:24px;fill:var(--ink)");
        t.textContent = d[0]; s2.appendChild(t);
        var v = document.createElementNS("http://www.w3.org/2000/svg", "text");
        v.setAttribute("x", 180 + i * 140); v.setAttribute("y", 260 - d[1] / 35 * 230 - 10); v.setAttribute("text-anchor", "middle");
        v.setAttribute("style", "font-family:var(--b-mono);font-size:18px;fill:var(--ink)");
        v.textContent = d[1]; s2.appendChild(v);
      });
      var n = document.createElementNS("http://www.w3.org/2000/svg", "text");
      n.setAttribute("x", 640); n.setAttribute("y", 40);
      n.setAttribute("style", "font-family:var(--b-note);font-size:22px;fill:var(--ink-soft)");
      n.textContent = "R4: endelig flyt!"; s2.appendChild(n);
    }
  }
  var deckIndex = 0, deckKeys = null;
  VIEWS.presentasjon = {
    title: "Presentasjon",
    render: function (host, o) {
      o = o || {};
      var d = document.createElement("section");
      d.className = "deck";
      d.innerHTML = (o.thumb ? "" : '<div class="deck__bar"><a class="back" href="#spill">← Til hex-flaten</a><div class="row"><button class="b-btn b-btn--sm" type="button" id="prev" aria-label="Forrige slide">←</button><span class="deck__count" id="count"></span><button class="b-btn b-btn--sm" type="button" id="next" aria-label="Neste slide">→</button></div></div>') +
        '<div class="b-slide" id="slide" aria-live="polite"></div>' +
        (o.thumb ? "" : '<div class="deck__strip" id="strip"></div>');
      host.appendChild(d);
      var main = d.querySelector("#slide");
      function show(i) {
        deckIndex = (i + SLIDES.length) % SLIDES.length;
        SLIDES[deckIndex](main);
        drawSlideArt(main);
        B.ink(main);
        if (o.thumb) return;
        d.querySelector("#count").textContent = (deckIndex + 1) + " / " + SLIDES.length;
        Array.prototype.forEach.call(d.querySelectorAll(".deck__mini"), function (m, k) { m.setAttribute("aria-current", k === deckIndex ? "true" : "false"); });
      }
      if (o.thumb) { SLIDES[0](main); drawSlideArt(main); return; }
      var strip = d.querySelector("#strip");
      SLIDES.forEach(function (fn, i) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "deck__mini";
        b.innerHTML = '<div class="b-slide"></div><span>Slide ' + (i + 1) + "</span>";
        fn(b.firstChild); drawSlideArt(b.firstChild);
        b.addEventListener("click", function () { show(i); });
        strip.appendChild(b);
      });
      d.querySelector("#prev").addEventListener("click", function () { show(deckIndex - 1); });
      d.querySelector("#next").addEventListener("click", function () { show(deckIndex + 1); });
      deckKeys = function (e) {
        if (e.key === "ArrowRight" || e.key === "PageDown") { show(deckIndex + 1); e.preventDefault(); }
        if (e.key === "ArrowLeft" || e.key === "PageUp") { show(deckIndex - 1); e.preventDefault(); }
      };
      window.addEventListener("keydown", deckKeys);
      show(deckIndex);
    },
    leave: function () { if (deckKeys) window.removeEventListener("keydown", deckKeys); deckKeys = null; }
  };


  /* ---------- Grafer ---------- */
  // Example data from imagined playtests of the hex board. Deterministic, marked as examples on the page.
  function series(seed, n, base, amp, trend) {
    var r = B.rough.rng(seed), out = [], v = base;
    for (var i = 0; i < n; i++) { v = Math.max(1, v + (r() - 0.45) * amp + trend); out.push(Math.round(v)); }
    return out;
  }
  function days(n) {
    var out = [], d = new Date(2026, 10, 9);
    for (var i = n - 1; i >= 0; i--) { var x = new Date(d); x.setDate(d.getDate() - i); out.push(x.getDate() + "." + (x.getMonth() + 1)); }
    return out;
  }
  var GRAF = {
    7: { x: days(7), s: [series(3, 7, 140, 40, 4), series(5, 7, 90, 30, 2), series(9, 7, 50, 20, 3)],
         stats: [[1284, 12, "%", series(21, 12, 900, 120, 30)], [27, 4, "", series(22, 12, 20, 4, 0.6)], [61, -3, " poeng", series(23, 12, 66, 5, -0.4)]] },
    30: { x: days(30), s: [series(13, 30, 110, 30, 1.2), series(15, 30, 70, 22, 0.8), series(19, 30, 30, 14, 0.9)],
         stats: [[5310, 8, "%", series(31, 12, 3600, 400, 90)], [25, 2, "", series(32, 12, 21, 3, 0.4)], [64, 1, " poeng", series(33, 12, 62, 4, 0.2)]] }
  };
  var grafRange = 7;
  VIEWS.grafer = {
    title: "Grafer",
    render: function (host, o) {
      o = o || {};
      var d = document.createElement("div");
      d.className = "stack-lg";
      d.style.gap = "var(--space-12)";
      d.innerHTML =
        (o.thumb ? "" : '<a class="back" href="#spill">← Til hex-flaten</a>') +
        '<section class="stack-lg"><div class="sec-head"><span class="b-label">Blyant.chart · eksempeldata fra testrunder</span><h1>Grafer med blyant</h1><p>Seks fargeblyanter i fast rekkefølge, hårfine hjelpelinjer og en tabell bak hver graf. Pek på en graf, eller gi den fokus og bruk piltastene.</p></div>' +
        '<div class="row filter-row" role="group" aria-label="Periode"><span class="b-label">Periode</span><button class="b-btn b-btn--sm" type="button" data-range="7" aria-pressed="true">Siste 7 dager</button><button class="b-btn b-btn--sm" type="button" data-range="30" aria-pressed="false">Siste 30 dager</button></div>' +
        '<div class="stats"><div class="b-box" data-stat="0"></div><div class="b-box" data-stat="1"></div><div class="b-box" data-stat="2"></div></div></section>' +
        '<section class="charts">' +
        '<div class="b-box chart-card chart-card--wide"><div data-chart="line"></div><button class="b-btn b-btn--sm b-btn--quiet chart-card__tbl" type="button">Vis tabell</button></div>' +
        '<div class="b-box chart-card"><div data-chart="bar"></div><button class="b-btn b-btn--sm b-btn--quiet chart-card__tbl" type="button">Vis tabell</button></div>' +
        '<div class="b-box chart-card"><div data-chart="stack"></div><button class="b-btn b-btn--sm b-btn--quiet chart-card__tbl" type="button">Vis tabell</button></div>' +
        '<div class="b-box chart-card"><div data-chart="scatter"></div><button class="b-btn b-btn--sm b-btn--quiet chart-card__tbl" type="button">Vis tabell</button></div>' +
        '<div class="b-box chart-card"><div data-chart="hbar"></div><button class="b-btn b-btn--sm b-btn--quiet chart-card__tbl" type="button">Vis tabell</button></div>' +
        '<div class="b-box chart-card chart-card--wide"><div data-chart="seg"></div><button class="b-btn b-btn--sm b-btn--quiet chart-card__tbl" type="button">Vis tabell</button></div>' +
        "</section>" +
        (o.thumb ? "" : '<section class="two"><div class="stack"><span class="b-label">Bruk</span><h2>Én linje per graf</h2><p>Gi grafen en tom boks og dataene. Fargene hentes fra <code>--chart-1</code> til <code>--chart-6</code>, så Papir og Kull virker av seg selv.</p></div>' +
        '<pre><code>Blyant.chart.line(el, {\n  title: "Spillere per dag",\n  x: ["3.11", "4.11", "5.11"],\n  series: [\n    { name: "Hex-flaten", values: [140, 162, 171] },\n    { name: "Myra", values: [90, 88, 97] }\n  ]\n});\n\nBlyant.chart.bar(el, { categories, series, highlight: 3 });\nBlyant.chart.stat(el, { label, value, delta, trend });</code></pre></section>');
      host.appendChild(d);
      var C = B.chart, charts = {};
      function q(s) { return d.querySelector(s); }
      var data = GRAF[grafRange];
      var statDefs = [["Spillere", "", true], ["Hopp per runde", "", true], ["Fullførte brett", "%", true]];
      function drawStats() {
        data = GRAF[grafRange];
        statDefs.forEach(function (s, i) {
          var v = data.stats[i];
          C.stat(q('[data-stat="' + i + '"]'), { label: s[0] + (grafRange === 7 ? " siste 7 dager" : " siste 30 dager"), value: v[0], unit: s[1], delta: v[1], deltaUnit: v[2], deltaLabel: "mot forrige periode", upIsGood: s[2], trend: v[3] });
        });
      }
      drawStats();
      charts.line = C.line(q('[data-chart="line"]'), { title: "Spillere per dag", subtitle: "Unike spillere per brett", x: data.x, xLabel: "Dag",
        series: [{ name: "Hex-flaten", values: data.s[0] }, { name: "Myra", values: data.s[1] }, { name: "Fjellet", values: data.s[2] }], height: 260 });
      charts.bar = C.bar(q('[data-chart="bar"]'), { title: "Hopp per runde", subtitle: "Snitt i fem testrunder. R4 fikk ny figur.", categories: ["R1", "R2", "R3", "R4", "R5"], categoryLabel: "Runde",
        series: [{ name: "Hopp", values: [14, 22, 19, 31, 27] }], highlight: 3, height: 240 });
      charts.stack = C.bar(q('[data-chart="stack"]'), { title: "Hvordan rundene endte", subtitle: "Antall runder per brett", categories: ["Hex-flaten", "Myra", "Fjellet"], categoryLabel: "Brett", stacked: true,
        series: [{ name: "Fullført", values: [212, 140, 61] }, { name: "Ga opp", values: [58, 71, 66] }, { name: "Tiden gikk ut", values: [30, 22, 41] }], height: 240 });
      charts.scatter = C.scatter(q('[data-chart="scatter"]'), { title: "Tid mot antall hopp", subtitle: "Én prikk per runde", xLabel: "Sekunder", yLabel: "Hopp",
        series: [{ name: "Mus", points: [[42, 18, "Ada"], [55, 22], [61, 25], [70, 31], [38, 16], [84, 33, "Ola"], [66, 24], [49, 20]] },
                 { name: "Tastatur", points: [[30, 21], [36, 24, "Kim"], [44, 29], [52, 33], [28, 19], [58, 37, "Siv"], [40, 26], [47, 30]] }],
        labelPoints: ["Ola", "Siv"], height: 250 });
      charts.hbar = C.bar(q('[data-chart="hbar"]'), { title: "Hvor figuren står fast", subtitle: "Ganger spilleren hoppet mot en blokkert hex", horizontal: true, categoryLabel: "Hinder",
        categories: ["Trær", "Vann", "Steiner", "Kanten"], series: [{ name: "Forsøk", values: [96, 71, 38, 22] }], highlight: 0 });
      charts.seg = C.segments(q('[data-chart="seg"]'), { title: "Hvordan spillerne styrer", subtitle: "Andel av alle hopp", unit: "hopp",
        parts: [{ name: "Klikk med mus", value: 4610 }, { name: "Piltaster", value: 3120 }, { name: "Q E A D Z C", value: 1490 }, { name: "Trykk på skjerm", value: 780 }] });
      Array.prototype.forEach.call(d.querySelectorAll(".chart-card"), function (card) {
        var host = card.querySelector("[data-chart]"), btn = card.querySelector(".chart-card__tbl");
        var ch = charts[host.getAttribute("data-chart")];
        btn.addEventListener("click", function () { var on = ch.table(); btn.textContent = on ? "Vis graf" : "Vis tabell"; });
      });
      Array.prototype.forEach.call(d.querySelectorAll("[data-range]"), function (b) {
        b.addEventListener("click", function () {
          grafRange = +b.getAttribute("data-range");
          Array.prototype.forEach.call(d.querySelectorAll("[data-range]"), function (x) {
            x.setAttribute("aria-pressed", x === b ? "true" : "false");
            x.classList.toggle("b-btn--marker", x === b);
          });
          drawStats();
          charts.line.update({ x: data.x, series: [{ name: "Hex-flaten", values: data.s[0] }, { name: "Myra", values: data.s[1] }, { name: "Fjellet", values: data.s[2] }] });
        });
      });
      d.querySelector('[data-range="' + grafRange + '"]').classList.add("b-btn--marker");
      d.querySelector('[data-range="' + grafRange + '"]').setAttribute("aria-pressed", "true");
      d.querySelector('[data-range="' + (grafRange === 7 ? 30 : 7) + '"]').setAttribute("aria-pressed", "false");
    }
  };

  /* ---------- Ruter (comic frames) ---------- */
  var ruter = { count: 6, geometry: 0.6, seed: 4, shape: "bred" };
  var RUTE_TEKST = ["Hoppet", "Dit bort?", "HOPP!", "Senere, på myra …", "Tre hex igjen.", "Nesten!", "Og så ble det stille."];
  function fillFrame(pn, i) {
    var body = pn.body, node = pn.el, w = pn.safe.w, h = pn.safe.h, bb = pn.bbox, kind = i % 6;
    var old = node.querySelector(".rute-bg");
    if (old) node.removeChild(old);
    body.innerHTML = "";
    body.className = "b-frame__body rute rute--" + kind;
    var rel = pn.points.map(function (v) { return [v[0] - bb.x, v[1] - bb.y]; });
    function bg(draw) {
      var s = B.svg(bb.w, bb.h, null, { "class": "rute-bg", "aria-hidden": "true" });
      node.insertBefore(s, body);
      draw(s);
    }
    if (kind === 0) {
      body.innerHTML = '<span class="b-label">Kapittel ' + (1 + Math.floor(i / 6)) + '</span><span class="rute__title">' + esc(RUTE_TEKST[i % 7]) + "</span>";
    } else if (kind === 1 || kind === 4) {
      var s1 = B.svg(200, 140, body, { "class": "rute__art", role: "img", "aria-label": kind === 1 ? "Figuren står på en hex" : "Figuren i luften mellom to hex", preserveAspectRatio: "xMidYMid meet" });
      s1.removeAttribute("width"); s1.removeAttribute("height");
      var hexA = [[56, 104], [82, 92], [118, 92], [144, 104], [118, 118], [82, 118]];
      var shapes = kind === 1
        ? [{ type: "hatch", points: hexA, gap: 5, opacity: 0.5 }, { type: "poly", points: hexA },
           { type: "ellipse", cx: 100, cy: 74, rx: 15, ry: 20, fill: "var(--dust-blue)" }, { type: "circle", cx: 100, cy: 42, r: 11, fill: "var(--paper)", fillOpacity: 1 }]
        : [{ type: "poly", points: hexA.map(function (v) { return [v[0] - 52, v[1] + 8]; }) }, { type: "poly", points: hexA.map(function (v) { return [v[0] + 52, v[1] + 8]; }) },
           { type: "curve", points: [[52, 96], [76, 44], [112, 36], [146, 92]], opacity: 0.55, width: 1.1 },
           { type: "ellipse", cx: 104, cy: 46, rx: 14, ry: 18, fill: "var(--dust-orange)" }, { type: "circle", cx: 110, cy: 18, r: 10, fill: "var(--paper)", fillOpacity: 1 }];
      B.figure(s1, shapes.map(function (sh, k) { sh.seed = i * 13 + k + 3; return sh; }));
    } else if (kind === 2) {
      var s2 = B.svg(w, h, body, { "class": "rute__bubble", "aria-hidden": "true" });
      var ry = Math.min(h * 0.34, w * 0.3), rx = Math.min(w * 0.46, ry * 1.9), cx = w / 2, cy = h * 0.46;
      B.draw(s2, B.rough.ellipse(cx, cy, rx, ry, { seed: i + 9 }), { width: 1.7 });
      B.draw(s2, B.rough.poly([[cx - rx * 0.3, cy + ry * 0.9], [cx - rx * 0.5, Math.min(h * 0.98, cy + ry * 1.5)], [cx - rx * 0.02, cy + ry * 0.98]], false, { seed: i + 4 }), { width: 1.7 });
      var p = document.createElement("p");
      p.className = "rute__say";
      p.style.cssText = "left:" + (cx - rx * 0.72) + "px;top:" + (cy - ry * 0.62) + "px;width:" + rx * 1.44 + "px;height:" + ry * 1.24 + "px";
      p.textContent = RUTE_TEKST[(i + 6) % 7 || 1];
      body.appendChild(p);
    } else if (kind === 3) {
      bg(function (s) { B.draw(s, B.rough.hatch(rel, { seed: i + 2, gap: 9, angle: -38 }), { width: 1, opacity: 0.32 }); });
      body.innerHTML = '<span class="rute__lyd"><mark>HOPP!</mark></span>';
    } else {
      bg(function (s) { B.draw(s, B.rough.hatch(rel, { seed: i + 7, gap: 6, angle: 52 }), { width: 1, opacity: 0.5 }); });
      body.innerHTML = '<span class="rute__cap">' + esc(RUTE_TEKST[(i + 3) % 7]) + "</span>";
    }
  }
  VIEWS.ruter = {
    title: "Ruter",
    render: function (host, o) {
      o = o || {};
      var d = document.createElement("div");
      d.className = "stack-lg";
      d.style.gap = "var(--space-12)";
      d.innerHTML =
        (o.thumb ? "" : '<a class="back" href="#spill">← Til hex-flaten</a>') +
        '<section class="stack-lg"><div class="sec-head"><span class="b-label">Blyant.frames</span><h1>Tegneserieruter</h1><p>Gi verktøyet en flate og et antall. Det kutter flaten i ruter som alltid fyller plassen, og tegner rammene med blyant. Dra i geometrien for å gå fra rolig rutenett til skjeve kutt.</p></div>' +
        (o.thumb ? "" :
        '<div class="rute-tools b-box">' +
        '<label class="b-field"><span class="b-field__label">Antall ruter <output id="rt-n-out"></output></span><input class="b-range" id="rt-n" type="range" min="1" max="14" step="1"></label>' +
        '<label class="b-field"><span class="b-field__label">Geometri <output id="rt-g-out"></output></span><input class="b-range" id="rt-g" type="range" min="0" max="1" step="0.05"></label>' +
        '<div class="rute-tools__row"><div class="rute-tools__fmt" role="group" aria-label="Format"><button class="b-btn b-btn--sm" type="button" data-shape="bred">Bred</button><button class="b-btn b-btn--sm" type="button" data-shape="kvadrat">Kvadrat</button><button class="b-btn b-btn--sm" type="button" data-shape="hoy">Høy</button></div>' +
        '<button class="b-btn b-btn--sm b-btn--primary" type="button" id="rt-seed">Ny side</button></div></div>') +
        '<div class="rute-stage" data-shape="' + ruter.shape + '"><div id="rt-frames" class="rute-frames"></div></div></section>' +
        (o.thumb ? "" : '<section class="two"><div class="stack"><span class="b-label">Bruk</span><h2>Én linje per side</h2><p>Samme <code>seed</code> gir samme side hver gang, også når plassen endrer størrelse. Hver rute har et trygt rektangel til innholdet, så tekst aldri klippes av en skrå kant. Rutene ligger i leserekkefølge.</p></div>' +
        '<pre><code>var side = Blyant.frames(el, {\n  count: 6,       // antall ruter\n  geometry: 0.6,  // 0 = rutenett, 1 = skjevt og vilt\n  seed: 4,\n  render: function (rute, i) {\n    rute.body.textContent = "Rute " + (i + 1);\n  }\n});\n\nside.update({ geometry: 1 });\n\n// eller rett i HTML: ett barn per rute\n// &lt;div data-count="3" data-geometry="0.4"&gt;…&lt;/div&gt;</code></pre></section>');
      host.appendChild(d);
      var fr = B.frames(d.querySelector("#rt-frames"), { count: ruter.count, geometry: ruter.geometry, seed: ruter.seed, render: fillFrame });
      if (o.thumb) return;
      var nIn = d.querySelector("#rt-n"), gIn = d.querySelector("#rt-g"), stage = d.querySelector(".rute-stage");
      function sync() {
        nIn.value = ruter.count; gIn.value = ruter.geometry;
        d.querySelector("#rt-n-out").textContent = ruter.count;
        d.querySelector("#rt-g-out").textContent = String(ruter.geometry.toFixed(2)).replace(".", ",");
        stage.setAttribute("data-shape", ruter.shape);
        Array.prototype.forEach.call(d.querySelectorAll("[data-shape].b-btn"), function (b) {
          var on = b.getAttribute("data-shape") === ruter.shape;
          b.classList.toggle("b-btn--marker", on); b.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
      nIn.addEventListener("input", function () { ruter.count = +nIn.value; sync(); fr.update({ count: ruter.count }); });
      gIn.addEventListener("input", function () { ruter.geometry = +gIn.value; sync(); fr.update({ geometry: ruter.geometry }); });
      d.querySelector("#rt-seed").addEventListener("click", function () { ruter.seed++; fr.update({ seed: ruter.seed }); });
      Array.prototype.forEach.call(d.querySelectorAll("[data-shape].b-btn"), function (b) {
        b.addEventListener("click", function () { ruter.shape = b.getAttribute("data-shape"); sync(); B.reink(d); });
      });
      sync();
    }
  };

  /* ---------- Former (2D + 3D lab) ---------- */
  var lab = null;
  VIEWS.former = {
    title: "Former",
    render: function (host, o) {
      o = o || {};
      var d = document.createElement("div");
      d.className = "stack-lg";
      d.style.gap = "var(--space-12)";
      d.innerHTML =
        (o.thumb ? "" : '<a class="back" href="#spill">← Til hex-flaten</a>') +
        '<section class="stack-lg"><div class="sec-head"><span class="b-label">2D · Blyant.rough</span><h1>Håndtegnede streker</h1><p>Hver form er to raske strøk med litt skjelving. Samme frø gir samme strek, så tegningen står stille mellom oppdateringer.</p></div><div class="shapes" id="shapes"></div></section>' +
        '<section class="stack-lg"><div class="sec-head"><span class="b-label">Effektfarger</span><h2>Fargeblyantene</h2><p>Svart, hvitt og grått bærer alt. De seks støvete fargene og tusjen er krydder.</p></div><div class="pencils" id="pencils"></div></section>' +
        (o.thumb ? "" :
        '<section class="lab"><div class="lab__stage b-box" data-ink="box" style="padding:0"><div class="stage__canvas" id="lab-canvas"></div></div>' +
        '<aside class="side"><div class="sec-head"><span class="b-label">3D · Blyant.Sketch3D</span><h2>Blyant-shaderen</h2><p>three.js tegner normaler, dybde og lys. Et etterarbeid gjør det om til kontur, skravur og papir.</p></div>' +
        '<label class="range"><span><span>Strektykkelse</span><b class="b-mono" id="lw-v">1.1</b></span><input type="range" id="lw" min="0.6" max="2.4" step="0.1" value="1.1"></label>' +
        '<label class="range"><span><span>Skravur-avstand</span><b class="b-mono" id="hg-v">5.5</b></span><input type="range" id="hg" min="3" max="10" step="0.5" value="5.5"></label>' +
        '<label class="b-switch"><input type="checkbox" id="lab-boil"><span class="b-switch__track"></span><span>Kokende strek</span></label>' +
        '<label class="b-switch"><input type="checkbox" id="lab-spin" checked><span class="b-switch__track"></span><span>Roter</span></label>' +
        "</aside></section>" +
        '<section class="two blender"><div class="stack"><span class="b-label">Fra Blender</span><h2>Egne modeller</h2><ol><li>Modeller i Blender med enkle, flate flater. Rundinger blir glatte konturer.</li><li>Fil → Eksporter → glTF 2.0 (.glb). Ta med normaler.</li><li>Last inn med <code>THREE.GLTFLoader</code> og bytt materialene til <code>sketch.mat(…)</code>.</li><li>Navngi materialer i Blender etter tokens, for eksempel <code>dust-red</code>, så kan de mappes automatisk.</li></ol></div>' +
        '<pre><code>const sketch = new Blyant.Sketch3D(el);\nnew THREE.GLTFLoader().load("hytte.glb", g =&gt; {\n  g.scene.traverse(o =&gt; {\n    if (!o.isMesh) return;\n    const name = o.material.name;          // "dust-red"\n    o.material = sketch.mat(name ? "--" + name : "#fff");\n  });\n  sketch.add(g.scene);\n  sketch.start();\n});</code></pre></section>');
      host.appendChild(d);
      var shapes = d.querySelector("#shapes");
      [["rough.line", [{ type: "line", x1: 20, y1: 110, x2: 220, y2: 40 }, { type: "line", x1: 20, y1: 130, x2: 220, y2: 130, seed: 4 }]],
        ["rough.rect", [{ type: "rect", x: 40, y: 30, w: 160, h: 110 }]],
        ["rough.circle", [{ type: "circle", cx: 120, cy: 90, r: 58, fill: "var(--dust-blue)", fillOpacity: 0.45 }]],
        ["rough.hex", [{ type: "hex", cx: 90, cy: 90, r: 50 }, { type: "hex", cx: 165, cy: 65, r: 30, fill: "var(--marker)", fillOpacity: 0.95 }]],
        ["rough.arrow", [{ type: "arrow", x1: 30, y1: 140, x2: 200, y2: 40, bend: 0.2 }, { type: "circle", cx: 30, cy: 140, r: 6 }]],
        ["rough.hatch", [{ type: "rect", x: 40, y: 30, w: 160, h: 120 }, { type: "hatch", points: [[40, 30], [200, 30], [200, 150], [40, 150]], gap: 7 }, { type: "hatch", points: [[120, 30], [200, 30], [200, 150], [120, 150]], gap: 7, angle: 45 }]],
        ["rough.scribble", [{ type: "curve", points: [[20, 120], [50, 40], [90, 120], [130, 40], [170, 120], [220, 50]] }]],
        ["rough.poly", [{ type: "poly", points: [[120, 20], [145, 75], [205, 80], [160, 118], [175, 172], [120, 142], [65, 172], [80, 118], [35, 80], [95, 75]], fill: "var(--dust-yellow)", fillOpacity: 0.6 }]]
      ].forEach(function (s) {
        var c = document.createElement("div"); c.className = "shape";
        figureInto(c, 240, 180, s[1]);
        c.insertAdjacentHTML("beforeend", "<code>Blyant." + s[0] + "(…)</code>");
        shapes.appendChild(c);
      });
      var pencils = d.querySelector("#pencils");
      [["Rød", "--dust-red"], ["Oransje", "--dust-orange"], ["Gul", "--dust-yellow"], ["Grønn", "--dust-green"], ["Blå", "--dust-blue"], ["Lilla", "--dust-purple"], ["Tusj", "--marker"]].forEach(function (p, i) {
        var c = document.createElement("div"); c.className = "pencil";
        var pts = [[10, 58], [40, 18], [130, 14], [150, 44], [120, 66], [30, 68]];
        var sh = [{ type: "hatch", points: pts, gap: 3.2, angle: -35 + i * 7, seed: 300 + i, stroke: "var(" + p[1] + ")", width: p[1] === "--marker" ? 6 : 2 }];
        if (p[1] === "--marker") sh = [{ type: "line", x1: 14, y1: 40, x2: 146, y2: 36, width: 22, stroke: "var(--marker)", seed: 3, wobble: 0.4 }];
        var s = svgEl(160, 76); c.appendChild(s);
        B.figure(s, sh);
        if (p[1] === "--marker") s.querySelectorAll("path").forEach(function (pp) { pp.setAttribute("stroke-linecap", "butt"); pp.setAttribute("opacity", ".85"); });
        c.insertAdjacentHTML("beforeend", "<b>" + p[0] + "</b><code class=\"b-small\">" + p[1] + "</code>");
        pencils.appendChild(c);
      });
      if (o.thumb) return;
      // 3D lab
      var holder = d.querySelector("#lab-canvas");
      if (lab) lab.dispose();
      var sk = lab = new B.Sketch3D(holder, { fov: 32 });
      var T = THREE, objs = [];
      var items = [
        [new T.BoxGeometry(1.3, 1.3, 1.3), "#ffffff", [-3, 0.65, -1.2]],
        [new T.SphereGeometry(0.8, 32, 20), "--dust-blue", [-0.6, 0.8, -1.8]],
        [new T.TorusKnotGeometry(0.55, 0.2, 120, 16), "#ffffff", [1.9, 1.0, -1.4]],
        [new T.ConeGeometry(0.75, 1.6, 24), "--dust-orange", [-2.1, 0.8, 1.4]],
        [new T.IcosahedronGeometry(0.8, 0), "#ffffff", [0.5, 0.8, 1.2]],
        [new T.CylinderGeometry(0.6, 0.6, 1.4, 6).toNonIndexed(), "--dust-purple", [2.9, 0.7, 1.0]]
      ];
      items.forEach(function (it) {
        if (!it[0].index) it[0].computeVertexNormals();
        var m = new T.Mesh(it[0], sk.mat(it[1]));
        m.position.set(it[2][0], it[2][1], it[2][2]);
        sk.add(m); objs.push(m);
      });
      var ground = new T.Mesh(new T.CircleGeometry(4.4, 6), sk.mat("#ffffff"));
      ground.rotation.x = -Math.PI / 2; ground.rotation.z = Math.PI / 6;
      sk.add(ground);
      sk.camera.position.set(0, 6, 10); sk.camera.lookAt(0, 0.4, 0);
      var spin = true;
      sk.start(function (dt) {
        if (!spin) return;
        objs.forEach(function (m, i) { m.rotation.y += dt * (0.25 + i * 0.05); if (i === 2) m.rotation.x += dt * 0.2; });
      });
      d.querySelector("#lw").addEventListener("input", function (e) { sk.set({ lineWidth: +e.target.value }); d.querySelector("#lw-v").textContent = e.target.value; });
      d.querySelector("#hg").addEventListener("input", function (e) { sk.set({ hatchGap: +e.target.value }); d.querySelector("#hg-v").textContent = e.target.value; });
      d.querySelector("#lab-boil").addEventListener("change", function (e) { sk.set({ boil: e.target.checked }); });
      d.querySelector("#lab-spin").addEventListener("change", function (e) { spin = e.target.checked; });
    },
    leave: function () { if (lab) { lab.dispose(); lab = null; } }
  };

  /* ---------- System ---------- */
  var TOOL_ICONS = {
    flytt: [{ type: "poly", points: [[20, 10], [20, 50], [30, 41], [38, 56], [45, 52], [37, 38], [50, 37]] }],
    blyant: [{ type: "poly", points: [[16, 46], [44, 18], [51, 25], [23, 53]] }, { type: "poly", points: [[16, 46], [23, 53], [11, 57]] }, { type: "line", x1: 39, y1: 23, x2: 46, y2: 30, width: 2.6 }],
    tekst: [{ type: "line", x1: 15, y1: 15, x2: 49, y2: 14 }, { type: "line", x1: 32, y1: 15, x2: 32, y2: 52 }, { type: "line", x1: 25, y1: 52, x2: 39, y2: 52, width: 2.6 }],
    spor: [{ type: "poly", points: [[10, 14], [54, 14], [54, 42], [30, 42], [19, 53], [21, 42], [10, 42]] }, { type: "curve", points: [[26, 24], [30, 20], [36, 21], [37, 26], [32, 30]], width: 3 }]
  };
  // Example pictures for the link cards: small coloured-pencil scenes as data URLs (a photo does not follow the theme).
  function linkPic(kind) {
    var r = B.rough, sky = kind === 1 ? "#cfdbe6" : "#efe2c9", d = [];
    d.push('<rect width="320" height="180" fill="' + sky + '"/>');
    d.push('<path d="' + r.circle(kind === 1 ? 232 : 84, 52, 22, { seed: 5 + kind, wobble: 1 }) + '" fill="#f2d76a" stroke="#454641" stroke-width="1.6"/>');
    d.push('<path d="M0 132 C 70 96 120 104 170 124 S 270 112 320 96 L320 180 L0 180Z" fill="#9db48a"/>');
    d.push('<path d="M0 150 C 90 128 160 150 230 140 S 300 150 320 146 L320 180 L0 180Z" fill="#86a271"/>');
    d.push('<path d="' + r.hex(kind === 1 ? 92 : 220, 128, 26, { seed: 9 + kind, wobble: 1.2 }) + '" fill="#d29358" stroke="#252623" stroke-width="1.8"/>');
    d.push('<path d="' + r.line(0, 132, 320, 98, { seed: 3, wobble: 1.4 }) + '" fill="none" stroke="#454641" stroke-width="1.2" opacity=".5"/>');
    return "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">' + d.join("") + "</svg>");
  }
  VIEWS.system = {
    title: "System",
    render: function (host, o) {
      o = o || {};
      var d = document.createElement("div");
      d.className = "stack-lg";
      d.style.gap = "var(--space-12)";
      var grey = ["paper", "paper-2", "paper-3", "graphite-100", "graphite-300", "graphite-500", "graphite-700", "graphite-900"];
      var dust = ["dust-red", "dust-orange", "dust-yellow", "dust-green", "dust-blue", "dust-purple", "marker"];
      function sw(list) {
        return list.map(function (n) { return '<div class="swatch"><div class="swatch__chip" style="--c:var(--' + n + ')"></div><span>' + n + '</span><code data-val="--' + n + '"></code></div>'; }).join("");
      }
      var typeRows = [["t-display", "Hopp fra hex til hex"], ["t-h1", "Skisseboka"], ["t-h2", "Former og figurer"], ["t-h3", "Håndtegnede streker"], ["t-lead", "Sett rammene først. Pynten kommer etterpå."], ["t-body", "Figuren hopper til nabofeltet når du trykker på pila."], ["t-small", "Sist endret 9. november"], ["t-label", "TASTER"], ["t-note", "husk: farge bare som effekt!"], ["t-code", "Blyant.rough.hex(80, 80, 40)"]];
      d.innerHTML =
        (o.thumb ? "" : '<a class="back" href="#spill">← Til hex-flaten</a>') +
        '<section class="stack-lg"><div class="sec-head"><span class="b-label">Tokens</span><h1>Grafitt og papir</h1><p>Åtte gråtoner gjør jobben. Fargene under er effekter.</p></div><div class="swatches">' + sw(grey) + '</div><div class="swatches">' + sw(dust) + "</div></section>" +
        '<section class="stack"><div class="sec-head"><h2>Skrift</h2><p>Caveat for overskrifter og tekst, Architects Daughter for notater og etiketter, Cutive Mono for kode.</p></div><div>' +
        typeRows.map(function (r) { return '<div class="type-row"><code>.' + r[0] + '</code><div class="' + r[0] + '">' + r[1] + "</div></div>"; }).join("") + "</div></section>" +
        '<section class="two"><div class="stack"><h2>Avstand</h2><div class="spaces">' +
        ["space-1", "space-2", "space-3", "space-4", "space-6", "space-8", "space-12", "space-16"].map(function (n) { return '<div><code>' + n + '</code><i style="width:var(--' + n + ')"></i></div>'; }).join("") +
        '</div></div><div class="stack"><h2>Strek</h2><div id="strokes"></div></div></section>' +
        '<section class="stack-lg"><div class="sec-head"><h2>Komponenter</h2></div><div class="gallery">' +
        '<div class="b-box"><span class="b-label">Knapper</span><div class="row"><button class="b-btn b-btn--primary" type="button">Lagre</button><button class="b-btn" type="button">Avbryt</button><button class="b-btn b-btn--marker" type="button">Prøv nå</button></div><div class="row"><button class="b-btn b-btn--sm" type="button">Liten</button><button class="b-btn b-btn--quiet" type="button">Stille</button><button class="b-btn" type="button" disabled>Av</button></div></div>' +
        '<div class="b-box"><span class="b-label">Felt</span><label class="b-field"><span class="b-field__label">Navn på brett</span><input class="b-input" id="s-name" value="Myra ved vannet"></label><label class="b-field"><span class="b-field__label">Radius</span><span class="b-select"><select class="b-input" id="s-rad"><option>3 · 37 felt</option><option selected>4 · 61 felt</option><option>5 · 91 felt</option></select></span></label></div>' +
        '<div class="b-box"><span class="b-label">Valg</span><label class="b-check"><input type="checkbox" id="s-c1" checked><span class="b-check__box"></span>Vis naboer</label><label class="b-check"><input type="checkbox" id="s-c2"><span class="b-check__box"></span>Vis koordinater</label><label class="b-check b-check--radio"><input type="radio" name="s-r" id="s-r1" checked><span class="b-check__box"></span>Spisse topper</label><label class="b-check b-check--radio"><input type="radio" name="s-r" id="s-r2"><span class="b-check__box"></span>Flate topper</label><label class="b-switch"><input type="checkbox" id="s-sw" checked><span class="b-switch__track"></span><span>Lyd</span></label></div>' +
        '<div class="b-box"><span class="b-label">Merker</span><div class="row"><span class="b-tag">Utkast</span><span class="b-tag b-tag--green"><span class="b-dot"></span>Klar</span><span class="b-tag b-tag--orange"><span class="b-dot"></span>Venter</span><span class="b-tag b-tag--red"><span class="b-dot"></span>Feil</span><span class="b-tag b-tag--blue">Info</span><span class="b-tag b-tag--purple">Sjelden</span><span class="b-tag b-tag--marker">Ny</span></div><div class="row"><span class="b-avatar">PH</span><span class="b-avatar">IL</span><span class="b-kbd">⌘</span><span class="b-kbd">K</span></div><div class="b-progress" style="--value:62%" role="progressbar" aria-valuenow="62" aria-valuemin="0" aria-valuemax="100" aria-label="Fremdrift"><i></i></div></div>' +
        '<div class="b-box"><span class="b-label">Faner</span><div class="b-tabs" role="tablist"><button class="b-tab" role="tab" aria-selected="true" type="button">Brett</button><button class="b-tab" role="tab" aria-selected="false" type="button">Figurer</button><button class="b-tab" role="tab" aria-selected="false" type="button">Regler</button></div><p class="t-small">Fanene er en ramme. Innholdet under er ditt.</p></div>' +
        '<div class="stack"><div class="b-note"><span class="t-h3">Notatlapp</span><p class="t-small" style="margin-top:6px">Til påminnelser, tips og det ene du vil at leseren skal huske.</p></div><div class="b-note b-note--blue" style="--b-tilt:1deg"><span class="t-note">og en blå til info</span></div></div>' +
        '<div class="b-box"><span class="b-label">Gjøremål</span><ul class="b-checklist">' +
        '<li class="b-checklist__item"><label class="b-check"><input type="checkbox" id="s-k1" aria-label="Ferdig"><span class="b-check__box"></span></label><a class="b-checklist__title" href="#system">Tegn kartet over myra</a><span class="b-checklist__meta">I dag</span></li>' +
        '<li class="b-checklist__item"><span class="b-checklist__mark" aria-hidden="true">↻</span><a class="b-checklist__title" href="#system">Vann plantene</a><span class="b-checklist__meta">Mandager</span></li>' +
        '<li class="b-checklist__item is-done"><label class="b-check"><input type="checkbox" id="s-k2" aria-label="Ferdig" checked><span class="b-check__box"></span></label><a class="b-checklist__title" href="#system">Spiss blyantene</a><span class="b-checklist__meta">I går</span></li>' +
        '</ul></div>' +
        '<div class="b-box"><span class="b-label">Plassholder</span><div class="b-ph" style="--ratio:16/9"><span>bilde 16:9</span></div></div>' +
        '<div class="b-box"><span class="b-label">Verktøylinje</span>' +
        '<div class="b-toolbar" role="toolbar" aria-label="Verktøy" style="justify-self:start"><button class="b-toolbar__btn" type="button" aria-pressed="true" aria-label="Flytt" title="Flytt"><svg viewBox="0 0 64 64" aria-hidden="true" data-icon="flytt"></svg></button><button class="b-toolbar__btn" type="button" aria-pressed="false" aria-label="Blyant" title="Blyant"><svg viewBox="0 0 64 64" aria-hidden="true" data-icon="blyant"></svg></button><button class="b-toolbar__btn" type="button" aria-pressed="false" aria-label="Tekst" title="Tekst"><svg viewBox="0 0 64 64" aria-hidden="true" data-icon="tekst"></svg></button><span class="b-toolbar__sep"></span><button class="b-toolbar__btn b-toolbar__btn--marker" type="button" aria-label="Spør om hjelp" title="Spør om hjelp"><svg viewBox="0 0 64 64" aria-hidden="true" data-icon="spor"></svg></button></div>' +
        '<div class="b-toolbar b-toolbar--compact" role="toolbar" aria-label="Blyant" style="justify-self:start"><button class="b-toolbar__swatch" type="button" style="--b-swatch:var(--ink)" aria-pressed="true" aria-label="Grafitt" title="Grafitt"></button><button class="b-toolbar__swatch" type="button" style="--b-swatch:var(--dust-red)" aria-pressed="false" aria-label="Rød" title="Rød"></button><button class="b-toolbar__swatch" type="button" style="--b-swatch:var(--dust-blue)" aria-pressed="false" aria-label="Blå" title="Blå"></button><span class="b-toolbar__sep"></span><button class="b-toolbar__size" type="button" style="--b-size:3px" aria-pressed="true" aria-label="Tynn" title="Tynn"></button><button class="b-toolbar__size" type="button" style="--b-size:6px" aria-pressed="false" aria-label="Middels" title="Middels"></button><button class="b-toolbar__size" type="button" style="--b-size:10px" aria-pressed="false" aria-label="Tykk" title="Tykk"></button><span class="b-toolbar__sep"></span><button class="b-toolbar__text" type="button" aria-pressed="true" aria-label="Overskrift" title="Overskrift">Aa</button></div>' +
        '<p class="t-small">Verktøyene på et lerret. Det valgte verktøyet er skyggelagt, og tusjen er den ene viktigste handlingen.</p></div>' +
        "</div></section>" +
        '<section class="stack-lg"><div class="sec-head"><h2>Lenkekort</h2><p>Et forhåndsvisningskort for en lenke eller en artikkel: bilde, nettsted, tittel, beskrivelse og en fot med valg. Alt er valgfritt.</p></div><div class="linkcards">' +
        '<div class="stack"><span class="b-label">Med bilde</span><a class="b-linkcard" href="#system"><img class="b-linkcard__image" src="' + linkPic(1) + '" alt="" onerror="this.remove()"><span class="b-linkcard__site">skisseboka.no</span><strong class="b-linkcard__title">Slik tegner du et hex-kart for hånd</strong><p class="b-linkcard__desc">Start med midten, tegn ringene utover og la strekene skjelve litt. Et kart trenger ikke linjal for å bli lesbart.</p></a></div>' +
        '<div class="stack"><span class="b-label">Kompakt</span><a class="b-linkcard b-linkcard--compact" href="#system"><img class="b-linkcard__image" src="' + linkPic(2) + '" alt="" onerror="this.remove()"><span class="b-linkcard__site">myra.no</span><strong class="b-linkcard__title">Fem steiner, seks farger og en figur som hopper fra hex til hex</strong><p class="b-linkcard__desc">Reglene for spillet på én side, med tegninger av hvert trekk og et kart over brettet.</p></a></div>' +
        '<div class="stack"><span class="b-label">Med valg i foten</span><article class="b-linkcard"><img class="b-linkcard__image" src="' + linkPic(2) + '" alt="" onerror="this.remove()"><span class="b-linkcard__site">blyant.phareim.no</span><strong class="b-linkcard__title"><a href="#system">Grafitt bærer alt</a></strong><p class="b-linkcard__desc">Svart, hvitt og gråtoner gjør nesten hele jobben. Farge er en effekt du legger på det ene leseren skal finne.</p><div class="b-linkcard__foot"><label class="b-check"><input type="checkbox" id="s-lc1"><span class="b-check__box"></span>Legg i Reader</label><span class="b-tag b-tag--green"><span class="b-dot"></span>Lest</span></div></article></div>' +
        '<div class="stack"><span class="b-label">Lang tittel, uten beskrivelse</span><a class="b-linkcard" href="#system"><img class="b-linkcard__image" src="finnes-ikke.jpg" alt="" onerror="this.remove()"><span class="b-linkcard__site">en-svært-lang-adresse-som-ikke-får-plass.eksempel.no/artikler/2026/11</span><strong class="b-linkcard__title">En svært lang tittel som fortsetter og fortsetter om hvordan man skisserer brett, kart, figurer og regler før noen har bestemt seg for farger, merkevare eller hva spillet faktisk skal hete</strong><div class="b-linkcard__foot"><span class="b-tag">Lagret</span></div></a></div>' +
        '</div><div class="linkcards linkcards--row">' +
        '<div class="stack"><span class="b-label">Rad</span><a class="b-linkcard b-linkcard--row" href="#system"><img class="b-linkcard__image" src="' + linkPic(1) + '" alt="" onerror="this.remove()"><span class="b-linkcard__site">skisseboka.no</span><strong class="b-linkcard__title">Blyanten først, pynten etterpå</strong><p class="b-linkcard__desc">Hvorfor en skisse holder lenger enn et ferdig design når du ennå ikke vet hva du bygger.</p></a></div>' +
        '<div class="stack linkcards__narrow"><span class="b-label">Rad, smalere enn 360px: stables</span><a class="b-linkcard b-linkcard--row" href="#system"><img class="b-linkcard__image" src="' + linkPic(2) + '" alt="" onerror="this.remove()"><span class="b-linkcard__site">myra.no</span><strong class="b-linkcard__title">Kartet over myra</strong><p class="b-linkcard__desc">Ti hexer med vann, tre med skog og en sti tvers over.</p></a></div>' +
        "</div></section>";
      host.appendChild(d);
      Array.prototype.forEach.call(d.querySelectorAll(".b-checklist input"), function (c) {
        c.addEventListener("change", function () { c.closest(".b-checklist__item").classList.toggle("is-done", c.checked); });
      });
      // toolbar icons: Blyant.figure in a 64×64 viewBox
      Array.prototype.forEach.call(d.querySelectorAll("svg[data-icon]"), function (sv) {
        B.figure(sv, TOOL_ICONS[sv.getAttribute("data-icon")].map(function (p) { return Object.assign({ width: 3.6 }, p); }), { wobble: 0.7 });
      });
      // resolve token values
      Array.prototype.forEach.call(d.querySelectorAll("[data-val]"), function (c) { c.textContent = B.css(c.getAttribute("data-val")) || ""; });
      var st = d.querySelector("#strokes");
      [["stroke-hair", 1], ["stroke-pencil", 1.6], ["stroke-bold", 2.6]].forEach(function (s, i) {
        var row = document.createElement("div"); row.className = "spaces";
        row.innerHTML = "<div><code>" + s[0] + "</code><span></span></div>";
        var sv = svgEl(300, 24); row.querySelector("span").appendChild(sv); sv.style.width = "100%"; sv.style.color = "var(--ink)";
        B.figure(sv, [{ type: "line", x1: 4, y1: 12, x2: 296, y2: 12, width: s[1], seed: 40 + i }]);
        st.appendChild(row);
      });
      ["wobble-low", "wobble-mid", "wobble-high"].forEach(function (n, i) {
        var row = document.createElement("div"); row.className = "spaces";
        row.innerHTML = "<div><code>" + n + "</code><span></span></div>";
        var sv = svgEl(300, 40); row.querySelector("span").appendChild(sv); sv.style.width = "100%"; sv.style.color = "var(--ink)";
        B.figure(sv, [{ type: "rect", x: 6, y: 6, w: 288, h: 28, wobble: [0.6, 1.2, 2.4][i], seed: 60 + i }]);
        st.appendChild(row);
      });
    }
  };

  /* --------------------------------------------------------------- */
  /* Router and theme                                          */
  /* --------------------------------------------------------------- */
  var current = null;
  function route() {
    var name = (location.hash || "#spill").slice(1);
    if (!VIEWS[name]) name = "spill";
    if (current && VIEWS[current].leave) VIEWS[current].leave();
    if (game && game.el.parentNode) game.el.parentNode.removeChild(game.el);
    viewEl.innerHTML = "";
    current = name;
    VIEWS[name].render(viewEl);
    B.ink(viewEl);
    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (a) {
      if (a.getAttribute("data-view") === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.title = name === "spill" ? "Hex-skisse" : "Hex-skisse · " + VIEWS[name].title;
    if (name !== "spill") window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  var themeBtn = document.getElementById("theme-btn");
  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function syncThemeBtn() { themeBtn.textContent = isDark() ? "Papir" : "Kull"; }
  themeBtn.addEventListener("click", function () { root.setAttribute("data-theme", isDark() ? "light" : "dark"); syncThemeBtn(); });
  if (window.matchMedia) { var mq = window.matchMedia("(prefers-color-scheme: dark)"); if (mq.addEventListener) mq.addEventListener("change", syncThemeBtn); }
  syncThemeBtn();

  route();
  B.ink(document.querySelector(".top"));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { B.reink(document); var g = document.getElementById("thumbs"); if (g) fitThumbs(g); });
})();
