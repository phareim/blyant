/* Blyant.Game2D — rigg for 2D-spill. Et spill er en enkel beskrivelse (spec) i JSON-form;
   riggen kjører den. Fem slag: platform, topdown, catch, runner og fly.
   Figurene er enten bilder (barnets egne tegninger) eller innebygde former tegnet med
   Blyant.rough og fargeblyant. Riggen kaster aldri på en rar spec: alt klemmes og får standardverdier.
   Trenger blyant.js (Blyant.rough, Blyant.draw) lastet først. Ingen andre avhengigheter.           */
(function () {
  "use strict";
  var B = (typeof window !== "undefined" && window.Blyant) || {};
  var R = B.rough;

  var KINDS = ["platform", "topdown", "catch", "runner", "fly"];
  var ROLES = ["player", "solid", "collect", "hazard", "goal", "decor", "spring"];
  var MOVES = ["still", "patrol", "chase", "float", "wander", "fall"];
  var WINS = ["goal", "collect", "score", "survive"];
  var EDGES = ["top", "right", "left"];
  var WORLD = { platform: [3200, 900], topdown: [1600, 1200], "catch": [1000, 750], runner: [6000, 900], fly: [6000, 900] };
  var SIZE = { player: 96, collect: 56, hazard: 72, goal: 130, decor: 140, spring: 54, solid: 44 };
  var GROUND = 80;          // the ground is this many world units thick, at the bottom of the world
  var STEP = 1 / 120;       // fixed simulation step
  var GRAV = 2300, JUMP_V = 1020, TILE = 480, MIN_VIEW_W = 560;
  var NAMED = {             // plain colour words become the dusty coloured pencils
    red: "--dust-red", orange: "--dust-orange", yellow: "--dust-yellow", green: "--dust-green", blue: "--dust-blue", purple: "--dust-purple",
    "rød": "--dust-red", oransje: "--dust-orange", gul: "--dust-yellow", "grønn": "--dust-green", "blå": "--dust-blue", lilla: "--dust-purple",
    grey: "--graphite-300", gray: "--graphite-300", "grå": "--graphite-300"
  };
  var FALLBACK = {
    "--paper": "#fafaf7", "--paper-2": "#f0f0ec", "--ink": "#252623", "--ink-soft": "#6b6c66", "--line": "#454641", "--line-faint": "#d5d5cf",
    "--graphite-300": "#a8a9a2", "--graphite-500": "#6b6c66", "--marker": "#f6e65a",
    "--dust-red": "#c4705f", "--dust-orange": "#d29358", "--dust-yellow": "#d8bc55", "--dust-green": "#86a271", "--dust-blue": "#6e92b5", "--dust-purple": "#9480af"
  };

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */
  function num(v, def, lo, hi) {
    if (typeof v === "string" && v.trim() !== "") v = +v;
    if (typeof v !== "number" || !isFinite(v)) return def;
    return v < lo ? lo : v > hi ? hi : v;
  }
  function pick(v, list, def) {
    if (typeof v !== "string") return def;
    v = v.toLowerCase().trim();
    return list.indexOf(v) >= 0 ? v : def;
  }
  function text(v, max, def) {
    if (typeof v === "number" && isFinite(v)) v = String(v);
    if (typeof v !== "string") return def;
    v = v.replace(/\s+/g, " ").trim();
    return v ? v.slice(0, max) : def;
  }
  function colorStr(v) { return typeof v === "string" && v.trim() ? v.trim().slice(0, 48) : null; }
  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isImage(v) {
    if (!v || typeof v !== "object") return false;
    try { return typeof v.getContext === "function" || "naturalWidth" in v || "videoWidth" in v || (typeof v.close === "function" && typeof v.width === "number"); }
    catch (e) { return false; }
  }
  function imgSize(img) {
    var w = 0, h = 0;
    try { w = img.naturalWidth || img.videoWidth || img.width || 0; h = img.naturalHeight || img.videoHeight || img.height || 0; } catch (e) { w = h = 0; }
    return typeof w === "number" && typeof h === "number" && w > 0 && h > 0 ? [w, h] : null;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function mkRand(seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function hash2(a, b) {
    var h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function r2(n) { return Math.round(n * 100) / 100; }

  /* ------------------------------------------------------------------ */
  /* clean(spec): the spec the rig runs. Pure, no DOM.                    */
  /* ------------------------------------------------------------------ */
  function hasGround(kind, world) { return kind !== "topdown" && world.ground; }
  function heightOf(t) { return t.h != null ? t.h : t.size != null ? t.size : t.w != null ? t.w : SIZE[t.role]; }

  function cleanSprite(v) {
    if (isImage(v)) return { image: v, shape: null, color: null };
    if (typeof v === "string") v = { shape: v };
    if (!isObj(v)) return null;
    var shape = null;
    if (typeof v.shape === "string") { shape = v.shape.toLowerCase().trim(); if (!own(SHAPES, shape)) shape = "ball"; }
    return { image: isImage(v.image) ? v.image : null, shape: shape, color: colorStr(v.color) };
  }

  function cleanThing(t, kind, world, sprites, index, edge) {
    if (!isObj(t)) return null;
    var role = pick(t.role, ROLES, "decor");
    if (edge && role !== "collect" && role !== "hazard" && role !== "decor") return null;   // only these can be spawned
    var sprite = null;
    if (typeof t.sprite === "string" && t.sprite !== "__proto__") {
      var id = t.sprite, low = id.toLowerCase().trim();
      if (own(sprites, id)) sprite = id;
      else if (own(SHAPES, low)) { if (!own(sprites, low)) sprites[low] = { image: null, shape: low, color: null }; sprite = low; }   // a bare shape name works as a sprite
    }
    var move = pick(t.move, MOVES, edge ? (edge === "top" ? "fall" : "still") : "still");
    if (role === "player") move = "still";
    if ((role === "solid" || role === "spring") && move !== "patrol" && move !== "float") move = "still";
    var out = role === "decor" ? 600 : 0;   // only decor may sit outside the world
    var o = {
      sprite: sprite, role: role,
      x: num(t.x, null, -out, world.width + out), y: num(t.y, null, -out, world.height + out),
      size: num(t.size, null, 8, 2000), w: num(t.w, null, 4, 12000), h: num(t.h, null, 4, 12000),
      move: move, axis: t.axis === "x" || t.axis === "y" ? t.axis : null,
      range: num(t.range, null, 0, 6000), speed: num(t.speed, null, 0, 1500),
      points: Math.round(num(t.points, 1, 0, 1000)),
      layer: t.layer === "front" ? "front" : "back", parallax: num(t.parallax, 1, 0, 1),
      say: text(t.say, 80, null)
    };
    if (o.size == null && o.w == null && o.h == null) {
      if (role === "solid" && !sprite) { o.w = 200; o.h = SIZE.solid; } else o.size = SIZE[role];
    }
    if (edge) { delete o.x; delete o.y; return o; }
    var hh = heightOf(o) / 2, gt = world.height - GROUND, g = hasGround(kind, world);
    if (o.x == null) o.x = clamp(200 + (index * 170) % Math.max(200, world.width - 400), 0, world.width);
    if (o.y == null) o.y = g ? gt - hh : world.height / 2;
    // things that matter to the game rest on the ground instead of being buried in it
    if (g && (role === "player" || role === "collect" || role === "hazard" || role === "goal" || role === "spring") && o.y + hh > gt) o.y = gt - hh;
    return o;
  }

  function cleanSpawner(sp, kind, world, sprites) {
    if (!isObj(sp)) return null;
    var from = pick(sp.from, EDGES, kind === "runner" || kind === "fly" ? "right" : "top");
    var raw = Array.isArray(sp.things) ? sp.things : isObj(sp.things) ? [sp.things] : [], list = [], i, t;
    for (i = 0; i < raw.length && list.length < 12; i++) { t = cleanThing(raw[i], kind, world, sprites, i, from); if (t) list.push(t); }
    if (!list.length) return null;
    return { every: num(sp.every, 1.4, 0.3, 10), from: from, max: Math.round(num(sp.max, 12, 1, 40)), things: list };
  }

  function clean(spec) {
    var s = isObj(spec) ? spec : {};
    var kind = pick(s.kind, KINDS, "platform");
    var wi = isObj(s.world) ? s.world : {}, vi = isObj(s.view) ? s.view : {}, pi = isObj(s.player) ? s.player : {};
    var ri = isObj(s.rules) ? s.rules : {}, ti = isObj(s.text) ? s.text : {};
    var raw = Array.isArray(s.things) ? s.things : [], i, t;

    // a world without a size grows to hold the things in it
    var maxX = 0, maxY = 0;
    for (i = 0; i < raw.length && i < 2000; i++) if (isObj(raw[i])) {
      maxX = Math.max(maxX, num(raw[i].x, 0, 0, 12000)); maxY = Math.max(maxY, num(raw[i].y, 0, 0, 4000));
    }
    var world = {
      width: num(wi.width, clamp(Math.max(WORLD[kind][0], maxX + 300), 400, 12000), 400, 12000),
      height: num(wi.height, maxY > WORLD[kind][1] ? clamp(maxY + 160, 300, 4000) : WORLD[kind][1], 300, 4000),
      sky: colorStr(wi.sky),
      ground: kind === "topdown" ? false : !(wi.ground === false || wi.ground === 0 || wi.ground === "false"),
      groundColor: colorStr(wi.groundColor)
    };

    var sprites = {}, si = isObj(s.sprites) ? s.sprites : {}, ids = Object.keys(si).slice(0, 80);
    for (i = 0; i < ids.length; i++) {
      if (ids[i] === "__proto__" || ids[i].length > 60) continue;
      t = cleanSprite(si[ids[i]]);
      if (t) sprites[ids[i]] = t;
    }

    var things = [], player = null;
    for (i = 0; i < raw.length && things.length < 400; i++) {
      t = cleanThing(raw[i], kind, world, sprites, things.length, null);
      if (!t) continue;
      if (t.role === "player") { if (player) t.role = "decor"; else player = t; }   // exactly one player
      things.push(t);
    }
    var gt = world.height - GROUND, g = hasGround(kind, world);
    if (!player) {
      player = cleanThing({ role: "player" }, kind, world, sprites, 0, null);
      player.x = kind === "topdown" || kind === "catch" ? world.width / 2 : kind === "fly" ? 220 : 140;
      player.y = kind === "topdown" || kind === "fly" ? world.height / 2 : g ? gt - player.size / 2 : world.height / 2;
      if (kind === "platform" && !g) {   // no ground: stand on the leftmost solid
        var first = null;
        for (i = 0; i < things.length; i++) if (things[i].role === "solid" && (!first || things[i].x < first.x)) first = things[i];
        if (first) { player.x = first.x; player.y = first.y - heightOf(first) / 2 - player.size / 2; }
      }
      if (things.length >= 400) things.pop();
      things.push(player);
    }
    var ph = heightOf(player);
    player.x = clamp(player.x, 20, world.width - 20);
    player.y = clamp(player.y, ph / 2, world.height - ph / 2);
    if (kind === "catch") player.y = (g ? gt : world.height) - ph / 2;   // the catcher stays at the bottom

    var spawn = [], rs = Array.isArray(s.spawn) ? s.spawn : isObj(s.spawn) ? [s.spawn] : [];
    for (i = 0; i < rs.length && spawn.length < 6; i++) { t = cleanSpawner(rs[i], kind, world, sprites); if (t) spawn.push(t); }
    if (kind === "catch" && !spawn.length) {
      // nothing falls yet: the collect and hazard things in the level become what falls
      var tpl = [], rest = [];
      for (i = 0; i < things.length; i++) {
        t = things[i];
        if ((t.role === "collect" || t.role === "hazard") && tpl.length < 12) { delete t.x; delete t.y; if (t.move === "still" || t.move === "patrol") t.move = "fall"; tpl.push(t); }
        else rest.push(t);
      }
      things = rest;
      if (!tpl.length) tpl = [cleanThing({ role: "collect" }, kind, world, sprites, 0, "top"), cleanThing({ role: "collect" }, kind, world, sprites, 1, "top"), cleanThing({ role: "hazard" }, kind, world, sprites, 2, "top")];
      spawn.push({ every: 1.2, from: "top", max: 12, things: tpl });
    }

    var nCollect = 0, nGoal = 0, spawnCollect = false, stomp = false, j;
    for (i = 0; i < things.length; i++) {
      t = things[i];
      if (t.role === "collect") nCollect++;
      if (t.role === "goal") nGoal++;
      if (t.role === "hazard" && t.move !== "still" && (kind === "platform" || kind === "runner")) stomp = true;
    }
    for (i = 0; i < spawn.length; i++) for (j = 0; j < spawn[i].things.length; j++) if (spawn[i].things[j].role === "collect") spawnCollect = true;
    var canScore = nCollect > 0 || spawnCollect || stomp;
    var win = pick(ri.win, WINS, null);
    if (win === "goal" && !nGoal && kind !== "runner" && kind !== "fly") win = null;   // runner and fly can win at the world's end
    if (win === "collect" && !nCollect) win = null;
    if (win === "score" && !canScore) win = null;
    if (!win) win = nGoal ? "goal" : nCollect ? "collect" : kind === "catch" && canScore ? "score" : "survive";
    var rules = {
      lives: Math.round(num(ri.lives, 3, 1, 9)), win: win,
      score: Math.round(num(ri.score, 10, 1, 9999)),
      time: num(ri.time, win === "survive" ? 45 : null, 5, 3600)
    };
    var start = win === "goal" ? (kind === "runner" || kind === "fly" ? "Kom deg helt fram." : "Finn veien til mål.")
      : win === "collect" ? "Samle alt du finner."
      : win === "score" ? "Få " + rules.score + " poeng."
      : "Hold ut i " + Math.round(rules.time) + " sekunder.";

    return {
      title: text(s.title, 60, ""),
      kind: kind,
      world: world,
      view: { height: num(vi.height, Math.min(world.height, 900), 200, world.height) },
      player: { speed: num(pi.speed, 340, 60, 1200), jump: num(pi.jump, 1, 0.5, 2), doubleJump: pi.doubleJump === true },
      sprites: sprites,
      things: things,
      spawn: spawn,
      rules: rules,
      text: { start: text(ti.start, 160, start), win: text(ti.win, 80, "Du klarte det!"), lose: text(ti.lose, 80, "Prøv igjen") }
    };
  }

  /* ------------------------------------------------------------------ */
  /* The pen: coloured pencil on a 2D canvas, with Blyant.rough           */
  /* ------------------------------------------------------------------ */
  function flatD(pts) {
    var d = "M" + r2(pts[0][0]) + " " + r2(pts[0][1]);
    for (var i = 1; i < pts.length; i++) d += "L" + r2(pts[i][0]) + " " + r2(pts[i][1]);
    return d + "Z";
  }
  // Catmull-Rom through points → a dense polygon. A point given twice is a sharp corner.
  function smooth(pts, closed, per) {
    var out = [], n = pts.length, k = per || 8, last = closed ? n : n - 1, i, j;
    for (i = 0; i < last; i++) {
      var p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], p1 = pts[i];
      var p2 = pts[closed ? (i + 1) % n : i + 1], p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
      if (p1[0] === p2[0] && p1[1] === p2[1]) continue;
      for (j = 0; j < k; j++) {
        var t = j / k, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  // A curved outline drawn twice by a quick hand: each pass shakes the points a little and overlaps where it closes.
  function inkD(pts, closed, rand, amp) {
    var d = "", pass, i;
    for (pass = 0; pass < 2; pass++) {
      var jit = [], prev = null, pj = null;
      for (i = 0; i < pts.length; i++) {
        if (prev && prev[0] === pts[i][0] && prev[1] === pts[i][1]) jit.push(pj);
        else { pj = [pts[i][0] + (rand() * 2 - 1) * amp, pts[i][1] + (rand() * 2 - 1) * amp]; jit.push(pj); }
        prev = pts[i];
      }
      var dense = smooth(jit, closed, 8), n = dense.length;
      if (n < 2) continue;
      var st = closed ? Math.floor(rand() * n) : 0, cnt = closed ? n + 3 : n;
      d += "M" + r2(dense[st % n][0]) + " " + r2(dense[st % n][1]);
      for (i = 1; i < cnt; i++) d += "L" + r2(dense[(st + i) % n][0]) + " " + r2(dense[(st + i) % n][1]);
    }
    return d;
  }
  function ovalPts(cx, cy, rx, ry, n) {
    var p = [];
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return p;
  }
  function starPts(cx, cy, ro, ri, n) {
    var p = [];
    for (var i = 0; i < n * 2; i++) { var a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : ro; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return p;
  }

  /* c: 2D context in CSS px. kx, ky: px per design unit. cols: the theme. */
  function Pen(c, kx, ky, seed, wob, lw, gapK, cols) {
    this.c = c; this.kx = kx; this.ky = ky; this.seed = seed >>> 0; this.n = 0;
    this.wob = wob; this.lw = lw; this.gapK = gapK; this.cols = cols;
    this.rand = mkRand(this.seed * 31 + 17);
  }
  Pen.prototype.sd = function () { this.n++; return ((this.seed + this.n * 7919) >>> 0) || 5; };
  Pen.prototype.px = function (pts) { var kx = this.kx, ky = this.ky; return pts.map(function (p) { return [p[0] * kx, p[1] * ky]; }); };
  Pen.prototype._fill = function (px, fill, o) {
    if (fill === false || px.length < 3) return;
    var c = this.c, flat = new Path2D(flatD(px));
    o = o || {};
    c.globalAlpha = 1; c.fillStyle = this.cols.paper; c.fill(flat);   // a drawing covers what is behind it
    if (!fill) return;
    var col = this.cols.get(fill);
    c.fillStyle = col; c.globalAlpha = o.wash != null ? o.wash : 0.2; c.fill(flat);
    c.strokeStyle = col; c.lineWidth = this.lw * 0.95; c.globalAlpha = o.alpha != null ? o.alpha : 0.8;
    c.stroke(new Path2D(R.hatch(px, { seed: this.sd(), wobble: this.wob, gap: (o.gap || 4.6) * this.gapK, angle: o.angle != null ? o.angle : -41 })));
    c.globalAlpha = 1;
  };
  Pen.prototype._ink = function (d, w) {
    var c = this.c;
    c.globalAlpha = 1; c.strokeStyle = this.cols.line; c.lineWidth = this.lw * (w || 1);
    c.stroke(new Path2D(d));
  };
  /** closed shape with straight edges */
  Pen.prototype.poly = function (pts, fill, o) {
    var px = this.px(pts);
    this._fill(px, fill, o);
    this._ink(R.poly(px, true, { seed: this.sd(), wobble: this.wob }), o && o.w);
  };
  /** closed shape with soft edges */
  Pen.prototype.blob = function (pts, fill, o) {
    var px = this.px(pts);
    this._fill(smooth(px, true, 8), fill, o);
    this._ink(inkD(px, true, this.rand, this.wob * 0.8), o && o.w);
  };
  Pen.prototype.oval = function (cx, cy, rx, ry, fill, o) {
    var kx = this.kx, ky = this.ky;
    this._fill(ovalPts(cx * kx, cy * ky, rx * kx, ry * ky, 22), fill, o);
    this._ink(R.ellipse(cx * kx, cy * ky, rx * kx, ry * ky, { seed: this.sd(), wobble: this.wob }), o && o.w);
  };
  Pen.prototype.line = function (x1, y1, x2, y2, w) {
    this._ink(R.line(x1 * this.kx, y1 * this.ky, x2 * this.kx, y2 * this.ky, { seed: this.sd(), wobble: this.wob }), w);
  };
  /** open curve through points */
  Pen.prototype.curve = function (pts, w) { this._ink(inkD(this.px(pts), false, this.rand, this.wob * 0.7), w); };
  Pen.prototype.dot = function (cx, cy, r) {
    var c = this.c, k = Math.min(this.kx, this.ky);
    c.globalAlpha = 1; c.fillStyle = this.cols.line;
    c.beginPath(); c.arc(cx * this.kx, cy * this.ky, Math.max(1.1, r * k), 0, Math.PI * 2); c.fill();
  };

  /* ------------------------------------------------------------------ */
  /* Built-in shapes. Each has a design box (w × h), a default colour     */
  /* and a drawing. Shapes that look somewhere look to the right.         */
  /* ------------------------------------------------------------------ */
  var SHAPES = {
    star: { w: 100, h: 100, color: "--dust-yellow", draw: function (P, c) { P.poly(starPts(50, 54, 47, 20, 5), c); } },
    heart: { w: 100, h: 92, color: "--dust-red", draw: function (P, c) {
      P.blob([[50, 26], [50, 26], [62, 10], [82, 8], [94, 24], [90, 46], [72, 68], [50, 88], [50, 88], [28, 68], [10, 46], [6, 24], [18, 8], [38, 10]], c);
    } },
    coin: { w: 100, h: 100, color: "--dust-yellow", draw: function (P, c) {
      P.oval(50, 50, 44, 44, c); P.oval(50, 50, 31, 31, false, { w: 0.7 }); P.line(50, 36, 50, 64, 1.2);
    } },
    gem: { w: 100, h: 100, color: "--dust-blue", draw: function (P, c) {
      P.poly([[26, 10], [74, 10], [95, 36], [50, 94], [5, 36]], c);
      P.line(5, 36, 95, 36, 0.7); P.line(26, 10, 38, 36, 0.7); P.line(74, 10, 62, 36, 0.7); P.line(38, 36, 50, 94, 0.7); P.line(62, 36, 50, 94, 0.7);
    } },
    cloud: { w: 170, h: 90, color: "--dust-blue", draw: function (P, c) {
      P.blob([[18, 62], [14, 44], [30, 34], [46, 36], [54, 18], [78, 10], [100, 20], [108, 34], [130, 30], [150, 44], [154, 62], [140, 76], [100, 80], [60, 80], [30, 76]], c, { gap: 8, wash: 0.08, alpha: 0.5 });
    } },
    tree: { w: 110, h: 150, color: "--dust-green", draw: function (P, c) {
      P.poly([[46, 92], [64, 92], [68, 149], [42, 149]], "--dust-orange", { angle: 80 });
      P.blob([[55, 6], [82, 14], [100, 36], [104, 62], [90, 86], [66, 100], [44, 100], [20, 88], [6, 64], [10, 36], [28, 14]], c);
      P.curve([[40, 46], [52, 40], [62, 48]], 0.7); P.curve([[58, 70], [70, 64], [80, 72]], 0.7);
    } },
    bush: { w: 140, h: 80, color: "--dust-green", draw: function (P, c) {
      P.blob([[8, 78], [8, 78], [6, 54], [20, 36], [40, 34], [52, 16], [78, 10], [98, 22], [104, 36], [124, 40], [136, 58], [132, 78], [132, 78]], c);
    } },
    flower: { w: 70, h: 110, color: "--dust-red", draw: function (P, c) {
      P.line(35, 108, 35, 50, 1.2);
      P.blob([[35, 86], [48, 72], [60, 74], [50, 88]], "--dust-green");
      for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * Math.PI * 2 / 5; P.oval(35 + Math.cos(a) * 18, 32 + Math.sin(a) * 18, 12, 12, c); }
      P.oval(35, 32, 9, 9, "--dust-yellow");
    } },
    rock: { w: 130, h: 90, color: "--graphite-300", draw: function (P, c) {
      P.blob([[6, 88], [6, 88], [4, 60], [20, 30], [48, 10], [84, 8], [112, 26], [126, 56], [124, 88], [124, 88]], c, { gap: 5.5 });
      P.curve([[40, 34], [52, 46], [48, 60]], 0.7);
    } },
    box: { w: 100, h: 100, color: "--dust-orange", draw: function (P, c) {
      P.poly([[5, 5], [95, 5], [95, 95], [5, 95]], c);
      P.line(18, 18, 82, 82, 0.8); P.line(82, 18, 18, 82, 0.8);
      P.poly([[17, 17], [83, 17], [83, 83], [17, 83]], false, { w: 0.8 });
    } },
    ball: { w: 100, h: 100, color: "--dust-red", draw: function (P, c) {
      P.oval(50, 50, 45, 45, c);
      P.curve([[50, 6], [34, 30], [34, 70], [50, 94]], 0.7); P.curve([[50, 6], [66, 30], [66, 70], [50, 94]], 0.7);
    } },
    spike: { w: 120, h: 60, color: "--dust-red", draw: function (P, c) {
      P.poly([[3, 59], [21, 5], [40, 59]], c); P.poly([[40, 59], [60, 3], [80, 59]], c); P.poly([[80, 59], [99, 5], [117, 59]], c);
    } },
    flag: { w: 90, h: 140, color: "--marker", draw: function (P, c) {
      P.curve([[4, 138], [20, 130], [38, 138]], 1);
      P.poly([[20, 10], [86, 28], [20, 52]], c, { wash: 0.55, alpha: 0.9 });
      P.line(20, 136, 20, 6, 1.4);
    } },
    door: { w: 80, h: 120, color: "--dust-orange", draw: function (P, c) {
      P.blob([[8, 118], [8, 118], [8, 60], [8, 42], [16, 20], [40, 6], [64, 20], [72, 42], [72, 60], [72, 118], [72, 118]], c, { angle: 85 });
      P.dot(59, 70, 3.6); P.line(40, 10, 40, 116, 0.6);
    } },
    key: { w: 110, h: 50, color: "--dust-yellow", draw: function (P, c) {
      P.poly([[36, 21], [105, 21], [105, 29], [36, 29]], c);
      P.poly([[80, 29], [80, 44], [88, 44], [88, 29]], c); P.poly([[95, 29], [95, 39], [101, 39], [101, 29]], c);
      P.oval(22, 25, 19, 19, c); P.oval(22, 25, 7, 7, null);
    } },
    fish: { w: 130, h: 76, color: "--dust-blue", draw: function (P, c) {
      P.poly([[30, 38], [4, 12], [9, 38], [4, 64]], c, { angle: 20 });
      P.blob([[124, 38], [124, 38], [106, 18], [74, 10], [42, 20], [26, 38], [42, 56], [74, 66], [106, 58]], c);
      P.dot(103, 31, 3.6); P.curve([[88, 24], [82, 38], [88, 52]], 0.7);
    } },
    apple: { w: 96, h: 104, color: "--dust-red", draw: function (P, c) {
      P.blob([[48, 30], [66, 22], [86, 34], [90, 60], [76, 90], [58, 100], [48, 96], [38, 100], [20, 90], [6, 60], [10, 34], [30, 22]], c);
      P.curve([[48, 30], [50, 16], [56, 6]], 1.3);
      P.blob([[56, 14], [70, 4], [84, 10], [70, 20]], "--dust-green");
    } },
    mushroom: { w: 110, h: 104, color: "--dust-red", draw: function (P, c) {
      P.poly([[40, 54], [70, 54], [76, 101], [34, 101]], null);
      P.blob([[6, 60], [6, 60], [10, 36], [30, 14], [55, 6], [80, 14], [100, 36], [104, 60], [104, 60]], c);
      P.oval(36, 36, 8, 7, null, { w: 0.7 }); P.oval(62, 24, 7, 6, null, { w: 0.7 }); P.oval(82, 44, 7, 6, null, { w: 0.7 });
    } },
    sun: { w: 130, h: 130, color: "--dust-yellow", draw: function (P, c) {
      for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 + 0.2; P.line(65 + Math.cos(a) * 45, 65 + Math.sin(a) * 45, 65 + Math.cos(a) * 60, 65 + Math.sin(a) * 60, 1); }
      P.oval(65, 65, 36, 36, c, { wash: 0.4 });
      P.dot(54, 60, 2.6); P.dot(76, 60, 2.6); P.curve([[52, 73], [65, 81], [78, 73]], 0.9);
    } },
    moon: { w: 100, h: 100, color: "--dust-yellow", draw: function (P, c) {
      P.blob([[62, 6], [62, 6], [40, 10], [20, 28], [14, 52], [24, 76], [46, 92], [72, 92], [90, 80], [90, 80], [66, 76], [50, 60], [46, 38], [52, 18]], c);
    } },
    hill: { w: 320, h: 140, color: "--dust-green", draw: function (P, c) {
      P.blob([[4, 139], [4, 139], [40, 92], [100, 38], [160, 14], [220, 38], [280, 92], [316, 139], [316, 139]], c, { gap: 7.5, wash: 0.1, alpha: 0.55 });
      P.curve([[120, 70], [128, 58], [134, 70]], 0.7); P.curve([[190, 96], [198, 84], [204, 96]], 0.7); P.curve([[70, 112], [78, 100], [84, 112]], 0.7);
    } },
    house: { w: 130, h: 130, color: "--dust-orange", draw: function (P, c) {
      P.poly([[90, 14], [104, 14], [104, 44], [90, 34]], null);
      P.poly([[18, 60], [112, 60], [112, 126], [18, 126]], c);
      P.poly([[5, 62], [65, 8], [125, 62]], "--dust-red", { angle: 30 });
      P.poly([[36, 126], [36, 88], [58, 88], [58, 126]], null); P.dot(53, 108, 2.4);
      P.poly([[76, 78], [98, 78], [98, 100], [76, 100]], null, { w: 0.8 }); P.line(87, 78, 87, 100, 0.6); P.line(76, 89, 98, 89, 0.6);
    } },
    ghost: { w: 96, h: 116, color: "--dust-purple", draw: function (P, c) {
      P.blob([[10, 110], [10, 110], [8, 50], [20, 20], [48, 6], [76, 20], [88, 50], [86, 110], [86, 110], [72, 96], [60, 110], [48, 96], [36, 110], [24, 96]], c, { gap: 7, wash: 0.08, alpha: 0.55 });
      P.oval(38, 46, 5, 8, "--ink", { wash: 0.9, gap: 2 }); P.oval(62, 46, 5, 8, "--ink", { wash: 0.9, gap: 2 });
      P.oval(50, 70, 5, 6, null, { w: 0.8 });
    } },
    slime: { w: 120, h: 80, color: "--dust-green", draw: function (P, c) {
      P.blob([[4, 78], [4, 78], [8, 46], [28, 18], [60, 8], [92, 18], [112, 46], [116, 78], [116, 78], [90, 74], [60, 79], [30, 74]], c);
      P.oval(46, 42, 9, 11, null, { w: 0.8 }); P.dot(49, 44, 3.6); P.oval(78, 42, 9, 11, null, { w: 0.8 }); P.dot(81, 44, 3.6);
      P.curve([[52, 62], [63, 67], [74, 62]], 0.8);
    } },
    bird: { w: 120, h: 84, color: "--dust-blue", draw: function (P, c) {
      P.poly([[24, 48], [2, 34], [7, 58]], c, { angle: 10 });
      P.poly([[96, 34], [118, 42], [97, 49]], "--dust-orange");
      P.blob([[20, 46], [30, 26], [56, 16], [84, 20], [100, 40], [92, 60], [70, 72], [40, 70]], c);
      P.blob([[38, 44], [56, 30], [74, 42], [60, 58]], c, { angle: 40, wash: 0.3 });
      P.dot(85, 34, 3.2);
    } },
    figure: { w: 70, h: 120, color: "--dust-blue", draw: function (P, c) {
      P.line(29, 78, 23, 116, 1.25); P.line(43, 78, 47, 116, 1.25); P.line(23, 116, 32, 117, 1.25); P.line(47, 116, 56, 117, 1.25);
      P.line(24, 50, 7, 68, 1.25); P.line(46, 50, 63, 68, 1.25);
      P.poly([[25, 42], [45, 42], [52, 80], [18, 80]], c, { wash: 0.3 });
      P.oval(35, 23, 17, 17, null, { w: 1.1 });
      P.dot(31, 21, 2.2); P.dot(43, 21, 2.2); P.curve([[29, 28], [37, 33], [45, 28]], 0.8);
    } },
    spring: { w: 90, h: 60, color: "--dust-red", draw: function (P, c) {
      P.line(16, 16, 74, 26, 1.2); P.line(74, 26, 16, 36, 1.2); P.line(16, 36, 74, 46, 1.2); P.line(74, 46, 16, 56, 1.2);
      P.line(4, 58, 86, 58, 1.3);
      P.poly([[5, 4], [85, 4], [85, 16], [5, 16]], c, { wash: 0.4 });
    } },
    drop: { w: 70, h: 100, color: "--dust-blue", draw: function (P, c) {
      P.blob([[35, 4], [35, 4], [52, 34], [62, 62], [54, 86], [35, 96], [16, 86], [8, 62], [18, 34]], c);
      P.curve([[22, 62], [24, 74], [32, 82]], 0.7);
    } },
    bomb: { w: 100, h: 110, color: "--graphite-500", draw: function (P, c) {
      P.curve([[62, 34], [72, 18], [88, 16]], 1.2);
      P.line(90, 12, 96, 4, 0.8); P.line(92, 18, 99, 20, 0.8); P.line(86, 10, 84, 2, 0.8);
      P.oval(46, 68, 38, 38, c, { gap: 3.4, wash: 0.35 });
      P.poly([[52, 28], [70, 36], [64, 46], [48, 38]], c, { gap: 3, wash: 0.5 });
      P.curve([[24, 58], [28, 48], [38, 42]], 0.7);
    } }
  };

  function defaultShape(t, kind, world, from, index) {
    switch (t.role) {
      case "player": return "figure";
      case "collect": return "star";
      case "goal": return "flag";
      case "spring": return "spring";
      case "hazard": return from ? (from === "top" ? "bomb" : "ghost") : t.move === "still" || t.move === "fall" ? "spike" : t.move === "chase" ? "ghost" : "slime";
      case "decor": return kind !== "topdown" && t.y != null && t.y < world.height * 0.42 ? "cloud" : ["bush", "tree", "flower", "rock"][index % 4];
    }
    return null;   // a solid without a sprite is a pencil box
  }

  /* ------------------------------------------------------------------ */
  /* CSS, injected once                                                  */
  /* ------------------------------------------------------------------ */
  var CSS = [
    ".b-game{overflow:hidden;min-height:200px;background-color:var(--paper,#fafaf7);background-image:var(--b-grain-img,none);color:var(--ink,#252623);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}",
    ".b-game__root{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;container-type:size;font-family:var(--b-display,cursive);color:var(--ink,#252623)}",
    ".b-game__canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;outline:none}",
    ".b-game__hud{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:14px;padding:8px 8px 0 14px;pointer-events:none;font-size:34px;line-height:1;font-weight:600;text-shadow:0 0 3px var(--paper),0 0 3px var(--paper),0 0 7px var(--paper),0 0 7px var(--paper);z-index:1}",
    ".b-game__root:not([data-state='playing']):not([data-state='paused']) .b-game__hud,.b-game__root:not([data-state='playing']) .b-game__pad{visibility:hidden}",
    ".b-game__lives{display:flex;gap:1px}",
    ".b-game__lives svg{width:32px;height:30px;overflow:visible;color:var(--line)}",
    ".b-game__lives svg.is-lost{opacity:.4}",
    ".b-game__score{display:flex;align-items:center;gap:5px;margin-left:auto}",
    ".b-game__score svg{width:30px;height:30px;overflow:visible;color:var(--line)}",
    ".b-game__time{min-width:1.9em;text-align:right;font-variant-numeric:tabular-nums}",
    ".b-game__time:empty{display:none}",
    ".b-game__pause{pointer-events:auto;-webkit-appearance:none;appearance:none;background:none;border:0;margin:0;padding:0;width:44px;height:44px;display:grid;place-items:center;cursor:pointer;color:var(--line);border-radius:50%;touch-action:manipulation}",
    ".b-game__pause svg{width:30px;height:30px;overflow:visible}",
    ".b-game__pause:focus-visible{outline:2.5px solid var(--focus,#3d6c99);outline-offset:1px}",
    ".b-game__pad{position:absolute;bottom:14px;display:none;gap:12px;touch-action:none;pointer-events:auto;z-index:1}",
    ".b-game.is-touch .b-game__pad{display:flex}",
    ".b-game__pad--move{left:14px}",
    ".b-game__pad--jump{right:14px}",
    ".b-game__key{position:relative;width:80px;height:80px;display:grid;place-items:center;color:var(--line);opacity:.7}",
    ".b-game__key::before{content:'';position:absolute;left:5px;top:5px;right:5px;bottom:5px;border-radius:50%;background:var(--paper);opacity:.72}",
    ".b-game__key svg{position:relative;width:80px;height:80px;overflow:visible}",
    ".b-game__key.is-down{opacity:1}",
    ".b-game__key.is-down::before{background:var(--marker);opacity:.95}",
    ".b-game__pad--jump .b-game__key,.b-game__pad--jump .b-game__key svg{width:96px;height:96px}",
    ".b-game__screen{position:absolute;left:0;top:0;right:0;bottom:0;display:none;place-items:center;padding:14px;text-align:center;z-index:3}",
    ".b-game__screen.is-open{display:grid}",
    ".b-game__screen::before{content:'';position:absolute;left:0;top:0;right:0;bottom:0;background:var(--paper);opacity:.8}",
    ".b-game__card{position:relative;display:flex;flex-direction:column;align-items:center;gap:clamp(6px,2.6cqh,16px);max-width:min(94%,580px)}",
    ".b-game__title{margin:0;font-family:var(--b-display,cursive);font-weight:600;font-size:clamp(30px,12cqmin,72px);line-height:.95;color:var(--ink);text-wrap:balance}",
    ".b-game__text{margin:0;font-family:var(--b-display,cursive);font-weight:400;font-size:clamp(20px,6cqmin,32px);line-height:1.12;color:var(--ink);max-width:24em;text-wrap:balance}",
    ".b-game__points{margin:0;display:flex;align-items:center;gap:8px;font-family:var(--b-display,cursive);font-weight:600;font-size:clamp(24px,8cqmin,44px);line-height:1;color:var(--ink)}",
    ".b-game__points svg{width:1em;height:1em;overflow:visible;color:var(--line)}",
    ".b-game__hint{margin:0;font-family:var(--b-display,cursive);font-size:clamp(16px,4.4cqmin,22px);line-height:1.15;color:var(--ink-soft)}",
    ".b-game__go.b-btn{min-height:64px;min-width:190px;padding:8px 34px 12px;margin-top:4px;font-family:var(--b-display,cursive);font-size:34px;font-weight:600;touch-action:manipulation}",
    "@media (prefers-reduced-motion:no-preference){.b-game__screen.is-open .b-game__card{animation:b-game-in .28s ease-out}}",
    "@keyframes b-game-in{from{transform:translateY(10px) scale(.96);opacity:0}}"
  ].join("\n");
  var cssUsers = 0;
  function addCss() {
    cssUsers++;
    if (document.getElementById("b-game2d-css")) return;
    var st = document.createElement("style");
    st.id = "b-game2d-css";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  function dropCss() {
    cssUsers = Math.max(0, cssUsers - 1);
    var st = document.getElementById("b-game2d-css");
    if (!cssUsers && st && st.parentNode) st.parentNode.removeChild(st);
  }

  /* ------------------------------------------------------------------ */
  /* Small pencil drawings for the HUD and the touch buttons (SVG)        */
  /* ------------------------------------------------------------------ */
  var SVG_NS = "http://www.w3.org/2000/svg";
  function icon(w, h, parent) {
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 " + w + " " + h);
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    if (parent) parent.appendChild(s);
    return s;
  }
  function stroke(svg, d, style) {
    if (B.draw) return B.draw(svg, d, style);
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor"); p.setAttribute("stroke-width", (style && style.width) || 1.6);
    svg.appendChild(p);
    return p;
  }
  var HEART = [[16, 9], [16, 9], [20, 4], [26, 4], [29, 10], [27, 17], [16, 27], [16, 27], [5, 17], [3, 10], [6, 4], [12, 4]];
  function heartIcon(parent, full, seed) {
    var s = icon(32, 30, parent);
    if (full) stroke(s, flatD(smooth(HEART, true, 6)), { stroke: "none", fill: "var(--dust-red)", fillOpacity: 0.85, grain: false });
    else s.setAttribute("class", "is-lost");
    stroke(s, inkD(HEART, true, mkRand(seed), 0.5), { width: 1.7 });
    return s;
  }
  function starIcon(parent) {
    var s = icon(30, 30, parent), pts = starPts(15, 16, 13.5, 5.6, 5);
    stroke(s, flatD(pts), { stroke: "none", fill: "var(--marker)", fillOpacity: 0.95, grain: false });
    stroke(s, R.poly(pts, true, { seed: 21, wobble: 0.6 }), { width: 1.6 });
    return s;
  }
  function keyIcon(parent, which, size) {
    var s = icon(size, size, parent), m = size / 2, r = m - 7, a = size * 0.17;
    stroke(s, R.ellipse(m, m, r, r, { seed: which.length * 13 + 3, wobble: 0.9 }), { width: 2 });
    var d;
    if (which === "left") d = R.line(m + a * 0.6, m - a, m - a * 0.7, m, { seed: 5, wobble: 0.6 }) + R.line(m - a * 0.7, m, m + a * 0.6, m + a, { seed: 6, wobble: 0.6 });
    else if (which === "right") d = R.line(m - a * 0.6, m - a, m + a * 0.7, m, { seed: 7, wobble: 0.6 }) + R.line(m + a * 0.7, m, m - a * 0.6, m + a, { seed: 8, wobble: 0.6 });
    else d = R.line(m - a, m + a * 0.5, m, m - a * 0.8, { seed: 9, wobble: 0.6 }) + R.line(m, m - a * 0.8, m + a, m + a * 0.5, { seed: 10, wobble: 0.6 });
    stroke(s, d, { width: 2.6 });
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Sound: tiny blips. [wave, [from Hz, to Hz, start s, length s] …]     */
  /* ------------------------------------------------------------------ */
  var SOUNDS = {
    jump: ["triangle", [300, 560, 0, 0.11]],
    spring: ["triangle", [260, 880, 0, 0.2]],
    collect: ["triangle", [880, 880, 0, 0.06], [1320, 1320, 0.06, 0.1]],
    stomp: ["square", [220, 440, 0, 0.09]],
    hurt: ["sawtooth", [240, 100, 0, 0.24]],
    win: ["triangle", [523, 523, 0, 0.11], [659, 659, 0.11, 0.11], [784, 784, 0.22, 0.11], [1047, 1047, 0.33, 0.28]],
    lose: ["triangle", [392, 392, 0, 0.16], [330, 330, 0.16, 0.16], [262, 240, 0.32, 0.34]]
  };

  var HIT = { player: [0.6, 1], solid: [1, 1], collect: [1.1, 1.1], hazard: [0.7, 0.7], goal: [0.8, 1], decor: [1, 1], spring: [1, 0.8] };

  /* ------------------------------------------------------------------ */
  /* new Blyant.Game2D(container, spec, options)                          */
  /* options: { sound, autostart, seed }                                  */
  /* ------------------------------------------------------------------ */
  function Game2D(container, spec, options) {
    if (!(this instanceof Game2D)) return new Game2D(container, spec, options);
    var o = isObj(options) ? options : {}, self = this;
    this.spec = clean(spec);
    this.state = "ready";
    this.score = 0; this.lives = this.spec.rules.lives; this.time = 0;
    this.opts = { sound: o.sound !== false, autostart: o.autostart === true, seed: Math.round(num(o.seed, 1, 0, 4294967295)) || 1 };
    this.el = container && container.nodeType === 1 ? container : document.createElement("div");
    this._on = {}; this._keys = {}; this._ptrs = {}; this._imgWait = [];
    this._cache = {}; this._nCache = 0; this._ents = []; this._parts = [];
    this._cam = { x: 0, y: 0 }; this._view = { w: 800, h: 600, scale: 1, cw: 0, ch: 0 };
    this._dpr = 1; this._clock = 0; this._acc = 0; this._last = 0; this._dead = false;
    this._touch = false; this._gesture = false;
    this._reduced = false;
    try {
      this._mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      this._reduced = !!this._mqMotion.matches;
      this._mqDark = window.matchMedia("(prefers-color-scheme: dark)");
      this._touch = !!window.matchMedia("(pointer: coarse)").matches;
    } catch (e) { /* no matchMedia: keep the defaults */ }

    this._mount();
    this._theme();
    this._resize();
    this._build();
    this._screen("start");
    this._tick = function (now) { self._frame(now); };
    this._raf = requestAnimationFrame(this._tick);
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { if (!self._dead) { self._notes = {}; self._fontOk = true; if (B.reink) B.reink(self._root); } });
    }
    if (this.opts.autostart) this.start();
  }

  /* ---------- DOM ---------- */
  Game2D.prototype._mount = function () {
    var el = this.el, self = this, d = document;
    addCss();
    el.classList.add("b-game");
    if (this._touch) el.classList.add("is-touch");
    this._posSet = false;
    try { if (getComputedStyle(el).position === "static") { el.style.position = "relative"; this._posSet = true; } } catch (e) { /* detached */ }
    function mk(tag, cls, parent) { var n = d.createElement(tag); n.className = cls; if (parent) parent.appendChild(n); return n; }
    var root = this._root = mk("div", "b-game__root", el);
    root.setAttribute("data-state", "ready");
    var cv = this._cv = mk("canvas", "b-game__canvas", root);
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", this.spec.title || "Spill");
    this._ctx = cv.getContext("2d");

    var hud = this._hudEl = mk("div", "b-game__hud", root);
    this._livesEl = mk("div", "b-game__lives", hud);
    var sc = mk("div", "b-game__score", hud);
    starIcon(sc);
    this._scoreEl = mk("span", "", sc);
    this._timeEl = mk("div", "b-game__time", hud);
    var pb = this._pauseEl = mk("button", "b-game__pause", hud);
    pb.type = "button";
    pb.setAttribute("aria-label", "Pause");
    var pi = icon(30, 30, pb);
    stroke(pi, R.line(10, 6, 10, 24, { seed: 3, wobble: 0.7 }) + R.line(20, 6, 20, 24, { seed: 4, wobble: 0.7 }), { width: 2.6 });

    var kind = this.spec.kind;
    this._pads = [];
    if (kind === "platform" || kind === "catch") {
      var mv = mk("div", "b-game__pad b-game__pad--move", root);
      mv._keys = [mk("span", "b-game__key", mv), mk("span", "b-game__key", mv)];
      keyIcon(mv._keys[0], "left", 80); keyIcon(mv._keys[1], "right", 80);
      this._pads.push(mv);
    }
    if (kind === "platform") {
      var jp = mk("div", "b-game__pad b-game__pad--jump", root);
      jp._keys = [mk("span", "b-game__key", jp)];
      keyIcon(jp._keys[0], "jump", 96);
      this._pads.push(jp);
    }
    this._scr = mk("div", "b-game__screen", root);

    /* listeners: everything goes through _listen so destroy() can take it all away */
    this._offs = [];
    function listen(target, type, fn, opt) {
      target.addEventListener(type, fn, opt);
      self._offs.push(function () { target.removeEventListener(type, fn, opt); });
    }
    listen(window, "keydown", function (e) { self._key(e, true); });
    listen(window, "keyup", function (e) { self._key(e, false); });
    listen(window, "blur", function () { self._release(); });
    listen(d, "visibilitychange", function () { if (d.hidden) { self._release(); self.pause(); } });
    listen(el, "contextmenu", function (e) { e.preventDefault(); });
    listen(el, "selectstart", function (e) { e.preventDefault(); });
    listen(el, "pointerdown", function (e) {
      self._gesture = true;
      if (e.pointerType === "touch" && !self._touch) { self._touch = true; el.classList.add("is-touch"); }
    }, true);
    listen(cv, "pointerdown", function (e) { self._pointer(e, 1); });
    listen(cv, "pointermove", function (e) { self._pointer(e, 2); });
    listen(cv, "pointerup", function (e) { self._pointer(e, 0); });
    listen(cv, "pointercancel", function (e) { self._pointer(e, 0); });
    listen(pb, "click", function () { pb.blur(); if (self.state === "playing") self.pause(); else if (self.state === "paused") self.resume(); });
    listen(this._scr, "click", function (e) {
      var t = e.target;
      while (t && t !== self._scr) { if (t.classList && t.classList.contains("b-game__go")) { self._go(); return; } t = t.parentNode; }
    });
    this._pads.forEach(function (pad) {
      function set(e, down) {
        var keys = pad._keys, i, r = pad.getBoundingClientRect(), which = -1;
        if (down) which = keys.length === 1 ? 0 : (e.clientX < r.left + r.width / 2 ? 0 : 1);
        for (i = 0; i < keys.length; i++) keys[i].classList.toggle("is-down", i === which);
        if (keys.length === 1) { if (down && !self._keys.jump) self._press(); self._keys.jump = !!down; }
        else { self._keys.left = which === 0; self._keys.right = which === 1; }
      }
      listen(pad, "pointerdown", function (e) { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } pad._down = true; set(e, true); });
      listen(pad, "pointermove", function (e) { if (pad._down) set(e, true); });
      listen(pad, "pointerup", function (e) { pad._down = false; set(e, false); });
      listen(pad, "pointercancel", function (e) { pad._down = false; set(e, false); });
    });
    var onTheme = function () { self._themeDirty = true; };
    [this._mqDark, this._mqMotion].forEach(function (mq) {
      if (mq && mq.addEventListener) listen(mq, "change", function () { self._reduced = !!(self._mqMotion && self._mqMotion.matches); onTheme(); });
    });
    if (typeof MutationObserver !== "undefined") {
      this._mo = new MutationObserver(onTheme);
      this._mo.observe(d.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-skin", "class", "style"] });
    }
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(function () { self._resize(); });
      this._ro.observe(el);
    } else listen(window, "resize", function () { self._resize(); });
  };

  /* ---------- theme: read the paper and the pencils from the tokens ---------- */
  Game2D.prototype._theme = function () {
    var el = this.el, cs = null, memo = {}, probe = null;
    try { cs = getComputedStyle(el); } catch (e) { cs = null; }
    function tok(name) {
      var v = "";
      try { v = cs ? cs.getPropertyValue(name).trim() : ""; } catch (e) { v = ""; }
      return v || FALLBACK[name] || "";
    }
    function valid(v) {
      try {
        if (!probe) probe = document.createElement("canvas").getContext("2d");
        probe.fillStyle = "#010203"; probe.fillStyle = v;
        if (probe.fillStyle !== "#010203") return true;
        probe.fillStyle = "#030201"; probe.fillStyle = v;
        return probe.fillStyle !== "#030201";
      } catch (e) { return false; }
    }
    function get(v) {
      if (typeof v !== "string" || !v) return tok("--graphite-300");
      if (own(memo, v)) return memo[v];
      var k = v, low = v.toLowerCase(), out = "";
      if (own(NAMED, low)) k = NAMED[low];
      if (k.indexOf("--") === 0) out = tok(k);
      else if (/^[a-z][a-z0-9]*-[a-z0-9-]+$/i.test(k)) out = tok("--" + k);   // "dust-red" without the dashes
      if (!out || !valid(out)) out = valid(k) ? k : tok("--graphite-300");
      memo[v] = out;
      return out;
    }
    this._cols = { paper: tok("--paper"), paper2: tok("--paper-2"), line: tok("--line"), ink: tok("--ink"), soft: tok("--ink-soft"), faint: tok("--line-faint"), marker: tok("--marker"), get: get };
    var w = parseFloat(tok("--b-wobble"));
    this._wob = isNaN(w) ? 1.2 : w;
    this._grainOn = tok("--b-grain") !== "0";
    this._font = tok("--b-display") || "cursive";
    this._rgb = [250, 250, 247];
    try {
      if (!probe) probe = document.createElement("canvas").getContext("2d");
      probe.clearRect(0, 0, 1, 1); probe.fillStyle = this._cols.paper; probe.fillRect(0, 0, 1, 1);
      this._rgb = probe.getImageData(0, 0, 1, 1).data;
    } catch (e) { /* keep the default */ }
    this._chalk = this._rgb[0] * 0.299 + this._rgb[1] * 0.587 + this._rgb[2] * 0.114 < 110;   // Kull: a dark sheet, drawn on with chalk
    this._cache = {}; this._nCache = 0; this._notes = {}; this._sky = null; this._grain = null;
    this._themeDirty = false;
  };

  /* ---------- size ---------- */
  Game2D.prototype._resize = function () {
    if (this._dead) return;
    var el = this.el, cw = el.clientWidth || 0, ch = el.clientHeight || 0, v = this._view, w = this.spec.world, s;
    var dpr = this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    v.cw = cw; v.ch = ch;
    if (cw < 2 || ch < 2) return;
    if (this.spec.kind === "catch") s = Math.min(cw / w.width, ch / w.height);   // the whole world is in view
    else { s = ch / this.spec.view.height; if (cw / s < MIN_VIEW_W) s = cw / MIN_VIEW_W; }
    s = Math.max(0.02, s);
    if (Math.abs(s - v.scale) > v.scale * 0.02) { this._cache = {}; this._nCache = 0; }   // the drawings are made for one scale
    v.scale = s; v.w = cw / s; v.h = ch / s;
    var pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    if (this._cv.width !== pw || this._cv.height !== ph) { this._cv.width = pw; this._cv.height = ph; }
    this._sky = null;
    this._clampCam();
    if (this._p) this._draw();
  };

  /* ------------------------------------------------------------------ */
  /* Drawings: every picture is drawn once to its own canvas and kept     */
  /* ------------------------------------------------------------------ */
  Game2D.prototype._grainPattern = function (c) {
    if (!this._grain) {
      var g = document.createElement("canvas"), n = 128, x, rand = mkRand(77), rgb = this._rgb;
      g.width = g.height = n;
      var gc = g.getContext("2d");
      var im = gc.createImageData(n, n), px = im.data;
      for (x = 0; x < n * n; x++) {
        var v = rand();
        px[x * 4] = rgb[0]; px[x * 4 + 1] = rgb[1]; px[x * 4 + 2] = rgb[2];
        px[x * 4 + 3] = v > 0.6 ? Math.min(255, (v - 0.6) * 2.4 * 255 * 0.85) : 0;
      }
      gc.putImageData(im, 0, 0);
      this._grain = g;
    }
    return c.createPattern(this._grain, "repeat");
  };
  /** A canvas of pw × ph CSS px (plus a margin for the loose ends of the strokes), drawn by fn. */
  Game2D.prototype._paint = function (key, pw, ph, pad, fn) {
    var hit = this._cache[key];
    if (hit) return hit;
    if (this._nCache > 420) { this._cache = {}; this._nCache = 0; }
    var dpr = this._dpr, cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.ceil((pw + pad * 2) * dpr)); cv.height = Math.max(1, Math.ceil((ph + pad * 2) * dpr));
    cv._w = pw; cv._h = ph; cv._pad = pad;
    var c = cv.getContext("2d");
    if (c) {
      c.setTransform(dpr, 0, 0, dpr, pad * dpr, pad * dpr);
      c.lineCap = "round"; c.lineJoin = "round";
      try { fn.call(this, c); } catch (e) { this._fail(e); }
      if (this._grainOn && this._wob) {   // paper-coloured specks over the strokes: the tooth of the paper
        try {
          c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-atop";
          c.fillStyle = this._grainPattern(c); c.fillRect(0, 0, cv.width, cv.height);
          c.globalCompositeOperation = "source-over";
        } catch (e) { this._fail(e); }
      }
    }
    this._cache[key] = cv; this._nCache++;
    return cv;
  };
  function blit(c, cv, x, y, w, h) {
    var px = cv._pad * w / cv._w, py = cv._pad * h / cv._h;
    c.drawImage(cv, x - px, y - py, w + px * 2, h + py * 2);
  }
  function quant(px) { var q = px <= 96 ? 4 : px <= 320 ? 8 : 16; return Math.max(8, Math.ceil(px / q) * q); }

  /** A built-in shape in a box of w × h world units, at the current scale. */
  Game2D.prototype._shape = function (name, color, w, h) {
    var def = SHAPES[name] || SHAPES.ball, s = this._view.scale;
    var pw = quant(w * s), ph = quant(h * s), cap = 900 / Math.max(pw, ph);
    if (cap < 1) { pw = Math.max(8, Math.round(pw * cap)); ph = Math.max(8, Math.round(ph * cap)); }
    var col = color || def.color, cols = this._cols, wob0 = this._wob;
    return this._paint("s|" + name + "|" + col + "|" + pw + "x" + ph, pw, ph, 6, function (c) {
      var m = Math.min(pw, ph), big = Math.max(pw, ph);
      var P = new Pen(c, pw / def.w, ph / def.h, name.length * 131 + pw, wob0 * clamp(m / 70, 0.4, 1.1), clamp(1.15 + big / 190, 1.3, 2.3), clamp(big / 95, 0.72, 1.5), cols);
      def.draw(P, col);
    });
  };
  /** A pencil box with hatching: a solid without a sprite. edges: 1 top, 2 right, 4 bottom, 8 left. */
  Game2D.prototype._box = function (w, h, color, edges, variant) {
    var s = this._view.scale, pw = quant(w * s), ph = quant(h * s), cols = this._cols, wob = this._wob;
    return this._paint("b|" + (color || "") + "|" + pw + "x" + ph + "|" + edges + "|" + variant, pw, ph, 5, function (c) {
      var seed = pw * 7 + ph * 13 + variant * 101 + edges, col = color ? cols.get(color) : cols.line;
      c.fillStyle = cols.paper; c.fillRect(0, 0, pw, ph);
      if (color) { c.globalAlpha = 0.16; c.fillStyle = col; c.fillRect(0, 0, pw, ph); }
      c.globalAlpha = color ? 0.8 : 0.36; c.strokeStyle = col; c.lineWidth = color ? 1.5 : 1.1;
      c.stroke(new Path2D(R.hatch([[0, 0], [pw, 0], [pw, ph], [0, ph]], { seed: seed, wobble: wob, gap: color ? 5.5 : 7, angle: variant === 1 ? -36 : -43 })));
      c.globalAlpha = 1; c.strokeStyle = cols.line;
      var d = "", o = { seed: seed + 9, wobble: wob };
      if (edges & 2) d += R.line(pw, 0, pw, ph, o);
      if (edges & 4) d += R.line(pw, ph, 0, ph, o);
      if (edges & 8) d += R.line(0, ph, 0, 0, o);
      if (d) { c.lineWidth = 1.8; c.stroke(new Path2D(d)); }
      if (edges & 1) { c.lineWidth = 2.4; c.stroke(new Path2D(R.line(0, 0, pw, 0, o))); }
    });
  };
  /** One stretch of ground: a firm line, hatching under it, a few tufts. */
  Game2D.prototype._tile = function (variant) {
    var s = this._view.scale, pw = Math.ceil(TILE * s), up = 16, ph = Math.ceil(GROUND * s) + up, cols = this._cols, wob = this._wob;
    var color = this.spec.world.groundColor;
    return this._paint("g|" + (color || "") + "|" + pw + "|" + variant, pw, ph, 0, function (c) {
      var rand = mkRand(variant * 53 + 11), i, x, seed = variant * 977 + 31;
      c.fillStyle = cols.paper; c.fillRect(0, up, pw, ph - up);
      if (color) {
        var col = cols.get(color);
        c.globalAlpha = 0.14; c.fillStyle = col; c.fillRect(0, up, pw, ph - up);
        c.globalAlpha = 0.8; c.strokeStyle = col; c.lineWidth = 1.6;
        c.stroke(new Path2D(R.hatch([[-8, up], [pw + 8, up], [pw + 8, ph + 8], [-8, ph + 8]], { seed: seed, wobble: wob, gap: 5.5, angle: -41 })));
      }
      c.strokeStyle = cols.line;
      c.globalAlpha = color ? 0.3 : 0.42; c.lineWidth = 1.1;
      c.stroke(new Path2D(R.hatch([[-8, up + 2], [pw + 8, up + 2], [pw + 8, up + Math.min(26, ph - up)], [-8, up + Math.min(26, ph - up)]], { seed: seed + 1, wobble: wob, gap: 8, angle: -52 })));
      c.globalAlpha = 0.7; c.lineWidth = 1.2;
      var d = "";
      for (i = 0; i < 4; i++) {   // tufts of grass on the line, pebbles under it
        x = 20 + rand() * (pw - 40);
        d += R.line(x, up, x - 4, up - 7 - rand() * 4, { seed: seed + i * 3, wobble: wob * 0.6, passes: 1 }) + R.line(x + 3, up, x + 3, up - 9 - rand() * 4, { seed: seed + i * 5, wobble: wob * 0.6, passes: 1 }) + R.line(x + 6, up, x + 10, up - 6 - rand() * 4, { seed: seed + i * 7, wobble: wob * 0.6, passes: 1 });
        if (ph - up > 44) d += R.ellipse(20 + rand() * (pw - 40), up + 34 + rand() * (ph - up - 44), 3 + rand() * 3, 2 + rand() * 2, { seed: seed + i * 11, wobble: wob * 0.5, passes: 1 });
      }
      c.stroke(new Path2D(d));
      c.globalAlpha = 1; c.lineWidth = 2.4;
      c.stroke(new Path2D(R.line(-6, up, pw + 6, up, { seed: seed + 2, wobble: wob })));
    });
  };
  /** The floor of a topdown world: a few faint marks, so the paper is seen to move under the player. */
  Game2D.prototype._floor = function (variant) {
    var s = this._view.scale, pw = Math.ceil(TILE * s), cols = this._cols, wob = this._wob;
    return this._paint("f|" + pw + "|" + variant, pw, pw, 0, function (c) {
      var rand = mkRand(variant * 71 + 5), i, x, y, d = "", o;
      for (i = 0; i < 7; i++) {
        x = 16 + rand() * (pw - 32); y = 16 + rand() * (pw - 32); o = { seed: variant * 31 + i * 7 + 3, wobble: wob * 0.6, passes: 1 };
        if (i % 3 === 0) d += R.ellipse(x, y, 3 + rand() * 3, 2 + rand() * 2, o);
        else d += R.line(x, y, x - 4, y - 8, o) + R.line(x + 3, y, x + 3, y - 10, o) + R.line(x + 6, y, x + 10, y - 7, o);
      }
      c.globalAlpha = 0.45; c.strokeStyle = cols.line; c.lineWidth = 1.1;
      c.stroke(new Path2D(d));
    });
  };
  /** The sky: a light wash of coloured pencil, strongest at the top. The paper stays visible. */
  Game2D.prototype._skyWash = function () {
    var v = this._view, sky = this.spec.world.sky;
    if (!sky || v.cw < 2) return null;
    if (this._sky) return this._sky;
    var cw = v.cw, ch = v.ch, cols = this._cols, wob = this._wob, dpr = Math.min(this._dpr, 1.5);
    var cv = document.createElement("canvas");
    cv.width = Math.ceil(cw * dpr); cv.height = Math.ceil(ch * dpr);
    var c = cv.getContext("2d");
    if (c) {
      try {
        var col = cols.get(sky), box = [[-10, -10], [cw + 10, -10], [cw + 10, ch + 10], [-10, ch + 10]];
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.lineCap = "round"; c.strokeStyle = col;
        var ka = this._chalk ? 0.55 : 1;
        c.globalAlpha = 0.17 * ka; c.lineWidth = 7;
        c.stroke(new Path2D(R.hatch(box, { seed: 41, wobble: wob * 2.2, gap: 12, angle: -38 })));
        c.globalAlpha = 0.12 * ka; c.lineWidth = 5;
        c.stroke(new Path2D(R.hatch(box, { seed: 43, wobble: wob * 2.2, gap: 19, angle: -47 })));
        c.globalAlpha = 1; c.globalCompositeOperation = "destination-in";
        var gr = c.createLinearGradient(0, 0, 0, ch);
        gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.55, "rgba(0,0,0,0.6)"); gr.addColorStop(1, "rgba(0,0,0,0.12)");
        c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
        if (this._grainOn && wob) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-atop"; c.fillStyle = this._grainPattern(c); c.fillRect(0, 0, cv.width, cv.height); }
        c.globalCompositeOperation = "source-over";
      } catch (e) { this._fail(e); }
    }
    this._sky = cv;
    return cv;
  };
  /** The small note a thing says: hand-written on a slip of paper. */
  Game2D.prototype._note = function (str) {
    var hit = this._notes[str];
    if (hit) return hit;
    var cols = this._cols, wob = this._wob, font = "500 23px " + this._font, lines = [], line = "", i, w = 0;
    var m = document.createElement("canvas").getContext("2d");
    var words = str.split(" ");
    if (m) m.font = font;
    function width(s) { return m ? m.measureText(s).width : s.length * 10; }
    for (i = 0; i < words.length; i++) {
      var tryLine = line ? line + " " + words[i] : words[i];
      if (line && width(tryLine) > 210) { lines.push(line); line = words[i]; } else line = tryLine;
    }
    if (line) lines.push(line);
    for (i = 0; i < lines.length; i++) w = Math.max(w, width(lines[i]));
    var pw = Math.ceil(Math.min(w, 300) + 26), ph = lines.length * 25 + 18, tail = 10;
    var dpr = this._dpr, cv = document.createElement("canvas");
    cv.width = Math.ceil((pw + 12) * dpr); cv.height = Math.ceil((ph + tail + 12) * dpr);
    cv._w = pw + 12; cv._h = ph + tail + 12;
    var c = cv.getContext("2d");
    if (c) {
      try {
        c.setTransform(dpr, 0, 0, dpr, 6 * dpr, 6 * dpr);
        c.lineCap = "round"; c.lineJoin = "round";
        var mid = pw / 2, pts = [[0, 0], [pw, 0], [pw, ph], [mid + 9, ph], [mid, ph + tail], [mid - 7, ph], [0, ph]];
        c.fillStyle = cols.paper2; c.fill(new Path2D(flatD(pts)));
        c.strokeStyle = cols.line; c.lineWidth = 1.7;
        c.stroke(new Path2D(R.poly(pts, true, { seed: str.length * 17 + 5, wobble: wob })));
        c.fillStyle = cols.ink; c.font = font; c.textAlign = "center"; c.textBaseline = "middle";
        for (i = 0; i < lines.length; i++) c.fillText(lines[i], mid, 9 + 12.5 + i * 25, 300);
      } catch (e) { this._fail(e); }
    }
    this._notes[str] = cv;
    return cv;
  };

  /* ------------------------------------------------------------------ */
  /* Building the level                                                  */
  /* ------------------------------------------------------------------ */
  Game2D.prototype._look = function (t, from, index) {
    var sp = this.spec, s = t.sprite && own(sp.sprites, t.sprite) ? sp.sprites[t.sprite] : null;
    var img = s && s.image ? s.image : null, size = img ? imgSize(img) : null;
    var shape = s && s.shape ? s.shape : null, color = s && s.color ? s.color : null;
    if (img && !size) this._waitFor(img);
    if (!shape) shape = defaultShape(t, sp.kind, sp.world, from, index);
    var def = shape ? SHAPES[shape] : null;
    return { image: size ? img : null, shape: shape, color: color, aspect: size ? size[0] / size[1] : def ? def.w / def.h : 1 };
  };
  /* an <img> that has not loaded yet: use the stand-in shape now, the picture when it arrives */
  Game2D.prototype._waitFor = function (img) {
    var self = this, i;
    if (!img || typeof img.addEventListener !== "function") return;
    for (i = 0; i < this._imgWait.length; i++) if (this._imgWait[i][0] === img) return;
    var fn = function () {
      if (self._dead) return;
      self._ents.forEach(function (e) { var x = e.x, y = e.y, b = y + e.h / 2; self._fit(e, e.from, e.index); e.x = x; e.y = e.role === "solid" ? y : b - e.h / 2; });
    };
    img.addEventListener("load", fn);
    this._imgWait.push([img, fn]);
  };
  Game2D.prototype._fit = function (e, from, index) {
    var t = e.t, spr = e.spr = this._look(t, from, index), kind = this.spec.kind;
    var h = t.h != null ? t.h : t.size != null ? t.size : t.w != null ? t.w / spr.aspect : SIZE[t.role];
    var w = t.w != null ? t.w : h * spr.aspect;
    e.w = clamp(w, 2, 12000); e.h = clamp(h, 2, 12000);
    var k = HIT[e.role] || HIT.decor, kx = k[0], ky = k[1];
    if (e.role === "player") { if (kind === "topdown" || kind === "fly") { kx = 0.62; ky = 0.7; } else if (kind === "catch") { kx = 0.9; ky = 0.8; } }
    e.cw = e.w * kx; e.ch = e.h * ky;
  };
  Game2D.prototype._make = function (t, from, index) {
    var e = {
      t: t, role: t.role, from: from || null, index: index, x: t.x || 0, y: t.y || 0, hx: t.x || 0, hy: t.y || 0,
      w: 1, h: 1, cw: 1, ch: 1, vx: 0, vy: 0, dx: 0, dy: 0, face: 1, dir: 1, sx: 1, sy: 1,
      alive: true, gone: false, pop: 0, say: t.say || null, sayT: 0, wait: 0, tx: null, ty: null, lap: 0,
      seed: (index * 2654435761 + 97) >>> 0, ph: hash2(index, 5) * 6.283, move: t.move, axis: t.axis, spr: null, owner: null
    };
    this._fit(e, from, index);
    var role = t.role, m = t.move;
    e.range = t.range != null ? t.range : m === "float" ? 40 : m === "wander" ? 260 : 220;
    e.speed = t.speed != null ? t.speed : from ? 210 : m === "chase" ? 110 : m === "wander" ? 70 : m === "float" ? 60 : 90;
    if (!e.axis && m === "patrol") e.axis = "x";
    if (!e.axis && m === "wander" && (this.spec.kind === "platform" || this.spec.kind === "runner")) e.axis = "x";
    e.pass = role === "decor" ? (t.layer === "front" ? 3 : 0) : role === "solid" ? 1 : 2;
    e.moving = m !== "still";
    return e;
  };
  Game2D.prototype._build = function () {
    var sp = this.spec, self = this, i;
    this._rand = mkRand(this.opts.seed * 7919 + 13);
    this._ents = []; this._solids = []; this._parts = [];
    this._p = null;
    for (i = 0; i < sp.things.length; i++) {
      var e = this._make(sp.things[i], null, i);
      if (e.role === "player") this._p = e; else this._ents.push(e);
      if (e.role === "solid") this._solids.push(e);
    }
    var p = this._p, W = sp.world.width, H = sp.world.height;
    if (sp.kind === "topdown") {   // pencil walls around the world
      [[W / 2, -22, W + 88, 44], [W / 2, H + 22, W + 88, 44], [-22, H / 2, 44, H], [W + 22, H / 2, 44, H]].forEach(function (b, k) {
        var wall = self._make({ role: "solid", sprite: null, x: b[0], y: b[1], w: b[2], h: b[3], move: "still", axis: null, range: null, speed: null, points: 0, layer: "back", parallax: 1, say: null }, null, 1000 + k);
        self._ents.push(wall); self._solids.push(wall);
      });
    }
    p.inv = 0; p.ground = false; p.on = null; p.coyote = 0; p.jumps = 0; p.walk = 0; p.tilt = 0; p.prevB = p.y + p.ch / 2;
    if (hasGround(sp.kind, sp.world) && sp.kind !== "fly") { var gt = H - GROUND; if (p.y + p.h / 2 > gt) p.y = gt - p.h / 2; }
    if (sp.kind === "catch") p.y = (sp.world.ground ? H - GROUND : H) - p.h / 2;
    this._start = { x: p.x, y: p.y };
    this._safe = { x: p.x, y: p.y };
    this._loop = (sp.kind === "runner" || sp.kind === "fly") && sp.rules.win !== "goal";   // the world goes round until the rule is met
    this._spawn = sp.spawn.map(function (s) { return { s: s, t: Math.min(s.every, 0.9), n: 0 }; });
    this._total = 0;
    for (i = 0; i < this._ents.length; i++) if (this._ents[i].role === "collect") this._total++;
    this._left = this._total;
    this.score = 0; this.lives = sp.rules.lives; this.time = 0;
    this._t = 0; this._acc = 0; this._jbuf = 0; this._shake = 0; this._endT = 0; this._flash = 0;
    this._hover = sp.kind === "fly" ? 2.2 : 0;
    this._dragX = null; this._ptr = null; this._ptrs = {};
    this._release();
    this._snapCam();
    this._hud(true);
  };

  /* ------------------------------------------------------------------ */
  /* Camera                                                              */
  /* ------------------------------------------------------------------ */
  Game2D.prototype._camTarget = function () {
    var sp = this.spec, v = this._view, p = this._p, kind = sp.kind;
    if (kind === "catch") return [(sp.world.width - v.w) / 2, sp.world.height - v.h];
    if (kind === "runner" || kind === "fly") return [p.x - v.w * 0.26, p.y - v.h * 0.5];
    if (kind === "topdown") return [p.x - v.w / 2, p.y - v.h / 2];
    return [p.x - v.w / 2 + p.face * v.w * 0.08, p.y - v.h * 0.6];
  };
  Game2D.prototype._clampCam = function () {
    var w = this.spec.world, v = this._view, c = this._cam;
    if (!this._loop) c.x = v.w >= w.width ? (w.width - v.w) / 2 : clamp(c.x, 0, w.width - v.w);
    if (this.spec.kind === "topdown") c.y = v.h >= w.height ? (w.height - v.h) / 2 : clamp(c.y, 0, w.height - v.h);
    else c.y = v.h >= w.height ? w.height - v.h : clamp(c.y, 0, w.height - v.h);   // the bottom of the world sits at the bottom of the view
  };
  Game2D.prototype._snapCam = function () {
    if (!this._p) return;
    var t = this._camTarget();
    this._cam.x = t[0]; this._cam.y = t[1];
    this._clampCam();
  };
  Game2D.prototype._follow = function (dt) {
    var t = this._camTarget(), c = this._cam, kind = this.spec.kind, v = this._view, p = this._p;
    var kx = kind === "runner" || kind === "fly" ? 1 : Math.min(1, dt * 5.5), ky = Math.min(1, dt * 4.5);
    if (kind !== "topdown") {   // up and down the camera only moves when the player nears the edge, so a jump does not rock the view
      t[1] = p.y < c.y + v.h * 0.3 ? p.y - v.h * 0.3 : p.y > c.y + v.h * 0.72 ? p.y - v.h * 0.72 : c.y;
      ky = Math.min(1, dt * 7);
    }
    c.x += (t[0] - c.x) * kx; c.y += (t[1] - c.y) * ky;
    this._clampCam();
  };
  Game2D.prototype._toWorld = function (cx, cy) {
    var r = this._cv.getBoundingClientRect(), s = this._view.scale;
    return { x: this._cam.x + (cx - r.left) / s, y: this._cam.y + (cy - r.top) / s };
  };

  /* ------------------------------------------------------------------ */
  /* Input                                                               */
  /* ------------------------------------------------------------------ */
  Game2D.prototype._release = function () {
    this._keys = {}; this._ptrs = {}; this._ptr = null; this._dragX = null;
    if (this._pads) this._pads.forEach(function (pad) { pad._down = false; pad._keys.forEach(function (k) { k.classList.remove("is-down"); }); });
  };
  Game2D.prototype._press = function () { this._jbuf = 0.13; };
  Game2D.prototype._key = function (e, down) {
    if (this._dead) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    var k = (e.key || "").toLowerCase(), K = this._keys, kind = this.spec.kind, name = null;
    if (k === "arrowleft" || k === "a") name = "left";
    else if (k === "arrowright" || k === "d") name = "right";
    else if (k === "arrowup" || k === "w") name = "up";
    else if (k === "arrowdown" || k === "s") name = "down";
    else if (k === " " || k === "spacebar") name = "jump";
    if (down) this._gesture = true;
    if (this.state !== "playing") {
      if (!down || e.repeat) return;
      if (k === "p" && this.state === "paused") { this.resume(); return; }
      // Enter or space starts, when the keys are not meant for something else on the page
      var a = document.activeElement, here = !a || a === document.body || this.el.contains(a);
      if ((k === "enter" || k === " ") && here && !(a && a.classList && a.classList.contains("b-game__go")) && this._clock - this._scrAt > 0.6) { e.preventDefault(); this._go(); }
      return;
    }
    if (k === "p" && down && !e.repeat) { this.pause(); return; }
    if (!name) return;
    e.preventDefault();
    if (down && !e.repeat && (name === "jump" || (name === "up" && kind !== "topdown"))) this._press();
    if (name === "up" && kind !== "topdown") name = "jump";
    K[name] = down;
  };
  Game2D.prototype._pointer = function (e, phase) {
    if (this._dead || this.state !== "playing") { if (!phase) delete this._ptrs[e.pointerId]; return; }
    var kind = this.spec.kind, id = e.pointerId;
    if (phase === 1) {
      e.preventDefault();
      try { this._cv.setPointerCapture(id); } catch (x) { /* fine */ }
      this._ptrs[id] = true;
      if (kind === "runner" || kind === "fly") this._press();   // the whole screen is the button
    }
    if (!this._ptrs[id]) return;
    if (phase === 0) {
      delete this._ptrs[id];
      if (this._ptr && this._ptr.id === id) this._ptr = null;
      if (this._dragId === id) this._dragX = null;
      return;
    }
    if (kind === "catch") { this._dragX = this._toWorld(e.clientX, e.clientY).x; this._dragId = id; }
    else if (kind === "topdown") this._ptr = { id: id, x: e.clientX, y: e.clientY };
  };

  /* ------------------------------------------------------------------ */
  /* Sound                                                               */
  /* ------------------------------------------------------------------ */
  Game2D.prototype._beep = function (name) {
    if (!this.opts.sound || !this._gesture || this._dead) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext, def = SOUNDS[name];
      if (!AC || !def) return;
      var ac = this._ac || (this._ac = new AC());
      if (ac.state === "suspended" && ac.resume) ac.resume();
      var t0 = ac.currentTime + 0.01, i;
      for (i = 1; i < def.length; i++) {
        var n = def[i], osc = ac.createOscillator(), g = ac.createGain();
        osc.type = def[0];
        osc.frequency.setValueAtTime(n[0], t0 + n[2]);
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, n[1]), t0 + n[2] + n[3]);
        g.gain.setValueAtTime(0.0001, t0 + n[2]);
        g.gain.exponentialRampToValueAtTime(def[0] === "triangle" ? 0.09 : 0.045, t0 + n[2] + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[2] + n[3]);
        osc.connect(g); g.connect(ac.destination);
        osc.start(t0 + n[2]); osc.stop(t0 + n[2] + n[3] + 0.03);
      }
    } catch (e) { /* no sound is fine */ }
  };

  /* ------------------------------------------------------------------ */
  /* Events and state                                                    */
  /* ------------------------------------------------------------------ */
  Game2D.prototype._fail = function (e) {
    if (!this._err) { this._err = e; if (typeof console !== "undefined" && console.warn) console.warn("Blyant.Game2D:", e); }
  };
  Game2D.prototype._emit = function (name) {
    var list = this._on[name], info = { score: this.score, lives: this.lives, time: Math.round(this._t * 10) / 10 }, i;
    if (!list) return;
    list = list.slice();
    for (i = 0; i < list.length; i++) { try { list[i](info); } catch (e) { this._fail(e); } }
  };
  /** Listen for "start", "win", "lose", "score" or "hurt". fn gets { score, lives, time }. */
  Game2D.prototype.on = function (name, fn) {
    if (typeof name === "string" && typeof fn === "function") (this._on[name] = this._on[name] || []).push(fn);
    return this;
  };
  Game2D.prototype.off = function (name, fn) {
    var list = this._on[name], i = list ? list.indexOf(fn) : -1;
    if (i >= 0) list.splice(i, 1);
    return this;
  };
  Game2D.prototype._set = function (state) {
    this.state = state;
    if (this._root) this._root.setAttribute("data-state", state);
  };
  Game2D.prototype._go = function () {
    this._gesture = true;
    if (this.state === "paused") this.resume(); else this.start();
  };
  /** Start playing. After a win or a loss it starts a fresh round. */
  Game2D.prototype.start = function () {
    if (this._dead || this.state === "playing") return this;
    if (this.state === "paused") return this.resume();
    if (this.state !== "ready") this._build();
    this._set("playing");
    this._screen(null);
    this._last = 0;
    this._emit("start");
    return this;
  };
  Game2D.prototype.pause = function () {
    if (this._dead || this.state !== "playing") return this;
    this._set("paused");
    this._release();
    this._screen("paused");
    return this;
  };
  Game2D.prototype.resume = function () {
    if (this._dead || this.state !== "paused") return this;
    this._set("playing");
    this._screen(null);
    this._last = 0;
    return this;
  };
  /** Back to the start screen. */
  Game2D.prototype.reset = function () {
    if (this._dead) return this;
    this._build();
    this._set("ready");
    this._screen("start");
    return this;
  };
  Game2D.prototype.destroy = function () {
    if (this._dead) return;
    this._dead = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this._ro) this._ro.disconnect();
    if (this._mo) this._mo.disconnect();
    this._offs.forEach(function (off) { off(); });
    this._offs = [];
    this._imgWait.forEach(function (w) { try { w[0].removeEventListener("load", w[1]); } catch (e) { /* gone */ } });
    this._imgWait = [];
    try { if (this._ac && this._ac.close) this._ac.close(); } catch (e) { /* closed */ }
    this._ac = null;
    var el = this.el;
    if (this._root && this._root.parentNode === el) el.removeChild(this._root);
    el.classList.remove("b-game"); el.classList.remove("is-touch");
    if (this._posSet) el.style.position = "";
    dropCss();
    this._on = {}; this._cache = {}; this._notes = {}; this._sky = null; this._ents = []; this._parts = [];
  };
  Game2D.prototype._win = function () {
    if (this.state !== "playing") return;
    this._set("won"); this._endT = 0.9; this._release();
    this._beep("win");
    var p = this._p, i, cols = ["--dust-red", "--dust-yellow", "--dust-green", "--dust-blue", "--dust-purple", "--marker"];
    if (!this._reduced) for (i = 0; i < 26; i++) this._part(4, p.x + (this._rand() - 0.5) * 80, p.y - p.h * 0.3, (this._rand() - 0.5) * 700, -300 - this._rand() * 600, 1.1 + this._rand() * 0.6, cols[i % cols.length]);
    this._hud(true);
    this._emit("win");
  };
  Game2D.prototype._lose = function () {
    if (this.state !== "playing") return;
    this._set("lost"); this._endT = 0.8; this._release();
    this._beep("lose");
    this._hud(true);
    this._emit("lose");
  };

  /* ------------------------------------------------------------------ */
  /* The simulation: one fixed step                                      */
  /* ------------------------------------------------------------------ */
  function overlap(a, b, grow) {
    var g = grow || 0;
    return Math.abs(a.x - b.x) * 2 < a.cw + b.cw + g && Math.abs(a.y - b.y) * 2 < a.ch + b.ch + g;
  }
  Game2D.prototype._step = function (dt) {
    var sp = this.spec, ents = this._ents, i, e, n;
    this._t += dt; this.time = this._t;
    if (sp.rules.time != null && this._t >= sp.rules.time) {
      if (sp.rules.win === "survive") this._win(); else this._lose();
      return;
    }
    if (this._loop) this._laps();
    this._spawnTick(dt);
    for (i = 0, n = ents.length; i < n; i++) this._moveEnt(ents[i], dt);
    this._movePlayer(dt);
    if (this.state !== "playing") return;
    for (i = 0, n = ents.length; i < n; i++) { this._touchEnt(ents[i], dt); if (this.state !== "playing") break; }
    for (i = ents.length - 1; i >= 0; i--) {
      e = ents[i];
      if (e.gone) { if (e.owner) e.owner.n--; ents.splice(i, 1); if (e.role === "solid") this._solids.splice(this._solids.indexOf(e), 1); }
    }
    this._follow(dt);
  };

  /* runner and fly without a goal: the level comes round again, one world width further on */
  Game2D.prototype._laps = function () {
    var W = this.spec.world.width, ents = this._ents, mid = this._cam.x + this._view.w / 2, i, e, k;
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      if (e.from) continue;
      k = Math.round((mid - (e.hx - e.lap * W)) / W);   // the copy nearest the middle of the view
      if (k !== e.lap) {
        var shift = (k - e.lap) * W;
        e.lap = k; e.x += shift; e.hx += shift;
        if (e.tx != null) e.tx += shift;
        if (!e.alive && !(e.role === "collect" && this.spec.rules.win === "collect")) { e.alive = true; e.gone = false; e.pop = 0; e.x = e.hx; e.y = e.hy; e.vy = 0; e.sx = e.sy = 1; }
      }
    }
  };

  Game2D.prototype._spawnTick = function (dt) {
    var list = this._spawn, i, st;
    for (i = 0; i < list.length; i++) {
      st = list[i];
      st.t -= dt;
      if (st.t > 0) continue;
      st.t += st.s.every * (0.8 + this._rand() * 0.4);
      if (st.n < st.s.max) this._spawnOne(st);
    }
  };
  Game2D.prototype._spawnOne = function (st) {
    var sp = this.spec, s = st.s, v = this._view, cam = this._cam, rand = this._rand, W = sp.world.width, H = sp.world.height;
    var tpl = s.things[Math.floor(rand() * s.things.length) % s.things.length];
    var e = this._make(tpl, s.from, 5000 + Math.floor(rand() * 100000));
    var g = hasGround(sp.kind, sp.world), gt = H - GROUND, floor = g ? gt : Math.min(H, cam.y + v.h);
    var ramp = 1 + Math.min(0.4, this._t / 150);   // a little faster as the round goes on
    var speed = e.speed * ramp;
    if (s.from === "top") {
      var l = Math.max(cam.x, this._loop ? -Infinity : 0) + e.w / 2 + 6, r = Math.min(cam.x + v.w, this._loop ? Infinity : W) - e.w / 2 - 6;
      e.x = r > l ? l + rand() * (r - l) : (l + r) / 2;
      e.y = cam.y - e.h / 2 - 4;
      e.vy = e.move === "float" ? speed * 0.55 : speed;
    } else {
      var top = Math.max(cam.y, 0) + e.h / 2 + 34, bot = floor - e.h / 2 - 2;
      if (sp.kind === "runner" || sp.kind === "platform") top = Math.max(top, floor - 250 * sp.player.jump - this._p.h);   // where the player can reach
      e.y = e.move === "patrol" ? floor - e.h / 2 : bot <= top ? bot : top + rand() * (bot - top);
      e.x = s.from === "right" ? cam.x + v.w + e.w / 2 + 4 : cam.x - e.w / 2 - 4;
      e.vx = s.from === "right" ? -speed : speed;
      if (s.from === "left" && (sp.kind === "runner" || sp.kind === "fly")) e.vx += sp.player.speed * (sp.kind === "fly" ? 0.75 : 1);   // it has to catch up with the runner
      e.face = e.vx < 0 ? -1 : 1;
    }
    e.hx = e.x; e.hy = e.y; e.owner = st; st.n++;
    this._ents.push(e);
  };

  Game2D.prototype._moveEnt = function (e, dt) {
    var p = this._p, sp = this.spec, x0 = e.x, y0 = e.y, s = e.speed, half, d, ux, uy;
    if (e.sx !== 1) e.sx += (1 - e.sx) * Math.min(1, dt * 9);
    if (e.sy !== 1) e.sy += (1 - e.sy) * Math.min(1, dt * 9);
    if (e.sayT > 0) e.sayT -= dt;
    if (!e.alive) { if (e.pop > 0) { e.pop -= dt; if (e.pop <= 0 && e.from) e.gone = true; } return; }
    if (e.from) { this._moveSpawned(e, dt); e.dx = e.x - x0; e.dy = e.y - y0; return; }
    switch (e.move) {
      case "patrol":
        half = e.range / 2;
        if (e.axis === "y") {
          e.y += e.dir * s * dt;
          if (e.y > e.hy + half) { e.y = e.hy + half; e.dir = -1; } else if (e.y < e.hy - half) { e.y = e.hy - half; e.dir = 1; }
        } else {
          e.x += e.dir * s * dt;
          if (e.x > e.hx + half) { e.x = e.hx + half; e.dir = -1; } else if (e.x < e.hx - half) { e.x = e.hx - half; e.dir = 1; }
          if (e.role !== "solid") e.face = e.dir;
        }
        break;
      case "chase":
        ux = p.x - e.x; uy = p.y - e.y; d = Math.sqrt(ux * ux + uy * uy);
        if (d < 500 && d > 3) {
          if (e.axis === "x") { ux = ux < 0 ? -1 : 1; uy = 0; } else if (e.axis === "y") { ux = 0; uy = uy < 0 ? -1 : 1; } else { ux /= d; uy /= d; }
          if (e.role === "decor" && d < 70) break;   // a friend keeps a little distance
          e.x += ux * s * dt; e.y += uy * s * dt;
          if (Math.abs(ux) > 0.2) e.face = ux < 0 ? -1 : 1;
        }
        break;
      case "float":
        half = e.range / 2;
        e.ph += s / Math.max(12, half) * dt;
        if (e.axis === "x") e.x = e.hx + Math.sin(e.ph) * half; else e.y = e.hy + Math.sin(e.ph) * half;
        break;
      case "wander":
        if (e.wait > 0) { e.wait -= dt; break; }
        if (e.tx == null) {
          half = e.range / 2;
          e.tx = e.axis === "y" ? e.hx : e.hx + (this._rand() * 2 - 1) * half;
          e.ty = e.axis === "x" ? e.hy : e.hy + (this._rand() * 2 - 1) * half;
        }
        ux = e.tx - e.x; uy = e.ty - e.y; d = Math.sqrt(ux * ux + uy * uy);
        if (d <= s * dt + 0.5) { e.x = e.tx; e.y = e.ty; e.tx = null; e.wait = 0.3 + this._rand() * 1.2; }
        else { e.x += ux / d * s * dt; e.y += uy / d * s * dt; if (Math.abs(ux) > 2) e.face = ux < 0 ? -1 : 1; }
        break;
      case "fall":
        if (e.rest) break;
        e.vy = Math.min(e.vy + GRAV * dt, 1400);
        e.y += e.vy * dt;
        if (this._land(e)) { e.rest = true; e.vy = 0; if (!this._reduced) { e.sx = 1.2; e.sy = 0.8; } }
        else if (e.y - e.h > sp.world.height + 300) { e.alive = false; e.pop = 0; }
        break;
    }
    e.dx = e.x - x0; e.dy = e.y - y0;
  };
  /* a falling thing comes to rest on the ground or on a solid under it */
  Game2D.prototype._land = function (e) {
    var sp = this.spec, kind = sp.kind, i, s, b = e.y + e.h / 2;
    if (kind === "topdown") return false;
    if (hasGround(kind, sp.world) && b >= sp.world.height - GROUND) { e.y = sp.world.height - GROUND - e.h / 2; return true; }
    for (i = 0; i < this._solids.length; i++) {
      s = this._solids[i];
      if (s === e || !s.alive) continue;
      if (Math.abs(e.x - s.x) * 2 < e.w * 0.6 + s.w && b >= s.y - s.h / 2 && b - e.vy * STEP * 2 - 2 <= s.y - s.h / 2) { e.y = s.y - s.h / 2 - e.h / 2; return true; }
    }
    return false;
  };
  Game2D.prototype._moveSpawned = function (e, dt) {
    var sp = this.spec, p = this._p, cam = this._cam, v = this._view, top = e.from === "top", ux, uy, d, s;
    switch (e.move) {
      case "float":
        e.ph += 3 * dt;
        if (top) { e.hx += e.vx * dt; e.y += e.vy * dt; e.x = e.hx + Math.sin(e.ph) * 46; }
        else { e.x += e.vx * dt; e.y = e.hy + Math.sin(e.ph) * 46; }
        break;
      case "chase":
        ux = p.x - e.x; uy = p.y - e.y; d = Math.sqrt(ux * ux + uy * uy) || 1; s = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
        e.vx += (ux / d * s - e.vx) * Math.min(1, dt * 1.6); e.vy += (uy / d * s - e.vy) * Math.min(1, dt * 1.6);
        e.x += e.vx * dt; e.y += e.vy * dt;
        break;
      case "wander":
        e.wait -= dt;
        if (e.wait <= 0) { e.wait = 0.4 + this._rand() * 0.8; e.tx = (this._rand() * 2 - 1) * e.speed * 0.8; }
        if (top) { e.x += (e.tx || 0) * dt; e.y += e.vy * dt; } else { e.x += e.vx * dt; e.y += (e.tx || 0) * dt; }
        break;
      case "fall":
        if (!top) e.vy = Math.min(e.vy + GRAV * 0.3 * dt, 900);
        e.x += e.vx * dt; e.y += e.vy * dt;
        break;
      default:   // straight across (or along the ground for "patrol")
        e.x += e.vx * dt; e.y += e.vy * dt;
    }
    if (e.vx) e.face = e.vx < 0 ? -1 : 1;
    var g = hasGround(sp.kind, sp.world), gt = sp.world.height - GROUND;
    if (g && e.y + e.h / 2 > gt + 3 && (top || e.move === "fall" || e.move === "chase" || e.move === "wander")) {
      if (top || e.move === "fall") {   // it lands and is gone
        this._part(1, e.x, gt, 0, 0, 0.35);
        e.gone = true;
        return;
      }
      e.y = gt - e.h / 2;
    }
    if (e.y - e.h / 2 > cam.y + v.h + 60 || e.y + e.h / 2 < cam.y - 500 || e.x + e.w / 2 < cam.x - 260 || e.x - e.w / 2 > cam.x + v.w + 260) e.gone = true;
  };

  /* ---------- the player ---------- */
  Game2D.prototype._movePlayer = function (dt) {
    var sp = this.spec, kind = sp.kind, p = this._p, K = this._keys, W = sp.world.width, H = sp.world.height;
    var speed = sp.player.speed, jv = JUMP_V * Math.sqrt(sp.player.jump), hw = p.cw / 2, i, s;
    var g = hasGround(kind, sp.world), gt = H - GROUND;
    if (p.inv > 0) p.inv -= dt;
    if (this._jbuf > 0) this._jbuf -= dt;
    if (p.sx !== 1) p.sx += (1 - p.sx) * Math.min(1, dt * 10);
    if (p.sy !== 1) p.sy += (1 - p.sy) * Math.min(1, dt * 10);

    if (kind === "topdown") {
      var dx = (K.right ? 1 : 0) - (K.left ? 1 : 0), dy = (K.down ? 1 : 0) - (K.up ? 1 : 0), d;
      if (!dx && !dy && this._ptr) {   // walk toward the finger
        var w = this._toWorld(this._ptr.x, this._ptr.y), ex = w.x - p.x, ey = w.y - p.y;
        d = Math.sqrt(ex * ex + ey * ey);
        if (d > 12) { dx = ex / d; dy = ey / d; }
      } else if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
      var acc = 3600 * dt;
      p.vx += clamp(dx * speed - p.vx, -acc, acc); p.vy += clamp(dy * speed - p.vy, -acc, acc);
      if (Math.abs(dx) > 0.15) p.face = dx < 0 ? -1 : 1;
      p.x += p.vx * dt; this._pushOut(p, true);
      p.y += p.vy * dt; this._pushOut(p, false);
      p.x = clamp(p.x, hw, W - hw); p.y = clamp(p.y, p.ch / 2, H - p.ch / 2);
      p.walk += Math.sqrt(p.vx * p.vx + p.vy * p.vy) * dt;
      return;
    }

    if (kind === "catch") {
      var dir = (K.right ? 1 : 0) - (K.left ? 1 : 0);
      if (dir) p.vx = dir * speed * 1.25;
      else if (this._dragX != null) p.vx = clamp((this._dragX - p.x) * 16, -speed * 3.2, speed * 3.2);   // follow the finger
      else p.vx = 0;
      p.x = clamp(p.x + p.vx * dt, hw, W - hw);
      if (Math.abs(p.vx) > 30) p.face = p.vx < 0 ? -1 : 1;
      p.walk += Math.abs(p.vx) * dt;
      return;
    }

    if (kind === "fly") {
      var flap = this._jbuf > 0;
      p.vx = speed * 0.75; p.x += p.vx * dt; p.face = 1;
      if (this._hover > 0 && !flap) { this._hover -= dt; p.vy = 0; }   // hangs in the air until the first flap
      else {
        this._hover = 0;
        if (flap) { this._jbuf = 0; p.vy = -620 * Math.sqrt(sp.player.jump); this._beep("jump"); if (!this._reduced) { p.sx = 0.86; p.sy = 1.16; } }
        p.vy = Math.min(p.vy + 1700 * dt, 900);
        p.y += p.vy * dt;
      }
      p.tilt = clamp(p.vy / 1400, -0.4, 0.55);
      var fl = g ? gt : H;
      if (p.y - p.ch / 2 < 0) { p.y = p.ch / 2; p.vy = 160; this._hurt(null); }
      else if (p.y + p.ch / 2 > fl) { p.y = fl - p.ch / 2; p.vy = -640; this._hurt(null); }
      if (this.state !== "playing") return;
      if (p.inv <= 0) for (i = 0; i < this._solids.length; i++) {
        s = this._solids[i];
        if (s.alive && overlap(p, s)) { p.vy = -320; this._hurt(s); break; }
      }
      if (!this._loop && p.x >= W - hw) { p.x = W - hw; this._win(); }
      return;
    }

    /* platform and runner: gravity, a jump, solid ground */
    var ax = kind === "runner" ? 1 : (K.right ? 1 : 0) - (K.left ? 1 : 0);
    var a = (p.ground ? 4400 : 3000) * dt;
    p.vx += clamp(ax * speed - p.vx, -a, a);
    if (ax) p.face = ax;
    if (p.on && p.on.alive) { p.x += p.on.dx; p.y += p.on.dy; }   // carried by a moving platform
    p.coyote = p.ground ? 0.1 : p.coyote - dt;
    if (this._jbuf > 0) {
      var can = p.coyote > 0, second = !can && sp.player.doubleJump && p.jumps < 2;
      if (can || second) {
        p.vy = second ? -jv * 0.88 : -jv;
        p.jumps = second ? 2 : 1; p.ground = false; p.coyote = 0; p.on = null; this._jbuf = 0;
        if (!this._reduced) { p.sx = 0.78; p.sy = 1.26; }
        this._part(1, p.x, p.y + p.h / 2, 0, 0, 0.3);
        this._beep("jump");
      }
    }
    p.vy = Math.min(p.vy + GRAV * dt, 1500);
    var was = p.ground, vy0 = p.vy;
    p.x += p.vx * dt;
    for (i = 0; i < this._solids.length; i++) {   // walls
      s = this._solids[i];
      if (!s.alive || !overlap(p, s)) continue;
      var penX = Math.min(p.x + hw - (s.x - s.w / 2), s.x + s.w / 2 - (p.x - hw));
      if (penX > Math.abs(p.vx) * dt + Math.abs(s.dx) + 1.5) continue;   // not a sideways hit: the floor and ceiling pass sorts it out
      p.x = p.x < s.x ? s.x - s.w / 2 - hw - 0.01 : s.x + s.w / 2 + hw + 0.01;
      p.vx = 0;
    }
    p.prevB = p.y + p.ch / 2;
    p.y += p.vy * dt;
    p.ground = false; p.on = null;
    for (i = 0; i < this._solids.length; i++) {   // floors and ceilings
      s = this._solids[i];
      if (!s.alive || !overlap(p, s)) continue;
      var st = s.y - s.h / 2, sb = s.y + s.h / 2;
      if (p.y + p.ch / 2 - st <= sb - (p.y - p.ch / 2)) { p.y = st - p.ch / 2; if (p.vy > 0) p.vy = 0; p.ground = true; p.on = s.moving ? s : null; }
      else { p.y = sb + p.ch / 2 + 0.01; if (p.vy < 0) p.vy = 0; }
    }
    if (g && p.y + p.ch / 2 >= gt) { p.y = gt - p.ch / 2; if (p.vy > 0) p.vy = 0; p.ground = true; }
    if (p.ground) {
      p.jumps = 0;
      if (!was && vy0 > 380) {   // landing
        if (!this._reduced) { var q = clamp(vy0 / 1500, 0.2, 1); p.sx = 1 + 0.3 * q; p.sy = 1 - 0.3 * q; }
        this._part(1, p.x - 14, p.y + p.h / 2, 0, 0, 0.3); this._part(1, p.x + 14, p.y + p.h / 2, 0, 0, 0.3);
      }
      if (!p.on) { this._safe.x = p.x; this._safe.y = p.y; }
      p.walk += Math.abs(p.vx) * dt;
    }
    if (p.x < hw && !this._loop) { p.x = hw; if (p.vx < 0) p.vx = 0; }
    if (!this._loop && p.x >= W - hw) {
      p.x = W - hw; if (p.vx > 0) p.vx = 0;
      if (kind === "runner") { this._win(); return; }   // made it to the end of the world
    }
    if (p.y - p.h / 2 > H + 140) this._fell();
  };
  /* topdown walls: out the short way, along the axis that just moved */
  Game2D.prototype._pushOut = function (p, alongX) {
    var i, s;
    for (i = 0; i < this._solids.length; i++) {
      s = this._solids[i];
      if (!s.alive || !overlap(p, s)) continue;
      if (alongX) { p.x = p.x < s.x ? s.x - s.w / 2 - p.cw / 2 - 0.01 : s.x + s.w / 2 + p.cw / 2 + 0.01; p.vx = 0; }
      else { p.y = p.y < s.y ? s.y - s.h / 2 - p.ch / 2 - 0.01 : s.y + s.h / 2 + p.ch / 2 + 0.01; p.vy = 0; }
    }
  };
  Game2D.prototype._fell = function () {
    var p = this._p, kind = this.spec.kind;
    this.lives--;
    this._shake = this._reduced ? 0 : 0.35;
    this._beep("hurt");
    this._hud();
    this._emit("hurt");
    if (this.lives <= 0) { this._lose(); return; }
    if (kind === "runner") { p.x = this._safe.x - 40; p.y = this._safe.y - 20; }   // back on the last firm spot
    else { p.x = this._start.x; p.y = this._start.y; }
    p.vx = p.vy = 0; p.inv = 1.6; p.ground = false; p.on = null;
    this._snapCam();
  };
  Game2D.prototype._hurt = function (src) {
    var p = this._p, kind = this.spec.kind;
    if (p.inv > 0 || this.state !== "playing") return;
    this.lives--;
    p.inv = 1.6;
    this._shake = this._reduced ? 0 : 0.35;
    this._flash = 0.25;
    if (!this._reduced) { p.sx = 1.25; p.sy = 0.75; }
    if (kind === "platform") { p.vy = -520; p.vx = (src && src.x > p.x ? -1 : 1) * 300; p.ground = false; }
    else if (kind === "runner") { p.vy = Math.min(p.vy, -420); p.ground = false; }
    else if (kind === "topdown" && src) { var dx = p.x - src.x, dy = p.y - src.y, d = Math.sqrt(dx * dx + dy * dy) || 1; p.vx = dx / d * 520; p.vy = dy / d * 520; }
    for (var i = 0; i < 7; i++) this._part(0, p.x, p.y, Math.cos(i * 0.9) * 260, Math.sin(i * 0.9) * 260, 0.35, "--dust-red");
    this._beep("hurt");
    this._hud();
    this._emit("hurt");
    if (this.lives <= 0) this._lose();
  };
  Game2D.prototype._take = function (e) {
    var i;
    e.alive = false; e.pop = 0.28;
    this.score += e.t.points;
    if (!e.from) this._left = Math.max(0, this._left - 1);
    for (i = 0; i < 7; i++) { var a = i / 7 * 6.283 + 0.3; this._part(0, e.x, e.y, Math.cos(a) * 240, Math.sin(a) * 240, 0.38, i % 2 ? "--marker" : null); }
    if (e.t.points) this._part(2, e.x, e.y - e.h / 2, 0, -90, 0.8, null, "+" + e.t.points);
    this._beep("collect");
    this._hud();
    this._emit("score");
    this._checkWin();
  };
  Game2D.prototype._checkWin = function () {
    var r = this.spec.rules;
    if (r.win === "collect" && this._total > 0 && this._left <= 0) this._win();
    else if (r.win === "score" && this.score >= r.score) this._win();
  };
  Game2D.prototype._touchEnt = function (e, dt) {
    var p = this._p, kind = this.spec.kind, role = e.role;
    if (!e.alive || (role === "decor" && !e.say) || (role === "solid" && !e.say)) return;
    if (!overlap(p, e, role === "solid" ? 10 : 0)) return;
    if (e.say) e.sayT = 2.4;
    if (role === "collect") this._take(e);
    else if (role === "goal") { if (this.spec.rules.win === "goal") { e.sy = 1.2; this._win(); } }
    else if (role === "spring") {
      if ((kind === "platform" || kind === "runner") && p.vy >= 0) {
        p.vy = -JUMP_V * Math.sqrt(this.spec.player.jump) * 1.55; p.ground = false; p.on = null; p.jumps = 1; p.coyote = 0;
        if (!this._reduced) { e.sy = 0.45; e.sx = 1.2; p.sx = 0.75; p.sy = 1.3; }
        this._beep("spring");
      } else if (kind === "fly" && p.vy >= 0) { p.vy = -820; this._beep("spring"); }
    }
    else if (role === "hazard") {
      if (e.from && kind === "catch") { e.alive = false; e.pop = 0.2; if (p.inv <= 0) this._hurt(e); return; }
      var above = p.prevB <= e.y - e.ch / 2 + Math.max(14, e.ch * 0.5);
      if ((kind === "platform" || kind === "runner") && (e.moving || e.from) && p.vy > 60 && above) {   // jumped on it
        e.alive = false; e.pop = 0.3;
        p.vy = -620; p.jumps = 1; p.ground = false;
        this.score += 1;
        for (var i = 0; i < 6; i++) this._part(0, e.x, e.y, Math.cos(i * 1.05) * 220, -Math.abs(Math.sin(i * 1.05)) * 220 - 40, 0.35);
        this._part(2, e.x, e.y - e.h / 2, 0, -90, 0.8, null, "+1");
        this._beep("stomp");
        this._hud();
        this._emit("score");
        this._checkWin();
      } else this._hurt(e);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Particles: pencil sparkles, puffs of dust, "+1", confetti            */
  /* kind 0 spark, 1 puff, 2 text, 4 confetti                            */
  /* ------------------------------------------------------------------ */
  Game2D.prototype._part = function (kind, x, y, vx, vy, life, color, str) {
    if (this._parts.length > 160) this._parts.shift();
    if (this._reduced && kind !== 2) return;
    this._parts.push({ k: kind, x: x, y: y, vx: vx, vy: vy, life: life, max: life, color: color || null, str: str || null, rot: this._rand() * 6.283 });
  };
  Game2D.prototype._moveParts = function (dt) {
    var ps = this._parts, i, q;
    for (i = ps.length - 1; i >= 0; i--) {
      q = ps[i];
      q.life -= dt;
      if (q.life <= 0) { ps.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.k === 0) { q.vx *= 1 - Math.min(1, dt * 5); q.vy *= 1 - Math.min(1, dt * 5); }
      else if (q.k === 4) { q.vy += 900 * dt; q.vx *= 1 - Math.min(1, dt * 1.2); q.rot += dt * 7; }
    }
  };

  /* ------------------------------------------------------------------ */
  /* The frame                                                           */
  /* ------------------------------------------------------------------ */
  Game2D.prototype._frame = function (now) {
    if (this._dead) return;
    this._raf = requestAnimationFrame(this._tick);
    var dt = this._last ? clamp((now - this._last) / 1000, 0, 0.1) : 0;
    this._last = now;
    try { this._advance(dt); this._draw(); } catch (e) { this._fail(e); }
  };
  Game2D.prototype._advance = function (dt) {
    var n = 0;
    if (this._themeDirty) { this._theme(); this._hud(true); }
    if (this.state === "paused") return;
    this._clock += dt;
    if (this.state === "playing") {
      this._acc += dt;
      while (this._acc >= STEP && n++ < 24 && this.state === "playing") { this._step(STEP); this._acc -= STEP; }
      if (this._acc > STEP * 4) this._acc = 0;
      this._hud();
    } else if (this._endT > 0) {
      this._endT -= dt;
      if (this._endT <= 0) this._screen(this.state === "won" ? "won" : "lost");
    }
    if (this._shake > 0) this._shake -= dt;
    if (this._flash > 0) this._flash -= dt;
    this._moveParts(dt);
  };

  Game2D.prototype._draw = function () {
    var c = this._ctx, v = this._view, cam = this._cam, sp = this.spec, p = this._p, ents = this._ents;
    if (!c || v.cw < 2 || v.ch < 2 || !p) return;
    var dpr = this._dpr, s = v.scale, clock = this._clock, i, e, pass, k = dpr * s;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.clearRect(0, 0, this._cv.width, this._cv.height);
    var sky = this._skyWash();
    if (sky) c.drawImage(sky, 0, 0, this._cv.width, this._cv.height);
    var shx = 0, shy = 0;
    if (this._shake > 0 && !this._reduced) { var amp = this._shake / 0.35 * 7 * dpr; shx = (hash2(7, Math.floor(clock * 60)) - 0.5) * 2 * amp; shy = (hash2(9, Math.floor(clock * 60)) - 0.5) * 2 * amp; }
    var tx = Math.round(-cam.x * k + shx), ty = Math.round(-cam.y * k + shy);
    c.setTransform(k, 0, 0, k, tx, ty);
    c.imageSmoothingEnabled = true;
    var bi = this._reduced ? -1 : Math.floor(clock * 6);   // the drawings boil at six frames a second
    var g = hasGround(sp.kind, sp.world), gt = sp.world.height - GROUND;

    if (sp.kind === "topdown") {
      var fx0 = Math.max(0, Math.floor(cam.x / TILE)), fx1 = Math.min(Math.floor((sp.world.width - 1) / TILE), Math.floor((cam.x + v.w) / TILE)), fy0 = Math.max(0, Math.floor(cam.y / TILE)), fy1 = Math.min(Math.floor((sp.world.height - 1) / TILE), Math.floor((cam.y + v.h) / TILE)), fj;
      for (fj = fy0; fj <= fy1; fj++) for (i = fx0; i <= fx1; i++) c.drawImage(this._floor((i * 2 + fj * 3) % 4), i * TILE, fj * TILE, TILE, TILE);
    }
    for (pass = 0; pass < 4; pass++) {
      if (pass === 1 && g) {   // the ground goes in front of the far decor and behind everything else
        var up = 16 / s, i0 = Math.floor((cam.x - 4) / TILE), i1 = Math.floor((cam.x + v.w + 4) / TILE);
        for (i = i0; i <= i1; i++) c.drawImage(this._tile(((i % 3) + 3) % 3), i * TILE, gt - up, TILE, GROUND + up);
      }
      for (i = 0; i < ents.length; i++) { e = ents[i]; if (e.pass === pass) this._drawEnt(c, e, bi, clock); }
      if (pass === 2) this._drawEnt(c, p, bi, clock);
    }
    this._drawParts(c);
    for (i = 0; i < ents.length; i++) { e = ents[i]; if (e.sayT > 0 && e.say) this._drawNote(c, e); }
    if (this._flash > 0 && !this._reduced) {   // a red pencil smear around the edge when it hurts
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalAlpha = Math.min(1, this._flash / 0.25) * 0.5; c.strokeStyle = this._cols.get("--dust-red"); c.lineWidth = 14;
      c.strokeRect(3, 3, v.cw - 6, v.ch - 6);
      c.globalAlpha = 1;
    }
  };
  Game2D.prototype._drawEnt = function (c, e, bi, clock) {
    var v = this._view, cam = this._cam, s = v.scale, role = e.role, w = e.w, h = e.h, x = e.x, y = e.y, spr = e.spr;
    if (role === "decor" && e.t.parallax < 1) x += (cam.x + v.w / 2 - x) * (1 - e.t.parallax);   // far things lag behind the camera
    if (x + w / 2 + 30 < cam.x || x - w / 2 - 30 > cam.x + v.w || y + h / 2 + 40 < cam.y || y - h / 2 - 40 > cam.y + v.h) return;
    var alpha = 1, rot = 0, sx = e.sx, sy = e.sy, oy = 0, p = this._p;
    if (!e.alive) {
      if (e.pop <= 0) return;
      if (role === "collect") { var q = 1 - e.pop / 0.28; sx *= 1 + q * 0.6; sy *= 1 + q * 0.6; alpha = 1 - q; oy = -q * 26; }
      else { var q2 = e.pop / 0.3; sy *= 0.25 + 0.2 * q2; sx *= 1.25; alpha = Math.min(1, q2 * 2); }
    }
    if (role === "solid" && !spr.image && !spr.shape) { this._drawSolid(c, e); return; }
    if (bi >= 0 && role !== "solid") {
      rot += (hash2(e.seed, bi) - 0.5) * 0.045;
      var bs = 1 + (hash2(e.seed + 3, bi) - 0.5) * 0.028;
      sx *= bs; sy *= 2 - bs;
    }
    if (role === "collect" && e.alive && !e.from && bi >= 0) oy += Math.sin(clock * 3.2 + e.ph) * 5;
    if (role === "goal" && bi >= 0) { var pu = 1 + Math.sin(clock * 4.4) * 0.05; sx *= pu; sy *= pu; }
    if (e === p) {
      if (p.inv > 0 && this.state === "playing" && Math.floor(clock * 11) % 2) alpha = 0.25;   // blinks while it cannot be hurt
      if (this.spec.kind === "fly") rot += p.tilt;
      else if (bi >= 0 && (p.ground || this.spec.kind === "topdown" || this.spec.kind === "catch")) { rot += Math.sin(p.walk * 0.085) * 0.07 * clamp(Math.abs(p.vx) + Math.abs(this.spec.kind === "topdown" ? p.vy : 0), 0, 200) / 200; }
      if (this.state === "won" && bi >= 0) oy -= Math.abs(Math.sin(clock * 7)) * 22;
    }
    c.save();
    c.translate(x, y + h / 2 + oy);
    if (rot) c.rotate(rot);
    c.scale((role === "solid" ? 1 : e.face) * sx, sy);
    if (alpha < 1) c.globalAlpha = alpha;
    var done = false;
    if (spr.image) {
      try { c.drawImage(spr.image, -w / 2, -h, w, h); done = true; } catch (err) { spr.image = null; }   // a picture that has gone away: use a shape instead
    }
    if (!done) {
      var name = spr.shape || defaultShape(e.t, this.spec.kind, this.spec.world, e.from, e.index) || "box";
      blit(c, this._shape(name, spr.color, w, h), -w / 2, -h, w, h);
    }
    c.restore();
  };
  /* a pencil box of any size, laid in pieces so no canvas gets too large */
  Game2D.prototype._drawSolid = function (c, e) {
    var v = this._view, cam = this._cam, s = v.scale, maxU = 560 / s;
    var nx = Math.ceil(e.w / maxU), ny = Math.ceil(e.h / maxU), cw = e.w / nx, ch = e.h / ny, x0 = e.x - e.w / 2, y0 = e.y - e.h / 2, i, j;
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
      var x = x0 + i * cw, y = y0 + j * ch;
      if (x + cw < cam.x - 20 || x > cam.x + v.w + 20 || y + ch < cam.y - 20 || y > cam.y + v.h + 20) continue;
      var edges = (j === 0 ? 1 : 0) | (i === nx - 1 ? 2 : 0) | (j === ny - 1 ? 4 : 0) | (i === 0 ? 8 : 0);
      blit(c, this._box(cw, ch, e.spr.color, edges, (e.index + i * 3 + j * 5) % 3), x, y, cw, ch);
    }
  };
  Game2D.prototype._drawParts = function (c) {
    var ps = this._parts, cols = this._cols, s = this._view.scale, i, q, a;
    c.lineCap = "round";
    for (i = 0; i < ps.length; i++) {
      q = ps[i]; a = clamp(q.life / q.max, 0, 1);
      c.globalAlpha = a;
      if (q.k === 0) {
        c.strokeStyle = q.color ? cols.get(q.color) : cols.line; c.lineWidth = 2 / s;
        c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 0.05 - Math.cos(q.rot) * 3 / s, q.y - q.vy * 0.05 - Math.sin(q.rot) * 3 / s); c.stroke();
      } else if (q.k === 1) {
        c.strokeStyle = cols.line; c.lineWidth = 1.4 / s;
        var r = (5 + (1 - a) * 12) / s;
        c.beginPath(); c.arc(q.x, q.y - r * 0.6, r, Math.PI * 1.05 + q.rot * 0.1, Math.PI * 2.1 + q.rot * 0.1); c.stroke();
      } else if (q.k === 2) {
        c.fillStyle = cols.ink; c.font = "700 " + Math.round(30 / s) + "px " + this._font; c.textAlign = "center";
        c.fillText(q.str, q.x, q.y);
      } else {
        c.strokeStyle = cols.get(q.color || "--marker"); c.lineWidth = 3.4 / s;
        c.beginPath(); c.moveTo(q.x - Math.cos(q.rot) * 7 / s, q.y - Math.sin(q.rot) * 7 / s); c.lineTo(q.x + Math.cos(q.rot) * 7 / s, q.y + Math.sin(q.rot) * 7 / s); c.stroke();
      }
    }
    c.globalAlpha = 1;
  };
  Game2D.prototype._drawNote = function (c, e) {
    var cv = this._note(e.say), v = this._view, cam = this._cam, s = v.scale;
    var w = cv._w / s, h = cv._h / s, pop = clamp((2.4 - e.sayT) / 0.14, 0, 1), fade = clamp(e.sayT / 0.25, 0, 1);
    var x = clamp(e.x, cam.x + w / 2 + 4 / s, cam.x + v.w - w / 2 - 4 / s), y = Math.max(cam.y + h + 50 / s, e.y - e.h / 2 - 6 / s);
    c.save();
    c.translate(x, y);
    c.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    c.rotate(-0.025);
    c.globalAlpha = fade;
    c.drawImage(cv, -w / 2, -h, w, h);
    c.restore();
  };

  /* ------------------------------------------------------------------ */
  /* HUD and screens (HTML over the canvas)                               */
  /* ------------------------------------------------------------------ */
  Game2D.prototype._hud = function (force) {
    if (!this._livesEl) return;
    var r = this.spec.rules, i, lives = Math.max(0, this.lives);
    if (force || this._hudLives !== lives) {
      this._hudLives = lives;
      this._livesEl.textContent = "";
      for (i = 0; i < r.lives; i++) heartIcon(this._livesEl, i < lives, 31 + i * 7);
      this._livesEl.setAttribute("aria-label", lives + " liv");
    }
    var sc = r.win === "score" ? this.score + " / " + r.score : r.win === "collect" ? (this._total - this._left) + " / " + this._total : String(this.score);
    if (force || this._hudScore !== sc) { this._hudScore = sc; this._scoreEl.textContent = sc; }
    var tm = "";
    if (r.time != null) { var left = Math.max(0, Math.ceil(r.time - this._t)); tm = Math.floor(left / 60) + ":" + (left % 60 < 10 ? "0" : "") + (left % 60); }
    if (force || this._hudTime !== tm) { this._hudTime = tm; this._timeEl.textContent = tm; }
  };
  var HINTS = {
    platform: ["Piltaster for å gå, mellomrom for å hoppe.", "Trykk på pilene for å gå og på knappen for å hoppe."],
    topdown: ["Gå med piltastene.", "Hold fingeren der du vil gå."],
    "catch": ["Piltaster til venstre og høyre.", "Dra fingeren til venstre og høyre."],
    runner: ["Mellomrom for å hoppe.", "Trykk på skjermen for å hoppe."],
    fly: ["Mellomrom for å fly oppover.", "Trykk på skjermen for å fly oppover."]
  };
  Game2D.prototype._screen = function (which) {
    var scr = this._scr, sp = this.spec, d = document;
    if (!scr) return;
    scr.textContent = "";
    scr.classList.toggle("is-open", !!which);
    this._scrAt = this._clock;
    if (!which) return;
    var card = d.createElement("div");
    card.className = "b-game__card";
    function add(tag, cls, str) { var n = d.createElement(tag); n.className = cls; if (str != null) n.textContent = str; card.appendChild(n); return n; }
    var label = "Start";
    if (which === "start") {
      if (sp.title) add("h2", "b-game__title", sp.title);
      add("p", sp.title ? "b-game__text" : "b-game__title", sp.text.start);
    } else if (which === "paused") {
      add("h2", "b-game__title", "Pause");
      label = "Fortsett";
    } else {
      add("h2", "b-game__title", which === "won" ? sp.text.win : sp.text.lose);
      if (which === "won" || this.score > 0) {
        var pts = add("p", "b-game__points", null);
        starIcon(pts);
        pts.appendChild(d.createTextNode(this.score + " poeng"));
      }
      label = which === "won" ? "Spill igjen" : "Prøv igjen";
      if (which === "lost" && sp.text.lose.toLowerCase().replace(/[.!]/g, "") === "prøv igjen") label = "En gang til";   // not the same words twice
    }
    var btn = add("button", "b-btn b-btn--marker b-game__go", label);
    btn.type = "button";
    if (which === "start") add("p", "b-game__hint", HINTS[sp.kind][this._touch ? 1 : 0]);
    scr.appendChild(card);
    try { if (B.ink) B.ink(scr); } catch (e) { this._fail(e); }
  };

  /** The names of the built-in shapes. */
  Game2D.shapes = Object.keys(SHAPES);
  /** The spec the rig would run: numbers clamped, unknown values replaced, exactly one player. Pure, no DOM. */
  Game2D.clean = clean;
  /** The thickness of the ground in world units: the ground's top edge is at world.height − 80. */
  Game2D.GROUND = GROUND;

  B.Game2D = Game2D;
  if (typeof window !== "undefined") { window.Blyant = Object.assign(window.Blyant || {}, B); }
})();
