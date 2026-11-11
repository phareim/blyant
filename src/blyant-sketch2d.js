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
