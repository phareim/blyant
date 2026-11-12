/* Tegner strekene til PowerPoint-malen med Blyant.rough fra src/blyant.js, så malen
   har de samme strekene som nettsidene. Leser en JSON-liste med former på stdin og
   skriver en liste med SVG-stier (d-strenger) på stdout. Brukes av mal/potx.py. */
const fs = require("fs"), path = require("path"), vm = require("vm");

const ctx = {};
ctx.window = ctx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "src", "blyant.js"), "utf8"), ctx);
const R = ctx.Blyant.rough;

const out = JSON.parse(fs.readFileSync(0, "utf8")).map(function (s) {
  const o = { seed: s.seed, wobble: s.wobble, passes: s.passes, gap: s.gap, angle: s.angle, bend: s.bend };
  switch (s.type) {
    case "rect": return R.rect(s.x, s.y, s.w, s.h, o);
    case "line": return R.line(s.x1, s.y1, s.x2, s.y2, o);
    case "hex": return R.hex(s.cx, s.cy, s.r, o, s.flat);
    case "circle": return R.circle(s.cx, s.cy, s.r, o);
    case "ellipse": return R.ellipse(s.cx, s.cy, s.rx, s.ry, o);
    case "poly": return R.poly(s.points, s.closed !== false, o);
    case "arrow": return R.arrow(s.x1, s.y1, s.x2, s.y2, o);
    case "hatch": return R.hatch(s.points, o);
    case "curve": return R.scribble(s.points, o);
  }
  throw new Error("Ukjent form: " + s.type);
});
process.stdout.write(JSON.stringify(out));
