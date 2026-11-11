/* Blyant.frames — fills any box with any number of comic-book panels.
   A seeded recursive cut: every cut halves a convex panel by area, so the layout
   holds at any size. `geometry` (0–1) goes from a calm grid to slanted, uneven,
   overlapping panels. DOM order is reading order. */
(function () {
  "use strict";
  var B = window.Blyant, R = B.rough;

  /* ---------- convex polygon helpers ---------- */
  function area(p) {
    var a = 0;
    for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
    return Math.abs(a) / 2;
  }
  function centroid(p) {
    var x = 0, y = 0, a = 0;
    for (var i = 0; i < p.length; i++) {
      var q = p[(i + 1) % p.length], c = p[i][0] * q[1] - q[0] * p[i][1];
      x += (p[i][0] + q[0]) * c; y += (p[i][1] + q[1]) * c; a += c;
    }
    return a ? [x / (3 * a), y / (3 * a)] : p[0].slice();
  }
  function bbox(p) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    p.forEach(function (v) { x0 = Math.min(x0, v[0]); y0 = Math.min(y0, v[1]); x1 = Math.max(x1, v[0]); y1 = Math.max(y1, v[1]); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  // keep the part of p where n·v <= s
  function clip(p, nx, ny, s) {
    var out = [];
    for (var i = 0; i < p.length; i++) {
      var a = p[i], b = p[(i + 1) % p.length];
      var da = a[0] * nx + a[1] * ny - s, db = b[0] * nx + b[1] * ny - s;
      if (da <= 0) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) { var t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  // narrowest width of a convex polygon
  function thickness(p) {
    var best = Infinity;
    for (var i = 0; i < p.length; i++) {
      var a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.01) continue;
      var far = 0;
      for (var k = 0; k < p.length; k++) far = Math.max(far, Math.abs((p[k][0] - a[0]) * dy - (p[k][1] - a[1]) * dx) / len);
      best = Math.min(best, far);
    }
    return best;
  }
  function inset(p, d) {
    var c = centroid(p), out = p;
    for (var i = 0; i < p.length && out.length > 2; i++) {
      var a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.01) continue;
      var nx = dy / len, ny = -dx / len;
      if ((c[0] - a[0]) * nx + (c[1] - a[1]) * ny > 0) { nx = -nx; ny = -ny; }   // n points outward
      out = clip(out, nx, ny, a[0] * nx + a[1] * ny - d);
    }
    return out;
  }
  function inside(p, x, y) {
    var sign = 0;
    for (var i = 0; i < p.length; i++) {
      var a = p[i], b = p[(i + 1) % p.length], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      if (Math.abs(c) < 1e-6) continue;
      if (!sign) sign = c > 0 ? 1 : -1; else if ((c > 0 ? 1 : -1) !== sign) return false;
    }
    return true;
  }
  // largest upright rectangle we can find inside p: where content is safe from the slanted edges
  function safeRect(p) {
    var bb = bbox(p), c = centroid(p), best = null;
    var centres = [c, [bb.x + bb.w / 2, bb.y + bb.h / 2], [(c[0] + bb.x + bb.w / 2) / 2, (c[1] + bb.y + bb.h / 2) / 2]];
    var base = bb.w / Math.max(bb.h, 1);
    centres.forEach(function (m) {
      if (!inside(p, m[0], m[1])) return;
      [0.45, 0.6, 0.8, 1, 1.25, 1.6, 2.2].forEach(function (k) {
        var ar = base * k, lo = 0, hi = Math.max(bb.w, bb.h);
        for (var i = 0; i < 18; i++) {
          var h = (lo + hi) / 2, w = h * ar;
          var ok = inside(p, m[0] - w / 2, m[1] - h / 2) && inside(p, m[0] + w / 2, m[1] - h / 2) &&
                   inside(p, m[0] + w / 2, m[1] + h / 2) && inside(p, m[0] - w / 2, m[1] + h / 2);
          if (ok) lo = h; else hi = h;
        }
        var W = lo * ar, H = lo;
        if (!best || W * H > best.w * best.h) best = { x: m[0] - W / 2, y: m[1] - H / 2, w: W, h: H };
      });
    });
    return best || { x: c[0], y: c[1], w: 0, h: 0 };
  }

  /* ---------- the cut ---------- */
  // Cut p in two so the first part holds `ratio` of the area. Normal (nx, ny) points at the second part.
  function cutAt(p, nx, ny, ratio) {
    var lo = Infinity, hi = -Infinity, total = area(p);
    p.forEach(function (v) { var s = v[0] * nx + v[1] * ny; lo = Math.min(lo, s); hi = Math.max(hi, s); });
    for (var i = 0; i < 30; i++) {
      var mid = (lo + hi) / 2;
      if (area(clip(p, nx, ny, mid)) < total * ratio) lo = mid; else hi = mid;
    }
    var s = (lo + hi) / 2;
    return [clip(p, nx, ny, s), clip(p, -nx, -ny, -s)];
  }

  // How roomy a part is for the k panels it must hold: 1 is a square's worth, lower is a sliver.
  // A single panel is also judged by the upright box its content gets, which is what punishes long spikes.
  function room(p, k) {
    var a = area(p), q = thickness(p) / Math.sqrt(a / k);
    if (k === 1) { var s = safeRect(p); q = Math.min(q, Math.min(s.w, s.h) / Math.sqrt(a) * 1.6); }
    return q;
  }

  /** Pure layout: returns the panel polygons (in reading order) for a w × h box. */
  function layout(w, h, o) {
    o = o || {};
    var n = Math.max(1, Math.round(o.count || 1));
    var g = Math.max(0, Math.min(1, o.geometry != null ? +o.geometry : 0.5));
    var gutter = o.gutter != null ? +o.gutter : Math.max(8, Math.min(18, Math.sqrt(w * h / n) * 0.07));
    var r = R.rng((o.seed != null ? o.seed : 1) * 2654435761 + n * 97);
    var minT = o.minSize != null ? +o.minSize : Math.max(gutter * 3, Math.sqrt(w * h / n) * 0.3);
    var leaves = [];

    function split(p, k) {
      if (k <= 1) { leaves.push(p); return; }
      var bb = bbox(p);
      var k1 = k >> 1;
      if (k % 2 && r() < 0.5) k1 = k - k1;
      if (k > 3 && r() < g * 0.6) k1 = Math.max(1, Math.min(k - 1, k1 + (r() < 0.5 ? -1 : 1)));
      var ratio = Math.max(0.16, Math.min(0.84, k1 / k * (1 + (r() * 2 - 1) * g * 0.28)));
      // rows first, like a comics page; then columns inside the rows
      var vertical = bb.w > bb.h * 1.2;
      if (r() < g * 0.14 && Math.min(bb.w, bb.h) > minT * 2.4) vertical = !vertical;
      var tilt = (r() * 2 - 1) * g * 0.36;                        // up to about 20°
      if (k === 2 && g > 0.55 && r() < (g - 0.55) * 1.3) tilt = (r() < 0.5 ? -1 : 1) * (0.55 + r() * 0.4);   // a real diagonal
      // Try the lively cut first, then calmer ones. A cut is good when neither part is
      // narrower than a fair panel would be; if none is, take the roomiest we saw.
      var fair = k1 / k, parts = null, best = -1;
      for (var tries = 0; tries < 8; tries++) {
        var t = tries < 5 ? tilt * (1 - tries / 4) : 0;
        var v = tries >= 6 ? !vertical : vertical;
        var ra = tries < 5 ? ratio + (fair - ratio) * (tries / 4) : (tries % 2 ? fair : 0.5);
        var ang = (v ? 0 : Math.PI / 2) + t;
        var c = cutAt(p, Math.cos(ang), Math.sin(ang), ra);
        if (c[0].length < 3 || c[1].length < 3) continue;
        var q = Math.min(room(c[0], k1), room(c[1], k - k1));
        if (q > best) { best = q; parts = c; }
        if (q >= 0.74 - g * 0.12 && Math.min(thickness(c[0]), thickness(c[1])) >= minT) break;
      }
      split(parts[0], k1);
      split(parts[1], k - k1);
    }
    split([[0, 0], [w, 0], [w, h], [0, h]], n);

    var panels = leaves.map(function (p, i) {
      var pts = inset(p, gutter / 2);
      if (pts.length < 3) pts = p;
      return { index: i, points: pts, pop: false };
    });
    // high geometry: one or two panels are laid on top of the page, a little askew
    if (g >= 0.7 && n >= 3) {
      var pops = n >= 8 && g > 0.9 ? 2 : 1, taken = {};
      for (var q = 0; q < pops; q++) {
        var idx = 1 + Math.floor(r() * (n - 1));
        if (taken[idx]) continue;
        taken[idx] = 1;
        var pn = panels[idx], c = centroid(pn.points), rot = (r() < 0.5 ? -1 : 1) * (0.025 + r() * 0.03) * g, sc = 1.05;
        var ca = Math.cos(rot), sa = Math.sin(rot);
        pn.points = pn.points.map(function (v) {
          var x = (v[0] - c[0]) * sc, y = (v[1] - c[1]) * sc;
          return [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca];
        });
        pn.pop = true;
      }
    }
    panels.forEach(function (pn) { pn.bbox = bbox(pn.points); pn.safe = safeRect(inset(pn.points, 6)); pn.area = area(pn.points); });
    return panels;
  }

  /* ---------- the component ---------- */
  function px(n) { return Math.round(n * 10) / 10 + "px"; }
  function num(v, d) { v = parseFloat(v); return isNaN(v) ? d : v; }

  function Frames(el, o) {
    if (!(this instanceof Frames)) return new Frames(el, o);
    o = o || {};
    var self = this;
    this.el = el;
    this.panels = [];
    // content written in the HTML is adopted: one child per panel, in order
    var kids = Array.prototype.filter.call(el.children, function (c) { return !c.classList.contains("b-frames__ink"); });
    this.opts = {
      count: o.count != null ? o.count : num(el.getAttribute("data-count"), kids.length || 4),
      geometry: o.geometry != null ? o.geometry : num(el.getAttribute("data-geometry"), 0.5),
      seed: o.seed != null ? o.seed : num(el.getAttribute("data-seed"), 1),
      gutter: o.gutter, minSize: o.minSize, numbers: !!o.numbers, render: o.render || null
    };
    el.classList.add("b-frames");
    this._bodies = kids.map(function (k) { k.classList.add("b-frame__body"); return k; });
    this._nodes = [];
    this._ink = [mk("b-frames__ink"), mk("b-frames__ink b-frames__ink--top")];
    function mk(cls) {
      var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("class", cls); s.setAttribute("aria-hidden", "true");
      return s;
    }
    this._ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(function () {
      if (el.clientWidth !== self._w || el.clientHeight !== self._h) self.layout();
    }) : null;
    if (this._ro) this._ro.observe(el);
    this.layout();
  }
  Frames.prototype.layout = function () {
    var el = this.el, o = this.opts, self = this, w = el.clientWidth, h = el.clientHeight;
    this._w = w; this._h = h;
    if (!w || !h) return this;
    var list = layout(w, h, o);
    var wob = num(getComputedStyle(el).getPropertyValue("--b-wobble"), 1.2);
    // one node per panel, reused between layouts so content survives a resize or a new seed
    while (this._nodes.length > list.length) { var gone = this._nodes.pop(); if (gone.parentNode) el.removeChild(gone); }
    this._ink.forEach(function (s) { s.innerHTML = ""; s.setAttribute("viewBox", "0 0 " + w + " " + h); s.setAttribute("width", w); s.setAttribute("height", h); });
    list.forEach(function (pn, i) {
      var node = self._nodes[i];
      if (!node) {
        node = self._nodes[i] = document.createElement("div");
        node.className = "b-frame";
        var body = self._bodies[i];
        if (!body) { body = self._bodies[i] = document.createElement("div"); body.className = "b-frame__body"; }
        node.appendChild(body);
        node.__fresh = true;
      }
      var bb = pn.bbox, body2 = self._bodies[i];
      node.style.left = px(bb.x); node.style.top = px(bb.y); node.style.width = px(bb.w); node.style.height = px(bb.h);
      node.style.clipPath = "polygon(" + pn.points.map(function (v) { return px(v[0] - bb.x) + " " + px(v[1] - bb.y); }).join(",") + ")";
      node.classList.toggle("b-frame--pop", pn.pop);
      node.setAttribute("data-frame", i + 1);
      body2.style.left = px(pn.safe.x - bb.x); body2.style.top = px(pn.safe.y - bb.y);
      body2.style.width = px(pn.safe.w); body2.style.height = px(pn.safe.h);
      pn.el = node; pn.body = body2;
      // the pencil frame
      var svg = self._ink[pn.pop ? 1 : 0];
      B.drawParts(svg, R.poly(pn.points, true, { seed: o.seed * 131 + i * 17 + 5, wobble: wob }), { width: pn.pop ? 2.1 : 1.8, stroke: "var(--b-frame-line, var(--line))" });
      if (o.numbers) {
        var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("class", "b-frames__num");
        t.setAttribute("x", pn.safe.x + 4); t.setAttribute("y", pn.safe.y + 16);
        t.textContent = i + 1;
        svg.appendChild(t);
      }
    });
    // DOM order = reading order. The stacking (pencil above panels, popped panels above that) is CSS.
    this._nodes.forEach(function (n) { el.appendChild(n); });
    el.appendChild(this._ink[0]);
    el.appendChild(this._ink[1]);
    this.panels = list;
    if (o.render) list.forEach(function (pn, i) { o.render(pn, i, !!pn.el.__fresh); pn.el.__fresh = false; });
    return this;
  };
  /** Change count, geometry, seed, gutter or numbers and lay out again. */
  Frames.prototype.update = function (patch) {
    for (var k in patch) this.opts[k] = patch[k];
    return this.layout();
  };
  Frames.prototype.destroy = function () {
    if (this._ro) this._ro.disconnect();
    var el = this.el;
    this._ink.forEach(function (s) { if (s.parentNode) el.removeChild(s); });
    this._nodes.forEach(function (n) { if (n.parentNode) el.removeChild(n); });
    el.classList.remove("b-frames");
  };

  B.frames = function (el, o) { return new Frames(el, o); };
  B.frames.layout = layout;
  B.Frames = Frames;
})();
