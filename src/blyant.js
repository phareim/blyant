/* @ds-bundle: {"format":4,"namespace":"Blyant","components":[{"name":"Button"},{"name":"Field"},{"name":"Check"},{"name":"Box"},{"name":"Note"},{"name":"Tag"},{"name":"Marker"},{"name":"Nav"},{"name":"Tabs"},{"name":"Table"},{"name":"Placeholder"},{"name":"Slide"},{"name":"Rough"},{"name":"Sketch3D"},{"name":"Sketch2D"},{"name":"HexBoard"},{"name":"LineChart"},{"name":"BarChart"},{"name":"ScatterChart"},{"name":"Segments"},{"name":"Stat"},{"name":"Frames"},{"name":"Prose"},{"name":"Sidenote"},{"name":"Entries"},{"name":"Empty"},{"name":"Menu"},{"name":"Toast"},{"name":"Sheet"},{"name":"Editor"},{"name":"Toolbar"},{"name":"Checklist"},{"name":"LinkCard"},{"name":"Thread"}]} */
/* Blyant — hand-drawn pencil design system. Vanilla JS, no dependencies.
   Sketch3D needs window.THREE (three.js r147 UMD) loaded first.
   Sketch2D (blyant-sketch2d.js) needs nothing but WebGL.                 */
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
