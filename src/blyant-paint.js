/* Blyant.Paint — malepenselen: oljemaling med tekstur på et 2D-lerret.
   Et strøk er en bunt bust. Kroppen er et bånd med busthårenes farger (en liten tekstur som
   strekkes langs strøket), oppå ligger rygger med lys og skygge, under ligger skyggen malingen
   kaster. Når penselen går tom, legger malingen seg bare på toppen av trådene i lerretet, og
   farge som ligger vått på bildet fra før, dras med i busten.
   Alt tegnes på et gjennomsiktig «vått» lag som den som kaller, legger over bildet når strøket
   er ferdig. Samme frø og samme punkter gir samme piksler. Ingen avhengigheter.              */
(function () {
  "use strict";
  var B = (typeof window !== "undefined" && window.Blyant) || {};

  var P = 2.5;                /* avstanden mellom trådene i lerretet, i brukerenheter */
  var TEX_W = 128, TEX_H = 16; /* teksturen med bustfargene: noen kolonner per hår, én rad per halve bredde */
  var LIGHT = [-0.6, -0.8];
  var REACH = 0.8;           /* teksturen dekker så mange bredder til hver side av midten, uansett trykk */

  /* ---------- tall ---------- */
  function hash(i, seed) {
    var h = (Math.imul(i | 0, 374761393) + Math.imul(seed | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  /* Jevn støy langs én akse, 0–1. */
  function noise(x, seed) {
    var i = Math.floor(x), f = x - i;
    var a = hash(i, seed), b = hash(i + 1, seed);
    return a + (b - a) * f * f * (3 - 2 * f);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ---------- farger ---------- */
  function rgbOf(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex == null ? "" : hex).trim());
    if (!m) {
      m = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(String(hex == null ? "" : hex).trim());
      if (!m) return null;
      m = [0, m[1] + m[1] + m[2] + m[2] + m[3] + m[3]];
    }
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
    if (d > 1e-6) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hue(p, q, t) {
    t = t - Math.floor(t);
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  }
  function fromHsl(h, s, l) {
    s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [Math.round(hue(p, q, h + 1 / 3) * 255), Math.round(hue(p, q, h) * 255), Math.round(hue(p, q, h - 1 / 3) * 255)];
  }
  function css(c, a) {
    return a == null ? "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")" : "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }
  /* Fargen slik ett busthår bærer den: litt lysere eller mørkere, litt til siden i fargetone og metning. */
  function variant(hsl, dl, ds, dh) {
    var h = hsl[0], s = hsl[1], l = hsl[2];
    if (s < 0.08) { h = dh > 0 ? 0.11 : 0.6; s = 0.03 + Math.abs(ds) * 0.5; }   /* grått og hvitt får et drag av varmt eller kaldt */
    else { h += dh; s = s * (1 + ds); }
    if (l > 0.86) dl = dl * 0.5 - 0.035;            /* hvitt kan bare bli mørkere */
    else if (l < 0.14) dl = dl * 0.5 + 0.03;        /* svart kan bare bli lysere */
    return fromHsl(h, s, clamp(l + dl, 0.02, 0.985));
  }

  /* ---------- lerretet: en toskaftvev ---------- */
  var CELLS = 16;            /* veven gjentar seg etter så mange tråder */
  function cellHash(i, j) { i &= CELLS - 1; j &= CELLS - 1; return hash(i + j * 131, 7717 + j); }
  /* Høyden i veven, 0–1: annenhver rute ligger renningen øverst, annenhver innslaget. */
  function weaveHeight(x, y) {
    var cx = x / P, cy = y / P, i = Math.floor(cx), j = Math.floor(cy), fx = cx - i - 0.5, fy = cy - j - 0.5, t;
    if ((i + j) & 1) { t = fx; fx = fy; fy = t; }
    var thick = 0.8 + 0.4 * hash(((i + j) & 1 ? i : j) & (CELLS - 1), (i + j) & 1 ? 9001 : 9002);
    var across = Math.cos(Math.PI * clamp(fy / (0.5 * thick), -1, 1) * 0.5), along = Math.cos(Math.PI * fx);
    return clamp(across, 0, 1) * (0.5 + 0.5 * along * along) * (0.85 + 0.15 * cellHash(i, j));
  }

  var pool = [];
  function texture() {
    var c = pool.pop();
    if (!c) {
      c = document.createElement("canvas"); c.width = TEX_W; c.height = TEX_H;
      c._g = c.getContext("2d", { willReadFrequently: true });
      c._row = c._g.createImageData(TEX_W, 1);
    }
    return c;
  }

  /* En høydeprofil på tvers av penselen, 0–1: fine riller etter hårene og bredere rygger. */
  function profile(n, seed, simple) {
    var h = new Float64Array(n + 1), q;
    for (q = 0; q <= n; q++) {
      h[q] = simple ? 0.5 + 0.2 * noise(q * 0.4, seed) : 0.24 * hash(q, seed) + 0.34 * noise(q * 0.42, seed + 1) + 0.42 * noise(q * 0.15, seed + 2);
    }
    return h;
  }

  function spread(p) { return 0.5 * Math.min(1.22, 0.24 + 1.02 * Math.pow(clamp(p, 0, 1), 0.75)); }

  /* ------------------------------------------------------------------ */
  /* Strøket                                                             */
  /* ------------------------------------------------------------------ */
  function Section(n) {
    this.x = 0; this.y = 0; this.tx = 1; this.ty = 0; this.hL = 1; this.hR = 1; this.dist = 0; this.s = 0;
    this.ex = new Float64Array(n + 1); this.ey = new Float64Array(n + 1); this.dry = new Float64Array(n);
  }

  /**
   * new Blyant.Paint.Stroke(ctx, options)
   * options: { color, width, seed, pick, picked, load, light }
   * Gir { add(pt), end(), picked, box }.
   */
  function Stroke(ctx, o) {
    o = o || {};
    this.ctx = ctx;
    var W = this.W = clamp(+o.width || 28, 2, 200);
    var seed = this.seed = (+o.seed || 0) | 0;
    var rgb = rgbOf(o.color) || [37, 38, 35];
    this.pick = typeof o.pick === "function" ? o.pick : null;
    this.replay = o.picked && typeof o.picked.length === "number" ? o.picked : null;
    this.picked = [];
    this.box = null;
    this.loadK = clamp(o.load == null ? 1 : +o.load || 1, 0.3, 2);
    this.wetOnly = !!o._wet;         /* fyllet maler alltid med full pensel */
    this.tailK = o._tail == null ? 1 : +o._tail; this.tailDry = 0.75;

    /* Hvor lyset står, sett fra brukerenhetene: retningen er fast på skjermen. */
    var m = ctx.getTransform ? ctx.getTransform() : null;
    var a = m ? m.a : 1, b = m ? m.b : 0, c = m ? m.c : 0, d = m ? m.d : 1;
    var det = a * d - b * c;
    if (!det || det !== det) { a = d = det = 1; b = c = 0; }
    var L = o.light && o.light.length === 2 ? o.light : LIGHT;
    var ux = (d * L[0] - c * L[1]) / det, uy = (-b * L[0] + a * L[1]) / det, ul = Math.sqrt(ux * ux + uy * uy) || 1;
    this.lx = ux / ul; this.ly = uy / ul;
    this.eps = 0.75 / Math.sqrt(Math.abs(det));      /* trekvart skjermpiksel: så mye overlapper leddene */

    /* Busten. */
    var N = this.N = Math.round(clamp(W / 1.5, 3, Math.min(36, 5 + 2.6 * Math.sqrt(W))));
    this.simple = W < 6;
    var e = this.e = new Float64Array(N + 1), k;
    for (k = 0; k <= N; k++) e[k] = k === 0 ? -1 : k === N ? 1 : -1 + (2 * (k + (hash(k, seed + 11) - 0.5) * 0.55)) / N;
    this.thirst = new Float64Array(N); this.land = new Float64Array(N + 1); this.lift = new Float64Array(N + 1); this.tailF = new Float64Array(N + 1);
    for (k = 0; k < N; k++) {
      var u = (e[k] + e[k + 1]) / 2;
      this.thirst[k] = 0.3 + 0.45 * u * u + 0.35 * hash(k, seed + 80);
    }
    /* Hvor hver kant mellom to hår lander og slipper: en rund ende, litt ujevn. */
    for (k = 0; k <= N; k++) {
      var arc = 1 - Math.sqrt(Math.max(0, 1 - e[k] * e[k]));
      this.land[k] = W * (0.3 * arc + 0.012 * hash(k, seed + 31)) + 1e-4;
      this.lift[k] = Infinity;
      this.tailF[k] = 1 - 0.85 * arc;
    }
    this.mode = new Uint8Array(N); this.lam0 = new Float64Array(N); this.lam1 = new Float64Array(N);

    /* Bustfargene: to ytterpunkter per kolonne, og det som er dratt med fra bildet. */
    var Mc = this.Mc = Math.round(clamp(N * 5.7, 12, TEX_W - 18));
    this.colW = 2 * REACH * W / Mc;
    var hsl = toHsl(rgb), q;
    this.lo = new Float64Array(Mc * 3); this.hi = new Float64Array(Mc * 3);
    this.sCol = new Float64Array(Mc * 3); this.sAmt = new Float64Array(Mc); this.greed = new Float64Array(Mc);
    for (q = 0; q < Mc; q++) {
      var uq = ((q + 0.5) / Mc * 2 - 1) * REACH / 0.45;       /* omtrent −1 til 1 over et vanlig strøk */
      var band = (noise(uq * 1.6 + 3.3, seed + 5) - 0.5) * 0.065;
      var fine = (0.8 * noise(q * 0.27, seed + 200) + 0.2 * hash(q, seed + 201) - 0.5) * 0.075;
      var c1 = variant(hsl, band + fine + 0.015, (noise(q * 0.22, seed + 210) - 0.5) * 0.24, (noise(q * 0.22, seed + 220) - 0.5) * 0.04);
      var c2 = variant(hsl, band - fine * 0.6 - 0.025, (noise(q * 0.22, seed + 230) - 0.5) * 0.24, (noise(q * 0.22, seed + 240) - 0.5) * 0.04);
      this.lo[q * 3] = c1[0]; this.lo[q * 3 + 1] = c1[1]; this.lo[q * 3 + 2] = c1[2];
      this.hi[q * 3] = c2[0]; this.hi[q * 3 + 1] = c2[1]; this.hi[q * 3 + 2] = c2[2];
      this.greed[q] = 0.1 + 0.16 * Math.min(1, Math.abs(uq)) + 0.42 * Math.pow(0.8 * noise(q * 0.25, seed + 250) + 0.2 * hash(q, seed + 251), 2.2);
    }
    /* Høyden på malingen på tvers av strøket: to profiler som det blandes mellom langs strøket.
       Lyset på flankene bakes inn i teksturen rad for rad. */
    this.hA = profile(Mc, seed + 600, this.simple); this.hB = profile(Mc, seed + 700, this.simple);
    this.hq = new Float64Array(Mc); this.g4 = new Float64Array((Mc >> 2) + 3); this.e4 = new Float64Array((Mc >> 2) + 3);
    this.tex = texture(); this.pat = null; this.rows = 0; this.rowLen = Math.max(W * 0.5, 4);
    this.wear = 0; this.wearK = 1;
    this.cap = this.loadK * (260 + 40 * W);

    /* Relieffet: lys og glans på ryggene (bakt inn i teksturen), en kant mot lyset og en fra, og skyggen under. */
    var l = hsl[2];
    this.hiCol = "rgba(255,252,244," + (0.42 - 0.12 * l).toFixed(3) + ")";
    this.loCol = css(fromHsl(hsl[0], hsl[1] < 0.08 ? 0.05 : Math.min(1, hsl[1] * 1.05), l * 0.42), 0.5);
    this.shCol = "rgba(46,30,20,0.23)";
    this.wR = this.simple ? clamp(0.12 * W, 0.3, 0.7) : clamp(0.022 * W + 0.4, 0.5, 1.6);
    this.reliefK = this.simple ? 1.4 : 2.6;
    this.glintK = (0.36 + 0.26 * l) * (o._gloss == null ? 1 : +o._gloss);
    this.litK = 0.2 + 0.42 * l;      /* mørk maling blir fort grå av for mye lys */
    this.darkK = l > 0.8 ? 0.55 : l > 0.6 ? 0.55 + (0.8 - l) * 2.25 : 1;     /* lys maling tåler mindre skygge før den blir grå */
    this.shH = this.simple ? 0.5 : clamp(0.045 * W + 0.6, 0.8, 4.5);
    this.margin = this.shH + P * 1.5 + this.eps + 1;
    this.reach = this.margin + REACH * W;

    this.step = clamp(0.15 * W, 1.2, 5);
    this.lag = Math.max(1.5, (o._lag == null ? 0.4 : +o._lag) * W); this.fw = 1; this.rate = 0; this.turn = 0; this.turnAt = 0; this.turnFar = false; this.moved = false;
    this.minD = Math.max(0.4, 0.04 * W); this.drag = clamp(0.09 * W, 0.3, 5);
    this.rawX = this.rawY = this.sx = this.sy = 0;
    this.pts = []; this.dist = 0; this.started = false; this.ended = false; this.tailing = false;
    this.A = new Section(N); this.Bs = new Section(N);
    /* Kantstrekene og skyggen samles opp og tegnes for noen ledd om gangen. */
    this.first = true;        /* første ledd etter at de sist ble tegnet: da begynner strekene et hårstrå lenger bak */
    this.bL = []; this.bD = []; this.bS = []; this.cL = []; this.cD = []; this.cS = []; this.pend = 0;
    this.sAvg = 0; this.sN = 0; this.thick = 1;
  }

  /* Neste punkt. Tegner så langt punktene rekker: ett punkt bak, så streken blir jevn. */
  Stroke.prototype.add = function (pt) {
    if (this.ended || !pt) return this;
    var x = +pt.x, y = +pt.y, p = pt.p == null ? 0.5 : clamp(+pt.p, 0, 1);
    if (!isFinite(x) || !isFinite(y)) return this;
    if (p !== p) p = 0.5;
    var pts = this.pts, last = pts[pts.length - 1], m = this.reach, bx = this.box;
    /* Et punkt så langt unna at avstanden dit ikke er et tall, hoppes over: penselen ville aldri kommet fram. */
    if (last && !isFinite((x - last.x) * (x - last.x) + (y - last.y) * (y - last.y))) return this;
    if (!bx) this.box = [x - m, y - m, x + m, y + m];
    else { if (x - m < bx[0]) bx[0] = x - m; if (y - m < bx[1]) bx[1] = y - m; if (x + m > bx[2]) bx[2] = x + m; if (y + m > bx[3]) bx[3] = y + m; }
    if (last) {
      /* Busten henger litt etter skaftet: det tar skjelvingen i hånda og støyen i pennen, ikke svingene. */
      var rx = x - this.rawX, ry = y - this.rawY, kk = 1 - Math.exp(-Math.sqrt(rx * rx + ry * ry) / this.drag);
      this.rawX = x; this.rawY = y;
      x = this.sx += (x - this.sx) * kk; y = this.sy += (y - this.sy) * kk;
      var dx = x - last.x, dy = y - last.y;
      if (dx * dx + dy * dy < this.minD * this.minD) { if (p > last.p) last.p = p; return this; }
    } else { this.rawX = this.sx = x; this.rawY = this.sy = y; }
    pts.push({ x: x, y: y, p: p });
    var n = pts.length;
    if (n === 2) this._curve(pts[0].x, pts[0].y, pts[0].p, pts[0].x, pts[0].y, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, (pts[0].p + pts[1].p) / 2);
    else if (n > 2) {
      var a = pts[n - 3], c = pts[n - 2], b = pts[n - 1];
      this._curve((a.x + c.x) / 2, (a.y + c.y) / 2, (a.p + c.p) / 2, c.x, c.y, (c.x + b.x) / 2, (c.y + b.y) / 2, (c.p + b.p) / 2);
    }
    if (n > 3) pts.shift();
    return this;
  };

  /* Penselen løftes: siste bit, og halen der busthårene slipper hver for seg. */
  Stroke.prototype.end = function () {
    if (this.ended) return this;
    var pts = this.pts, n = pts.length, W = this.W;
    if (n === 1) {
      /* Et dask: et kort strøk i en retning frøet velger. */
      var ang = hash(3, this.seed + 9) * Math.PI * 2, cx = Math.cos(ang), cy = Math.sin(ang), p0 = Math.max(pts[0].p, 0.35);
      var r = W * spread(p0) * 0.75;
      this.tailK = 0.6; this.tailDry = 0; this.dot = true;
      this._curve(pts[0].x - cx * r, pts[0].y - cy * r, p0, pts[0].x, pts[0].y, pts[0].x + cx * r * 0.5, pts[0].y + cy * r * 0.5, p0);
    } else if (n > 1) {
      var a = pts[n - 2], b = pts[n - 1];
      this._curve((a.x + b.x) / 2, (a.y + b.y) / 2, (a.p + b.p) / 2, b.x, b.y, b.x, b.y, b.p);
    }
    if (this.started) this._tail(n > 1 ? Math.sqrt((pts[n - 1].x - pts[n - 2].x) * (pts[n - 1].x - pts[n - 2].x) + (pts[n - 1].y - pts[n - 2].y) * (pts[n - 1].y - pts[n - 2].y)) : W * 0.2);
    this._flush();
    this.ended = true;
    this.pts = [];
    if (this.tex) { pool.push(this.tex); this.tex = null; this.pat = null; }
    if (!this.box) this.box = [0, 0, 0, 0];
    return this;
  };

  Stroke.prototype._tail = function (spacing) {
    var W = this.W, A = this.A, N = this.N, k;
    var T = clamp(0.28 * W + 0.7 * spacing, 0.28 * W, 0.65 * W) * this.tailK;
    if (T <= 0.01) return;
    var d0 = this.dist;
    var jit = this.dot ? 0.06 : 0.38;
    for (k = 0; k <= N; k++) this.lift[k] = d0 + T * this.tailF[k] * (1 - jit + jit * hash(k, this.seed + 57));
    this.tailing = true; this.tail0 = d0;
    var n = Math.max(2, Math.ceil(T / this.step)), x0 = A.x, y0 = A.y, tx = A.tx * this.fw, ty = A.ty * this.fw, p0 = this.lastP;
    for (var i = 1; i <= n; i++) {
      var t = i / n;
      this._section(x0 + tx * T * t, y0 + ty * T * t, tx, ty, p0 * (1 - 0.35 * t));
    }
  };

  /* Én bit av linja: en kvadratisk kurve fra a til b bøyd mot c, gått i små ledd. */
  Stroke.prototype._curve = function (ax, ay, ap, cx, cy, bx, by, bp) {
    var d1x = cx - ax, d1y = cy - ay, d2x = bx - cx, d2y = by - cy;
    var l1 = Math.sqrt(d1x * d1x + d1y * d1y), l2 = Math.sqrt(d2x * d2x + d2y * d2y), len = l1 + l2;
    if (len < 0.01) return;
    var turn = 0;
    if (l1 > 1e-6 && l2 > 1e-6) turn = Math.acos(clamp((d1x * d2x + d1y * d2y) / (l1 * l2), -1, 1));
    var n = Math.min(48, Math.max(1, Math.ceil(len / this.step), Math.ceil(turn / 0.3)));
    for (var i = this.started ? 1 : 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      var x = u * u * ax + 2 * u * t * cx + t * t * bx, y = u * u * ay + 2 * u * t * cy + t * t * by;
      var tx = u * d1x + t * d2x, ty = u * d1y + t * d2y, tl = Math.sqrt(tx * tx + ty * ty);
      if (tl < 1e-6) { tx = bx - ax; ty = by - ay; tl = Math.sqrt(tx * tx + ty * ty) || 1; }
      this._section(x, y, tx / tl, ty / tl, ap + (bp - ap) * t);
    }
    if (++this.pend >= 3) this._flush();
  };

  function lines(ctx, b, caps) {
    var i;
    ctx.beginPath();
    for (i = 0; i < b.length; i += 4) { ctx.moveTo(b[i], b[i + 1]); ctx.lineTo(b[i + 2], b[i + 3]); }
    for (i = 0; i < caps.length; i += 8) { ctx.moveTo(caps[i], caps[i + 1]); ctx.bezierCurveTo(caps[i + 2], caps[i + 3], caps[i + 4], caps[i + 5], caps[i + 6], caps[i + 7]); }
    ctx.stroke();
  }
  function quads(ctx, b, caps) {
    var i;
    ctx.beginPath();
    for (i = 0; i < b.length; i += 8) { ctx.moveTo(b[i], b[i + 1]); ctx.lineTo(b[i + 2], b[i + 3]); ctx.lineTo(b[i + 4], b[i + 5]); ctx.lineTo(b[i + 6], b[i + 7]); ctx.closePath(); }
    for (i = 0; i < caps.length; i += 8) { ctx.moveTo(caps[i], caps[i + 1]); ctx.bezierCurveTo(caps[i + 2], caps[i + 3], caps[i + 4], caps[i + 5], caps[i + 6], caps[i + 7]); ctx.closePath(); }
    ctx.fill();
  }

  /* Kanten med lys og skygge, og skyggen strøket kaster, for de siste leddene på én gang. */
  Stroke.prototype._flush = function () {
    var ctx = this.ctx, bL = this.bL, bD = this.bD, bS = this.bS, cL = this.cL, cD = this.cD, cS = this.cS;
    this.pend = 0; this.first = true;
    if (!bL.length && !bD.length && !bS.length && !cL.length && !cD.length && !cS.length) return;
    ctx.save();
    ctx.globalAlpha = 1;
    var s = this.sN ? this.sAvg / this.sN : 0.5, w = (0.25 + 0.75 * s) * (0.5 + 0.5 * this.thick);
    ctx.lineCap = "butt"; ctx.lineJoin = "bevel"; ctx.globalCompositeOperation = "source-over";
    if (bD.length || cD.length) { ctx.lineWidth = this.wR * w; ctx.strokeStyle = this.loCol; lines(ctx, bD, cD); }
    if (bL.length || cL.length) { ctx.lineWidth = this.wR * w * 0.62; ctx.strokeStyle = this.hiCol; lines(ctx, bL, cL); }
    if (bS.length || cS.length) {
      /* Skyggen legges under det som alt er malt, i to trinn, så kanten blir myk. */
      var h = this.shH * (0.5 + 0.5 * this.thick);
      ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = this.shCol;
      ctx.translate(-this.lx * h * 0.5, -this.ly * h * 0.5); quads(ctx, bS, cS);
      ctx.translate(-this.lx * h * 0.5, -this.ly * h * 0.5); quads(ctx, bS, cS);
    }
    ctx.restore();
    bL.length = bD.length = bS.length = cL.length = cD.length = cS.length = 0;
    this.sAvg = 0; this.sN = 0;
  };

  /* Nye rader i teksturen. Annenhver rad spør bildet hva som ligger vått der penselen er,
     og hver rad får lyset slik strøket ligger mot det akkurat nå. */
  Stroke.prototype._rows = function (need, S) {
    var tex = this.tex, g = tex._g, row = tex._row, d = row.data, Mc = this.Mc, seed = this.seed, q, i;
    var hA = this.hA, hB = this.hB, hq = this.hq, lo = this.lo, hi = this.hi, sCol = this.sCol, sAmt = this.sAmt;
    var x = S.x, y = S.y, sn = S.s, st = S.tx * this.lx + S.ty * this.ly;
    /* Radene males to og to (teksturen må fryses hver gang den brukes), så den bakerste ligger et stykke
       foran penselen. Lyset regnes ut for retningen penselen ventelig har der, ut fra hvordan den svinger nå. */
    while (this.rows <= need || (this.rows > 1 && !(this.rows & 1))) {
      var r = this.rows, phi = clamp(this.rate * (r * this.rowLen - S.dist), -1.2, 1.2);
      var s = sn * Math.cos(phi) - st * Math.sin(phi);
      if (r & 1) {
        /* Rad 1, 3, 5 …: penselen har gått én bredde til. */
        var idx = this.picked.length, got = null;
        if (this.replay) got = idx < this.replay.length ? this.replay[idx] : null;
        else if (this.pick) got = this.pick(x, y);
        var pc = got ? rgbOf(got) : null;
        this.picked.push(pc ? "#" + ((1 << 24) | (pc[0] << 16) | (pc[1] << 8) | pc[2]).toString(16).slice(1) : null);
        this.wearK = pc ? 0.45 : 1;
        if (pc) {
          for (q = 0; q < Mc; q++) {
            var want = clamp(this.greed[q] * (0.5 + noise(r * 0.43 + q * 0.37, seed + 300)), 0, 0.6);
            var have = sAmt[q], tot = have + want;
            if (tot > 1e-4) {
              var kq = want / tot;
              sCol[q * 3] += (pc[0] - sCol[q * 3]) * kq;
              sCol[q * 3 + 1] += (pc[1] - sCol[q * 3 + 1]) * kq;
              sCol[q * 3 + 2] += (pc[2] - sCol[q * 3 + 2]) * kq;
            }
            sAmt[q] = Math.max(have, want);
          }
        }
      }
      var K = this.reliefK * this.thick, dk = this.darkK, gk = this.simple ? 0 : this.glintK * this.thick;
      var lk = this.litK, rowL = 1 + (hash(r, seed + 33) - 0.5) * 0.05, aoK = 0.2 * this.thick * dk, g4 = this.g4, e4 = this.e4, j;
      /* Ryggene vandrer litt sidelengs og bytter plass langs strøket, så de ikke blir linjalrette;
         noen steder ligger malingen glatt, andre steder står ryggene høyt. */
      var drift = (noise(r * 0.23, seed + 280) - 0.5) * 5;
      for (j = 0; j < g4.length; j++) { g4[j] = noise(r * 0.43 + j * 0.76, seed + 270); e4[j] = 0.25 + 1.3 * noise(j * 0.52 + r * 0.11, seed + 290); }
      for (q = 0; q < Mc; q++) {
        var qf = clamp(q + drift, 0, Mc - 1.001), qi = Math.floor(qf), qt = qf - qi;
        j = q >> 2;
        var mixh = g4[j] + (g4[j + 1] - g4[j]) * (q & 3) * 0.25;
        hq[q] = (hA[qi] + (hA[qi + 1] - hA[qi]) * qt) * (1 - mixh) + (hB[qi] + (hB[qi + 1] - hB[qi]) * qt) * mixh;
      }
      for (q = 0; q < Mc; q++) {
        var t = noise(r * 0.41 + q * 5.3, seed + 260 + q), am = sAmt[q], o = (q + 1) * 4, q3 = q * 3;
        var hl = q > 0 ? hq[q - 1] : hq[0], hr = q < Mc - 1 ? hq[q + 1] : hq[q];
        /* Lyset faller både på de fine rillene etter hårene og på de brede ryggene der malingen ligger tykt. */
        var wide = (hq[q + 3 < Mc ? q + 3 : Mc - 1] - hq[q > 3 ? q - 3 : 0]) * 0.34;
        j = q >> 2;
        var sh = -((hr - hl) * 0.36 * (e4[j] + (e4[j + 1] - e4[j]) * (q & 3) * 0.25) + wide) * s * K;
        sh = sh < -0.6 ? -0.6 : sh > 0.6 ? 0.6 : sh;
        var ao = 1 + aoK * (hq[q] - 0.58);
        var mul = (sh < 0 ? ao * (1 + sh * 0.7 * dk) : ao) * rowL, add = sh > 0 ? sh * lk : 0;
        if (sh > 0.2 && gk > 0) {
          /* Glans: våt olje blinker der en rygg vender rett mot lyset, i korte drag. */
          var gn = noise(r * 1.07 + q * 2.3, seed + 900 + (q >> 1));
          if (gn > 0.6) add += Math.min(1, (sh - 0.2) * 4) * Math.min(1, (gn - 0.6) * 5) * gk;
        }
        if (add > 0.9) add = 0.9;
        var v0 = lo[q3] + (hi[q3] - lo[q3]) * t, v1 = lo[q3 + 1] + (hi[q3 + 1] - lo[q3 + 1]) * t, v2 = lo[q3 + 2] + (hi[q3 + 2] - lo[q3 + 2]) * t;
        if (am > 0.002) { v0 += (sCol[q3] - v0) * am; v1 += (sCol[q3 + 1] - v1) * am; v2 += (sCol[q3 + 2] - v2) * am; sAmt[q] = am * 0.8; }
        v0 *= mul; v1 *= mul; v2 *= mul;
        d[o] = v0 + (252 - v0) * add; d[o + 1] = v1 + (252 - v1) * add; d[o + 2] = v2 + (236 - v2) * add; d[o + 3] = 255;
      }
      /* Utenfor kantene fortsetter kantfargen, så klatter som stikker ut, ikke henter farge fra andre siden.
         Alle kolonnene skrives: raden er brukt før, og et smalt strøk skal ikke arve kolonner fra et bredere. */
      d[0] = d[4]; d[1] = d[5]; d[2] = d[6]; d[3] = 255;
      var e0 = Mc * 4, pad = (TEX_W - Mc) >> 1;
      for (j = 1; j <= pad; j++) {
        o = (Mc + j) * 4; d[o] = d[e0]; d[o + 1] = d[e0 + 1]; d[o + 2] = d[e0 + 2]; d[o + 3] = 255;
        o = (TEX_W - j) * 4; d[o] = d[4]; d[o + 1] = d[5]; d[o + 2] = d[6]; d[o + 3] = 255;
      }
      g.putImageData(row, 0, r % TEX_H);
      g.putImageData(row, 0, (r + 1) % TEX_H);            /* det som stikker fram foran leddet, får samme farge inntil neste rad er malt */
      /* Første rad fyller resten av teksturen: det som stikker ut bak starten, og alle rader strøket ikke har
         malt ennå. Teksturen er brukt før, og radene til forrige strøk ville ellers vist seg i dette. */
      if (r === 0) for (j = 2; j < TEX_H; j++) g.putImageData(row, 0, j);
      this.rows++;
      this.pat = null;
    }
  };

  /* Neste tverrsnitt. Der penselen må vri seg mye på ett ledd, deles leddet opp: teksturen legges rett
     på hvert ledd, og store vinkler mellom to ledd ville synes som hakk i stripene. */
  Stroke.prototype._section = function (x, y, tx, ty, p) {
    if (this.started) {
      var A = this.A, x0 = A.x, y0 = A.y, p0 = this.lastP, dx = x - x0, dy = y - y0, dd = Math.sqrt(dx * dx + dy * dy);
      var dt = tx * A.tx + ty * A.ty, cr = A.tx * ty - A.ty * tx;
      var rot = Math.atan2(Math.abs(cr), Math.abs(dt)) * (1 - Math.exp(-dd / this.lag));
      if (rot > 0.1 && dd > 0.3) {
        var m = Math.min(16, Math.ceil(rot / 0.075));
        for (var i = 1; i <= m; i++) this._cut(x0 + dx * i / m, y0 + dy * i / m, tx, ty, p0 + (p - p0) * i / m);
        return;
      }
    }
    this._cut(x, y, tx, ty, p);
  };

  /* Et tverrsnitt av strøket: hvor hvert busthår står nå. Tegner leddet fra forrige tverrsnitt. */
  Stroke.prototype._cut = function (x, y, tx, ty, p) {
    var W = this.W, N = this.N, e = this.e, S = this.Bs, A = this.A, seed = this.seed, k;
    var has = this.started, dist = this.dist;
    if (has) {
      var ddx = x - A.x, ddy = y - A.y, dd = Math.sqrt(ddx * ddx + ddy * ddy);
      dist = this.dist += dd; this.wear += dd * this.wearK;
      /* Penselen snur seg ikke på flekken: retningen følger hånda med et lite etterslep, og når hånda
         snur helt, dras busten baklengs i stedet for å vende. Da tåler strøket en skjelven hånd. */
      var fw = tx * A.tx + ty * A.ty < 0 ? -1 : 1, al = 1 - Math.exp(-dd / this.lag);
      var sx = A.tx + (tx * fw - A.tx) * al, sy = A.ty + (ty * fw - A.ty) * al, sl = Math.sqrt(sx * sx + sy * sy);
      if (sl > 1e-6) { tx = sx / sl; ty = sy / sl; } else { tx = A.tx; ty = A.ty; }
      this.rate += ((A.tx * ty - A.ty * tx) / Math.max(dd, 0.05) - this.rate) * (1 - Math.exp(-dd / (0.5 * W + 2)));
      var nf2 = ddx * tx + ddy * ty < 0 ? -1 : 1;
      if (nf2 !== this.fw && this.moved) { this.turn = this.fw; this.turnFar = dist - this.turnAt > 0.6 * W; this.turnAt = dist; }   /* hånda snudde: strøket får en rund ende der */
      this.fw = nf2; this.moved = true;
    }
    this.lastP = p;
    var wob = 1 + (noise(dist / (W * 1.7 + 8), seed) - 0.5) * 0.12 + 0.09 * Math.exp(-dist / (0.4 * W + 1));
    var half = Math.max(0.5, W * spread(p) * wob);
    var en = this.simple ? 0.03 : 0.085, ef = dist / (W * 0.5 + 5);
    S.hL = half * (1 + (noise(ef, seed + 17) - 0.5) * en + (noise(ef * 3.1, seed + 19) - 0.5) * en * 0.5);
    S.hR = half * (1 + (noise(ef, seed + 23) - 0.5) * en + (noise(ef * 3.1, seed + 29) - 0.5) * en * 0.5);
    S.x = x; S.y = y; S.tx = tx; S.ty = ty; S.dist = dist;
    var nx = -ty, ny = tx;
    S.s = nx * this.lx + ny * this.ly;
    for (k = 0; k <= N; k++) {
      var lat = e[k] * (e[k] < 0 ? S.hL : S.hR);
      S.ex[k] = x + nx * lat; S.ey[k] = y + ny * lat;
    }
    /* Hvor tørr hver bust er: 0 og under er full, 1 og over har sluppet lerretet. */
    var used = this.wear / this.cap;
    var dl = this.wetOnly ? 0 : Math.pow(clamp((used - 1) / 0.9, 0, 1), 1.2) * 0.64;
    /* Lett trykk maler tørt, men ikke der penselen nettopp har landet: da sitter det en klatt på den. */
    var dp = this.wetOnly ? 0 : clamp((0.26 - p) / 0.26, 0, 1) * 0.85 * clamp((dist - 0.5 * W) / (1.5 * W), 0, 1);
    var D = 1 - (1 - dl) * (1 - dp);
    if (this.simple) D = 0;
    this.thick = clamp(1.25 - 0.45 * used, 0.45, 1.25) * (1 - 0.6 * D);
    var tailing = this.tailing;
    if (D > 0.001 || tailing) {
      var nf = dist / (W * 0.9 + 6), amp = 0.7 * Math.min(1, D * 4);
      for (k = 0; k < N; k++) {
        var v = D > 0.001 ? (D - 0.42 * (1.15 - this.thirst[k])) * (0.6 + this.thirst[k]) * 1.25 + (noise(nf + k * 13.7, seed + 400 + k) - 0.5) * amp : 0;
        if (tailing) {
          var lf = (this.lift[k] + this.lift[k + 1]) / 2, fade = (lf - this.tail0) * (0.35 + 0.6 * hash(k, seed + 58)) + 0.01;
          v = Math.max(v, 0) + clamp((dist - (lf - fade)) / fade, 0, 1) * this.tailDry;
        }
        S.dry[k] = v;
      }
    } else for (k = 0; k < N; k++) S.dry[k] = 0;

    var m = this.margin + Math.max(S.hL, S.hR), bx = this.box;
    if (!bx) this.box = [x - m, y - m, x + m, y + m];
    else { if (x - m < bx[0]) bx[0] = x - m; if (y - m < bx[1]) bx[1] = y - m; if (x + m > bx[2]) bx[2] = x + m; if (y + m > bx[3]) bx[3] = y + m; }

    if (has) this._step(A, S);
    this.A = S; this.Bs = A; this.started = true;
  };

  /* Ett ledd: kroppen (våte hår som bånd, tørre som klatter på trådtoppene), så ryggene og skyggen. */
  Stroke.prototype._step = function (A, S) {
    var ctx = this.ctx, N = this.N, mode = this.mode, lam0 = this.lam0, lam1 = this.lam1, k, j;
    var dA = A.dist, dB = S.dist, dd = dB - dA;
    if (dd < 1e-6) return;
    var anyWet = false, anyDry = false, k0 = N, k1 = -1;
    var land = this.land, lift = this.lift;
    for (k = 0; k < N; k++) {
      var m = 0, a0 = 0, a1 = 1;
      if ((dB > land[k] || dB > land[k + 1]) && (dA < lift[k] || dA < lift[k + 1])) {
        var part = dA < land[k] || dA < land[k + 1] || dB > lift[k] || dB > lift[k + 1];
        if (part) { a0 = clamp(((land[k] + land[k + 1]) / 2 - dA) / dd, 0, 1); a1 = clamp(((lift[k] + lift[k + 1]) / 2 - dA) / dd, 0, 1); }
        var da = A.dry[k], db = S.dry[k];
        if (da <= 0 && db <= 0) m = part ? 3 : 1;
        else if (da < 1 || db < 1) m = 2;
        if (m === 2) { anyDry = true; if (k < k0) k0 = k; if (k > k1) k1 = k; }
        else if (m) anyWet = true;
      }
      mode[k] = m; lam0[k] = a0; lam1[k] = a1;
    }
    if (!anyWet && !anyDry) { this.first = false; this.turn = 0; return; }

    this._rows(Math.floor(dB / this.rowLen) + 1, S);
    if (!this.pat) this.pat = ctx.createPattern(this.tex, "repeat");

    var ax = A.ex, ay = A.ey, bx = S.ex, by = S.ey;
    var fw = this.fw, eps = this.eps * fw, bkx = -A.tx * eps, bky = -A.ty * eps;
    var bS = this.bS, x0, y0, x1, y1, x2, y2, x3, y3;
    ctx.beginPath();
    if (anyWet) {
      for (k = 0; k < N; k++) {
        if (mode[k] === 1) {
          j = k; while (j + 1 < N && mode[j + 1] === 1) j++;
          ctx.moveTo(ax[k] + bkx, ay[k] + bky); ctx.lineTo(bx[k], by[k]); ctx.lineTo(bx[j + 1], by[j + 1]); ctx.lineTo(ax[j + 1] + bkx, ay[j + 1] + bky); ctx.closePath();
          if (k === 0 || j === N - 1) {
            /* Skygge kaster bare maling som når ut til kanten: inne i tørre drag blir den til grå flekker. */
            bS.push(ax[k], ay[k], bx[k], by[k], bx[j + 1], by[j + 1], ax[j + 1], ay[j + 1]);
          }
          k = j;
        } else if (mode[k] === 3) {
          /* Et hår som lander eller slipper midt i leddet: enden følger buen fra kant til kant. */
          var l0 = clamp((land[k] - dA) / dd, 0, 1), r0 = clamp((land[k + 1] - dA) / dd, 0, 1);
          var l1 = clamp((lift[k] - dA) / dd, 0, 1), r1 = clamp((lift[k + 1] - dA) / dd, 0, 1);
          if (l1 - l0 < 1e-4 && r1 - r0 < 1e-4) continue;
          x0 = ax[k] + (bx[k] - ax[k]) * l0; y0 = ay[k] + (by[k] - ay[k]) * l0;
          x1 = ax[k + 1] + (bx[k + 1] - ax[k + 1]) * r0; y1 = ay[k + 1] + (by[k + 1] - ay[k + 1]) * r0;
          x2 = ax[k + 1] + (bx[k + 1] - ax[k + 1]) * r1; y2 = ay[k + 1] + (by[k + 1] - ay[k + 1]) * r1;
          x3 = ax[k] + (bx[k] - ax[k]) * l1; y3 = ay[k] + (by[k] - ay[k]) * l1;
          if (l0 <= 0) { x0 += bkx; y0 += bky; }
          if (r0 <= 0) { x1 += bkx; y1 += bky; }
          ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath();
          if (!this.tailing) {
            bS.push(x0, y0, x1, y1, x2, y2, x3, y3);
            if ((l0 > 0 || r0 > 0) && !this.simple) {
              /* Kanten der penselen landet: lys om den vender mot lyset, mørk ellers. */
              var ci = this.wR * 0.45 * fw, cix = A.tx * ci, ciy = A.ty * ci;
              ((A.tx * this.lx + A.ty * this.ly) * fw < 0 ? this.bL : this.bD).push(x0 + cix, y0 + ciy, x1 + cix, y1 + ciy);
            }
          }
        }
      }
    }
    if (this.turn) {
      /* Der hånda snur, stopper penselen opp: enden blir rund, som der et strøk begynner. */
      if (mode[N >> 1] === 1) {
        var cd = Math.min(A.hL, A.hR) * 0.8 * this.turn, c1x = A.tx * cd * 1.33, c1y = A.ty * cd * 1.33;
        ctx.moveTo(ax[0], ay[0]); ctx.bezierCurveTo(ax[0] + c1x, ay[0] + c1y, ax[N] + c1x, ay[N] + c1y, ax[N], ay[N]); ctx.closePath();
        this.cS.push(ax[0], ay[0], ax[0] + c1x, ay[0] + c1y, ax[N] + c1x, ay[N] + c1y, ax[N], ay[N]);
        if (this.turnFar) {
          var ci = this.wR * 0.5 / (Math.abs(cd) + 0.01);
          ((A.tx * this.lx + A.ty * this.ly) * this.turn > 0 ? this.cL : this.cD).push(ax[0] + (A.x - ax[0]) * ci, ay[0] + (A.y - ay[0]) * ci,
            ax[0] + c1x * (1 - ci), ay[0] + c1y * (1 - ci), ax[N] + c1x * (1 - ci), ay[N] + c1y * (1 - ci), ax[N] + (A.x - ax[N]) * ci, ay[N] + (A.y - ay[N]) * ci);
        }
      }
      this.turn = 0;
    }
    if (anyDry) this._dry(A, S, k0, k1);

    /* Teksturen legges langs leddet: u på tvers, v langs. */
    var Mc = this.Mc, rl = this.rowLen;
    var mx = (A.x + S.x) / 2, my = (A.y + S.y) / 2, tx = A.tx + S.tx, ty = A.ty + S.ty, tl = Math.sqrt(tx * tx + ty * ty);
    if (tl < 1e-6) { tx = S.tx; ty = S.ty; } else { tx /= tl; ty /= tl; }
    var nx = -ty, ny = tx;
    /* Stripene følger veien penselen faktisk gikk (fra A til S), tverrsnittet følger busten. */
    var cw = this.colW, exx = nx * cw, exy = ny * cw, eyx = (S.x - A.x) / dd, eyy = (S.y - A.y) / dd, along = (eyx * tx + eyy * ty) * fw;
    if (along < 0.5) {
      /* Går penselen nesten rett sidelengs, ville teksturen klappe sammen: da får busten bestemme mer. */
      eyx += tx * fw * (0.5 - along) * 2; eyy += ty * fw * (0.5 - along) * 2;
      along = Math.sqrt(eyx * eyx + eyy * eyy) || 1; eyx /= along; eyy /= along;
    }
    eyx *= rl; eyy *= rl;
    var tv = ((dA + dB) / 2 / rl + 0.5) % TEX_H, tu = 1 + Mc / 2;
    ctx.save();
    ctx.transform(exx, exy, eyx, eyy, mx - exx * tu - eyx * tv, my - exy * tu - eyy * tv);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.pat;
    ctx.fill();
    ctx.restore();

    if (anyWet) this._relief(A, S, this.first ? bkx : 0, this.first ? bky : 0);
    this.first = false;
  };

  /* Tørr pensel: malingen fester seg på toppen av trådene i veven, og jo tørrere, jo mindre klatter. */
  Stroke.prototype._dry = function (A, S, k0, k1) {
    var ctx = this.ctx, N = this.N, e = this.e, mode = this.mode;
    var ax = A.ex, ay = A.ey, bx = S.ex, by = S.ey, pad = P * 0.5;
    var minx = Math.min(ax[k0], ax[k1 + 1], bx[k0], bx[k1 + 1]) - pad, maxx = Math.max(ax[k0], ax[k1 + 1], bx[k0], bx[k1 + 1]) + pad;
    var miny = Math.min(ay[k0], ay[k1 + 1], by[k0], by[k1 + 1]) - pad, maxy = Math.max(ay[k0], ay[k1 + 1], by[k0], by[k1 + 1]) + pad;
    var i0 = Math.floor(minx / P), i1 = Math.floor(maxx / P), j0 = Math.floor(miny / P), j1 = Math.floor(maxy / P);
    var Anx = -A.ty, Any = A.tx, Bnx = -S.ty, Bny = S.tx, i, j, k, fw = this.fw;
    var tx = S.x - A.x, ty = S.y - A.y, tl = Math.sqrt(tx * tx + ty * ty) || 1;
    tx /= tl; ty /= tl;
    for (j = j0; j <= j1; j++) {
      for (i = i0; i <= i1; i++) {
        var h = cellHash(i, j);
        var cx = (i + 0.5 + (h - 0.5) * 0.4) * P, cy = (j + 0.5 + (((h * 7.13) % 1) - 0.5) * 0.4) * P;
        var da = ((cx - A.x) * A.tx + (cy - A.y) * A.ty) * fw;
        if (da < 0) continue;
        var db = ((cx - S.x) * S.tx + (cy - S.y) * S.ty) * fw;
        if (db >= 0) continue;
        var lam = da / (da - db);
        var mx = A.x + (S.x - A.x) * lam, my = A.y + (S.y - A.y) * lam;
        var lat = (cx - mx) * (Anx + (Bnx - Anx) * lam) + (cy - my) * (Any + (Bny - Any) * lam);
        var side = lat < 0 ? A.hL + (S.hL - A.hL) * lam : A.hR + (S.hR - A.hR) * lam, u = lat / side;
        if (u < -1 || u >= 1) continue;
        k = Math.floor((u + 1) * 0.5 * N); if (k >= N) k = N - 1;
        while (k > 0 && u < e[k]) k--;
        while (k < N - 1 && u >= e[k + 1]) k++;
        if (mode[k] !== 2 || lam < this.lam0[k] || lam > this.lam1[k]) continue;
        var d = A.dry[k] + (S.dry[k] - A.dry[k]) * lam;
        if (d < 0) d = 0;
        d += ((((h * 31.7) % 1) - 0.5) * 0.34 + (hash(i & (CELLS - 1), 9001) - 0.5) * 0.1 + (hash(j & (CELLS - 1), 9002) - 0.5) * 0.1) * Math.min(1, d * 5);
        if (d >= 1) continue;
        var f = 1 - d, h2 = (h * 57.3) % 1, h3 = (h * 113.9) % 1;
        var ra = P * (0.4 + 1.05 * Math.pow(f, 0.8)) * (0.75 + 0.5 * h2), rb = P * (0.2 + 1.2 * f) * (0.7 + 0.6 * h3);
        if (side - Math.abs(lat) < rb * 0.2) continue;
        var ux = tx * ra, uy = ty * ra, vx = -ty * rb, vy = tx * rb;
        ctx.moveTo(cx - ux, cy - uy);
        ctx.quadraticCurveTo(cx + vx, cy + vy, cx + ux, cy + uy);
        ctx.quadraticCurveTo(cx - vx, cy - vy, cx - ux, cy - uy);
      }
    }
  };

  /* Kanten rundt strøket, skarpt oppå teksturen: en lys strek mot lyset, en mørk bort fra det. */
  Stroke.prototype._relief = function (A, S, bkx, bky) {
    var N = this.N, mode = this.mode;
    var Anx = -A.ty, Any = A.tx, Bnx = -S.ty, Bny = S.tx, sB = S.s;
    this.sAvg += Math.abs(sB); this.sN++;
    var lit = sB < 0 ? 0 : N, far = N - lit, sg = lit === 0 ? 1 : -1, o = this.wR * 0.5, ol = o * 0.62;
    var ax = A.ex, ay = A.ey, bx = S.ex, by = S.ey;
    if (mode[lit === 0 ? 0 : N - 1] === 1) this.bL.push(ax[lit] + Anx * sg * ol + bkx, ay[lit] + Any * sg * ol + bky, bx[lit] + Bnx * sg * ol, by[lit] + Bny * sg * ol);
    if (mode[far === 0 ? 0 : N - 1] === 1) this.bD.push(ax[far] - Anx * sg * o + bkx, ay[far] - Any * sg * o + bky, bx[far] - Bnx * sg * o, by[far] - Bny * sg * o);
  };

  /* ------------------------------------------------------------------ */
  /* Hele strøk, fyll, lerret, hånd                                      */
  /* ------------------------------------------------------------------ */
  function stroke(ctx, points, options) {
    var s = new Stroke(ctx, options);
    for (var i = 0; i < (points ? points.length : 0); i++) s.add(points[i]);
    s.end();
    return { picked: s.picked, box: s.box };
  }

  /* En flat punktliste → punkter med trykket til en hånd: penselen lander, trykker og løftes mot slutten. */
  function hand(flat, width, seed, spacing) {
    var out = [], total = 0, i;
    spacing = spacing > 0 ? spacing : 4; width = +width || 28; seed = (+seed || 0) | 0;
    if (!flat || flat.length < 2) return out;
    for (i = 2; i + 1 < flat.length; i += 2) total += Math.sqrt((flat[i] - flat[i - 2]) * (flat[i] - flat[i - 2]) + (flat[i + 1] - flat[i - 1]) * (flat[i + 1] - flat[i - 1]));
    if (total < 0.5) return [{ x: flat[0], y: flat[1], p: 0.7 }];
    var lead = Math.min(total * 0.3, 10 + width * 1.6), tail = Math.min(total * 0.4, 16 + width * 2.4);
    function pressure(s) {
      var land = clamp(s / lead, 0, 1), lift = clamp((total - s) / tail, 0, 1);
      var body = 0.62 + (noise(s * 0.012, seed + 7) - 0.5) * 0.3;
      return Math.max(0.06, body * Math.min(0.25 + 0.75 * land, 0.12 + 0.88 * Math.pow(lift, 0.8)));
    }
    var s = 0, next = 0;
    for (i = 2; i + 1 < flat.length; i += 2) {
      var ax = flat[i - 2], ay = flat[i - 1], bx = flat[i], by = flat[i + 1];
      var len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
      while (next <= s + len && len > 0) {
        var t = (next - s) / len;
        out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, p: pressure(next) });
        next += spacing;
      }
      s += len;
    }
    out.push({ x: flat[flat.length - 2], y: flat[flat.length - 1], p: pressure(total) });
    return out;
  }

  /* ---------- fyll ---------- */
  function insideRings(rings, x, y) {
    var c = false;
    for (var r = 0; r < rings.length; r++) {
      var g = rings[r], n = g.length >> 1;
      for (var i = 0, j = n - 1; i < n; j = i++) {
        var xi = g[i * 2], yi = g[i * 2 + 1], xj = g[j * 2], yj = g[j * 2 + 1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
      }
    }
    return c;
  }
  function tracePath(ctx, rings) {
    ctx.beginPath();
    for (var r = 0; r < rings.length; r++) {
      var g = rings[r];
      if (g.length < 6) continue;
      ctx.moveTo(g[0], g[1]);
      for (var i = 2; i + 1 < g.length; i += 2) ctx.lineTo(g[i], g[i + 1]);
      ctx.closePath();
    }
  }
  /* En ring med færre punkter: det som avviker mindre enn `tol` fra en rett linje, tas bort. Da blir ikke
     trappetrinnene i en form som er sporet fra piksler, til hjørner. */
  function simplify(g, tol) {
    var n = g.length >> 1, far = 0, fd = -1, i;
    if (n < 5) return g;
    for (i = 1; i < n; i++) { var d0 = (g[i * 2] - g[0]) * (g[i * 2] - g[0]) + (g[i * 2 + 1] - g[1]) * (g[i * 2 + 1] - g[1]); if (d0 > fd) { fd = d0; far = i; } }
    var keep = new Uint8Array(n + 1), stack = [0, far, far, n];
    keep[0] = keep[far] = 1;
    while (stack.length) {
      var b = stack.pop(), a = stack.pop(), ax = g[(a % n) * 2], ay = g[(a % n) * 2 + 1], bx = g[(b % n) * 2], by = g[(b % n) * 2 + 1];
      var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy), worst = -1, wi = -1;
      for (i = a + 1; i < b; i++) {
        var px = g[i * 2] - ax, py = g[i * 2 + 1] - ay, d = len > 1e-9 ? Math.abs(px * dy - py * dx) / len : Math.sqrt(px * px + py * py);
        if (d > worst) { worst = d; wi = i; }
      }
      if (worst > tol) { keep[wi] = 1; stack.push(a, wi, wi, b); }
    }
    var out = [];
    for (i = 0; i < n; i++) if (keep[i]) out.push(g[i * 2], g[i * 2 + 1]);
    return out.length >= 6 ? out : g;
  }
  /* Ringen gått opp i jevne skritt og trukket litt inn i flata: punktene til penselstrøkene langs kanten.
     En rund form får ett strøk rundt; der formen har hjørner, får hver side sitt eget strøk. */
  function rimStrokes(rings, g, ds, inset, half, seed) {
    var n = g.length >> 1, pts = [], corner = [], i, acc = 0;
    for (i = 0; i < n; i++) {
      var ax = g[i * 2], ay = g[i * 2 + 1], bx = g[((i + 1) % n) * 2], by = g[((i + 1) % n) * 2 + 1];
      var cx = g[((i + 2) % n) * 2], cy = g[((i + 2) % n) * 2 + 1];
      var l = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
      if (l < 1e-6) continue;
      while (acc < l) { pts.push(ax + (bx - ax) * acc / l, ay + (by - ay) * acc / l); corner.push(0); acc += ds; }
      acc -= l;
      var l2 = Math.sqrt((cx - bx) * (cx - bx) + (cy - by) * (cy - by));
      var cs2 = l2 > 1e-6 ? ((bx - ax) * (cx - bx) + (by - ay) * (cy - by)) / (l * l2) : 1;
      if (cs2 < 0.64 && l > half && l2 > half) {
        /* Et hjørne. Er det spisst og vender ut, må strøkene stoppe før spissen, ellers stikker de ut på andre siden. */
        pts.push(bx, by); acc = ds;
        var crs = ((bx - ax) * (cy - by) - (by - ay) * (cx - bx)) / (l * l2);
        corner.push(cs2 < -0.02 ? [crs, -cs2 / Math.sqrt(Math.max(1e-4, 1 - cs2 * cs2))] : [crs, 0]);
      }
    }
    var m = pts.length >> 1;
    if (m < 3) return [];
    /* Hvilken side er inne? Prøv et punkt like ved kanten. */
    var k = Math.floor(m / 3), tx = pts[((k + 1) % m) * 2] - pts[k * 2], ty = pts[((k + 1) % m) * 2 + 1] - pts[k * 2 + 1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
    var mx = (pts[((k + 1) % m) * 2] + pts[k * 2]) / 2, my = (pts[((k + 1) % m) * 2 + 1] + pts[k * 2 + 1]) / 2;
    var sign = insideRings(rings, mx - ty / tl * 0.6, my + tx / tl * 0.6) ? 1 : -1;
    var cs = [], out = [];
    for (i = 0; i < m; i++) if (corner[i]) cs.push(i);
    function trim(c) { var k = corner[c]; return k && k[0] * sign > 0 ? Math.round((inset + half) * k[1] * 0.8 / ds) : 0; }
    function run(from, count, closed) {
      var line = [], over = closed ? Math.ceil(inset * 9 / ds) : 0, j, j0 = 0, j1 = count + over;
      if (!closed) { j0 = trim(from); j1 = count - trim((from + count) % m); if (j1 - j0 < 2) return; }
      for (j = j0; j <= j1; j++) {
        var c = (from + j) % m, a, b;
        if (closed) { a = (c - 1 + m) % m; b = (c + 1) % m; } else { a = (from + Math.max(0, j - 1)) % m; b = (from + Math.min(count, j + 1)) % m; }
        tx = pts[b * 2] - pts[a * 2]; ty = pts[b * 2 + 1] - pts[a * 2 + 1]; tl = Math.sqrt(tx * tx + ty * ty) || 1;
        var wob = inset * (0.85 + 0.5 * noise(j * ds / (inset * 5 + 6), seed + 3 + from));
        var x = pts[c * 2] - ty / tl * wob * sign, y = pts[c * 2 + 1] + tx / tl * wob * sign;
        var pr = 0.6 + 0.2 * noise(j * ds / (inset * 8 + 10), seed + 4 + from);
        if (closed) pr *= Math.min(1, 0.4 + j * ds / (inset * 9), 0.4 + (count + over - j) * ds / (inset * 9));
        line.push({ x: x, y: y, p: pr });
      }
      out.push(line);
    }
    if (!cs.length) run(Math.floor(hash(1, seed) * m), m, true);
    else for (i = 0; i < cs.length; i++) run(cs[i], (cs[(i + 1) % cs.length] - cs[i] + m) % m || m, false);
    return out;
  }

  /**
   * Blyant.Paint.fill(ctx, rings, options)
   * En lukket form dekket med penselstrøk: rings er [[x,y,x,y,…], …] (partall-oddetall gir hull).
   * options: { color, seed, width, angle (grader), light }. Gir { box }.
   */
  function fill(ctx, rings, o) {
    o = o || {};
    var seed = (+o.seed || 0) | 0, rgb = rgbOf(o.color) || [37, 38, 35], hsl = toHsl(rgb), r, i;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, any = false;
    /* Punkter som ikke er endelige tall, tas ut av ringen: ett uendelig punkt ville gitt uendelig mange strøk. */
    rings = (rings || []).map(function (g) {
      var out = [], k;
      for (k = 0; g && k + 1 < g.length; k += 2) if (isFinite(g[k]) && isFinite(g[k + 1])) out.push(+g[k], +g[k + 1]);
      return out;
    }).filter(function (g) { return g.length >= 6; });
    for (r = 0; r < rings.length; r++) for (i = 0; i + 1 < rings[r].length; i += 2) {
      var px = rings[r][i], py = rings[r][i + 1];
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; any = true;
    }
    if (!any) return { box: [0, 0, 0, 0] };
    var bw = x1 - x0, bh = y1 - y0;
    if (!isFinite(bw) || !isFinite(bh)) return { box: [0, 0, 0, 0] };   /* tall så store at avstanden mellom dem ikke er et tall */
    var W = clamp(+o.width || 0.2 * Math.sqrt(Math.max(1, bw * bh)), 4, 200);
    var Wr = clamp(W * 0.42, 3, 24), box = [x0, y0, x1, y1];
    function grow(b) { if (!b) return; if (b[0] < box[0]) box[0] = b[0]; if (b[1] < box[1]) box[1] = b[1]; if (b[2] > box[2]) box[2] = b[2]; if (b[3] > box[3]) box[3] = b[3]; }
    function tone(k) {
      var c = variant(hsl, (hash(k, seed + 61) - 0.5) * 0.06, (hash(k, seed + 62) - 0.5) * 0.16, (hash(k, seed + 63) - 0.5) * 0.02);
      return "#" + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1);
    }

    ctx.save();
    /* Grunningen: flata i fargen, så ingenting av bildet skinner gjennom mellom strøkene. */
    tracePath(ctx, rings);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = css(variant(hsl, -0.03, 0, 0));
    ctx.fill("evenodd");
    ctx.clip("evenodd");

    /* Strøkene: parallelle bånd på skrå, annethvert den andre veien, lett bøyd. */
    var ang = (o.angle != null ? +o.angle : -22 + (hash(2, seed) - 0.5) * 50) * Math.PI / 180;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var lo = Infinity, hi = -Infinity;
    for (r = 0; r < rings.length; r++) for (i = 0; i + 1 < rings[r].length; i += 2) {
      var v = -rings[r][i] * sa + rings[r][i + 1] * ca;
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    var pitch = W * 0.68, nb = Math.max(1, Math.ceil((hi - lo) / pitch)), first = lo + ((hi - lo) - (nb - 1) * pitch) / 2, band, q;
    for (band = 0; band < nb; band++) {
      var c = first + band * pitch, spans = [];
      for (q = -1; q <= 1; q++) {
        var cv = c + q * W * 0.36, xs = [];
        for (r = 0; r < rings.length; r++) {
          var g = rings[r], n = g.length >> 1;
          for (i = 0; i < n; i++) {
            var j = (i + 1) % n;
            var ua = g[i * 2] * ca + g[i * 2 + 1] * sa, va = -g[i * 2] * sa + g[i * 2 + 1] * ca;
            var ub = g[j * 2] * ca + g[j * 2 + 1] * sa, vb = -g[j * 2] * sa + g[j * 2 + 1] * ca;
            if ((va > cv) !== (vb > cv)) xs.push(ua + (ub - ua) * (cv - va) / (vb - va));
          }
        }
        xs.sort(function (a, b) { return a - b; });
        for (i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i] - W * 0.3, xs[i + 1] + W * 0.3]);
      }
      spans.sort(function (a, b) { return a[0] - b[0]; });
      var merged = [];
      for (i = 0; i < spans.length; i++) {
        var last = merged[merged.length - 1];
        if (last && spans[i][0] <= last[1] + W * 0.25) { if (spans[i][1] > last[1]) last[1] = spans[i][1]; } else merged.push(spans[i]);
      }
      for (i = 0; i < merged.length; i++) {
        var u0 = merged[i][0], u1 = merged[i][1], len = u1 - u0, sd = seed * 31 + band * 7 + i * 131 + 17;
        var m = Math.max(3, Math.ceil(len / Math.max(3, W * 0.3))), pts = [], back = (band + i) & 1;
        var bow = (hash(band, sd + 1) - 0.5) * Math.min(W * 0.3, len * 0.06), tilt = (hash(band, sd + 2) - 0.5) * W * 0.16;
        for (q = 0; q <= m; q++) {
          var t = q / m, tt = back ? 1 - t : t, uu = u0 + len * tt;
          var vv = c + bow * Math.sin(Math.PI * tt) + tilt * (tt - 0.5) + (noise(uu / (W * 1.5 + 4), sd + 3) - 0.5) * W * 0.12;
          pts.push({ x: uu * ca - vv * sa, y: uu * sa + vv * ca, p: 0.66 + 0.24 * noise(uu / (W * 2 + 6), sd + 4) });
        }
        grow(stroke(ctx, pts, { color: tone(band * 13 + i), width: W * (0.94 + 0.2 * hash(band, sd + 5)), seed: sd, light: o.light, _wet: true, _tail: 0.5, _gloss: 0.45 }).box);
      }
    }
    ctx.restore();

    /* Kanten: et tykkere strøk langs omrisset, litt innenfor, som dekker over der båndene er kuttet. */
    for (r = 0; r < rings.length; r++) {
      var rim = rimStrokes(rings, simplify(rings[r], Math.max(0.4, Wr * 0.1)), Math.max(1.5, Wr * 0.3), Wr * 0.36, Wr * 0.46, seed + r * 977);
      for (i = 0; i < rim.length; i++) grow(stroke(ctx, rim[i], { color: tone(900 + r * 31 + i), width: Wr, seed: seed + 400 + r * 53 + i, light: o.light, _wet: true, _tail: 0.2, _gloss: 0.6 }).box);
    }
    return { box: box };
  }

  /* ---------- lerretet som bakgrunn ---------- */
  var tiles = {};
  /**
   * Blyant.Paint.weave(ctx, w, h, options)
   * Et svakt lerretsmønster over flata 0,0–w,h: samme vev som den tørre penselen fester seg i.
   * options: { color, strength, light }.
   */
  function weave(ctx, w, h, o) {
    o = o || {};
    var rgb = rgbOf(o.color) || [112, 92, 66], strength = clamp(o.strength == null ? 0.5 : +o.strength, 0, 1);
    if (!strength || !(w > 0) || !(h > 0)) return;
    var m = ctx.getTransform ? ctx.getTransform() : null;
    var a = m ? m.a : 1, b = m ? m.b : 0, c = m ? m.c : 0, d = m ? m.d : 1, det = a * d - b * c;
    if (!det || det !== det) { a = d = det = 1; b = c = 0; }
    var L = o.light && o.light.length === 2 ? o.light : LIGHT;
    var lx = (d * L[0] - c * L[1]) / det, ly = (-b * L[0] + a * L[1]) / det, ll = Math.sqrt(lx * lx + ly * ly) || 1;
    lx /= ll; ly /= ll;
    var sc = Math.sqrt(Math.abs(det)), res = sc <= 0.75 ? 1 : sc <= 1.5 ? 2 : sc <= 3 ? 4 : 8;
    var key = res + "|" + rgb.join(",") + "|" + lx.toFixed(2) + "," + ly.toFixed(2), tile = tiles[key];
    if (!tile) {
      var size = Math.round(CELLS * P * res);
      tile = tiles[key] = document.createElement("canvas"); tile.width = tile.height = size;
      var g = tile.getContext("2d"), img = g.createImageData(size, size), px = img.data, e = 0.5 / res, x, y, o4 = 0;
      for (y = 0; y < size; y++) for (x = 0; x < size; x++, o4 += 4) {
        var ux = (x + 0.5) / res, uy = (y + 0.5) / res, hgt = weaveHeight(ux, uy);
        var lit = (weaveHeight(ux + lx * e, uy + ly * e) - weaveHeight(ux - lx * e, uy - ly * e)) * res * 0.9;
        var dark = clamp(-lit, 0, 1) * 0.5 + (1 - hgt) * 0.3 - clamp(lit, 0, 1) * 0.1;
        if (lit > 0.05 && dark < 0.04) { px[o4] = 255; px[o4 + 1] = 252; px[o4 + 2] = 244; px[o4 + 3] = clamp(lit, 0, 1) * 150; }
        else { px[o4] = rgb[0]; px[o4 + 1] = rgb[1]; px[o4 + 2] = rgb[2]; px[o4 + 3] = clamp(dark, 0, 1) * 255; }
      }
      g.putImageData(img, 0, 0);
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h);
    ctx.scale(1 / res, 1 / res);
    ctx.globalAlpha = strength * 0.55 * clamp((sc * P - 0.9) / 1.6, 0, 1); ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = ctx.createPattern(tile, "repeat");
    ctx.fill();
    ctx.restore();
  }

  B.Paint = { Stroke: Stroke, stroke: stroke, fill: fill, weave: weave, hand: hand };
  if (typeof window !== "undefined") { window.Blyant = Object.assign(window.Blyant || {}, B); }
})();
