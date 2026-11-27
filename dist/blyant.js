/* @ds-bundle: {"format":4,"namespace":"Blyant","components":[{"name":"Button"},{"name":"Field"},{"name":"Check"},{"name":"Box"},{"name":"Note"},{"name":"Tag"},{"name":"Marker"},{"name":"Nav"},{"name":"Tabs"},{"name":"Table"},{"name":"Placeholder"},{"name":"Slide"},{"name":"Rough"},{"name":"Sketch3D"},{"name":"Sketch2D"},{"name":"Paint"},{"name":"Game2D"},{"name":"HexBoard"},{"name":"LineChart"},{"name":"BarChart"},{"name":"ScatterChart"},{"name":"Segments"},{"name":"Stat"},{"name":"Frames"},{"name":"Prose"},{"name":"Sidenote"},{"name":"Entries"},{"name":"Empty"},{"name":"Menu"},{"name":"Toast"},{"name":"Sheet"},{"name":"Editor"},{"name":"Toolbar"},{"name":"Checklist"},{"name":"LinkCard"},{"name":"Thread"}]} */
/* Blyant — hand-drawn pencil design system. Vanilla JS, no dependencies.
   Sketch3D needs window.THREE (three.js r147 UMD) loaded first.
   Sketch2D (blyant-sketch2d.js) needs nothing but WebGL.
   Paint (blyant-paint.js) and Game2D (blyant-game2d.js) need only canvas 2D. */
(function () {
  "use strict";
  var B = {};
  var NS = "http://www.w3.org/2000/svg";

  /* ------------------------------------------------------------------ */
  /* Random + helpers                                                    */
  /* ------------------------------------------------------------------ */
  function rng(seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function f(n) { return Math.round(n * 100) / 100; }
  function opts(o) {
    o = o || {};
    var R = o.rand || rng(o.seed != null ? o.seed : 1);
    return {
      r: R,
      wobble: o.wobble != null ? +o.wobble : 1.2,
      bow: o.bow != null ? o.bow : 1,
      passes: o.passes != null ? o.passes : 2,
      gap: o.gap || 7,
      angle: o.angle != null ? o.angle : -41
    };
  }
  function off(o, amt) { return (o.r() * 2 - 1) * amt * o.wobble; }

  /* ------------------------------------------------------------------ */
  /* Rough geometry → SVG path data                                     */
  /* ------------------------------------------------------------------ */
  function stroke1(x1, y1, x2, y2, o, pass) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var amp = Math.min(len * 0.012 + 0.6, 3.2);          // endpoint wiggle
    var bow = Math.min(len * 0.018, 4.5) * o.bow;          // belly of the stroke
    var nx = -dy / len, ny = dx / len;
    var b1 = off(o, bow), b2 = off(o, bow);
    // overshoot / undershoot like a quick hand
    var over = pass ? off(o, 1.6) : off(o, 0.8);
    var sx = x1 + off(o, amp) - dx / len * over, sy = y1 + off(o, amp) - dy / len * over;
    var ex = x2 + off(o, amp) + dx / len * over, ey = y2 + off(o, amp) + dy / len * over;
    var c1x = x1 + dx * (0.3 + off(o, 0.06)) + nx * b1, c1y = y1 + dy * (0.3 + off(o, 0.06)) + ny * b1;
    var c2x = x1 + dx * (0.7 + off(o, 0.06)) + nx * b2, c2y = y1 + dy * (0.7 + off(o, 0.06)) + ny * b2;
    return "M" + f(sx) + " " + f(sy) + "C" + f(c1x) + " " + f(c1y) + " " + f(c2x) + " " + f(c2y) + " " + f(ex) + " " + f(ey);
  }

  function line(x1, y1, x2, y2, o) {
    o = opts(o);
    if (!o.wobble) return "M" + f(x1) + " " + f(y1) + "L" + f(x2) + " " + f(y2);
    var d = "";
    for (var p = 0; p < o.passes; p++) d += stroke1(x1, y1, x2, y2, o, p);
    return d;
  }

  function poly(pts, closed, o) {
    o = opts(o);
    var d = "", n = pts.length, last = closed ? n : n - 1;
    if (!o.wobble) {
      d = "M" + pts.map(function (p) { return f(p[0]) + " " + f(p[1]); }).join("L");
      return closed ? d + "Z" : d;
    }
    for (var p = 0; p < o.passes; p++)
      for (var i = 0; i < last; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        d += stroke1(a[0], a[1], b[0], b[1], o, p);
      }
    return d;
  }

  function rect(x, y, w, h, o) {
    return poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, o);
  }

  function ellipse(cx, cy, rx, ry, o) {
    o = opts(o);
    if (!o.wobble) {
      return "M" + f(cx - rx) + " " + f(cy) + "a" + f(rx) + " " + f(ry) + " 0 1 0 " + f(rx * 2) + " 0a" + f(rx) + " " + f(ry) + " 0 1 0 " + f(-rx * 2) + " 0Z";
    }
    var d = "";
    for (var p = 0; p < o.passes; p++) {
      var steps = Math.max(9, Math.round((rx + ry) / 7));
      var start = o.r() * Math.PI * 2;
      var sweep = Math.PI * 2 + 0.35 + o.r() * 0.45;      // overlap at the end
      var pts = [];
      for (var i = 0; i <= steps; i++) {
        var t = start + sweep * (i / steps);
        var k = 1 + off(o, 0.035) + (i / steps) * off(o, 0.02);
        pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
      }
      d += curve(pts);
    }
    return d;
  }

  // Catmull-Rom through points → cubic beziers
  function curve(pts) {
    var d = "M" + f(pts[0][0]) + " " + f(pts[0][1]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += "C" + f(p1[0] + (p2[0] - p0[0]) / 6) + " " + f(p1[1] + (p2[1] - p0[1]) / 6) + " " +
        f(p2[0] - (p3[0] - p1[0]) / 6) + " " + f(p2[1] - (p3[1] - p1[1]) / 6) + " " + f(p2[0]) + " " + f(p2[1]);
    }
    return d;
  }

  function hexPoints(cx, cy, r, flat) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i + (flat ? 0 : 30));
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }
  function hex(cx, cy, r, o, flat) { return poly(hexPoints(cx, cy, r, flat), true, o); }

  function arrow(x1, y1, x2, y2, o) {
    var oo = Object.assign({}, o || {});
    // a slightly curved shaft, drawn as one stroke pass + head
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len, bend = (oo.bend != null ? oo.bend : 0.12) * len;
    var mx = (x1 + x2) / 2 + nx * bend, my = (y1 + y2) / 2 + ny * bend;
    var oO = opts(oo);
    var d = "M" + f(x1) + " " + f(y1) + "Q" + f(mx + off(oO, 2)) + " " + f(my + off(oO, 2)) + " " + f(x2) + " " + f(y2);
    var ang = Math.atan2(y2 - my, x2 - mx), hl = Math.min(16, len * 0.25);
    var a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82;
    oo.passes = 1;
    d += line(x2, y2, x2 + Math.cos(a1) * hl, y2 + Math.sin(a1) * hl, oo);
    d += line(x2, y2, x2 + Math.cos(a2) * hl, y2 + Math.sin(a2) * hl, oo);
    return d;
  }

  // Hachure fill: parallel strokes clipped to a polygon (even-odd)
  function hatch(pts, o) {
    o = opts(o);
    var ang = o.angle * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    var rot = pts.map(function (p) { return [p[0] * ca + p[1] * sa, -p[0] * sa + p[1] * ca]; });
    var minY = Infinity, maxY = -Infinity;
    rot.forEach(function (p) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    var d = "", oneO = { wobble: o.wobble * 0.7, passes: 1, rand: o.r, bow: 0.5 };
    for (var y = minY + o.gap * 0.5; y < maxY; y += o.gap) {
      var xs = [];
      for (var i = 0; i < rot.length; i++) {
        var a = rot[i], b = rot[(i + 1) % rot.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        var xa = xs[k] + 1.5, xb = xs[k + 1] - 1.5;
        if (xb - xa < 2) continue;
        var A = [xa * ca - y * sa, xa * sa + y * ca], Bp = [xb * ca - y * sa, xb * sa + y * ca];
        d += line(A[0], A[1], Bp[0], Bp[1], oneO);
      }
    }
    return d;
  }

  function scribble(pts, o) {   // free-hand curve through points
    o = opts(o);
    var jit = pts.map(function (p) { return [p[0] + off(o, 1.2), p[1] + off(o, 1.2)]; });
    return curve(jit);
  }

  B.rough = {
    rng: rng, line: line, poly: poly, rect: rect, ellipse: ellipse, circle: function (cx, cy, r, o) { return ellipse(cx, cy, r, r, o); },
    hex: hex, hexPoints: hexPoints, arrow: arrow, hatch: hatch, curve: curve, scribble: scribble
  };

  /* ------------------------------------------------------------------ */
  /* SVG helpers                                                        */
  /* ------------------------------------------------------------------ */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  B.svg = function (w, h, parent, attrs) {
    var s = el("svg", Object.assign({ viewBox: "0 0 " + w + " " + h, width: w, height: h }, attrs || {}), parent);
    return s;
  };
  /** Draw a path on an svg. style: {stroke, width, fill, opacity, fillOpacity, dash, grain} */
  B.draw = function (svg, d, style) {
    style = style || {};
    var box = style.grain === false ? null : pathBox(d);
    return el("path", {
      d: d,
      fill: style.fill || "none",
      "fill-opacity": style.fillOpacity,
      stroke: style.stroke === undefined ? "currentColor" : style.stroke,
      "stroke-width": style.width || 1.6,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "stroke-dasharray": style.dash,
      opacity: style.opacity,
      filter: box ? B.grainFilter(svg, box, style.stroke === "none" ? 0 : +(style.width || 1.6)) : null
    }, svg);
  };
  /** Like draw, but a path too large for one grain region is drawn as one <path> per subpath, so it keeps its grain. */
  B.drawParts = function (svg, d, style) {
    var p = B.draw(svg, d, style);
    if (p.hasAttribute("filter") || (style && style.grain === false) || typeof document === "undefined") return [p];
    var parts = String(d).split(/(?=[Mm])/);
    if (parts.length < 2 || parts.slice(1).some(function (s) { return s.charAt(0) === "m"; })) return [p];
    svg.removeChild(p);
    return parts.map(function (s) { return B.draw(svg, s, style); });
  };
  // CSS variables are not valid in every browser's SVG presentation attributes: move them to style.
  var _el = el;
  el = function (tag, attrs, parent) {
    var e = _el(tag, attrs, parent);
    ["fill", "stroke"].forEach(function (k) {
      var v = attrs && attrs[k];
      if (typeof v === "string" && v.indexOf("var(") >= 0) e.style[k] = v;
    });
    return e;
  };

  /* Graphite grain: an SVG filter that eats specks out of a stroke.
     WebKit (Safari, every browser on iPhone) refuses a filter region larger than 4096 × 4096 device
     pixels and then draws nothing at all, so the region must follow the path, not cover the world.
     Each path gets a region around its own bounding box, snapped to a coarse grid so that thousands
     of paths share a handful of filters. A path too large for the budget at 3× is drawn without grain. */
  var GRAIN_AREA = 4096 * 4096 * 0.94;   // WebKit's cap, in device pixels, with a little room
  var grainDefs = null, grainMade = {};
  function grainDef(id, x, y, w, h) {
    if (!grainDefs || !grainDefs.isConnected) {
      var old = document.getElementById("b-graphite-defs");
      if (old) grainDefs = old;
      else {
        var s = el("svg", { id: "b-graphite-defs", width: 0, height: 0, "aria-hidden": "true", focusable: "false", style: "position:absolute;width:0;height:0;overflow:hidden" });
        grainDefs = el("defs", {}, s);
        (document.body || document.documentElement).appendChild(s);
      }
      grainMade = {};
    }
    if (grainMade[id] || document.getElementById(id)) return (grainMade[id] = 1);
    var fl = el("filter", { id: id, filterUnits: "userSpaceOnUse", x: x, y: y, width: w, height: h }, grainDefs);
    fl.innerHTML = '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.35" result="m"/>' +
      '<feComposite in="SourceGraphic" in2="m" operator="in"/>';
    grainMade[id] = 1;
  }
  // Region edges snap to an 8th of the next power of two (at least 32 units), so near sizes share a filter.
  function grainStep(n) { return Math.max(32, Math.pow(2, Math.ceil(Math.log(Math.max(n, 1)) / Math.LN2) - 3)); }
  function grainNum(n) { return (n < 0 ? "m" : "") + Math.abs(n); }
  /** The grain filter for a box in the svg's user units ({x, y, w, h}, stroke width sw), as "url(#…)",
      or null when the box is too large to grain safely. Without a box: a region from the svg's viewBox. */
  B.grainFilter = function (svg, box, sw) {
    if (typeof document === "undefined") return null;
    if (!box) {
      var vb = svg && svg.viewBox && svg.viewBox.baseVal;
      if (vb && vb.width && vb.height) box = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
      else { grainDef("b-graphite", -40, -40, 1300, 1300); return "url(#b-graphite)"; }   // the old id, at a size WebKit draws
    }
    var pad = (sw || 0) + 3, gx = grainStep(box.w + pad * 2), gy = grainStep(box.h + pad * 2);
    var x = Math.floor((box.x - pad) / gx) * gx, y = Math.floor((box.y - pad) / gy) * gy;
    var w = Math.ceil((box.x + box.w + pad) / gx) * gx - x, h = Math.ceil((box.y + box.h + pad) / gy) * gy - y;
    var k = Math.max(typeof window !== "undefined" && window.devicePixelRatio || 1, 3);
    if (!(w * h * k * k <= GRAIN_AREA)) return null;
    var id = "b-graphite-" + grainNum(x) + "_" + grainNum(y) + "_" + w + "_" + h;
    grainDef(id, x, y, w, h);
    return "url(#" + id + ")";
  };

  /* Bounding box of SVG path data, control points included (a safe superset), or null if it can't be read. */
  var NUM_RE = /[\s,]*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/y, FLAG_RE = /[\s,]*([01])/y, CMD_RE = /[\s,]*([MmLlHhVvCcSsQqTtAaZz])/y;
  var ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  function pathBox(d) {
    d = String(d || "");
    var p = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, qx = 0, qy = 0, last = "";
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    function add(px, py) { if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
    function read(re) { re.lastIndex = p; var m = re.exec(d); if (!m) return null; p = re.lastIndex; return m[1]; }
    while (p < d.length) {
      if (/^[\s,]*$/.test(d.slice(p))) break;
      var c = read(CMD_RE);
      if (c) cmd = c; else if (!cmd || cmd === "z" || cmd === "Z") return null;
      var lc = cmd.toLowerCase(), rel = cmd === lc, a = [];
      for (var i = 0; i < ARGS[lc]; i++) {
        var v = read(lc === "a" && (i === 3 || i === 4) ? FLAG_RE : NUM_RE);
        if (v === null) return null;
        a.push(+v);
      }
      var ox = rel ? x : 0, oy = rel ? y : 0, prev = last;
      last = lc;
      if (lc === "z") { x = sx; y = sy; continue; }
      // s and t reflect the previous control point; remember the last one in (qx, qy)
      if (lc === "s" || lc === "t") {
        var smooth = lc === "s" ? prev === "c" || prev === "s" : prev === "q" || prev === "t";
        var rx = smooth ? 2 * x - qx : x, ry = smooth ? 2 * y - qy : y;
        add(rx, ry);
        if (lc === "t") { qx = rx; qy = ry; }
      }
      if (lc === "h") x = ox + a[0];
      else if (lc === "v") y = oy + a[0];
      else if (lc === "a") { arcBox(x, y, a, ox + a[5], oy + a[6], add); x = ox + a[5]; y = oy + a[6]; }
      else {
        for (var j = 0; j < a.length; j += 2) add(ox + a[j], oy + a[j + 1]);
        if (lc === "c" || lc === "s" || lc === "q") { qx = ox + a[a.length - 4]; qy = oy + a[a.length - 3]; }
        x = ox + a[a.length - 2]; y = oy + a[a.length - 1];
      }
      add(x, y);
      if (lc === "m") { sx = x; sy = y; cmd = rel ? "l" : "L"; }
    }
    return x0 <= x1 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }
  // The whole ellipse an arc lies on (SVG arc endpoint → centre conversion).
  function arcBox(px, py, a, ex, ey, add) {
    var rx = Math.abs(a[0]), ry = Math.abs(a[1]), phi = a[2] * Math.PI / 180, co = Math.cos(phi), si = Math.sin(phi);
    if (!rx || !ry) return;
    var dx = (px - ex) / 2, dy = (py - ey) / 2, xp = co * dx + si * dy, yp = -si * dx + co * dy;
    var lam = xp * xp / (rx * rx) + yp * yp / (ry * ry);
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    var den = rx * rx * yp * yp + ry * ry * xp * xp;
    var q = den ? Math.sqrt(Math.max(0, (rx * rx * ry * ry - den) / den)) * (a[3] === a[4] ? -1 : 1) : 0;
    var cx = co * (q * rx * yp / ry) - si * (-q * ry * xp / rx) + (px + ex) / 2;
    var cy = si * (q * rx * yp / ry) + co * (-q * ry * xp / rx) + (py + ey) / 2;
    var hx = Math.sqrt(rx * rx * co * co + ry * ry * si * si), hy = Math.sqrt(rx * rx * si * si + ry * ry * co * co);
    add(cx - hx, cy - hy); add(cx + hx, cy + hy);
  }
  B.pathBox = pathBox;

  function cssNum(node, name, fallback) {
    var v = parseFloat(getComputedStyle(node).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  B.css = function (name, node) {
    return getComputedStyle(node || document.documentElement).getPropertyValue(name).trim();
  };

  /* ------------------------------------------------------------------ */
  /* Ink: rough outlines on HTML components                             */
  /* ------------------------------------------------------------------ */
  var AUTO = [
    [".b-btn:not(.b-btn--quiet)", "box"],
    [".b-input:not(.b-input--line)", "box"],
    [".b-box:not(.b-box--flat)", "box"],
    [".b-callout", "box"],
    [".b-tag", "box-sm"],
    [".b-kbd", "box-sm"],
    [".b-ph", "cross"],
    [".b-slide", "box"],
    [".b-menu", "box"],
    [".b-toast", "box-sm"],
    [".b-sheet", "box"],
    [".b-toolbar", "box"],
    [".b-linkcard", "box"],
    [".b-tab[aria-selected='true']", "tab"],
    ["[data-ink]", null]
  ];
  var VOID = { INPUT: 1, SELECT: 1, TEXTAREA: 1, IMG: 1, CANVAS: 1 };
  var observed = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(function (entries) {
    entries.forEach(function (en) { inkOne(en.target, en.target.__bShape); });
  }) : null;

  function inkOne(node, shape) {
    if (!node.isConnected) return;
    var host = VOID[node.tagName] ? node.parentElement : node;
    if (!host) return;
    var w = node.offsetWidth, h = node.offsetHeight;
    if (!w || !h) return;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    var svg = node.__bInk;
    if (!svg) {
      svg = el("svg", { "class": host === node ? "b-inkl" : "b-inkl b-inkl--over", "aria-hidden": "true" });
      svg.__bFor = node;
      node.__bInk = svg;
    }
    // a framework that re-renders the host's text throws the drawing out: put it back
    if (svg.parentNode !== host) host.insertBefore(svg, host.firstChild);
    var x0 = host === node ? 0 : node.offsetLeft, y0 = host === node ? 0 : node.offsetTop;
    var bw = parseFloat(getComputedStyle(node).borderTopWidth) || 0;
    var pad = 6;
    svg.setAttribute("viewBox", (-pad) + " " + (-pad) + " " + (w + pad * 2) + " " + (h + pad * 2));
    svg.style.left = (x0 - pad - (host === node ? bw : 0)) + "px";
    svg.style.top = (y0 - pad - (host === node ? bw : 0)) + "px";
    svg.style.width = (w + pad * 2) + "px";
    svg.style.height = (h + pad * 2) + "px";
    svg.style.color = getComputedStyle(node).getPropertyValue("--b-ink-c").trim() || "var(--line)";
    var wob = cssNum(node, "--b-wobble", 1.2);
    var seed = node.__bSeed || (node.__bSeed = hashStr((node.className || "") + (node.textContent || "").slice(0, 40) + w) || 3);
    var sw = node.getAttribute("data-ink-width") || (shape === "box-sm" ? 1.4 : 1.7);
    var o = { seed: seed, wobble: wob };
    var d = "", i = 0.6, extra = "";
    if (shape === "box" || shape === "box-sm") d = rect(i, i, w - i * 2, h - i * 2, o);
    else if (shape === "cross") { d = rect(i, i, w - i * 2, h - i * 2, o); extra = line(4, 4, w - 4, h - 4, { seed: seed + 1, wobble: wob, passes: 1 }) + line(w - 4, 4, 4, h - 4, { seed: seed + 2, wobble: wob, passes: 1 }); }
    else if (shape === "circle") d = ellipse(w / 2, h / 2, w / 2 + 4, h / 2 + 3, o);
    else if (shape === "underline") d = line(0, h - 2, w, h - 3, Object.assign({ passes: 2 }, o));
    else if (shape === "strike") d = line(-2, h * 0.55, w + 2, h * 0.5, o);
    else if (shape === "hex") d = hex(w / 2, h / 2, Math.min(w, h) / 2, o);
    else if (shape === "tab") d = poly([[0, h + 1], [0, 2], [w, 2], [w, h + 1]], false, o);
    else d = rect(i, i, w - i * 2, h - i * 2, o);
    svg.innerHTML = "";
    B.drawParts(svg, d, { width: sw });
    if (extra) B.drawParts(svg, extra, { width: 1, opacity: 0.6 });
    node.classList.add("is-inked");
  }

  /** Put the tape of a .b-note a little off centre, a little up or down and at its own angle, from a seed
      (default: the note's class and text), so no two notes are taped alike. A value set in the note's own
      style (--b-tape-x, --b-tape-y, --b-tape-tilt) is left alone. */
  B.tape = function (node, seed) {
    if (seed == null) seed = node.__bSeed || hashStr((node.className || "") + (node.textContent || "").slice(0, 40)) || 3;
    seed = seed >>> 0;
    var st = node.style;
    if (!st.getPropertyValue("--b-tape-x")) st.setProperty("--b-tape-x", f(50 + ((seed % 201) - 100) / 10) + "%");
    if (!st.getPropertyValue("--b-tape-y")) st.setProperty("--b-tape-y", f(-10 + (((seed >>> 8) % 41) - 20) / 10) + "px");
    if (!st.getPropertyValue("--b-tape-tilt")) st.setProperty("--b-tape-tilt", f((((seed >>> 16) % 91) - 45) / 10) + "deg");
    node.__bTape = 1;
  };

  /** Draw rough outlines on every Blyant component inside root (default: document). Safe to call again. */
  B.ink = function (root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll ? root.querySelectorAll(".b-note") : [], function (note) {
      if (!note.__bTape) B.tape(note);
    });
    Array.prototype.forEach.call(root.querySelectorAll ? root.querySelectorAll("svg[data-doodle]") : [], function (svg) {
      if (svg.__bDoodle !== svg.getAttribute("data-doodle")) { svg.__bDoodle = svg.getAttribute("data-doodle"); B.doodle(svg); }
    });
    AUTO.forEach(function (pair) {
      var list = root.querySelectorAll ? root.querySelectorAll(pair[0]) : [];
      Array.prototype.forEach.call(list, function (node) {
        var shape = pair[1] || node.getAttribute("data-ink") || "box";
        node.__bShape = shape;
        inkOne(node, shape);
        if (ro && observed && !observed.has(node)) { observed.set(node, 1); ro.observe(node); }
      });
    });
  };
  /** Re-draw after a skin change or font load. */
  B.reink = function (root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll(".is-inked"), function (n) { inkOne(n, n.__bShape); });
    Array.prototype.forEach.call(root.querySelectorAll("svg[data-doodle]"), function (svg) { B.doodle(svg); });
  };
  function unink(node) {
    var svg = node.__bInk;
    if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
    node.__bInk = null;
    node.classList.remove("is-inked");
    if (ro && observed && observed.has(node)) { observed.delete(node); ro.unobserve(node); }
  }
  function inkable(node) {
    return AUTO.some(function (pair) { return node.matches(pair[0]); });
  }
  /** Keep the ink in step with a page that a framework (Vue, React, htmx) re-renders: new components get their
      outline, and a component that is no longer one (a tab that lost aria-selected) loses it.
      Returns a function that stops watching. */
  B.watch = function (root) {
    root = root || document.body;
    function sweep() {
      Array.prototype.forEach.call(root.querySelectorAll(".b-inkl"), function (svg) {
        var node = svg.__bFor;
        if (node && (!node.isConnected || !inkable(node))) unink(node);
      });
      B.ink(root);
    }
    if (typeof MutationObserver === "undefined") { sweep(); return function () {}; }
    // what the ink itself changes: its own svg, and the drawing inside an svg
    function own(rec) {
      if (rec.target.closest && rec.target.closest("svg")) return true;
      if (rec.type !== "childList" || rec.removedNodes.length || !rec.addedNodes.length) return false;
      return Array.prototype.every.call(rec.addedNodes, function (n) { return n.nodeType === 1 && (n.classList.contains("b-inkl") || n.id === "b-graphite-defs"); });
    }
    var mo = new MutationObserver(function (records) {
      if (records.every(own)) return;
      sweep();
      mo.takeRecords();
    });
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-selected", "data-ink", "data-doodle"] });
    sweep();
    mo.takeRecords();
    return function () { mo.disconnect(); };
  };
  B.setSkin = function (skin, node) {
    (node || document.documentElement).setAttribute("data-skin", skin);
    B.reink(node && node.ownerDocument ? node : document);
  };

  /* ------------------------------------------------------------------ */
  /* Rough 2D component helper: draw a small figure in an <svg>          */
  /* ------------------------------------------------------------------ */
  /** shapes: [{type:'rect'|'circle'|'hex'|'line'|'arrow'|'poly'|'hatch', ...}] */
  B.figure = function (svg, shapes, defaults) {
    defaults = defaults || {};
    var wob = defaults.wobble != null ? defaults.wobble : cssNum(svg, "--b-wobble", 1.2);
    shapes.forEach(function (s, idx) {
      var o = { seed: (s.seed || 11) + idx * 97, wobble: s.wobble != null ? s.wobble : wob, gap: s.gap, angle: s.angle };
      var d;
      switch (s.type) {
        case "rect": d = rect(s.x, s.y, s.w, s.h, o); break;
        case "circle": d = ellipse(s.cx, s.cy, s.r, s.r, o); break;
        case "ellipse": d = ellipse(s.cx, s.cy, s.rx, s.ry, o); break;
        case "hex": d = hex(s.cx, s.cy, s.r, o, s.flat); break;
        case "line": d = line(s.x1, s.y1, s.x2, s.y2, o); break;
        case "arrow": d = arrow(s.x1, s.y1, s.x2, s.y2, Object.assign(o, { bend: s.bend })); break;
        case "poly": d = poly(s.points, s.closed !== false, o); break;
        case "curve": d = scribble(s.points, o); break;
        case "hatch": d = hatch(s.points, o); break;
      }
      if (s.fill && s.type !== "hatch") {
        // a coloured-pencil fill under the outline: flat shape, low opacity, grainy
        var flat = s.type === "circle" ? ellipse(s.cx, s.cy, s.r - 1, s.r - 1, { wobble: 0 })
          : s.type === "ellipse" ? ellipse(s.cx, s.cy, s.rx - 1, s.ry - 1, { wobble: 0 })
          : s.type === "rect" ? rect(s.x, s.y, s.w, s.h, { wobble: 0 })
          : s.type === "hex" ? hex(s.cx, s.cy, s.r, { wobble: 0 }, s.flat)
          : s.points ? poly(s.points, true, { wobble: 0 }) : null;
        if (flat) B.draw(svg, flat, { stroke: "none", fill: s.fill, fillOpacity: s.fillOpacity != null ? s.fillOpacity : 0.55 });
      }
      B.drawParts(svg, d, { stroke: s.stroke, width: s.width || (s.type === "hatch" ? 1 : 1.7), opacity: s.opacity });
    });
    return svg;
  };


  /* ------------------------------------------------------------------ */
  /* Doodles: small ready-made drawings for empty states and margins     */
  /* ------------------------------------------------------------------ */
  var DOODLES = {
    // a blank sheet with a pencil lying on it: nothing written yet
    ark: [
      { type: "poly", points: [[26, 12], [80, 7], [86, 80], [32, 85]], fill: "var(--paper-2)", fillOpacity: 1 },
      { type: "curve", points: [[38, 26], [46, 24], [53, 27], [60, 24]], width: 1.3, opacity: 0.7 },
      { type: "poly", points: [[65.5, 62.8], [107.6, 30.8], [112.4, 37.2], [70.4, 69.1]], fill: "var(--marker)", fillOpacity: 0.95 },
      { type: "poly", points: [[65.5, 62.8], [70.4, 69.1], [59.5, 72.5]], fill: "var(--paper)", fillOpacity: 1 },
      { type: "line", x1: 101.5, y1: 35.4, x2: 106.3, y2: 41.8, width: 1.3 }
    ],
    // a light bulb: an idea
    ide: [
      { type: "circle", cx: 60, cy: 36, r: 22, fill: "var(--marker)", fillOpacity: 0.85 },
      { type: "poly", points: [[51, 57], [69, 57], [67, 72], [53, 72]], fill: "var(--paper-2)", fillOpacity: 1 },
      { type: "line", x1: 52, y1: 64, x2: 68, y2: 63, width: 1.2 },
      { type: "curve", points: [[52, 40], [56, 34], [60, 40], [64, 34], [68, 40]], width: 1.3 },
      { type: "line", x1: 24, y1: 36, x2: 14, y2: 35, width: 1.3 },
      { type: "line", x1: 96, y1: 36, x2: 106, y2: 34, width: 1.3 },
      { type: "line", x1: 33, y1: 12, x2: 26, y2: 5, width: 1.3 },
      { type: "line", x1: 87, y1: 12, x2: 94, y2: 5, width: 1.3 }
    ],
    // a signpost with a question mark: this place is not on the map
    ukjent: [
      { type: "line", x1: 60, y1: 86, x2: 60, y2: 52 },
      { type: "poly", points: [[30, 10], [84, 8], [98, 30], [85, 52], [31, 50]], fill: "var(--paper-2)", fillOpacity: 1 },
      { type: "curve", points: [[51, 24], [54, 17], [62, 15], [68, 20], [66, 27], [60, 31], [60, 36]], width: 2 },
      { type: "circle", cx: 60, cy: 43, r: 1.4, width: 2 },
      { type: "curve", points: [[40, 86], [52, 84], [68, 87], [82, 85]], width: 1.2, opacity: 0.7 }
    ]
  };
  /** Draw a ready-made doodle ("ark", "ide", "ukjent") in an <svg>. Safe to call again. */
  B.doodle = function (svg, name) {
    var shapes = DOODLES[name || svg.getAttribute("data-doodle")];
    if (!shapes) return svg;
    if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", "0 0 120 90");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    return B.figure(svg, shapes);
  };
  B.doodles = Object.keys(DOODLES);

  /* ------------------------------------------------------------------ */
  /* Hex grid math (axial, pointy-top)                                  */
  /* ------------------------------------------------------------------ */
  var DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]; // E, NE, NW, W, SW, SE
  B.hexgrid = {
    DIRS: DIRS,
    key: function (q, r) { return q + "," + r; },
    toXZ: function (q, r, size) { return [size * Math.sqrt(3) * (q + r / 2), size * 1.5 * r]; },
    dist: function (a, b) { return (Math.abs(a[0] - b[0]) + Math.abs(a[0] + a[1] - b[0] - b[1]) + Math.abs(a[1] - b[1])) / 2; },
    ring: function (radius) {
      var out = [];
      for (var q = -radius; q <= radius; q++)
        for (var r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) out.push([q, r]);
      return out;
    },
    /** Breadth-first path from a to b over cells where ok(q,r) is true. */
    path: function (a, b, ok) {
      var k = B.hexgrid.key, start = k(a[0], a[1]), goal = k(b[0], b[1]);
      var prev = {}, queue = [a]; prev[start] = null;
      while (queue.length) {
        var c = queue.shift(), ck = k(c[0], c[1]);
        if (ck === goal) break;
        for (var i = 0; i < 6; i++) {
          var n = [c[0] + DIRS[i][0], c[1] + DIRS[i][1]], nk = k(n[0], n[1]);
          if (nk in prev || !ok(n[0], n[1])) continue;
          prev[nk] = ck; queue.push(n);
        }
      }
      if (!(goal in prev)) return null;
      var out = [], cur = goal;
      while (cur !== start) { out.unshift(cur.split(",").map(Number)); cur = prev[cur]; }
      return out;
    }
  };

  /* ------------------------------------------------------------------ */
  /* Sketch3D: three.js renderer with a pencil post-process             */
  /* ------------------------------------------------------------------ */
  var POST_VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  var POST_FRAG = [
    "uniform sampler2D tColor; uniform sampler2D tNormal; uniform sampler2D tDepth;",
    "uniform vec2 res; uniform vec3 paper; uniform vec3 ink; uniform float time; uniform float wobble;",
    "uniform float lineW; uniform float hatchOn; uniform float hatchGap; uniform float grainOn; uniform float near; uniform float far; uniform float ortho; uniform float dpr;",
    "varying vec2 vUv;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);",
    "  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }",
    "float linD(vec2 uv){ float z = texture2D(tDepth, uv).x; if (ortho > 0.5) return near + z*(far-near);",
    "  float n = z*2.0-1.0; return (2.0*near*far)/(far+near-n*(far-near)); }",
    "float edgeAt(vec2 uv){",
    "  vec2 px = lineW * dpr / res;",
    "  vec3 n0 = texture2D(tNormal, uv).rgb; float d0 = linD(uv);",
    "  float nd = 0.0; float dd = 0.0;",
    "  vec2 o[4]; o[0]=vec2(px.x,0.0); o[1]=vec2(-px.x,0.0); o[2]=vec2(0.0,px.y); o[3]=vec2(0.0,-px.y);",
    "  for (int i=0;i<4;i++){ vec3 n = texture2D(tNormal, uv+o[i]).rgb; float d = linD(uv+o[i]);",
    "    nd += distance(n0, n); dd += abs(d0-d)/max(min(d0,d),0.001); }",
    "  return max(smoothstep(0.22, 0.5, nd), smoothstep(0.035, 0.09, dd));",
    "}",
    "void main(){",
    "  vec2 q = gl_FragCoord.xy / dpr;",
    "  float t = time;",
    "  vec2 w1 = (vec2(noise(q*0.045 + t*3.1), noise(q*0.045 + vec2(31.7, 9.2) + t*2.3)) - 0.5) * wobble * 3.2;",
    "  vec2 w2 = (vec2(noise(q*0.021 + vec2(11.0) - t*1.7), noise(q*0.021 + vec2(57.0, 3.0) + t*1.9)) - 0.5) * wobble * 5.0;",
    "  float pressure = 0.55 + 0.45*noise(q*0.012 + t);",
    "  float e1 = edgeAt(vUv + w1 * dpr / res);",
    "  float e2 = edgeAt(vUv + w2 * dpr / res) * 0.55;",
    "  float edge = clamp(max(e1, e2) * pressure, 0.0, 1.0);",
    "  vec4 c = texture2D(tColor, vUv);",
    "  bool bg = texture2D(tDepth, vUv).x > 0.99999;",
    "  float grain = noise(q*0.9)*0.55 + noise(q*0.33)*0.45;",
    "  vec3 col = paper;",
    "  if (!bg) {",
    "    vec3 alb = c.rgb; float light = c.a;",
    "    float mx = max(alb.r, max(alb.g, alb.b)); float mn = min(alb.r, min(alb.g, alb.b));",
    "    float sat = mx - mn; float lum = dot(alb, vec3(0.299, 0.587, 0.114));",
    "    float tooth = smoothstep(0.15, 0.75, grain + 0.25);",
    "    if (sat < 0.08) col = mix(paper, ink, (1.0 - lum) * 0.55 * mix(1.0, tooth, grainOn));",
    "    else col = mix(paper, alb, 0.78 * mix(1.0, tooth, grainOn));",
    "    if (hatchOn > 0.5) {",
    "      float jit = noise(q*vec2(0.006, 0.09)) * 0.9;",
    "      float a1 = abs(fract((q.x*0.62 + q.y*0.78)/hatchGap + jit) - 0.5);",
    "      float a2 = abs(fract((q.x*-0.70 + q.y*0.71)/hatchGap + jit*0.7 + 0.33) - 0.5);",
    "      float a3 = abs(fract((q.x*0.98 + q.y*0.17)/(hatchGap*0.8) + jit*1.3) - 0.5);",
    "      float h1 = (1.0 - smoothstep(0.06, 0.16, a1)) * smoothstep(0.72, 0.58, light);",
    "      float h2 = (1.0 - smoothstep(0.06, 0.15, a2)) * smoothstep(0.45, 0.32, light);",
    "      float h3 = (1.0 - smoothstep(0.05, 0.14, a3)) * smoothstep(0.24, 0.12, light);",
    "      float h = max(h1, max(h2, h3)) * (0.35 + 0.5*noise(q*0.05));",
    "      col = mix(col, ink, h);",
    "    } else {",
    "      col = mix(col, ink, (1.0 - smoothstep(0.2, 0.95, light)) * 0.35);",
    "    }",
    "  }",
    "  col = mix(col, ink, edge * mix(1.0, 0.65 + 0.35*grain, grainOn));",
    "  col *= 1.0 - (grain - 0.5) * 0.05 * grainOn;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var MAT_VERT = [
    "varying vec3 vN; varying vec3 vW;",
    "#include <common>",
    "#include <skinning_pars_vertex>",
    "void main(){",
    "  #include <skinbase_vertex>",
    "  #include <beginnormal_vertex>",
    "  #include <skinnormal_vertex>",
    "  #include <begin_vertex>",
    "  #include <skinning_vertex>",
    "  vec4 wp = modelMatrix * vec4(transformed, 1.0);",
    "  #ifdef USE_INSTANCING",
    "    wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);",
    "    objectNormal = mat3(instanceMatrix) * objectNormal;",
    "  #endif",
    "  vN = normalize(mat3(modelMatrix) * objectNormal); vW = wp.xyz;",
    "  gl_Position = projectionMatrix * viewMatrix * wp;",
    "}"
  ].join("\n");
  var MAT_FRAG = [
    "uniform vec3 albedo; uniform vec3 lightDir; uniform float fixedLight; uniform float ambient;",
    "varying vec3 vN; varying vec3 vW;",
    "void main(){",
    "  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;",
    "  float l = ambient + (1.0 - ambient) * max(dot(n, normalize(lightDir)), 0.0);",
    "  if (fixedLight >= 0.0) l = fixedLight;",
    "  gl_FragColor = vec4(albedo, l);",
    "}"
  ].join("\n");

  function readColor(T, name, fallback, node) {
    var v = B.css(name, node);
    var c = new T.Color();
    try { c.setStyle(v || fallback); } catch (e) { c.setStyle(fallback); }
    return c;
  }

  /**
   * new Blyant.Sketch3D(container, options)
   * options: { camera:'perspective'|'ortho', fov, wobble, lineWidth, hatch, hatchGap, grain, boil, background }
   * Returns { THREE, scene, camera, renderer, mat(color, opts), add(obj), resize(), render(), start(onFrame), stop(), set(opts), refreshTheme(), dispose() }
   */
  function Sketch3D(container, o) {
    var T = window.THREE;
    if (!T) throw new Error("Blyant.Sketch3D needs three.js (window.THREE) loaded first.");
    o = Object.assign({ camera: "perspective", fov: 35, wobble: null, lineWidth: 1.1, hatch: true, hatchGap: 5.5, grain: true, boil: false, pixelRatio: Math.min(window.devicePixelRatio || 1, 2) }, o || {});
    var self = this;
    this.THREE = T;
    this.container = container;
    this.opts = o;
    var renderer = this.renderer = new T.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: !!o.preserve });
    renderer.setPixelRatio(o.pixelRatio);
    renderer.outputEncoding = T.LinearEncoding;
    container.appendChild(renderer.domElement);
    this.scene = new T.Scene();
    this.camera = o.camera === "ortho" ? new T.OrthographicCamera(-5, 5, 5, -5, 0.1, 100) : new T.PerspectiveCamera(o.fov, 1, 0.1, 100);
    this.camera.position.set(6, 7, 9);
    this.camera.lookAt(0, 0, 0);
    this.lightDir = new T.Vector3(0.45, 1, 0.35).normalize();

    this.rtColor = new T.WebGLRenderTarget(2, 2, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
    this.rtNormal = new T.WebGLRenderTarget(2, 2, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
    this.rtNormal.depthTexture = new T.DepthTexture(2, 2);
    this.rtNormal.depthTexture.type = T.UnsignedIntType;
    this.normalMat = new T.MeshNormalMaterial();

    this.post = new T.ShaderMaterial({
      vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthWrite: false, depthTest: false,
      uniforms: {
        tColor: { value: this.rtColor.texture }, tNormal: { value: this.rtNormal.texture }, tDepth: { value: this.rtNormal.depthTexture },
        res: { value: new T.Vector2(2, 2) }, paper: { value: new T.Color(1, 1, 1) }, ink: { value: new T.Color(0, 0, 0) },
        time: { value: 0 }, wobble: { value: 1.2 }, lineW: { value: o.lineWidth }, hatchOn: { value: o.hatch ? 1 : 0 },
        hatchGap: { value: o.hatchGap }, grainOn: { value: o.grain ? 1 : 0 }, near: { value: 0.1 }, far: { value: 100 }, ortho: { value: 0 }, dpr: { value: o.pixelRatio }
      }
    });
    this.postScene = new T.Scene();
    this.postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var quad = new T.Mesh(new T.PlaneGeometry(2, 2), this.post);
    quad.frustumCulled = false;
    this.postScene.add(quad);

    this.refreshTheme();
    this.resize();
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(function () { self.resize(); self.render(); });
      this._ro.observe(container);
    }
    this._mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    this._onTheme = function () { setTimeout(function () { self.refreshTheme(); self.render(); }, 30); };
    if (this._mq && this._mq.addEventListener) this._mq.addEventListener("change", this._onTheme);
    this._mo = new MutationObserver(this._onTheme);
    this._mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-skin"] });
  }
  Sketch3D.prototype.refreshTheme = function () {
    var T = this.THREE, u = this.post.uniforms, node = this.container;
    u.paper.value.copy(readColor(T, "--paper", "#fafaf7", node));
    u.ink.value.copy(readColor(T, "--graphite-900", "#252623", node));
    var w = this.opts.wobble != null ? this.opts.wobble : cssNum(node, "--b-wobble", 1.2);
    u.wobble.value = w;
    var clean = w === 0;
    u.hatchOn.value = this.opts.hatch && !clean ? 1 : 0;
    u.grainOn.value = this.opts.grain && !clean ? 1 : 0;
    this.scene.traverse(function (obj) {
      var m = obj.material;
      (Array.isArray(m) ? m : [m]).forEach(function (mm) {
        if (mm && mm.userData && mm.userData.bToken) mm.uniforms.albedo.value.copy(readColor(T, mm.userData.bToken, "#ffffff", node));
      });
    });
  };
  /** A material for this renderer. color: hex, CSS colour, or a token name like '--dust-red'. opts: {light: fixed 0..1} */
  Sketch3D.prototype.mat = function (color, mo) {
    var T = this.THREE; mo = mo || {};
    var c = new T.Color(1, 1, 1), token = null;
    if (typeof color === "string" && color.indexOf("--") === 0) { token = color; c = readColor(T, color, "#ffffff", this.container); }
    else if (color != null) c.set(color);
    var m = new T.ShaderMaterial({
      vertexShader: MAT_VERT, fragmentShader: MAT_FRAG, side: mo.side || T.FrontSide,
      uniforms: { albedo: { value: c }, lightDir: { value: this.lightDir }, fixedLight: { value: mo.light != null ? mo.light : -1 }, ambient: { value: mo.ambient != null ? mo.ambient : 0.34 } }
    });
    m.userData.bToken = token;
    return m;
  };
  Sketch3D.prototype.add = function (obj) { this.scene.add(obj); return obj; };
  Sketch3D.prototype.set = function (patch) {
    Object.assign(this.opts, patch);
    var u = this.post.uniforms;
    if (patch.lineWidth != null) u.lineW.value = patch.lineWidth;
    if (patch.hatchGap != null) u.hatchGap.value = patch.hatchGap;
    this.refreshTheme();
  };
  Sketch3D.prototype.resize = function () {
    var w = Math.max(2, this.container.clientWidth), h = Math.max(2, this.container.clientHeight);
    var pr = this.opts.pixelRatio;
    this.renderer.setSize(w, h, false);
    this.rtColor.setSize(w * pr, h * pr);
    this.rtNormal.setSize(w * pr, h * pr);
    this.post.uniforms.res.value.set(w * pr, h * pr);
    var cam = this.camera;
    if (cam.isPerspectiveCamera) cam.aspect = w / h;
    else { var s = this.opts.orthoSize || 6, a = w / h; cam.left = -s * a; cam.right = s * a; cam.top = s; cam.bottom = -s; }
    cam.updateProjectionMatrix();
    this.width = w; this.height = h;
  };
  Sketch3D.prototype.render = function (time) {
    var r = this.renderer, s = this.scene, cam = this.camera, u = this.post.uniforms;
    u.near.value = cam.near; u.far.value = cam.far; u.ortho.value = cam.isOrthographicCamera ? 1 : 0;
    if (time != null) u.time.value = this.opts.boil ? Math.floor(time * 6) / 6 * 0.37 : 0;
    var bgc = r.getClearColor(new this.THREE.Color()), bga = r.getClearAlpha();
    r.setClearColor(0xffffff, 0);
    s.overrideMaterial = null;
    r.setRenderTarget(this.rtColor); r.clear(); r.render(s, cam);
    r.setClearColor(0x8080ff, 1);
    s.overrideMaterial = this.normalMat;
    r.setRenderTarget(this.rtNormal); r.clear(); r.render(s, cam);
    s.overrideMaterial = null;
    r.setRenderTarget(null);
    r.setClearColor(bgc, bga);
    r.render(this.postScene, this.postCam);
  };
  Sketch3D.prototype.start = function (onFrame) {
    var self = this, t0 = performance.now(), last = t0;
    this.stop();
    function loop(now) {
      self._raf = requestAnimationFrame(loop);
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (onFrame) onFrame(dt, (now - t0) / 1000);
      self.render((now - t0) / 1000);
    }
    this._raf = requestAnimationFrame(loop);
    return this;
  };
  Sketch3D.prototype.stop = function () { if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; };
  Sketch3D.prototype.dispose = function () {
    this.stop();
    if (this._ro) this._ro.disconnect();
    if (this._mo) this._mo.disconnect();
    if (this._mq && this._mq.removeEventListener) this._mq.removeEventListener("change", this._onTheme);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  };
  /** Pointer → first hit among objects. */
  Sketch3D.prototype.pick = function (clientX, clientY, objects) {
    var T = this.THREE, rect = this.renderer.domElement.getBoundingClientRect();
    var v = new T.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this._ray = this._ray || new T.Raycaster();
    this._ray.setFromCamera(v, this.camera);
    var hits = this._ray.intersectObjects(objects || this.scene.children, true);
    return hits[0] || null;
  };
  B.Sketch3D = Sketch3D;

  /* ------------------------------------------------------------------ */
  /* HexBoard: a small hex world with a hopping figure (uses Sketch3D)  */
  /* ------------------------------------------------------------------ */
  /**
   * new Blyant.HexBoard(container, { radius, seed, onCollect(found,total), onMove(cell), interactive, keyboardTarget })
   */
  function HexBoard(container, o) {
    o = Object.assign({ radius: 4, seed: 7, size: 1, interactive: true, gems: 6, keyboardTarget: window, autoplay: false }, o || {});
    var self = this, T = window.THREE, HG = B.hexgrid;
    var sk = this.sketch = new Sketch3D(container, Object.assign({ fov: 30 }, o.sketch || {}));
    this.opts = o;
    var R = rng(o.seed);
    var size = o.size, gap = 0.93;
    var cells = {}, tiles = [];
    var geo = new T.CylinderGeometry(size * gap, size * gap, 1, 6, 1);
    geo.translate(0, -0.5, 0);           // top at y = 0, scale.y = height
    geo = geo.toNonIndexed(); geo.computeVertexNormals();   // flat sides → crisp prism edges

    // terrain heights from a few smooth bumps
    var bumps = [];
    for (var b = 0; b < 4; b++) bumps.push([(R() * 2 - 1) * o.radius, (R() * 2 - 1) * o.radius, 0.6 + R() * 0.8]);
    function heightAt(q, r) {
      var xz = HG.toXZ(q, r, 1), h = 0;
      bumps.forEach(function (bp) { var dx = xz[0] - bp[0] * 1.5, dz = xz[1] - bp[1] * 1.5; h += bp[2] * Math.exp(-(dx * dx + dz * dz) / 9); });
      return Math.round(h * 2) / 4;    // steps of .25
    }

    var mats = {
      paper: sk.mat("#ffffff"), grass: sk.mat("--dust-green"), sand: sk.mat("#e8e2cf"), water: sk.mat("--dust-blue"),
      stone: sk.mat("#9a9a94"), side: sk.mat("#f2f2f2"), marker: sk.mat("--marker"), near: sk.mat("#f5f0c8"), blocked: sk.mat("--dust-red"),
      gems: ["--dust-red", "--dust-orange", "--dust-yellow", "--dust-green", "--dust-blue", "--dust-purple"].map(function (t) { return sk.mat(t); }),
      trunk: sk.mat("#8a7a66"), tree: sk.mat("--dust-green"), body: sk.mat("#ffffff"), hat: sk.mat("--dust-red"), shadow: sk.mat("#777777", { light: 0.1 })
    };
    this.mats = mats;

    var coords = HG.ring(o.radius);
    coords.forEach(function (c) {
      var q = c[0], r = c[1], k = HG.key(q, r);
      var h = heightAt(q, r), kind = "paper";
      var rr = R();
      if (h <= 0 && rr < 0.3 && HG.dist(c, [0, 0]) > 1) kind = "water";
      else if (rr > 0.78) kind = "grass";
      else if (rr > 0.7) kind = "sand";
      var top = kind === "water" ? 0.08 : 0.3 + h;
      var mesh = new T.Mesh(geo, [mats.side, mats[kind], mats.side]);
      var xz = HG.toXZ(q, r, size);
      mesh.position.set(xz[0], 0, xz[1]);
      mesh.scale.y = top + 0.6;
      mesh.position.y = top;
      mesh.userData = { q: q, r: r, key: k };
      sk.add(mesh);
      var cell = { q: q, r: r, key: k, top: top, kind: kind, mesh: mesh, baseMat: mats[kind], blocked: kind === "water", item: null };
      cells[k] = cell; tiles.push(mesh);
    });
    this.cells = cells; this.tiles = tiles;

    // obstacles: trees and rocks
    var free = coords.filter(function (c) { return HG.dist(c, [0, 0]) > 1 && !cells[HG.key(c[0], c[1])].blocked; });
    function takeFree() { var i = Math.floor(R() * free.length); return free.splice(i, 1)[0]; }
    var coneGeo = new T.ConeGeometry(0.5, 1.1, 7), trunkGeo = new T.CylinderGeometry(0.1, 0.12, 0.35, 6), rockGeo = new T.DodecahedronGeometry(0.42, 0);
    for (var t = 0; t < 8; t++) {
      var c = cells[HG.key.apply(null, takeFree())];
      var g = new T.Group();
      var trunk = new T.Mesh(trunkGeo, mats.trunk); trunk.position.y = 0.17; g.add(trunk);
      var crown = new T.Mesh(coneGeo, mats.tree); crown.position.y = 0.85; g.add(crown);
      if (R() > 0.5) { var c2 = new T.Mesh(coneGeo, mats.tree); c2.scale.setScalar(0.7); c2.position.y = 1.35; g.add(c2); }
      g.position.set(c.mesh.position.x, c.top, c.mesh.position.z);
      g.rotation.y = R() * 6;
      sk.add(g); c.blocked = true; c.obstacle = g;
    }
    for (var s = 0; s < 4; s++) {
      var cr = cells[HG.key.apply(null, takeFree())];
      var rock = new T.Mesh(rockGeo, mats.stone);
      rock.position.set(cr.mesh.position.x, cr.top + 0.25, cr.mesh.position.z);
      rock.rotation.set(R() * 3, R() * 3, R() * 3);
      rock.scale.set(1, 0.75, 1);
      sk.add(rock); cr.blocked = true; cr.obstacle = rock;
    }
    // gems to collect
    var gemGeo = new T.OctahedronGeometry(0.22, 0);
    this.gems = [];
    for (var gi = 0; gi < o.gems; gi++) {
      var cg = cells[HG.key.apply(null, takeFree())];
      var gem = new T.Mesh(gemGeo, mats.gems[gi % 6]);
      gem.position.set(cg.mesh.position.x, cg.top + 0.45, cg.mesh.position.z);
      gem.scale.y = 1.4;
      gem.userData.home = gem.position.clone();
      sk.add(gem); cg.item = gem; cg._hadItem = gem; this.gems.push(gem);
    }
    this.found = 0;

    // the figure: a round body, a head, a pointed hat that shows the facing
    var fig = this.figure = new T.Group();
    var body = new T.Mesh(new T.SphereGeometry(0.3, 18, 12), mats.body); body.scale.set(1, 1.1, 1); body.position.y = 0.33; fig.add(body);
    var head = new T.Mesh(new T.SphereGeometry(0.19, 16, 10), mats.body); head.position.y = 0.78; fig.add(head);
    var hat = new T.Mesh(new T.ConeGeometry(0.17, 0.38, 10), mats.hat); hat.position.set(0, 1.02, 0); hat.rotation.x = 0.0; fig.add(hat);
    var nose = new T.Mesh(new T.ConeGeometry(0.06, 0.2, 6), mats.hat); nose.rotation.z = -Math.PI / 2; nose.position.set(0.22, 0.8, 0); fig.add(nose);
    var shadow = this.shadow = new T.Mesh(new T.CircleGeometry(0.3, 18), mats.shadow); shadow.rotation.x = -Math.PI / 2;
    sk.add(shadow);
    sk.add(fig);
    this.pos = [0, 0];
    this.facing = 0;  // index into DIRS
    var c0 = cells["0,0"]; c0.blocked = false;
    if (c0.obstacle) { sk.scene.remove(c0.obstacle); c0.obstacle = null; }
    fig.position.set(c0.mesh.position.x, c0.top, c0.mesh.position.z);
    this._yaw = this._yawTarget = this.yawFor(0);
    fig.rotation.y = this._yaw;

    this.queue = [];
    this.hop = null;
    this.hover = null;
    this.camTarget = new T.Vector3();
    this.camOffset = new T.Vector3(0, 13.5, 13);
    this.camZoom = 1;
    this.highlightNeighbours();
    this.updateCamera(1);

    if (o.interactive) this.bindInput();
    sk.start(function (dt, t) { self.tick(dt, t); });
    sk.refreshTheme();
  }
  HexBoard.prototype.yawFor = function (dir) { return Math.PI / 3 * dir; };
  HexBoard.prototype.cellAt = function (q, r) { return this.cells[q + "," + r]; };
  HexBoard.prototype.passable = function (q, r) { var c = this.cellAt(q, r); return !!c && !c.blocked; };
  HexBoard.prototype.highlightNeighbours = function () {
    var self = this, D = B.hexgrid.DIRS;
    Object.keys(this.cells).forEach(function (k) { var c = self.cells[k]; c.mesh.material[1] = c.baseMat; });
    if (!this.hop && !this.queue.length) {
      D.forEach(function (d) {
        var c = self.cellAt(self.pos[0] + d[0], self.pos[1] + d[1]);
        if (c && !c.blocked) c.mesh.material[1] = self.mats.near;
      });
    }
    if (this.hover) {
      var hc = this.cellAt(this.hover[0], this.hover[1]);
      if (hc) hc.mesh.material[1] = hc.blocked ? this.mats.blocked : this.mats.marker;
    }
  };
  /** Hop one step in direction index 0..5 (E, NE, NW, W, SW, SE). */
  HexBoard.prototype.step = function (dir) {
    var d = B.hexgrid.DIRS[((dir % 6) + 6) % 6];
    var last = this.queue.length ? this.queue[this.queue.length - 1] : this.pos;
    var n = [last[0] + d[0], last[1] + d[1]];
    this.facing = ((dir % 6) + 6) % 6;
    if (!this.passable(n[0], n[1])) { this.bump(); return false; }
    if (this.queue.length < 3) this.queue.push(n);
    return true;
  };
  HexBoard.prototype.turn = function (by) {
    this.facing = (this.facing + by + 6) % 6;
    this._yawTarget = this.closestYaw(this.yawFor(this.facing));
  };
  HexBoard.prototype.forward = function () { return this.step(this.facing); };
  HexBoard.prototype.back = function () { return this.step(this.facing + 3); };
  HexBoard.prototype.goTo = function (q, r) {
    var p = B.hexgrid.path(this.pos, [q, r], this.passable.bind(this));
    if (!p || !p.length) { this.bump(); return false; }
    this.queue = p;
    return true;
  };
  HexBoard.prototype.bump = function () { this._bump = 0.25; };
  HexBoard.prototype.closestYaw = function (y) {
    var cur = this._yaw;
    while (y - cur > Math.PI) y -= Math.PI * 2;
    while (y - cur < -Math.PI) y += Math.PI * 2;
    return y;
  };
  HexBoard.prototype.updateCamera = function (k) {
    var cam = this.sketch.camera, f = this.figure.position;
    var tx = f.x * 0.55, tz = f.z * 0.55;
    this.camTarget.x += (tx - this.camTarget.x) * k;
    this.camTarget.z += (tz - this.camTarget.z) * k;
    this.camTarget.y = 0.3;
    cam.position.copy(this.camTarget).addScaledVector(this.camOffset, this.camZoom);
    cam.lookAt(this.camTarget);
  };
  HexBoard.prototype.tick = function (dt, t) {
    var self = this, fig = this.figure, HG = B.hexgrid;
    if (!this.hop && this.queue.length) {
      var next = this.queue.shift();
      var from = this.cellAt(this.pos[0], this.pos[1]), to = this.cellAt(next[0], next[1]);
      var dq = next[0] - this.pos[0], dr = next[1] - this.pos[1];
      HG.DIRS.forEach(function (d, i) { if (d[0] === dq && d[1] === dr) self.facing = i; });
      this._yawTarget = this.closestYaw(this.yawFor(this.facing));
      this.hop = { from: from, to: to, t: 0, dur: 0.34 + Math.abs(to.top - from.top) * 0.08 };
      this.pos = next;
      this.highlightNeighbours();
    }
    this._yaw += (this._yawTarget - this._yaw) * Math.min(1, dt * 14);
    fig.rotation.y = this._yaw;
    var sq = 1;
    if (this.hop) {
      var h = this.hop; h.t += dt / h.dur;
      var k = Math.min(1, h.t), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var a = h.from.mesh.position, b = h.to.mesh.position;
      fig.position.x = a.x + (b.x - a.x) * e;
      fig.position.z = a.z + (b.z - a.z) * e;
      var arc = 0.55 + Math.max(0, h.to.top - h.from.top) * 0.7;
      fig.position.y = h.from.top + (h.to.top - h.from.top) * k + Math.sin(Math.PI * k) * arc;
      sq = 1 + Math.sin(Math.PI * k) * 0.12;
      if (h.t >= 1) {
        this.hop = null; this._land = 0.18;
        fig.position.set(b.x, h.to.top, b.z);
        if (h.to.item) {
          var item = h.to.item; h.to.item = null;
          item.userData.collect = 0;
          this.found++;
          if (this.opts.onCollect) this.opts.onCollect(this.found, this.gems.length);
        }
        if (this.opts.onMove) this.opts.onMove(this.pos.slice());
        this.highlightNeighbours();
      }
    }
    if (this._land > 0) { this._land -= dt; sq = 1 - Math.sin(Math.max(0, this._land) / 0.18 * Math.PI) * 0.16; }
    if (this._bump > 0) { this._bump -= dt; fig.rotation.z = Math.sin(this._bump * 50) * 0.08; } else fig.rotation.z = 0;
    fig.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    // shadow follows on the tile below
    var cellBelow = this.hop ? (this.hop.t < 0.5 ? this.hop.from : this.hop.to) : this.cellAt(this.pos[0], this.pos[1]);
    this.shadow.position.set(fig.position.x, cellBelow.top + 0.01, fig.position.z);
    var hgt = fig.position.y - cellBelow.top;
    this.shadow.scale.setScalar(Math.max(0.45, 1 - hgt * 0.5));
    // gems spin; collected gems fly up and vanish
    this.gems.forEach(function (g, i) {
      g.rotation.y = t * 1.6 + i;
      if (g.userData.collect != null) {
        g.userData.collect += dt;
        g.position.y += dt * 3; g.scale.multiplyScalar(0.94);
        if (g.userData.collect > 0.6) g.visible = false;
      } else g.position.y += Math.sin(t * 2.4 + i) * 0.0025;
    });
    this.updateCamera(Math.min(1, dt * 3));
  };
  HexBoard.prototype.bindInput = function () {
    var self = this, el = this.sketch.renderer.domElement, target = this.opts.keyboardTarget;
    // Q E / A D / Z C sit around S on a QWERTY keyboard like the six neighbours of a hex
    var keyDir = { KeyD: 0, KeyE: 1, KeyQ: 2, KeyA: 3, KeyZ: 4, KeyC: 5 };
    this._onKey = function (e) {
      if (self.enabled === false) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      var used = true;
      if (e.key === "ArrowLeft") self.turn(1);
      else if (e.key === "ArrowRight") self.turn(-1);
      else if (e.key === "ArrowUp") self.forward();
      else if (e.key === "ArrowDown") self.back();
      else if (e.code in keyDir) self.step(keyDir[e.code]);
      else used = false;
      if (used) e.preventDefault();
    };
    target.addEventListener("keydown", this._onKey);
    function hoverAt(e) {
      var hit = self.sketch.pick(e.clientX, e.clientY, self.tiles);
      var nh = hit ? [hit.object.userData.q, hit.object.userData.r] : null;
      var changed = (nh ? nh.join() : "") !== (self.hover ? self.hover.join() : "");
      self.hover = nh;
      if (changed) self.highlightNeighbours();
      el.style.cursor = nh ? (self.passable(nh[0], nh[1]) ? "pointer" : "not-allowed") : "default";
    }
    el.addEventListener("pointermove", hoverAt);
    el.addEventListener("pointerleave", function () { self.hover = null; self.highlightNeighbours(); });
    el.addEventListener("pointerdown", function (e) {
      hoverAt(e);
      if (self.hover && !(self.hover[0] === self.pos[0] && self.hover[1] === self.pos[1])) self.goTo(self.hover[0], self.hover[1]);
    });
    el.addEventListener("wheel", function (e) {
      e.preventDefault();
      self.camZoom = Math.max(0.6, Math.min(1.5, self.camZoom * (1 + e.deltaY * 0.001)));
    }, { passive: false });
  };
  HexBoard.prototype.reset = function () {
    var self = this;
    this.gems.forEach(function (g) { g.visible = true; g.scale.set(1, 1.4, 1); g.position.copy(g.userData.home); delete g.userData.collect; });
    Object.keys(this.cells).forEach(function (k) { var c = self.cells[k]; if (c._hadItem) c.item = c._hadItem; });
    this.found = 0;
    if (this.opts.onCollect) this.opts.onCollect(0, this.gems.length);
  };
  HexBoard.prototype.dispose = function () {
    if (this._onKey) this.opts.keyboardTarget.removeEventListener("keydown", this._onKey);
    this.sketch.dispose();
  };
  B.HexBoard = HexBoard;

  B.version = "1.0.0";
  if (typeof window !== "undefined") { window.Blyant = Object.assign(window.Blyant || {}, B); }
})();

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

/* Blyant.Sketch2D — blyanten over et ferdig bilde: et lerret fra et spill,
   pikselkunst, et foto, en videorute. Ren WebGL, ingen avhengigheter.
   Samme hånd som Sketch3D: kontur tegnet to ganger med skjelving, lys blir
   skravur i tre retninger, farge blir fargeblyant med papirkorn.           */
(function () {
  "use strict";
  var B = (typeof window !== "undefined" && window.Blyant) || {};

  var VERT = "attribute vec2 p; varying vec2 vUv; void main(){ vUv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p, 0.0, 1.0); }";
  var FRAG = [
    "precision highp float;",
    "uniform sampler2D tSrc; uniform sampler2D tLight;",
    "uniform vec2 res; uniform vec2 srcSize; uniform vec2 origin; uniform float px; uniform float dpr;",
    "uniform vec3 paper; uniform vec3 ink; uniform vec3 faint;",
    "uniform float wobble; uniform float lineW; uniform float detail; uniform float hatchOn; uniform float hatchGap;",
    "uniform float grainOn; uniform float colour; uniform float shade; uniform float hasLight; uniform float lightRef;",
    "uniform float mixK; uniform float time; uniform float grid; uniform float chalk; uniform float exposure;",
    "varying vec2 vUv;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);",
    "  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }",
    "float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }",
    "vec3 src(vec2 uv){ return texture2D(tSrc, clamp(uv, vec2(0.0), vec2(1.0))).rgb; }",
    /* Kanten mellom to flater: størst fargeavstand til fire naboer en strekbredde unna. */
    "float edgeAt(vec2 uv){",
    "  vec2 d = lineW * dpr / res;",
    "  vec3 c0 = src(uv);",
    "  float m = max(max(distance(c0, src(uv + vec2(d.x, 0.0))), distance(c0, src(uv - vec2(d.x, 0.0)))),",
    "                max(distance(c0, src(uv + vec2(0.0, d.y))), distance(c0, src(uv - vec2(0.0, d.y)))));",
    "  float lo = mix(0.62, 0.07, detail);",
    "  return smoothstep(lo, lo * 2.1 + 0.03, m);",
    "}",
    "void main(){",
    "  vec2 o = vUv * res;",                       /* utpiksler, y nedover */
    "  vec2 q = (o + origin * px) / dpr;",         /* hånda følger verden, ikke skjermen */
    "  float t = time;",
    "  vec2 w1 = (vec2(noise(q*0.045 + t*3.1), noise(q*0.045 + vec2(31.7, 9.2) + t*2.3)) - 0.5) * wobble * 3.2;",
    "  vec2 w2 = (vec2(noise(q*0.021 + vec2(11.0) - t*1.7), noise(q*0.021 + vec2(57.0, 3.0) + t*1.9)) - 0.5) * wobble * 5.0;",
    "  float pressure = 0.55 + 0.45*noise(q*0.012 + t);",
    "  vec2 uv1 = vUv + w1 * dpr / res;",
    "  float e1 = edgeAt(uv1);",
    "  float e2 = edgeAt(vUv + w2 * dpr / res) * 0.55;",
    "  float edge = clamp(max(e1, e2) * pressure, 0.0, 1.0);",
    "  vec3 alb = src(uv1);",
    "  vec3 lightC = hasLight > 0.5 ? texture2D(tLight, clamp(uv1, vec2(0.0), vec2(1.0))).rgb : vec3(1.0);",
    "  float light = hasLight > 0.5 ? clamp(lum(lightC) / max(lightRef, 0.001), 0.0, 2.0) : 1.0;",
    "  float grain = noise(q*0.9)*0.55 + noise(q*0.33)*0.45;",
    "  float tooth = mix(1.0, smoothstep(0.15, 0.75, grain + 0.25), grainOn);",
    "  float mx = max(alb.r, max(alb.g, alb.b)); float mn = min(alb.r, min(alb.g, alb.b));",
    "  float sat = mx - mn; float l = lum(alb);",
    /* Trykket: på lyst ark (Papir) tegnes det mørke, og skygge legger mer på.
       På mørkt ark (Kull) er blyanten kritt: det lyse tegnes, og lys legger mer på. */
    "  float pencil = 1.0 - clamp(l * exposure, 0.0, 1.0) * mix(1.0, 0.3 + 0.7 * min(light, 1.0), hasLight);",
    "  float crayon = clamp(l / exposure, 0.0, 1.0) * mix(1.0, 0.55 + 1.1 * smoothstep(0.95, 1.8, light), hasLight);",
    "  float press = clamp(mix(pencil, crayon, chalk), 0.0, 1.0);",
    "  vec3 col = paper;",
    "  if (grid > 0.5) {",
    "    vec2 gq = (o / px + origin) / grid; vec2 gf = abs(fract(gq + 0.5) - 0.5) * grid * px;",
    "    float gl = 1.0 - smoothstep(0.35 * dpr, 1.1 * dpr, min(gf.x, gf.y));",
    "    col = mix(col, faint, gl * 0.55);",
    "  }",
    /* Fargeblyant: flatens farge, støvet ned mot arket, lagt på med papirkorn. */
    "  vec3 pig = alb / max(mx, 0.001);",          /* fargen for seg, uten mørket */
    "  vec3 dust = mix(vec3(lum(pig)), pig, 0.7);",
    "  dust = mix(dust * 0.82, mix(dust, vec3(1.0), 0.25), chalk);",
    "  float wash = smoothstep(0.06, 0.3, sat) * colour;",
    "  col = mix(col, dust, wash * (0.2 + 0.55 * press) * tooth);",
    /* Grafitt bærer resten: grå flater blir tone. */
    "  col = mix(col, ink, (1.0 - wash) * press * 0.3 * shade * tooth);",
    /* Lys som har egen farge (en lampe, et skilt) er et lett strøk fargeblyant rundt kilden. */
    "  if (hasLight > 0.5) {",
    "    float lmx = max(lightC.r, max(lightC.g, lightC.b)); float lmn = min(lightC.r, min(lightC.g, lightC.b));",
    "    float glow = smoothstep(1.02, 1.7, light) * smoothstep(0.08, 0.4, lmx - lmn);",
    "    col = mix(col, mix(lightC / max(lmx, 0.001), paper, 0.35 - 0.3 * chalk), glow * 0.38 * colour * tooth);",
    "  }",
    "  if (hatchOn > 0.5) {",
    "    float jit = noise(q*vec2(0.006, 0.09)) * 0.9;",
    "    float a1 = abs(fract((q.x*0.62 + q.y*0.78)/hatchGap + jit) - 0.5);",
    "    float a2 = abs(fract((q.x*-0.70 + q.y*0.71)/hatchGap + jit*0.7 + 0.33) - 0.5);",
    "    float a3 = abs(fract((q.x*0.98 + q.y*0.17)/(hatchGap*0.8) + jit*1.3) - 0.5);",
    "    float d = 1.0 - press * shade;",          /* 1 er rent ark, 0 er hardest trykk */
    "    float h1 = (1.0 - smoothstep(0.06, 0.16, a1)) * smoothstep(0.66, 0.5, d);",
    "    float h2 = (1.0 - smoothstep(0.06, 0.15, a2)) * smoothstep(0.42, 0.3, d);",
    "    float h3 = (1.0 - smoothstep(0.05, 0.14, a3)) * smoothstep(0.24, 0.12, d);",
    "    float h = max(h1, max(h2, h3)) * (0.35 + 0.5*noise(q*0.05));",
    "    col = mix(col, ink, h);",
    "  }",
    "  col = mix(col, ink, edge * mix(1.0, 0.65 + 0.35*grain, grainOn));",
    "  col *= 1.0 - (grain - 0.5) * 0.05 * grainOn;",
    /* mix < 1: skissen kommer fram i flekker, som når en tegning blir til. */
    "  if (mixK < 0.999) {",
    "    vec3 plain = src(vUv) * (hasLight > 0.5 ? texture2D(tLight, vUv).rgb : vec3(1.0));",
    "    float n = noise(q*0.02)*0.6 + noise(q*0.11)*0.4;",
    "    col = mix(plain, col, smoothstep(n - 0.12, n + 0.12, mixK * 1.24 - 0.12));",
    "  }",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function rgb(str, fallback) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(str || "").trim()) || /^#?([0-9a-f]{6})$/i.exec(fallback);
    var n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  /** En farge fra et token (`--paper`), en hex (#rrggbb) eller en annen CSS-farge. */
  function colorOf(v, fallback, node) {
    if (typeof v === "string" && v.indexOf("--") === 0 && B.css) v = B.css(v, node);
    if (typeof v === "string" && /^\s*#?[0-9a-f]{6}\s*$/i.test(v)) return rgb(v, fallback);
    if (typeof v === "string" && /^\s*#[0-9a-f]{3}\s*$/i.test(v)) { v = v.trim(); return rgb("#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3], fallback); }
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(String(v || ""));
    if (m) return [m[1] / 255, m[2] / 255, m[3] / 255];
    return rgb(fallback, fallback);
  }
  function luma(c) { return c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114; }

  var DEFAULTS = {
    wobble: null, lineWidth: 1.1, detail: 0.55, hatch: true, hatchGap: 5.5, grain: true, colour: 1, shade: 1, exposure: 1,
    boil: false, grid: 0, smooth: false, paper: null, ink: null, faint: null, preserve: false, node: null
  };

  /**
   * new Blyant.Sketch2D(options)
   * options: { canvas, wobble, lineWidth, detail, hatch, hatchGap, grain, colour, shade, boil, grid, smooth,
   *            paper, ink, faint, pixelRatio, preserve, node }
   * Gir { canvas, ok, render(source, frame), set(patch), refreshTheme(), dispose() }.
   * `canvas` er et eget lerret med skissen: legg det i siden, eller tegn det inn på ditt eget med drawImage.
   */
  function Sketch2D(o) {
    o = this.opts = Object.assign({}, DEFAULTS, { pixelRatio: Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2) }, o || {});
    var canvas = this.canvas = o.canvas || document.createElement("canvas");
    var gl = null;
    try { gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: !!o.preserve }); } catch (e) { gl = null; }
    this.gl = gl;
    this.ok = !!gl;
    this.u = {};
    if (gl) {
      var prog = this.prog = gl.createProgram();
      [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]].forEach(function (s) {
        var sh = gl.createShader(s[0]); gl.shaderSource(sh, s[1]); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("Blyant.Sketch2D: " + gl.getShaderInfoLog(sh));
        gl.attachShader(prog, sh);
      });
      gl.bindAttribLocation(prog, 0, "p");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("Blyant.Sketch2D: " + gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      var n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(prog, i); this.u[info.name] = gl.getUniformLocation(prog, info.name); }
      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.tSrc = this._tex(0);
      this.tLight = this._tex(1);
      gl.uniform1i(this.u.tSrc, 0);
      gl.uniform1i(this.u.tLight, 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    } else {
      this.ctx = canvas.getContext("2d");
    }
    this.refreshTheme();
    var self = this;
    this._mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    this._onTheme = function () { setTimeout(function () { self.refreshTheme(); if (self._last) self.render(self._last[0], self._last[1]); }, 30); };
    if (this._mq && this._mq.addEventListener) this._mq.addEventListener("change", this._onTheme);
    if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
      this._mo = new MutationObserver(this._onTheme);
      this._mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-skin"] });
    }
  }
  Sketch2D.prototype._tex = function (unit) {
    var gl = this.gl, t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    return t;
  };
  /** Les arket og blyanten på nytt fra tokenene (Papir og Kull), eller fra fargene som er satt med `set`. */
  Sketch2D.prototype.refreshTheme = function () {
    var o = this.opts, node = o.node || (typeof document !== "undefined" ? document.documentElement : null);
    this.paper = colorOf(o.paper || "--paper", "#fafaf7", node);
    this.ink = colorOf(o.ink || "--graphite-900", "#252623", node);
    this.faint = colorOf(o.faint || "--graphite-100", "#d5d5cf", node);
    var w = o.wobble;
    if (w == null) { var css = B.css && node ? parseFloat(B.css("--b-wobble", node)) : NaN; w = isNaN(css) ? 1.2 : css; }
    this.wobble = w;
    this.chalk = luma(this.paper) < luma(this.ink) ? 1 : 0;
  };
  Sketch2D.prototype.set = function (patch) {
    Object.assign(this.opts, patch);
    this.refreshTheme();
    return this;
  };
  /**
   * Tegn `source` (lerret, bilde, video, ImageData) som skisse.
   * frame: { width, height   størrelsen på skissen i skjermpiksler (standard: kildens størrelse × pixel)
   *          pixel           skjermpiksler per kildepiksel (standard 1; 3–4 for pikselkunst)
   *          light           et bilde til, like stort som kilden: lyst der lyset faller. Blir skravur.
   *          lightRef        lysheten (0–1) i `light` som regnes som vanlig lys (standard 1)
   *          origin: [x, y]  hvor utsnittet ligger i en større verden, i kildepiksler: streken står stille når kameraet flytter seg
   *          mix             0 er kilden som den er, 1 er skissen (standard 1)
   *          time }          sekunder, brukes bare når `boil` er på
   */
  Sketch2D.prototype.render = function (source, frame) {
    frame = frame || {};
    this._last = [source, frame];
    var o = this.opts, sw = source.videoWidth || source.naturalWidth || source.width, sh = source.videoHeight || source.naturalHeight || source.height;
    var px = frame.pixel || 1;
    var W = Math.max(1, Math.round(frame.width || sw * px)), H = Math.max(1, Math.round(frame.height || sh * px));
    var canvas = this.canvas;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    var mix = frame.mix != null ? Math.max(0, Math.min(1, frame.mix)) : 1;
    if (!this.gl) {
      /* Uten WebGL: bildet lagt lett på arket, så siden fortsatt er lesbar og i riktig tone. */
      var c = this.ctx, p = this.paper;
      c.imageSmoothingEnabled = !!o.smooth;
      c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
      c.drawImage(source, 0, 0, sw, sh, 0, 0, sw * px, sh * px);
      if (frame.light) { c.globalCompositeOperation = "multiply"; c.drawImage(frame.light, 0, 0, sw, sh, 0, 0, sw * px, sh * px); c.globalCompositeOperation = "source-over"; }
      c.globalAlpha = 0.72 * mix;
      c.fillStyle = "rgb(" + Math.round(p[0] * 255) + "," + Math.round(p[1] * 255) + "," + Math.round(p[2] * 255) + ")";
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
      return canvas;
    }
    var gl = this.gl, u = this.u;
    var clean = this.wobble === 0;
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.prog);
    var filter = o.smooth ? gl.LINEAR : gl.NEAREST;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tSrc);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (frame.light) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tLight);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame.light);
    }
    var org = frame.origin || [0, 0];
    gl.uniform2f(u.res, W, H);
    gl.uniform2f(u.srcSize, sw, sh);
    gl.uniform2f(u.origin, org[0], org[1]);
    gl.uniform1f(u.px, px);
    gl.uniform1f(u.dpr, o.pixelRatio || 1);
    gl.uniform3fv(u.paper, this.paper);
    gl.uniform3fv(u.ink, this.ink);
    gl.uniform3fv(u.faint, this.faint);
    gl.uniform1f(u.wobble, this.wobble);
    gl.uniform1f(u.lineW, o.lineWidth);
    gl.uniform1f(u.detail, Math.max(0, Math.min(1, o.detail)));
    gl.uniform1f(u.hatchOn, o.hatch && !clean ? 1 : 0);
    gl.uniform1f(u.hatchGap, o.hatchGap);
    gl.uniform1f(u.grainOn, o.grain && !clean ? 1 : 0);
    gl.uniform1f(u.colour, Math.max(0, Math.min(1, o.colour)));
    gl.uniform1f(u.shade, Math.max(0, Math.min(2, o.shade)));
    gl.uniform1f(u.exposure, Math.max(0.25, Math.min(4, o.exposure)));
    gl.uniform1f(u.hasLight, frame.light ? 1 : 0);
    gl.uniform1f(u.lightRef, frame.lightRef != null ? frame.lightRef : 1);
    gl.uniform1f(u.mixK, mix);
    gl.uniform1f(u.time, o.boil && frame.time != null ? Math.floor(frame.time * 6) / 6 * 0.37 : 0);
    gl.uniform1f(u.grid, o.grid || 0);
    gl.uniform1f(u.chalk, this.chalk);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return canvas;
  };
  Sketch2D.prototype.dispose = function () {
    if (this._mo) this._mo.disconnect();
    if (this._mq && this._mq.removeEventListener) this._mq.removeEventListener("change", this._onTheme);
    var gl = this.gl;
    if (gl) {
      gl.deleteTexture(this.tSrc); gl.deleteTexture(this.tLight); gl.deleteBuffer(this.buf); gl.deleteProgram(this.prog);
      var lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    }
    this._last = null;
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  };
  B.Sketch2D = Sketch2D;
  if (typeof window !== "undefined") { window.Blyant = Object.assign(window.Blyant || {}, B); }
})();

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

    // held: the points the level holds. more: points keep coming, from a spawner or because the level comes round again
    var nCollect = 0, nGoal = 0, spawnCollect = false, held = 0, more = kind === "runner" || kind === "fly", j;
    var stompKind = kind === "platform" || kind === "runner";
    for (i = 0; i < things.length; i++) {
      t = things[i];
      if (t.role === "collect") { nCollect++; held += t.points; }
      if (t.role === "goal") nGoal++;
      if (t.role === "hazard" && t.move !== "still" && stompKind) held++;   // jumped on: one point
    }
    for (i = 0; i < spawn.length; i++) for (j = 0; j < spawn[i].things.length; j++) {
      t = spawn[i].things[j];
      if (t.role === "collect" && t.points > 0) spawnCollect = true;
      if (t.role === "hazard" && stompKind) more = true;
    }
    if (spawnCollect) more = true;
    var canScore = held > 0 || spawnCollect;
    var win = pick(ri.win, WINS, null);
    if (win === "goal" && !nGoal && kind !== "runner" && kind !== "fly") win = null;   // runner and fly can win at the world's end
    if (win === "collect" && !nCollect) win = null;
    if (win === "score" && !canScore) win = null;
    if (!win) win = nGoal ? "goal" : nCollect ? "collect" : kind === "catch" && canScore ? "score" : "survive";
    var score = Math.round(num(ri.score, 10, 1, 9999)), time = num(ri.time, 0, 0, 3600);
    if (win === "score" && !more) score = Math.min(score, held);   // nothing comes back: the level cannot give more than it holds
    var rules = {
      lives: Math.round(num(ri.lives, 3, 1, 9)), win: win,
      score: score,
      time: time > 0 ? Math.max(5, time) : win === "survive" ? 45 : null   // a time that is not above zero is no time limit
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
    ".b-game__hud{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:14px;column-gap:min(14px,3.9%);padding:8px 8px 0 14px;pointer-events:none;font-size:34px;line-height:1;font-weight:600;text-shadow:0 0 3px var(--paper),0 0 3px var(--paper),0 0 7px var(--paper),0 0 7px var(--paper);z-index:1}",
    ".b-game__root:not([data-state='playing']):not([data-state='paused']) .b-game__hud,.b-game__root:not([data-state='playing']) .b-game__pad{visibility:hidden}",
    ".b-game__lives{display:flex;flex-wrap:wrap;gap:1px;flex:0 1 auto;min-width:0;height:30px}",   /* many lives on a narrow screen: the hearts go on more rows, under the first */
    ".b-game__lives svg{flex:none;width:32px;height:30px;overflow:visible;color:var(--line)}",
    ".b-game__lives svg.is-lost{opacity:.4}",
    ".b-game__score{display:flex;flex:none;align-items:center;gap:5px;margin-left:auto}",
    ".b-game__score svg{width:30px;height:30px;overflow:visible;color:var(--line)}",
    ".b-game__time{flex:none;min-width:1.9em;text-align:right;font-variant-numeric:tabular-nums}",
    ".b-game__time:empty{display:none}",
    ".b-game__pause{pointer-events:auto;-webkit-appearance:none;appearance:none;background:none;border:0;margin:0;padding:0;flex:none;width:44px;height:44px;display:grid;place-items:center;cursor:pointer;color:var(--line);border-radius:50%;touch-action:manipulation}",
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
    var key = "n|" + str, hit = this._notes[key];   // never a name Object.prototype has
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
    this._notes[key] = cv;
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
      var refit = function (e) { var x = e.x, y = e.y, b = y + e.h / 2; self._fit(e, e.from, e.index); e.x = x; e.y = e.role === "solid" ? y : b - e.h / 2; };
      self._ents.forEach(refit);
      if (self._p) refit(self._p);   // the player is not among _ents
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
      if (!down) return;
      if (k === "p" && !e.repeat && this.state === "paused") { this.resume(); return; }
      // Enter or space starts, when the keys are not meant for something else on the page, and not while the win or lose screen is on its way.
      // The key is the game's own all the same: it is swallowed also while it is held back, or space would scroll the page away under the screen.
      var a = document.activeElement, here = !a || a === document.body || this.el.contains(a);
      if ((k === "enter" || k === " ") && here && !(a && a.classList && a.classList.contains("b-game__go"))) {
        e.preventDefault();
        if (!e.repeat && !(this._endT > 0) && this._clock - this._scrAt > 0.6) this._go();
      }
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
    var speed = Math.max(40, e.speed) * ramp;   // never so slow that it stays outside the view
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
      p.x += p.vx * dt; this._pushOut(p, true, dt);
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
  Game2D.prototype._pushOut = function (p, alongX, dt) {
    var i, s, penX, penY;
    for (i = 0; i < this._solids.length; i++) {
      s = this._solids[i];
      if (!s.alive || !overlap(p, s)) continue;
      if (alongX) {
        penX = Math.min(p.x + p.cw / 2 - (s.x - s.w / 2), s.x + s.w / 2 - (p.x - p.cw / 2));
        penY = Math.min(p.y + p.ch / 2 - (s.y - s.h / 2), s.y + s.h / 2 - (p.y - p.ch / 2));
        if (penX > penY && penX > Math.abs(p.vx) * dt + Math.abs(s.dx) + 1.5) continue;   // not made by this sideways move, and shorter up or down: the y pass sorts it out
        p.x = p.x < s.x ? s.x - s.w / 2 - p.cw / 2 - 0.01 : s.x + s.w / 2 + p.cw / 2 + 0.01; p.vx = 0;
      }
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
    if (this.state === "paused") { this._scrAt -= dt; return; }   // the clock stands still, but the wait before Enter and space resume still runs out
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
