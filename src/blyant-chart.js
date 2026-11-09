/* Blyant.chart — hand-drawn charts in the same pencil.
   bar · line (and area) · scatter · segments · spark · stat
   Every chart: legend for 2+ series, selective direct labels, hover + keyboard tooltip, table view. */
(function () {
  "use strict";
  var B = window.Blyant, R = B.rough, NS = "http://www.w3.org/2000/svg";
  var C = {};

  /* ---------- helpers ---------- */
  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    ["fill", "stroke"].forEach(function (k) { var v = attrs[k]; if (typeof v === "string" && v.indexOf("var(") >= 0) e.style[k] = v; });
    if (parent) parent.appendChild(e);
    return e;
  }
  function html(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(svg, x, y, str, cls, anchor) {
    var t = svgEl("text", { x: x, y: y, "class": cls, "text-anchor": anchor || "start" }, svg);
    t.textContent = str;
    return t;
  }
  function color(s, i) {
    var c = s.color || "--chart-" + ((i % 6) + 1);
    return c.indexOf("--") === 0 ? "var(" + c + ")" : c;
  }
  function seedOf(str) { var h = 7; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h || 7; }
  var nf = new Intl.NumberFormat("nb-NO");
  function compact(v) {
    var a = Math.abs(v);
    if (a >= 1e6) return nf.format(Math.round(v / 1e5) / 10) + " mill.";
    if (a >= 1e4) return nf.format(Math.round(v / 100) / 10) + "k";
    return nf.format(Math.round(v * 100) / 100);
  }
  function niceTicks(min, max, count) {
    if (max === min) max = min + 1;
    var span = max - min, step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = span / count / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (var v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e9) / 1e9);
    return out;
  }
  function wob(el) { var v = parseFloat(getComputedStyle(el).getPropertyValue("--b-wobble")); return isNaN(v) ? 1.2 : v; }
  function reduced() { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; }

  /* ---------- the shell every chart shares ---------- */
  function Shell(el, opts, kind) {
    this.el = el; this.opts = opts; this.kind = kind;
    el.classList.add("b-chart");
    el.innerHTML = "";
    if (opts.title || opts.subtitle) {
      var head = html("div", "b-chart__head", el);
      if (opts.title) html("div", "b-chart__title", head, opts.title);
      if (opts.subtitle) html("div", "b-chart__sub", head, opts.subtitle);
    }
    this.legend = html("div", "b-chart__legend", el);
    this.plot = html("div", "b-chart__plot", el);
    this.plot.tabIndex = 0;
    this.plot.setAttribute("role", "img");
    this.tip = html("div", "b-chart__tip", this.plot);
    this.tip.hidden = true;
    this.tableWrap = html("div", "b-table-wrap b-chart__table", el);
    this.tableWrap.hidden = true;
    var self = this;
    if (typeof ResizeObserver !== "undefined") {
      var lastW = 0;
      this.ro = new ResizeObserver(function () {
        var w = self.plot.clientWidth;
        if (Math.abs(w - lastW) > 1) { lastW = w; self.render(); }
      });
      this.ro.observe(this.plot);
    }
    this.onKey = function (e) {
      if (!self.focusSteps) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var n = self.focusSteps();
        self.focusIdx = self.focusIdx == null ? 0 : Math.max(0, Math.min(n - 1, self.focusIdx + (e.key === "ArrowRight" ? 1 : -1)));
        self.showAt(self.focusIdx, true);
        e.preventDefault();
      } else if (e.key === "Escape") self.hideTip();
    };
    this.plot.addEventListener("keydown", this.onKey);
    this.plot.addEventListener("blur", function () { self.hideTip(); });
  }
  Shell.prototype.svg = function (w, h) {
    var old = this.plot.querySelector("svg.b-chart__svg");
    if (old) old.remove();
    var s = svgEl("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, "class": "b-chart__svg", "aria-hidden": "true" });
    this.plot.insertBefore(s, this.tip);
    return s;
  };
  Shell.prototype.setLegend = function (items, shape) {
    this.legend.innerHTML = "";
    this.legend.hidden = items.length < 2;
    items.forEach(function (it) {
      var row = html("span", "b-chart__key", this.legend);
      var sw = html("i", "b-chart__swatch b-chart__swatch--" + (shape || "rect"), row);
      sw.style.setProperty("--c", it.color);
      html("span", null, row, it.name);
    }, this);
  };
  Shell.prototype.setTable = function (head, rows, caption) {
    var w = this.tableWrap; w.innerHTML = "";
    var t = html("table", "b-table", w);
    if (caption) html("caption", "b-chart__caption", t, caption);
    var tr = html("tr", null, html("thead", null, t));
    head.forEach(function (h, i) { var th = html("th", i ? "num" : null, tr, h); th.scope = "col"; });
    var tb = html("tbody", null, t);
    rows.forEach(function (r) {
      var row = html("tr", null, tb);
      r.forEach(function (c, i) { html("td", i ? "num" : null, row, c); });
    });
  };
  /** Show or hide the table view. Returns the new state. */
  Shell.prototype.table = function (show) {
    if (show == null) show = this.tableWrap.hidden;
    this.tableWrap.hidden = !show;
    this.plot.hidden = show;
    this.legend.style.display = show ? "none" : "";
    return show;
  };
  Shell.prototype.tipRows = function (title, rows, x, y) {
    var tip = this.tip; tip.innerHTML = "";
    if (title) html("div", "b-chart__tip-title", tip, title);
    rows.forEach(function (r) {
      var row = html("div", "b-chart__tip-row", tip);
      var k = html("i", "b-chart__tip-key", row); k.style.setProperty("--c", r.color || "transparent");
      html("b", null, row, r.value);
      html("span", null, row, r.name);
    });
    tip.hidden = false;
    var pw = this.plot.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = x + 14; if (left + tw > pw - 4) left = x - tw - 14; if (left < 4) left = 4;
    var top = Math.max(4, y - th - 10);
    tip.style.left = left + "px"; tip.style.top = top + "px";
  };
  Shell.prototype.hideTip = function () {
    this.tip.hidden = true;
    if (this.cross) this.cross.setAttribute("opacity", 0);
    if (this.onHide) this.onHide();
  };
  Shell.prototype.destroy = function () { if (this.ro) this.ro.disconnect(); this.el.innerHTML = ""; };
  Shell.prototype.update = function (patch) { Object.assign(this.opts, patch); this.render(); };

  /* Axis helpers (value axis on the left, hairline grid) */
  function yAxis(svg, sc, ticks, x0, x1, fmt, w) {
    ticks.forEach(function (v, i) {
      var y = sc(v);
      B.draw(svg, R.line(x0, y, x1, y, { seed: 900 + i, wobble: w * 0.3, passes: 1 }), { stroke: "var(--line-faint)", width: 1, grain: false });
      text(svg, x0 - 8, y + 4, fmt(v), "b-chart__tick", "end");
    });
  }

  /* ================================================================== */
  /* BAR — vertical or horizontal, single, grouped or stacked           */
  /* ================================================================== */
  /**
   * Blyant.chart.bar(el, { categories, series:[{name, values, color?}], stacked?, horizontal?,
   *   title?, subtitle?, unit?, format?, height?, highlight? (category index), labels? ('auto'|'none') })
   */
  C.bar = function (el, opts) {
    var sh = new Shell(el, opts, "bar");
    sh.render = function () {
      var o = sh.opts, cats = o.categories, S = o.series, fmt = o.format || compact, unit = o.unit ? " " + o.unit : "";
      var W = Math.max(260, sh.plot.clientWidth), horiz = !!o.horizontal;
      var H = o.height || (horiz ? cats.length * 44 + 40 : 280);
      var wv = wob(el), svg = sh.svg(W, H);
      var single = S.length === 1, stacked = !!o.stacked && !single;
      sh.setLegend(S.map(function (s, i) { return { name: s.name, color: color(s, i) }; }));
      var tot = cats.map(function (_, ci) { return S.reduce(function (a, s) { return a + (s.values[ci] || 0); }, 0); });
      var maxV = stacked ? Math.max.apply(null, tot) : Math.max.apply(null, S.map(function (s) { return Math.max.apply(null, s.values); }));
      var ticks = niceTicks(0, maxV * 1.04, horiz ? 4 : 5);
      var vmax = ticks[ticks.length - 1];
      var padL = horiz ? Math.min(160, Math.max(70, Math.max.apply(null, cats.map(function (c) { return String(c).length; })) * 9 + 16)) : 46;
      var padR = horiz ? 44 : 12, padT = 20, padB = horiz ? 28 : 34;
      var x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB;
      var band = (horiz ? (y1 - y0) : (x1 - x0)) / cats.length;
      var groupN = stacked || single ? 1 : S.length;
      var barT = Math.min(24, (band * 0.62) / groupN);
      var gap = 2;
      var sc = horiz ? function (v) { return x0 + (v / vmax) * (x1 - x0); } : function (v) { return y1 - (v / vmax) * (y1 - y0); };
      // grid
      if (horiz) {
        ticks.forEach(function (v, i) {
          var x = sc(v);
          B.draw(svg, R.line(x, y0, x, y1, { seed: 700 + i, wobble: wv * 0.3, passes: 1 }), { stroke: "var(--line-faint)", width: 1, grain: false });
          text(svg, x, H - 8, fmt(v), "b-chart__tick", "middle");
        });
        B.draw(svg, R.line(x0, y0 - 6, x0, y1 + 2, { seed: 5, wobble: wv * 0.6 }), { stroke: "var(--line)", width: 1.4 });
      } else {
        yAxis(svg, sc, ticks, x0, x1, fmt, wv);
        B.draw(svg, R.line(x0 - 4, y1, x1 + 2, y1, { seed: 5, wobble: wv * 0.6 }), { stroke: "var(--line)", width: 1.4 });
      }
      var hits = [];
      cats.forEach(function (cat, ci) {
        var bandStart = (horiz ? y0 : x0) + ci * band;
        if (o.highlight === ci) {   // overstrykning behind the category the story is about
          var mw = Math.max(barT * groupN + 18, band * 0.8);
          var mx = bandStart + (band - mw) / 2;
          var md = horiz ? R.rect(x0, mx, x1 - x0, mw, { wobble: 0 }) : R.rect(mx, y0 - 8, mw, y1 - y0 + 8, { wobble: 0 });
          B.draw(svg, md, { stroke: "none", fill: "var(--marker)", fillOpacity: 0.45 });
        }
        var acc = 0;
        S.forEach(function (s, si) {
          var v = s.values[ci] || 0;
          var gi = stacked || single ? 0 : si;
          var off = bandStart + (band - barT * groupN - gap * (groupN - 1)) / 2 + gi * (barT + gap);
          var a = stacked ? acc : 0, b = a + v; acc = b;
          var p0 = sc(a), p1 = sc(b);
          if (stacked && si > 0) { if (horiz) p0 += gap; else p0 -= gap; }
          var rx, ry, rw, rh;
          if (horiz) { rx = p0; ry = off; rw = Math.max(0, p1 - p0); rh = barT; }
          else { rx = off; ry = p1; rw = barT; rh = Math.max(0, p0 - p1); }
          if (rw < 0.5 || rh < 0.5) return;
          var col = single && o.highlight != null && o.highlight !== ci ? "var(--graphite-300)" : color(s, si);
          var seed = seedOf(s.name + cat);
          B.draw(svg, R.rect(rx, ry, rw, rh, { wobble: 0 }), { stroke: "none", fill: col, fillOpacity: 0.9 });
          B.draw(svg, R.rect(rx, ry, rw, rh, { seed: seed, wobble: wv * 0.55 }), { stroke: "var(--line)", width: 1.1, opacity: 0.85 });
          hits.push({ ci: ci, x: rx, y: ry, w: rw, h: rh });
        });
        // category label
        if (horiz) text(svg, x0 - 10, bandStart + band / 2 + 5, cat, "b-chart__cat", "end");
        else text(svg, bandStart + band / 2, H - 10, cat, "b-chart__cat", "middle");
        // direct label: total (stacked/single) at the bar end, when it fits
        if ((single || stacked) && o.labels !== "none" && (o.labels === "all" || o.highlight === ci || o.highlight == null && (single ? cats.length <= 8 : true))) {
          var total = tot[ci], pe = sc(total);
          if (horiz) text(svg, pe + 6, bandStart + band / 2 + 5, fmt(total), "b-chart__val");
          else text(svg, bandStart + band / 2, pe - 7, fmt(total), "b-chart__val", "middle");
        }
      });
      // hover: the whole category band is the hit target
      var hl = svgEl("rect", { fill: "var(--ink)", opacity: 0, "pointer-events": "none" }, svg);
      sh.focusSteps = function () { return cats.length; };
      sh.showAt = function (ci) {
        var bs = (horiz ? y0 : x0) + ci * band;
        if (horiz) { hl.setAttribute("x", x0); hl.setAttribute("y", bs); hl.setAttribute("width", x1 - x0); hl.setAttribute("height", band); }
        else { hl.setAttribute("x", bs); hl.setAttribute("y", y0); hl.setAttribute("width", band); hl.setAttribute("height", y1 - y0); }
        hl.setAttribute("opacity", 0.05);
        var rows = S.map(function (s, si) { return { name: s.name, value: fmt(s.values[ci] || 0) + unit, color: color(s, si) }; });
        if (stacked) rows.unshift({ name: "totalt", value: fmt(tot[ci]) + unit });
        if (single) rows[0].name = S[0].name;
        var k = svg.clientWidth / W || 1;
        sh.tipRows(cats[ci], rows, (horiz ? sc(tot[ci]) : bs + band / 2) * k, (horiz ? bs + band / 2 : sc(stacked ? tot[ci] : maxV)) * k);
      };
      sh.onHide = function () { hl.setAttribute("opacity", 0); };
      svg.style.pointerEvents = "all";
      svg.onpointermove = function (e) {
        var r = svg.getBoundingClientRect(), k = W / r.width;
        var px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
        var pos = horiz ? py - y0 : px - x0, ci = Math.floor(pos / band);
        if (ci < 0 || ci >= cats.length || (horiz ? px < x0 - padL : py > H)) { sh.hideTip(); return; }
        sh.showAt(ci);
      };
      svg.onpointerleave = function () { sh.hideTip(); };
      // a11y + table
      sh.plot.setAttribute("aria-label", (o.title || "Stolpediagram") + ". " + cats.length + " kategorier. Piltaster viser verdiene, eller åpne tabellen.");
      var head = [o.categoryLabel || ""].concat(S.map(function (s) { return s.name; }));
      if (stacked) head.push("Totalt");
      sh.setTable(head, cats.map(function (c, ci) {
        var r = [c].concat(S.map(function (s) { return fmt(s.values[ci] || 0) + unit; }));
        if (stacked) r.push(fmt(tot[ci]) + unit);
        return r;
      }), o.title);
    };
    sh.render();
    return sh;
  };

  /* ================================================================== */
  /* LINE — one or more series over an ordered x, optional area hatch    */
  /* ================================================================== */
  /**
   * Blyant.chart.line(el, { x:[labels], series:[{name, values, color?}], area?, title?, subtitle?, unit?, format?,
   *   height?, yMin?, xEvery? (label every n-th x), endLabels? (default: true when <= 4 series) })
   */
  C.line = function (el, opts) {
    var sh = new Shell(el, opts, "line");
    sh.render = function () {
      var o = sh.opts, X = o.x, S = o.series, fmt = o.format || compact, unit = o.unit ? " " + o.unit : "";
      var W = Math.max(260, sh.plot.clientWidth), H = o.height || 280, wv = wob(el), svg = sh.svg(W, H);
      sh.setLegend(S.map(function (s, i) { return { name: s.name, color: color(s, i) }; }), "line");
      var all = []; S.forEach(function (s) { all = all.concat(s.values.filter(function (v) { return v != null; })); });
      var lo = o.yMin != null ? o.yMin : Math.min(0, Math.min.apply(null, all)), hi = Math.max.apply(null, all);
      var ticks = niceTicks(lo, hi * 1.04, 5), vmin = ticks[0], vmax = ticks[ticks.length - 1];
      var endLabels = o.endLabels != null ? o.endLabels : S.length <= 4;
      var lblW = endLabels ? Math.min(130, Math.max.apply(null, S.map(function (s) { return s.name.length; })) * 8.5 + 24) : 16;
      var x0 = 46, x1 = W - lblW, y0 = 18, y1 = H - 34;
      var sx = function (i) { return X.length < 2 ? (x0 + x1) / 2 : x0 + (i / (X.length - 1)) * (x1 - x0); };
      var sy = function (v) { return y1 - ((v - vmin) / (vmax - vmin)) * (y1 - y0); };
      yAxis(svg, sy, ticks, x0, x1, fmt, wv);
      B.draw(svg, R.line(x0 - 4, y1, x1 + 2, y1, { seed: 5, wobble: wv * 0.6 }), { stroke: "var(--line)", width: 1.4 });
      var every = o.xEvery || Math.max(1, Math.ceil(X.length / Math.max(2, Math.floor((x1 - x0) / 64))));
      X.forEach(function (lab, i) {
        var lastOk = i === X.length - 1 && (X.length - 1) % every >= every * 0.6;
        if (i % every === 0 || lastOk) text(svg, sx(i), H - 10, lab, "b-chart__cat", "middle");
      });
      var ends = [];
      S.forEach(function (s, si) {
        var pts = []; s.values.forEach(function (v, i) { if (v != null) pts.push([sx(i), sy(v)]); });
        if (!pts.length) return;
        var col = color(s, si);
        if (o.area) {
          var poly = pts.concat([[pts[pts.length - 1][0], y1], [pts[0][0], y1]]);
          B.draw(svg, R.hatch(poly, { seed: 40 + si, gap: 6, angle: si % 2 ? 45 : -45, wobble: wv * 0.5 }), { stroke: col, width: 1, opacity: 0.55, grain: false });
        }
        B.draw(svg, R.curve(pts), { stroke: col, width: 2.2 });
        B.draw(svg, R.scribble(pts, { seed: 60 + si, wobble: wv * 0.8 }), { stroke: col, width: 1, opacity: 0.45 });
        var last = pts[pts.length - 1];
        svgEl("circle", { cx: last[0], cy: last[1], r: 6, fill: "var(--paper)" }, svg);
        svgEl("circle", { cx: last[0], cy: last[1], r: 4, fill: col }, svg);
        ends.push({ y: last[1], x: last[0], name: s.name, v: s.values[s.values.length - 1], col: col });
      });
      if (endLabels) {
        ends.sort(function (a, b) { return a.y - b.y; });
        var minGap = 18, placed = [];
        ends.forEach(function (e) {
          var y = e.y; if (placed.length && y - placed[placed.length - 1] < minGap) y = placed[placed.length - 1] + minGap;
          placed.push(y);
          if (Math.abs(y - e.y) > 3) B.draw(svg, R.line(e.x + 6, e.y, e.x + 14, y - 4, { wobble: 0 }), { stroke: "var(--ink-soft)", width: 1, grain: false });
          text(svg, e.x + 14, y + 1, e.name, "b-chart__end");
          if (e.v != null) text(svg, e.x + 14, y + 15, fmt(e.v) + unit, "b-chart__val b-chart__val--sm");
        });
      }
      // crosshair + one tooltip with every series
      var cross = sh.cross = svgEl("path", { d: R.line(0, y0, 0, y1, { seed: 3, wobble: wv * 0.4, passes: 1 }), stroke: "var(--ink)", "stroke-width": 1, fill: "none", opacity: 0 }, svg);
      var dots = svgEl("g", {}, svg);
      sh.focusSteps = function () { return X.length; };
      sh.showAt = function (i) {
        var x = sx(i); cross.setAttribute("transform", "translate(" + x + ",0)"); cross.setAttribute("opacity", 0.5);
        dots.innerHTML = "";
        var rows = [];
        S.forEach(function (s, si) {
          var v = s.values[i]; if (v == null) return;
          svgEl("circle", { cx: x, cy: sy(v), r: 6, fill: "var(--paper)" }, dots);
          svgEl("circle", { cx: x, cy: sy(v), r: 4, fill: color(s, si) }, dots);
          rows.push({ name: s.name, value: fmt(v) + unit, color: color(s, si), v: v });
        });
        rows.sort(function (a, b) { return b.v - a.v; });
        var k = svg.clientWidth / W || 1;
        sh.tipRows(X[i], rows, x * k, Math.min.apply(null, S.map(function (s) { return s.values[i] == null ? y1 : sy(s.values[i]); })) * k);
      };
      sh.onHide = function () { dots.innerHTML = ""; };
      svg.onpointermove = function (e) {
        var r = svg.getBoundingClientRect(), k = W / r.width, px = (e.clientX - r.left) * k;
        var i = X.length < 2 ? 0 : Math.round((px - x0) / (x1 - x0) * (X.length - 1));
        sh.showAt(Math.max(0, Math.min(X.length - 1, i)));
      };
      svg.onpointerleave = function () { sh.hideTip(); };
      sh.plot.setAttribute("aria-label", (o.title || "Linjediagram") + ". " + S.length + " serier over " + X.length + " punkter. Piltaster viser verdiene.");
      sh.setTable([o.xLabel || ""].concat(S.map(function (s) { return s.name; })), X.map(function (lab, i) {
        return [lab].concat(S.map(function (s) { return s.values[i] == null ? "–" : fmt(s.values[i]) + unit; }));
      }), o.title);
    };
    sh.render();
    return sh;
  };

  /* ================================================================== */
  /* SCATTER — up to three series (identity across every pair)          */
  /* ================================================================== */
  /**
   * Blyant.chart.scatter(el, { series:[{name, points:[[x, y, label?]], color?}], xLabel, yLabel, title?, height?,
   *   format?, xFormat?, labelPoints? ([label,...] to annotate) })
   */
  C.scatter = function (el, opts) {
    var sh = new Shell(el, opts, "scatter");
    sh.render = function () {
      var o = sh.opts, S = o.series.slice(0, 3), fmt = o.format || compact, xfmt = o.xFormat || compact;
      var W = Math.max(260, sh.plot.clientWidth), H = o.height || 300, wv = wob(el), svg = sh.svg(W, H);
      sh.setLegend(S.map(function (s, i) { return { name: s.name, color: color(s, i) }; }), "dot");
      var xs = [], ys = []; S.forEach(function (s) { s.points.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
      var tx = niceTicks(Math.min(0, Math.min.apply(null, xs)), Math.max.apply(null, xs) * 1.04, 5);
      var ty = niceTicks(Math.min(0, Math.min.apply(null, ys)), Math.max.apply(null, ys) * 1.04, 5);
      var x0 = 52, x1 = W - 16, y0 = 32, y1 = H - 46;
      var sx = function (v) { return x0 + (v - tx[0]) / (tx[tx.length - 1] - tx[0]) * (x1 - x0); };
      var sy = function (v) { return y1 - (v - ty[0]) / (ty[ty.length - 1] - ty[0]) * (y1 - y0); };
      yAxis(svg, sy, ty, x0, x1, fmt, wv);
      tx.forEach(function (v, i) {
        B.draw(svg, R.line(sx(v), y0, sx(v), y1, { seed: 800 + i, wobble: wv * 0.3, passes: 1 }), { stroke: "var(--line-faint)", width: 1, grain: false });
        text(svg, sx(v), y1 + 18, xfmt(v), "b-chart__tick", "middle");
      });
      B.draw(svg, R.line(x0 - 4, y1, x1 + 2, y1, { seed: 5, wobble: wv * 0.6 }), { stroke: "var(--line)", width: 1.4 });
      if (o.xLabel) text(svg, (x0 + x1) / 2, H - 6, o.xLabel, "b-chart__axis", "middle");
      if (o.yLabel) text(svg, x0 - 44, 12, o.yLabel, "b-chart__axis");
      var flat = [];
      S.forEach(function (s, si) {
        var col = color(s, si);
        s.points.forEach(function (p, pi) {
          var cx = sx(p[0]), cy = sy(p[1]);
          svgEl("circle", { cx: cx, cy: cy, r: 7, fill: "var(--paper)" }, svg);
          B.draw(svg, R.circle(cx, cy, 4.5, { wobble: 0 }), { stroke: "none", fill: col, fillOpacity: 0.95 });
          B.draw(svg, R.circle(cx, cy, 5, { seed: si * 100 + pi, wobble: wv * 0.25, passes: 1 }), { stroke: "var(--line)", width: 0.8, opacity: 0.8, grain: false });
          flat.push({ x: cx, y: cy, s: s, si: si, p: p });
          if (o.labelPoints && p[2] && o.labelPoints.indexOf(p[2]) >= 0) text(svg, cx + 9, cy - 8, p[2], "b-chart__end");
        });
      });
      var ring = svgEl("circle", { r: 9, fill: "none", stroke: "var(--ink)", "stroke-width": 1.5, opacity: 0 }, svg);
      sh.focusSteps = function () { return flat.length; };
      sh.showAt = function (i) {
        var f = flat[i]; ring.setAttribute("cx", f.x); ring.setAttribute("cy", f.y); ring.setAttribute("opacity", 1);
        var k = svg.clientWidth / W || 1;
        sh.tipRows(f.p[2] || f.s.name, [{ name: o.yLabel || "y", value: fmt(f.p[1]), color: color(f.s, f.si) }, { name: o.xLabel || "x", value: xfmt(f.p[0]) }], f.x * k, f.y * k);
      };
      sh.onHide = function () { ring.setAttribute("opacity", 0); };
      svg.onpointermove = function (e) {   // nearest point within 24px — no pinpoint aiming
        var r = svg.getBoundingClientRect(), k = W / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
        var best = -1, bd = 24 * k * 24 * k;
        flat.forEach(function (f, i) { var d = (f.x - px) * (f.x - px) + (f.y - py) * (f.y - py); if (d < bd) { bd = d; best = i; } });
        if (best < 0) sh.hideTip(); else sh.showAt(best);
      };
      svg.onpointerleave = function () { sh.hideTip(); };
      sh.plot.setAttribute("aria-label", (o.title || "Punktdiagram") + ". " + flat.length + " punkter. Piltaster går gjennom punktene.");
      var rows = []; S.forEach(function (s) { s.points.forEach(function (p) { rows.push([p[2] || "", s.name, xfmt(p[0]), fmt(p[1])]); }); });
      sh.setTable(["Punkt", "Serie", o.xLabel || "x", o.yLabel || "y"], rows, o.title);
      Array.prototype.forEach.call(sh.tableWrap.querySelectorAll("td:nth-child(2)"), function (td) { td.className = ""; });
    };
    sh.render();
    return sh;
  };

  /* ================================================================== */
  /* SEGMENTS — one whole split into parts (instead of a pie)           */
  /* ================================================================== */
  /** Blyant.chart.segments(el, { parts:[{name, value, color?}], unit?, title?, subtitle?, format? }) */
  C.segments = function (el, opts) {
    var sh = new Shell(el, opts, "segments");
    sh.render = function () {
      var o = sh.opts, P = o.parts, fmt = o.format || compact, unit = o.unit ? " " + o.unit : "";
      var W = Math.max(260, sh.plot.clientWidth), H = 44, wv = wob(el), svg = sh.svg(W, H);
      sh.setLegend(P.map(function (p, i) { return { name: p.name, color: color(p, i) }; }));
      var total = P.reduce(function (a, p) { return a + p.value; }, 0), gap = 3, x = 1, boxes = [];
      var avail = W - 2 - gap * (P.length - 1);
      P.forEach(function (p, i) {
        var w = p.value / total * avail; if (w <= 0) return;
        var col = color(p, i);
        B.draw(svg, R.rect(x, 6, w, 30, { wobble: 0 }), { stroke: "none", fill: col, fillOpacity: 0.92 });
        B.draw(svg, R.rect(x, 6, w, 30, { seed: 20 + i, wobble: wv * 0.5 }), { stroke: "var(--line)", width: 1.1, opacity: 0.85 });
        var share = Math.round(p.value / total * 100) + " %";
        var lw = share.length * 8.5 + 12;
        if (w > lw + 12) {
          B.draw(svg, R.rect(x + 6, 12, lw, 18, { wobble: 0 }), { stroke: "none", fill: "var(--paper)", fillOpacity: 0.92, grain: false });
          text(svg, x + 12, 26, share, "b-chart__inlabel");
        }
        boxes.push({ x: x, w: w, p: p, i: i, share: share });
        x += w + gap;
      });
      sh.focusSteps = function () { return boxes.length; };
      sh.showAt = function (bi) {
        var b = boxes[bi], k = svg.clientWidth / W || 1;
        sh.tipRows(b.p.name, [{ name: "av " + fmt(total) + unit, value: fmt(b.p.value) + unit + " · " + b.share, color: color(b.p, b.i) }], (b.x + b.w / 2) * k, 6 * k);
      };
      svg.onpointermove = function (e) {
        var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width;
        for (var i = 0; i < boxes.length; i++) if (px >= boxes[i].x && px <= boxes[i].x + boxes[i].w + gap) return sh.showAt(i);
      };
      svg.onpointerleave = function () { sh.hideTip(); };
      sh.plot.setAttribute("aria-label", (o.title || "Fordeling") + ": " + P.map(function (p) { return p.name + " " + Math.round(p.value / total * 100) + " %"; }).join(", "));
      sh.setTable(["Del", "Verdi", "Andel"], P.map(function (p) { return [p.name, fmt(p.value) + unit, Math.round(p.value / total * 100) + " %"]; }), o.title);
    };
    sh.render();
    return sh;
  };

  /* ================================================================== */
  /* SPARK + STAT — the number is the chart                              */
  /* ================================================================== */
  /** Blyant.chart.spark(el, values, { color?, width?, height? }) — a tiny trend, last point accented. */
  C.spark = function (el, values, o) {
    o = o || {};
    var W = o.width || 120, H = o.height || 34, svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, "class": "b-spark", "aria-hidden": "true" });
    el.innerHTML = ""; el.appendChild(svg);
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values); if (hi === lo) hi = lo + 1;
    var pts = values.map(function (v, i) { return [3 + i / (values.length - 1) * (W - 9), H - 4 - (v - lo) / (hi - lo) * (H - 8)]; });
    B.draw(svg, R.curve(pts), { stroke: "var(--graphite-300)", width: 1.6 });
    var last = pts[pts.length - 1];
    svgEl("circle", { cx: last[0], cy: last[1], r: 5, fill: "var(--paper)" }, svg);
    svgEl("circle", { cx: last[0], cy: last[1], r: 3.5, fill: o.color || "var(--chart-1)" }, svg);
    return svg;
  };
  /**
   * Blyant.chart.stat(el, { label, value, unit?, delta?, deltaLabel?, upIsGood?, trend?:[...] })
   * delta is a signed number; colour = direction × whether up is good, always with an arrow and words.
   */
  C.stat = function (el, o) {
    el.classList.add("b-stat");
    Array.prototype.slice.call(el.childNodes).forEach(function (n) { if (!(n.classList && n.classList.contains("b-inkl"))) el.removeChild(n); });
    html("div", "b-stat__label", el, o.label);
    var v = html("div", "b-stat__value", el, typeof o.value === "number" ? compact(o.value) : o.value);
    if (o.unit) html("span", "b-stat__unit", v, " " + o.unit);
    var foot = html("div", "b-stat__foot", el);
    if (o.delta != null) {
      var good = (o.delta >= 0) === (o.upIsGood !== false);
      var d = html("span", "b-stat__delta " + (o.delta === 0 ? "" : good ? "is-good" : "is-bad"), foot);
      html("b", null, d, (o.delta > 0 ? "↑ +" : o.delta < 0 ? "↓ " : "→ ") + compact(o.delta) + (o.deltaUnit || ""));
      if (o.deltaLabel) html("span", null, d, " " + o.deltaLabel);
    }
    if (o.trend) C.spark(html("span", "b-stat__trend", foot), o.trend, { color: o.trendColor });
    return el;
  };

  B.chart = C;
})();
