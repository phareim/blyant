/* @ds-bundle: {"format":4,"namespace":"Blyant","components":[{"name":"Button"},{"name":"Field"},{"name":"Check"},{"name":"Box"},{"name":"Note"},{"name":"Tag"},{"name":"Marker"},{"name":"Nav"},{"name":"Tabs"},{"name":"Table"},{"name":"Placeholder"},{"name":"Slide"},{"name":"Rough"},{"name":"Sketch3D"},{"name":"HexBoard"},{"name":"LineChart"},{"name":"BarChart"},{"name":"ScatterChart"},{"name":"Segments"},{"name":"Stat"},{"name":"Frames"},{"name":"Prose"},{"name":"Sidenote"},{"name":"Entries"},{"name":"Empty"}]} */
/* Blyant — hand-drawn pencil design system. Vanilla JS, no dependencies.
   Sketch3D needs window.THREE (three.js r147 UMD) loaded first.          */
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
  /** Draw a path on an svg. style: {stroke, width, fill, opacity, fillOpacity, dash} */
  B.draw = function (svg, d, style) {
    style = style || {};
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
      filter: style.grain === false ? null : B.grainFilter(svg)
    }, svg);
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

  // A graphite-grain filter, defined once per document.
  var grainId = null;
  B.grainFilter = function () {
    if (typeof document === "undefined") return null;
    if (!grainId) {
      grainId = "b-graphite";
      if (!document.getElementById(grainId)) {
        var s = el("svg", { width: 0, height: 0, "aria-hidden": "true", style: "position:absolute;width:0;height:0;overflow:hidden" });
        s.innerHTML = '<defs><filter id="' + grainId + '" filterUnits="userSpaceOnUse" x="-3000" y="-3000" width="8000" height="8000">' +
          '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="n"/>' +
          '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.35" result="m"/>' +
          '<feComposite in="SourceGraphic" in2="m" operator="in"/></filter></defs>';
        (document.body || document.documentElement).appendChild(s);
      }
    }
    return "url(#" + grainId + ")";
  };

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
    [".b-input", "box"],
    [".b-box:not(.b-box--flat)", "box"],
    [".b-callout", "box"],
    [".b-tag", "box-sm"],
    [".b-kbd", "box-sm"],
    [".b-ph", "cross"],
    [".b-slide", "box"],
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
      host.insertBefore(svg, host.firstChild);
      node.__bInk = svg;
    }
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
    B.draw(svg, d, { width: sw });
    if (extra) B.draw(svg, extra, { width: 1, opacity: 0.6 });
    node.classList.add("is-inked");
  }

  /** Draw rough outlines on every Blyant component inside root (default: document). Safe to call again. */
  B.ink = function (root) {
    root = root || document;
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
      B.draw(svg, d, { stroke: s.stroke, width: s.width || (s.type === "hatch" ? 1 : 1.7), opacity: s.opacity });
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
      B.draw(svg, R.poly(pn.points, true, { seed: o.seed * 131 + i * 17 + 5, wobble: wob }), { width: pn.pop ? 2.1 : 1.8, stroke: "var(--b-frame-line, var(--line))" });
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
