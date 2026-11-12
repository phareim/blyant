#!/usr/bin/env python3
"""Bygger PowerPoint-malen til Blyant fra tokens.json og Blyant.rough.

    python3 build.py        # bygger malen sammen med resten av dist/

dist/blyant.potx          – malen: temaene Papir og Kull, elleve oppsett i hvert
dist/blyant-eksempel.pptx – de samme oppsettene fylt ut, som eksempel og til programmer som ikke leser .potx

Ingenting er tegnet for hånd her. Fargene, skriftene og strektykkelsene kommer fra
tokens.json, og blyantstrekene tegnes av Blyant.rough i src/blyant.js (gjennom Node,
se mal/streker.js). Malen har samme versjon som pakken: den står i temanavnet, i
filegenskapene og under lysbildet i malvisningen. Se docs/presentasjonsmal.md.
"""
import json, math, os, re, subprocess, sys, zipfile
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(os.path.join(ROOT, 'tokens.json')))

PX = 9525                 # EMU per px: the slide is drawn on a 1280 × 720 canvas
W, H = 1280, 720
ML, CW = 90, 1100         # .b-slide has 7 % padding left and right
LANG = 'nb-NO'
NS = ('xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"')
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
CT = 'application/vnd.openxmlformats-officedocument.'
TABLE_STYLE = '{B1A7A47E-0C0D-4B1E-9A5C-0B17A47B17A4}'
FONT = {k: re.match(r'"([^"]+)"', v).group(1) for k, v in T['type']['families'].items()}
STROKE = {t['name']: float(t['value'][:-2]) for t in T['stroke']['tokens']}

# Theme slots. Text 1/2 are ink and ink-soft, Background 1/2 are paper and paper-2, and the
# six accents are the chart colours in their fixed order, so a native chart gets them.
SLOT = {'ink': 'tx1', 'ink-soft': 'tx2', 'paper': 'bg1', 'paper-2': 'bg2',
        'chart-1': 'accent1', 'chart-2': 'accent2', 'chart-3': 'accent3',
        'chart-4': 'accent4', 'chart-5': 'accent5', 'chart-6': 'accent6'}
# Pencil strokes are ink with less pressure, so two passes on top of each other get darker.
PENCIL = {'line': 84, 'graphite-300': 36, 'line-faint': 16}


def mix(a, b, p):
    return ''.join('%02X' % round(int(a[i:i + 2], 16) * p + int(b[i:i + 2], 16) * (1 - p)) for i in (0, 2, 4))


class Tema:
    def __init__(self, tid, navn):
        self.id, self.navn, self.dark = tid, navn, tid != T['color']['themes'][0]['id']
        raw = {t['name']: t['value'] for t in T['color']['tokens']}

        def get(n):
            v = raw[n][tid] if isinstance(raw[n], dict) else raw[n]
            m = re.fullmatch(r'\{(.+)\}', v)
            return get(m.group(1)) if m else v.lstrip('#').upper()
        c = self.c = {n: get(n) for n in raw}
        c['note'] = mix(c['marker'], c['paper'], .62)      # .b-note
        c['tape'] = c['paper']
        sh = [t for t in T['shadow']['tokens'] if t['name'] == 'shadow-lift'][0]['value'][tid]
        n = [float(v) for v in re.findall(r'[\d.]+', sh)]
        self.shadow = (n[0], n[1], '%02X%02X%02X' % tuple(int(v) for v in n[4:7]), n[7])

    def farge(self, navn, alpha=None):
        if navn in PENCIL:
            navn, alpha = 'ink', PENCIL[navn]
        a = '<a:alpha val="%d"/>' % round(alpha * 1000) if alpha is not None and alpha < 100 else ''
        if navn in SLOT:
            return '<a:schemeClr val="%s">%s</a:schemeClr>' % (SLOT[navn], a)
        return '<a:srgbClr val="%s">%s</a:srgbClr>' % (self.c[navn], a)

    def fyll(self, navn, alpha=None):
        return '<a:solidFill>%s</a:solidFill>' % self.farge(navn, alpha)


# ---------------------------------------------------------------------------
# Blyant.rough → DrawingML
# ---------------------------------------------------------------------------
ROUGH, PENDING = {}, []


def rough(spec):
    key = json.dumps(spec, sort_keys=True)
    if key not in ROUGH:
        if spec not in PENDING:
            PENDING.append(spec)
        return 'M0 0L1 1'           # first pass only collects; draw() fills ROUGH before the second
    return ROUGH[key]


def draw():
    if not PENDING:
        return
    try:
        r = subprocess.run(['node', os.path.join(ROOT, 'mal', 'streker.js')], input=json.dumps(PENDING),
                           text=True, capture_output=True)
    except FileNotFoundError:
        sys.exit('Malen trenger Node for å tegne strekene med Blyant.rough. Installer Node og kjør build.py på nytt.')
    if r.returncode:
        sys.exit('mal/streker.js feilet:\n' + r.stderr)
    for spec, d in zip(PENDING, json.loads(r.stdout)):
        ROUGH[json.dumps(spec, sort_keys=True)] = d
    del PENDING[:]


def geom(d, filled=False):
    """An SVG path (absolute M, L, C, Q, Z) as a custGeom, and the box it sits in."""
    cmds = [(c, list(zip(*[iter(float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', a))] * 2)))
            for c, a in re.findall(r'([MLCQZ])([^MLCQZ]*)', d)]
    pts = [p for _, ps in cmds for p in ps]
    x0, y0 = min(p[0] for p in pts), min(p[1] for p in pts)
    w = max(1, round((max(p[0] for p in pts) - x0) * PX))
    h = max(1, round((max(p[1] for p in pts) - y0) * PX))

    def pt(ps):
        return ''.join('<a:pt x="%d" y="%d"/>' % (round((x - x0) * PX), round((y - y0) * PX)) for x, y in ps)
    out = ''
    for c, ps in cmds:
        if c == 'M':
            out += '<a:moveTo>%s</a:moveTo>' % pt(ps[:1]) + ''.join('<a:lnTo>%s</a:lnTo>' % pt([p]) for p in ps[1:])
        elif c == 'L':
            out += ''.join('<a:lnTo>%s</a:lnTo>' % pt([p]) for p in ps)
        elif c == 'C':
            out += ''.join('<a:cubicBezTo>%s</a:cubicBezTo>' % pt(ps[i:i + 3]) for i in range(0, len(ps), 3))
        elif c == 'Q':
            out += ''.join('<a:quadBezTo>%s</a:quadBezTo>' % pt(ps[i:i + 2]) for i in range(0, len(ps), 2))
        else:
            out += '<a:close/>'
    return (x0, y0, w, h), ('<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>'
                            '<a:pathLst><a:path w="%d" h="%d"%s>%s</a:path></a:pathLst></a:custGeom>'
                            % (w, h, '' if filled else ' fill="none"', out))


def hexpts(cx, cy, r):
    return [[round(cx + r * math.cos(math.radians(60 * i + 30)), 2), round(cy + r * math.sin(math.radians(60 * i + 30)), 2)]
            for i in range(6)]


def rectpts(x, y, w, h):
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]


# ---------------------------------------------------------------------------
# Shapes. A layout or a slide is a list of these; Del turns them into XML.
# ---------------------------------------------------------------------------
def strek(spec, farge='line', bredde=None, navn='Blyantstrek'):
    """A pencil stroke from Blyant.rough: {type: rect|line|hex|poly|arrow|hatch|…, seed, …}."""
    return dict(k='strek', spec=spec, farge=farge, navn=navn,
                bredde=bredde or (STROKE['stroke-hair'] if spec['type'] == 'hatch' else STROKE['stroke-pencil']))


def flate(punkter, farge, alpha=None, navn='Fargeblyant'):
    """A flat fill under a stroke, like the coloured-pencil fill in Blyant.figure."""
    return dict(k='flate', punkter=punkter, farge=farge, alpha=alpha, navn=navn)


def rekt(x, y, w, h, farge, alpha=None, rot=0, skygge=False, kant=None, navn='Flate'):
    return dict(k='rekt', boks=(x, y, w, h), farge=farge, alpha=alpha, rot=rot, skygge=skygge, kant=kant, navn=navn)


def ph(key, type, idx, boks, stil=None, prompt='', navn=None, **kw):
    """A placeholder. key is what a slide fills it by; type and idx are PowerPoint's own."""
    return dict(k='ph', key=key, type=type, idx=idx, boks=boks, stil=stil, prompt=prompt, navn=navn or prompt, **kw)


def fritekst(boks, stil, tekst, navn='Tekst'):
    return dict(k='tekst', boks=boks, stil=stil, tekst=tekst, navn=navn)


def tabell(boks, rader, kolonner, idx=None):
    return dict(k='tabell', boks=boks, rader=rader, kolonner=kolonner, idx=idx)


def stil(pt, font=None, farge='ink', caps=False, spc=0, algn='l', linje=None, fet=False):
    """Text style. font: display | body | note | mono (tokens.json type.families)."""
    return dict(pt=pt, font=font, farge=farge, caps=caps, spc=spc, algn=algn, linje=linje, fet=fet)


def rpr(t, s, tag='a:defRPr', lang=False):
    a = (' lang="%s"' % LANG if lang else '') + ' sz="%d" b="%d"' % (round(s['pt'] * 100), s['fet'])
    if s['caps']:
        a += ' cap="all"'
    if s['spc']:
        a += ' spc="%d"' % round(s['spc'] * s['pt'] * 100)
    face = {'display': '+mj-lt', 'body': '+mn-lt', None: None}.get(s['font'], FONT.get(s['font']))
    return '<%s%s>%s%s</%s>' % (tag, a, t.fyll(s['farge']), '<a:latin typeface="%s"/>' % face if face else '', tag)


def ppr(t, s, tag='a:lvl1pPr', kule=False):
    a = ' marL="0" indent="0" algn="%s"' % s['algn'] if not kule else ' algn="%s"' % s['algn']
    ln = '<a:lnSpc><a:spcPct val="%d"/></a:lnSpc>' % round(s['linje'] * 1000) if s['linje'] else ''
    return '<%s%s>%s<a:spcBef><a:spcPts val="0"/></a:spcBef>%s%s</%s>' % (tag, a, ln, '' if kule else '<a:buNone/>', rpr(t, s), tag)


def avsnitt(innhold, run='', algn=''):
    """Text as paragraphs. A string is one paragraph, \\n a line break; (level, text) indents."""
    out = ''
    for a in ([innhold] if isinstance(innhold, (str, tuple)) else innhold):
        niv, txt = a if isinstance(a, tuple) else (0, a)
        r = run or '<a:rPr lang="%s"/>' % LANG
        runs = ('<a:br>%s</a:br>' % r).join('<a:r>%s<a:t>%s</a:t></a:r>' % (r, escape(l)) for l in txt.split('\n'))
        a = (' lvl="%d"' % niv if niv else '') + (' algn="%s"' % algn if algn else '')
        out += '<a:p>%s%s</a:p>' % ('<a:pPr%s/>' % a if a else '', runs)
    return out


def xfrm(boks, rot=0, tag='a:xfrm'):
    x, y, w, h = boks
    return '<%s%s><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></%s>' % (
        tag, ' rot="%d"' % round(rot * 60000) if rot else '', round(x * PX), round(y * PX), round(w * PX), round(h * PX), tag)


FIELD = {'sldNum': ('slidenum', '‹#›', '{6B1A7A47-0001-4B1E-9A5C-0B17A47B17A4}'),
         'dt': ('datetime1', '', '{6B1A7A47-0002-4B1E-9A5C-0B17A47B17A4}')}


class Del:
    """The shape tree of one part: a master, a layout or a slide."""

    def __init__(self, tema, nivaa):
        self.t, self.nivaa, self.n, self.xml = tema, nivaa, 1, []

    def nv(self, navn, locks='', nvpr='<p:nvPr/>', txbox=False):
        self.n += 1
        return '<p:nvSpPr><p:cNvPr id="%d" name="%s"/><p:cNvSpPr%s>%s</p:cNvSpPr>%s</p:nvSpPr>' % (
            self.n, escape(navn, {'"': '&quot;'}), ' txBox="1"' if txbox else '', locks, nvpr)

    def linje(self, farge, bredde, alpha=None):
        return '<a:ln w="%d" cap="rnd">%s<a:round/></a:ln>' % (round(bredde * PX), self.t.fyll(farge, alpha))

    def add(self, s, innhold=None):
        t, k = self.t, s['k']
        if k == 'strek':
            (x, y, w, h), g = geom(rough(s['spec']))
            self.xml.append('<p:sp>%s<p:spPr>%s%s<a:noFill/>%s</p:spPr></p:sp>' % (
                self.nv(s['navn']), xfrm((x, y, w / PX, h / PX)), g, self.linje(s['farge'], s['bredde'])))
        elif k == 'flate':
            d = 'M' + 'L'.join('%s %s' % (p[0], p[1]) for p in s['punkter']) + 'Z'
            (x, y, w, h), g = geom(d, filled=True)
            self.xml.append('<p:sp>%s<p:spPr>%s%s%s<a:ln><a:noFill/></a:ln></p:spPr></p:sp>' % (
                self.nv(s['navn']), xfrm((x, y, w / PX, h / PX)), g, t.fyll(s['farge'], s['alpha'])))
        elif k == 'rekt':
            ln = self.linje(*s['kant']) if s['kant'] else '<a:ln><a:noFill/></a:ln>'
            fx = ''
            if s['skygge']:
                dx, dy, c, a = t.shadow
                fx = ('<a:effectLst><a:outerShdw blurRad="0" dist="%d" dir="%d" algn="tl" rotWithShape="0">'
                      '<a:srgbClr val="%s"><a:alpha val="%d"/></a:srgbClr></a:outerShdw></a:effectLst>'
                      % (round(math.hypot(dx, dy) * 1.6 * PX), round(math.degrees(math.atan2(dy, dx)) * 60000), c, round(a * 100000)))
            self.xml.append('<p:sp>%s<p:spPr>%s<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>%s%s%s</p:spPr></p:sp>' % (
                self.nv(s['navn']), xfrm(s['boks'], s['rot']), t.fyll(s['farge'], s['alpha']), ln, fx))
        elif k == 'tekst':
            self.xml.append(
                '<p:sp>%s<p:spPr>%s<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
                '<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>%s</p:txBody></p:sp>'
                % (self.nv(s['navn'], txbox=True), xfrm(s['boks']),
                   avsnitt(s['tekst'], rpr(t, s['stil'], 'a:rPr', lang=True), s['stil']['algn'])))
        elif k == 'tabell':
            self.tabell(s)
        else:
            self.ph(s, innhold)

    def ph(self, s, innhold):
        t, typ = self.t, s['type']
        tag = '<p:ph%s%s%s/>' % (' type="%s"' % typ if typ else '', ' sz="%s"' % s['sz'] if s.get('sz') else '',
                                 ' idx="%d"' % s['idx'] if s['idx'] is not None else '')
        nv = self.nv(s['navn'], '<a:spLocks noGrp="1"/>', '<p:nvPr>%s</p:nvPr>' % tag)
        if typ in FIELD:
            f = FIELD[typ]
            # the style on the field's own run too: LibreOffice reads it from there, not from lstStyle
            r = '<a:rPr lang="%s"/>' % LANG if self.nivaa == 'slide' else rpr(t, s['stil'], 'a:rPr', lang=True)
            pp = '' if self.nivaa == 'slide' else '<a:pPr algn="%s"/>' % s['stil']['algn']
            text = '<a:p>%s<a:fld id="%s" type="%s">%s<a:t>%s</a:t></a:fld><a:endParaRPr lang="%s"/></a:p>' % (pp, f[2], f[0], r, f[1], LANG)
        elif innhold:
            text = avsnitt(innhold)
        elif self.nivaa == 'slide' or not s['prompt']:
            text = '<a:p><a:endParaRPr lang="%s"/></a:p>' % LANG
        else:
            text = avsnitt(s['prompt'])
        if self.nivaa == 'slide':      # position and style come from the layout
            if typ == 'pic' and not innhold:
                self.xml.append('<p:sp>%s<p:spPr/></p:sp>' % nv)
            else:
                self.xml.append('<p:sp>%s<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>%s</p:txBody></p:sp>' % (nv, text))
            return
        i = s.get('ins', 0) * PX
        body = '<a:bodyPr vert="horz" lIns="%d" tIns="%d" rIns="%d" bIns="%d" rtlCol="0" anchor="%s">%s</a:bodyPr>' % (
            i, i, i, i, s.get('anker', 't'), '<a:normAutofit/>' if s.get('krymp', True) else '<a:noAutofit/>')
        lst = '<a:lstStyle>%s</a:lstStyle>' % (ppr(t, s['stil']) if s['stil'] else '')
        self.xml.append('<p:sp>%s<p:spPr>%s</p:spPr><p:txBody>%s%s%s</p:txBody></p:sp>' % (
            nv, xfrm(s['boks'], s.get('rot', 0)), body, lst, text))

    def tabell(self, s):
        self.n += 1
        t, (x, y, w, h) = self.t, s['boks']
        cols = s['kolonner']
        grid = ''.join('<a:gridCol w="%d"/>' % round(w * PX * c / sum(cols)) for c in cols)
        rows = ''
        for r, rad in enumerate(s['rader']):
            st = stil(14, 'note', 'ink-soft', caps=True, spc=.06) if r == 0 else stil(22)
            cells = ''.join(
                '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="%s"/><a:r>%s<a:t>%s</a:t></a:r></a:p></a:txBody>'
                '<a:tcPr marL="%d" marR="%d" marT="%d" marB="%d" anchor="ctr"/></a:tc>'
                % ('r' if i else 'l', rpr(t, st, 'a:rPr', lang=True), escape(str(c)), 12 * PX, 12 * PX, 6 * PX, 6 * PX)
                for i, c in enumerate(rad))
            rows += '<a:tr h="%d">%s</a:tr>' % (round(h * PX / len(s['rader'])), cells)
        nvpr = '<p:nvPr><p:ph idx="%d"/></p:nvPr>' % s['idx'] if s['idx'] is not None else '<p:nvPr/>'
        self.xml.append(
            '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="%d" name="Tabell"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/>'
            '</p:cNvGraphicFramePr>%s</p:nvGraphicFramePr>%s<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">'
            '<a:tbl><a:tblPr firstRow="1"><a:tableStyleId>%s</a:tableStyleId></a:tblPr><a:tblGrid>%s</a:tblGrid>%s</a:tbl>'
            '</a:graphicData></a:graphic></p:graphicFrame>' % (self.n, nvpr, xfrm(s['boks'], tag='p:xfrm'), TABLE_STYLE, grid, rows))

    def tree(self, bg=None, navn=''):
        b = '<p:bg><p:bgPr>%s<a:effectLst/></p:bgPr></p:bg>' % self.t.fyll(bg) if bg else ''
        return ('<p:cSld%s>%s<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
                '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
                '%s</p:spTree></p:cSld>' % (' name="%s"' % navn if navn else '', b, ''.join(self.xml)))


# ---------------------------------------------------------------------------
# The layouts. Sizes follow .b-slide: kicker, title, body and a foot in mono.
# ---------------------------------------------------------------------------
KICKER = stil(16, 'note', 'ink-soft', caps=True, spc=.06)
TITTEL = stil(44, 'display', linje=85)
BRODTEKST = stil(24, 'body', linje=100)
FOT = stil(12, 'mono', 'ink-soft')
TITLE_BOX, BODY_BOX = (ML, 86, CW, 104), (ML, 206, CW, 408)


def ramme(seed):
    return strek({'type': 'rect', 'x': 20, 'y': 20, 'w': W - 40, 'h': H - 40, 'seed': seed}, navn='Ramme')


def fot(idx=10):
    """.b-slide__foot: a line of text to the left, the date and the slide number to the right, in mono."""
    return [ph('dato', 'dt', idx, (700, 654, 280, 26), stil(12, 'mono', 'ink-soft', algn='r'), sz='half', navn='Dato', anker='ctr', krymp=False),
            ph('fot', 'ftr', idx + 1, (ML, 654, 590, 26), FOT, sz='quarter', navn='Bunntekst', anker='ctr', krymp=False),
            ph('nummer', 'sldNum', idx + 2, (1090, 654, 100, 26), stil(12, 'mono', 'ink-soft', algn='r'), sz='quarter', navn='Lysbildenummer', anker='ctr', krymp=False)]


def hode(seed, tittel='Klikk for å legge til en tittel'):
    return [ramme(seed),
            ph('kicker', 'body', 13, (ML, 56, CW, 28), KICKER, 'Stikkord', sz='quarter', krymp=False),
            ph('tittel', 'title', None, TITLE_BOX, None, tittel, navn='Tittel')]


def oppsett(t):
    """The eleven layouts, the same in every theme."""
    dust = ['dust-red', 'dust-orange', 'dust-yellow', 'dust-green', 'dust-blue', 'dust-purple']
    out = []

    # 1. Tittel: the cover from the test page, with the row of hexes
    f = [ramme(1),
         ph('kicker', 'body', 13, (ML, 132, 900, 32), stil(18, 'note', 'ink-soft', caps=True, spc=.06), 'Stikkord', sz='quarter', krymp=False),
         ph('tittel', 'ctrTitle', None, (ML, 170, 1000, 206), stil(72, 'display', linje=80), 'Klikk for å legge til en tittel', navn='Tittel'),
         ph('undertittel', 'subTitle', 1, (ML, 392, 900, 84), stil(26, 'body', linje=100), 'Klikk for å legge til en undertittel')]
    for i in range(9):
        cx, cy = 628 + i * 64, 536 + (i % 2) * 55
        if i % 3 == 1:
            f.append(flate(hexpts(cx, cy, 34), dust[i % 6], 55))
        f.append(strek({'type': 'hex', 'cx': cx, 'cy': cy, 'r': 34, 'seed': 30 + i * 98}, navn='Hex'))
    f.append(strek({'type': 'arrow', 'x1': 536, 'y1': 600, 'x2': 632, 'y2': 550, 'bend': .3, 'seed': 984}, navn='Pil'))
    out.append(dict(navn='Tittel', type='title', former=f + fot()))

    # 2. Seksjon: a new sheet on top, and one big hatched hex
    f = [ramme(2),
         ph('kicker', 'body', 13, (ML, 236, 640, 30), stil(18, 'note', 'ink-soft', caps=True, spc=.06), 'Stikkord', sz='quarter', krymp=False),
         ph('tittel', 'title', None, (ML, 272, 660, 150), stil(60, 'display', linje=80), 'Klikk for å legge til en seksjonstittel', navn='Tittel'),
         ph('tekst', 'body', 1, (ML, 436, 620, 90), stil(24, 'body', 'ink-soft', linje=100), 'Hva denne delen handler om'),
         strek({'type': 'hatch', 'points': hexpts(1000, 350, 160), 'gap': 11, 'seed': 21}, 'graphite-300', navn='Skravur'),
         strek({'type': 'hex', 'cx': 1000, 'cy': 350, 'r': 160, 'seed': 22}, navn='Hex'),
         flate(hexpts(822, 508, 60), 'marker'),
         strek({'type': 'hex', 'cx': 822, 'cy': 508, 'r': 60, 'seed': 23}, navn='Hex')]
    out.append(dict(navn='Seksjon', type='secHead', bg='paper-2', former=f + fot()))

    # 3. Tittel og innhold
    out.append(dict(navn='Tittel og innhold', type='obj', former=hode(3) + [
        ph('innhold', None, 1, BODY_BOX, None, 'Klikk for å legge til tekst', navn='Innhold')] + fot()))

    # 4. To kolonner, with a light pencil line between them
    out.append(dict(navn='To kolonner', type='twoObj', former=hode(4) + [
        ph('venstre', None, 1, (ML, 206, 520, 408), None, 'Klikk for å legge til tekst', navn='Innhold venstre', sz='half'),
        ph('hoyre', None, 2, (670, 206, 520, 408), None, 'Klikk for å legge til tekst', navn='Innhold høyre', sz='half'),
        strek({'type': 'line', 'x1': 640, 'y1': 214, 'x2': 640, 'y2': 606, 'seed': 41, 'passes': 1}, 'graphite-300', navn='Skille')] + fot()))

    # 5. Tre bokser: three .b-box frames with a heading and a text each
    f = hode(5)
    for i in range(3):
        x = ML + i * 380
        f += [strek({'type': 'rect', 'x': x, 'y': 214, 'w': 340, 'h': 392, 'seed': 51 + i * 7}, navn='Boks'),
              ph('boks%d' % (i + 1), 'body', 14 + i * 2, (x + 28, 236, 284, 50), stil(32, 'display', linje=90), 'Overskrift', sz='quarter', navn='Overskrift %d' % (i + 1)),
              ph('tekst%d' % (i + 1), 'body', 15 + i * 2, (x + 28, 296, 284, 290), stil(21, 'body', linje=100), 'Klikk for å legge til tekst', sz='quarter', navn='Tekst %d' % (i + 1))]
    out.append(dict(navn='Tre bokser', former=f + fot()))

    # 6. Bilde og tekst: .b-ph, the wireframe box with a cross, until a picture covers it
    px, py, pw, phh = 640, 210, 550, 372
    out.append(dict(navn='Bilde og tekst', type='picTx', former=hode(6) + [
        ph('tekst', 'body', 1, (ML, 206, 490, 408), None, 'Klikk for å legge til tekst', sz='half'),
        flate(rectpts(px, py, pw, phh), 'paper-2', navn='Plassholder'),
        strek({'type': 'line', 'x1': px + 4, 'y1': py + 4, 'x2': px + pw - 4, 'y2': py + phh - 4, 'seed': 61, 'passes': 1}, 'graphite-300', 1.3, navn='Kryss'),
        strek({'type': 'line', 'x1': px + pw - 4, 'y1': py + 4, 'x2': px + 4, 'y2': py + phh - 4, 'seed': 62, 'passes': 1}, 'graphite-300', 1.3, navn='Kryss'),
        strek({'type': 'rect', 'x': px, 'y': py, 'w': pw, 'h': phh, 'seed': 63}, navn='Bilderamme'),
        ph('bilde', 'pic', 2, (px + 7, py + 7, pw - 14, phh - 14), stil(18, 'note', 'ink-soft', algn='ctr'), 'Bilde', anker='ctr', krymp=False),
        ph('bildetekst', 'body', 3, (px, py + phh + 10, pw, 26), stil(15, 'note', 'ink-soft'), 'Bildetekst', sz='quarter', krymp=False)] + fot()))

    # 7. Stort tall: Stat, with the marker under the one number the eye should find
    out.append(dict(navn='Stort tall', former=hode(7) + [
        flate([[76, 318], [412, 311], [405, 384], [68, 389]], 'marker', navn='Tusj'),
        ph('merkelapp', 'body', 14, (ML, 214, 500, 26), stil(15, 'note', 'ink-soft', caps=True, spc=.08), 'Merkelapp', sz='quarter', krymp=False),
        ph('tall', 'body', 15, (ML, 246, 520, 220), stil(150, 'display', linje=80, fet=True), '42', sz='quarter', navn='Tall'),
        ph('fotnote', 'body', 16, (ML, 414, 500, 60), stil(20, 'body', 'ink-soft', linje=100), 'Hva tallet sammenlignes med', sz='quarter'),
        ph('tekst', 'body', 1, (670, 214, 520, 400), None, 'Klikk for å legge til tekst', sz='half')] + fot()))

    # 8. Notatlapp: .b-note, a little crooked, with a strip of tape
    tilt = -1.2
    out.append(dict(navn='Notatlapp', former=hode(8) + [
        ph('tekst', 'body', 1, (ML, 206, 560, 408), None, 'Klikk for å legge til tekst', sz='half'),
        rekt(750, 222, 420, 360, 'note', rot=tilt, skygge=True, navn='Lapp'),
        rekt(906, 204, 116, 30, 'tape', 70, rot=2, kant=('ink', .8, 25), navn='Teip'),
        ph('notat', 'body', 2, (750, 222, 420, 360), stil(24, 'note', 'on-marker', linje=105), 'husk: skriv det ene her', sz='quarter', rot=tilt, ins=30, anker='ctr', navn='Notat')] + fot()))

    # 9. Innhold og margnotat: .b-scribble in the margin and an arrow that points at the content
    out.append(dict(navn='Innhold og margnotat', former=hode(9) + [
        ph('innhold', None, 1, (ML, 206, 790, 408), None, 'Klikk for å legge til tekst', navn='Innhold'),
        ph('margnotat', 'body', 2, (940, 250, 250, 170), stil(19, 'note', 'ink-soft', linje=105), 'en kommentar i margen', sz='quarter'),
        strek({'type': 'arrow', 'x1': 1010, 'y1': 440, 'x2': 900, 'y2': 500, 'bend': -.25, 'seed': 91, 'wobble': 2.4}, navn='Pil')] + fot()))

    # 10. Bare tittel, 11. Tomt
    out.append(dict(navn='Bare tittel', type='titleOnly', former=hode(10) + fot()))
    out.append(dict(navn='Tomt', type='blank', former=[ramme(11)] + fot()))
    return out


def master(t, versjon):
    d = Del(t, 'master')
    for s in [ph('tittel', 'title', None, TITLE_BOX, None, 'Klikk for å redigere tittelstil', navn='Tittel'),
              ph('tekst', 'body', 1, BODY_BOX, None, [(0, 'Klikk for å redigere tekststiler'), (1, 'Andre nivå'), (2, 'Tredje nivå'), (3, 'Fjerde nivå'), (4, 'Femte nivå')], navn='Tekst'),
              *fot(2),
              # below the slide, so it only shows in the master view: which version this deck was made from
              fritekst((ML, H + 16, CW, 24), FOT, 'Blyant %s · %s · github.com/phareim/blyant' % (versjon, t.navn), navn='Blyant-versjon')]:
        d.add(s)

    def nivaa(n, marL, pt, kule):
        b = ('<a:buClr>%s</a:buClr><a:buSzPct val="60000"/><a:buFont typeface="Arial"/><a:buChar char="%s"/>' % (t.farge('ink'), kule)) if kule else '<a:buNone/>'
        return ('<a:lvl%dpPr marL="%d" indent="%d" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">'
                '<a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="%d"/></a:spcBef>%s'
                '<a:defRPr sz="%d" kern="1200">%s<a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl%dpPr>'
                % (n, marL, -330200 if kule else 0, 1000 if n < 3 else 600, b, pt * 100, t.fyll('ink'), n))
    # level 1 is a paragraph, as on a .b-slide; a list starts at level 2 with the small ring from prose lists
    body = ''.join(nivaa(n, m, pt, k) for n, m, pt, k in [
        (1, 0, 24, ''), (2, 330200, 24, '○'), (3, 660400, 21, '–'), (4, 990600, 19, '–'), (5, 1320800, 19, '–'),
        (6, 1651000, 19, '–'), (7, 1981200, 19, '–'), (8, 2311400, 19, '–'), (9, 2641600, 19, '–')])
    title = ('<a:lvl1pPr algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:lnSpc><a:spcPct val="%d"/></a:lnSpc>'
             '<a:spcBef><a:spcPct val="0"/></a:spcBef><a:buNone/><a:defRPr sz="%d" b="0" kern="1200">%s<a:latin typeface="+mj-lt"/><a:ea typeface="+mj-ea"/><a:cs typeface="+mj-cs"/></a:defRPr></a:lvl1pPr>'
             % (TITTEL['linje'] * 1000, TITTEL['pt'] * 100, t.fyll('ink')))
    other = ''.join('<a:lvl%dpPr marL="%d" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">'
                    '<a:defRPr sz="1800" kern="1200">%s<a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl%dpPr>'
                    % (n, (n - 1) * 457200, t.fyll('ink'), n) for n in range(1, 10))
    return d, title, body, other


def theme(t, versjon):
    c = t.c
    dk1, lt1, dk2, lt2 = (c['paper'], c['ink'], c['paper-2'], c['ink-soft']) if t.dark else (c['ink'], c['paper'], c['ink-soft'], c['paper-2'])
    slots = [('dk1', dk1), ('lt1', lt1), ('dk2', dk2), ('lt2', lt2)] + [('accent%d' % i, c['chart-%d' % i]) for i in range(1, 7)] \
        + [('hlink', c['focus']), ('folHlink', c['dust-purple'])]
    scheme = ''.join('<a:%s><a:srgbClr val="%s"/></a:%s>' % (n, v, n) for n, v in slots)
    font = '<a:latin typeface="%s"/><a:ea typeface=""/><a:cs typeface=""/>'
    ln = ''.join('<a:ln w="%d" cap="rnd" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln>'
                 % round(STROKE[k] * PX) for k in ('stroke-hair', 'stroke-pencil', 'stroke-bold'))
    solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' * 3
    pencil = '<a:ln w="%d" cap="rnd"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:round/></a:ln>' % round(STROKE['stroke-pencil'] * PX)
    # the rest of the palette, for the colour picker: everything in tokens.json that has no theme slot
    extra = ''.join('<a:custClr name="%s"><a:srgbClr val="%s"/></a:custClr>' % (n, c[n]) for n in
                    ['marker', 'dust-red', 'dust-orange', 'dust-yellow', 'dust-green', 'dust-blue', 'dust-purple',
                     'paper-3', 'graphite-100', 'graphite-300', 'graphite-700'])
    return (HEAD + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Blyant %s %s"><a:themeElements>'
            '<a:clrScheme name="Blyant %s">%s</a:clrScheme>'
            '<a:fontScheme name="Blyant"><a:majorFont>%s</a:majorFont><a:minorFont>%s</a:minorFont></a:fontScheme>'
            '<a:fmtScheme name="Blyant"><a:fillStyleLst>%s</a:fillStyleLst><a:lnStyleLst>%s</a:lnStyleLst>'
            '<a:effectStyleLst>%s</a:effectStyleLst><a:bgFillStyleLst>%s</a:bgFillStyleLst></a:fmtScheme></a:themeElements>'
            # a new shape is a sheet with a pencil outline, not a blue box
            '<a:objectDefaults><a:spDef><a:spPr><a:solidFill><a:schemeClr val="bg2"/></a:solidFill>%s</a:spPr><a:bodyPr rtlCol="0" anchor="ctr"/>'
            '<a:lstStyle><a:defPPr algn="ctr"><a:defRPr><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:defPPr></a:lstStyle></a:spDef>'
            '<a:lnDef><a:spPr>%s</a:spPr><a:bodyPr/><a:lstStyle/></a:lnDef></a:objectDefaults>'
            '<a:extraClrSchemeLst/><a:custClrLst>%s</a:custClrLst></a:theme>'
            % (versjon, t.navn, t.navn, scheme, font % FONT['display'], font % FONT['body'], solid, ln,
               '<a:effectStyle><a:effectLst/></a:effectStyle>' * 3, solid, pencil, pencil, extra))


def table_styles():
    none = '<a:ln><a:noFill/></a:ln>'
    dash = '<a:ln w="9525" cmpd="sng"><a:solidFill><a:schemeClr val="tx1"><a:alpha val="36000"/></a:schemeClr></a:solidFill><a:prstDash val="dash"/></a:ln>'
    rule = '<a:ln w="%d" cmpd="sng"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:ln>' % round(STROKE['stroke-pencil'] * PX)
    tx = '<a:tcTxStyle><a:fontRef idx="minor"><a:prstClr val="black"/></a:fontRef><a:schemeClr val="%s"/></a:tcTxStyle>'
    return (HEAD + '<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="%s"><a:tblStyle styleId="%s" styleName="Blyant">'
            '<a:wholeTbl>%s<a:tcStyle><a:tcBdr><a:left>%s</a:left><a:right>%s</a:right><a:top>%s</a:top><a:bottom>%s</a:bottom>'
            '<a:insideH>%s</a:insideH><a:insideV>%s</a:insideV></a:tcBdr><a:fill><a:noFill/></a:fill></a:tcStyle></a:wholeTbl>'
            '<a:firstRow>%s<a:tcStyle><a:tcBdr><a:bottom>%s</a:bottom></a:tcBdr><a:fill><a:noFill/></a:fill></a:tcStyle></a:firstRow>'
            '</a:tblStyle></a:tblStyleLst>' % (TABLE_STYLE, TABLE_STYLE, tx % 'tx1', none, none, none, dash, dash, none, tx % 'tx2', rule))


# ---------------------------------------------------------------------------
# The example deck: every layout filled in, as the guidelines want them used
# ---------------------------------------------------------------------------
def eksempel(versjon):
    """(theme index, layout name, {placeholder key: text}, extra shapes) per slide."""
    bunn = {'fot': 'Blyant %s' % versjon, 'nummer': True}
    data = [['R1', 14], ['R2', 22], ['R3', 19], ['R4', 31], ['R5', 27]]
    y0 = 578
    bars = [strek({'type': 'line', 'x1': 190, 'y1': y0, 'x2': 1090, 'y2': y0, 'seed': 11}),
            strek({'type': 'line', 'x1': 190, 'y1': y0, 'x2': 190, 'y2': 226, 'seed': 12})]
    for i, (navn, v) in enumerate(data):
        x, h = 270 + i * 160, round(v / 35 * 330, 2)
        bars += [strek({'type': 'rect', 'x': x, 'y': y0 - h, 'w': 92, 'h': h, 'seed': 70 + i * 98}),
                 strek({'type': 'hatch', 'points': rectpts(x, y0 - h, 92, h), 'gap': 5 if i == 3 else 9, 'seed': 90 + i * 98}),
                 fritekst((x - 20, y0 + 6, 132, 34), stil(22, 'body', algn='ctr'), navn),
                 fritekst((x - 20, y0 - h - 30, 132, 26), stil(15, 'mono', algn='ctr'), str(v))]
    bars.append(fritekst((880, 214, 300, 32), stil(19, 'note', 'ink-soft'), 'R4: endelig flyt!'))
    return [
        (0, 'Tittel', dict(bunn, kicker='Blyant · presentasjonsmal', tittel='Skisse først,\nstil etterpå',
                           undertittel='Et håndtegnet system for spill, nettsider, dokumenter og presentasjoner.'), []),
        (0, 'Tittel og innhold', dict(bunn, kicker='Slik brukes malen', tittel='Tittelen er påstanden, ikke temaet', innhold=[
            'Én tanke per slide. Det som ikke får plass, hører hjemme i notatene eller på neste slide.',
            (1, 'Skriv «Hopp per runde økte i R4», ikke «Resultater».'),
            (1, 'Farge er effekt: tusj på det ene øyet skal finne.'),
            (1, 'Merk eksempeldata som eksempeldata i stikkordet eller bunnteksten.')]), []),
        (0, 'Seksjon', dict(bunn, kicker='Del 2', tittel='Oppsettene', tekst='Elleve oppsett i Papir, og de samme elleve i Kull.'), []),
        (0, 'To kolonner', dict(bunn, kicker='Temaer', tittel='Papir i dagslys, Kull i et mørkt rom', venstre=[
            'Papir er det lyse arket. Det passer på skjerm, på utskrift og i et lyst møterom.',
            (1, 'Grafitt på nesten hvitt papir.'), (1, 'Standardvalget.')], hoyre=[
            'Kull er det samme arket i mørket. Fargene er løftet litt, så de bærer like godt.',
            (1, 'Lys strek på mørkt papir.'), (1, 'Velg det under Oppsett når du lager en ny slide.')]), []),
        (0, 'Tre bokser', dict(bunn, kicker='Arkitektur', tittel='Tre lag',
                               boks1='Struktur', tekst1='Rammer og hierarki. Endres sjelden når den først sitter.',
                               boks2='Skall', tekst2='Font, strek og hjørner. Det eneste laget som byttes når merkevaren kommer.',
                               boks3='Effekt', tekst3='Gule og støvete farger. Brukes sparsomt, der øyet skal lande.'), []),
        (0, 'Bilde og tekst', dict(bunn, kicker='Plassholder', tittel='Bildet som ikke finnes ennå', tekst=[
            'Ruta med kryss står der til bildet kommer. Den sier at noe mangler, uten å late som noe annet.',
            'Slipp et bilde på ruta, så dekker det krysset og blir liggende inni blyantramma.'],
            bilde=None, bildetekst='Plassholder for et bilde'), []),
        (0, 'Stort tall', dict(bunn, kicker='Testflaten · eksempeldata', tittel='Hopp per runde økte i R4',
                               merkelapp='Hopp i runde 4', tall='31', fotnote='mot 19 i runde 3',
                               tekst=['Ett tall får hele venstre side, og tusjen ligger under det.',
                                      'Teksten til høyre sier hva tallet betyr og hva det sammenlignes med. Tallene her er oppdiktet.']), []),
        (0, 'Notatlapp', dict(bunn, kicker='Notat', tittel='Det ene du vil at de skal huske', tekst=[
            'Lappen er til en påminnelse, et sitat eller et åpent spørsmål. Den ligger litt skjevt, som en lapp gjør.',
            'Bruk én lapp per slide. To lapper konkurrerer om det samme blikket.'],
            notat='husk: farge bare som effekt!'), []),
        (0, 'Innhold og margnotat', dict(bunn, kicker='Testflaten · eksempeldata', tittel='Tabellen har Blyant-stilen',
                                         margnotat='R4: endelig flyt!'),
         [tabell((ML, 220, 790, 330), [['Runde', 'Hopp', 'Bom', 'Tid']] + [[n, v, 9 - i - (i == 3) * 3, '%d s' % (48 - v)] for i, (n, v) in enumerate(data)],
                 [3, 2, 2, 2], idx=1)]),
        (0, 'Bare tittel', dict(bunn, kicker='Testflaten · eksempeldata', tittel='Hopp per runde'), bars),
        (1, 'Tittel', dict(bunn, kicker='Blyant · Kull', tittel='Det samme arket,\ni mørket',
                           undertittel='Kull har de samme elleve oppsettene. Velg tema når du lager en ny slide.'), []),
        (1, 'Tre bokser', dict(bunn, kicker='Arkitektur', tittel='Tre lag',
                               boks1='Struktur', tekst1='Rammer og hierarki. Endres sjelden når den først sitter.',
                               boks2='Skall', tekst2='Font, strek og hjørner. Det eneste laget som byttes når merkevaren kommer.',
                               boks3='Effekt', tekst3='Gule og støvete farger. Brukes sparsomt, der øyet skal lande.'), []),
        (1, 'Stort tall', dict(bunn, kicker='Testflaten · eksempeldata', tittel='Hopp per runde økte i R4',
                               merkelapp='Hopp i runde 4', tall='31', fotnote='mot 19 i runde 3',
                               tekst=['Tusjen er den samme gule i Kull, og teksten oppå den er fortsatt mørk.']), []),
    ]


# ---------------------------------------------------------------------------
# The package
# ---------------------------------------------------------------------------
def rels(items):
    return HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">%s</Relationships>' % ''.join(
        '<Relationship Id="rId%d" Type="%s" Target="%s"/>' % (i + 1, typ, target) for i, (typ, target) in enumerate(items))


def pakke(versjon, slides, mal):
    """All parts of a .potx (mal=True) or .pptx as {path: xml}."""
    temaer = [Tema(t['id'], t['name']) for t in T['color']['themes']]
    parts, types, pres_rels, masters = {}, [], [], []
    lay_no, lay_id, layouts = 0, 2147483648, {}
    for m, t in enumerate(temaer, 1):
        d, title, body, other = master(t, versjon)
        mrels, ids = [], ''
        master_id, lay_id = lay_id, lay_id + 1
        for o in oppsett(t):
            lay_no += 1
            ld = Del(t, 'layout')
            for s in o['former']:
                ld.add(s)
            parts['ppt/slideLayouts/slideLayout%d.xml' % lay_no] = (
                HEAD + '<p:sldLayout %s%s preserve="1" userDrawn="1">%s<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'
                % (NS, ' type="%s"' % o['type'] if o.get('type') else '', ld.tree(o.get('bg'), o['navn'])))
            parts['ppt/slideLayouts/_rels/slideLayout%d.xml.rels' % lay_no] = rels([(REL + 'slideMaster', '../slideMasters/slideMaster%d.xml' % m)])
            types.append(('/ppt/slideLayouts/slideLayout%d.xml' % lay_no, CT + 'presentationml.slideLayout+xml'))
            mrels.append((REL + 'slideLayout', '../slideLayouts/slideLayout%d.xml' % lay_no))
            ids += '<p:sldLayoutId id="%d" r:id="rId%d"/>' % (lay_id, len(mrels))
            lay_id += 1
            layouts[(m - 1, o['navn'])] = (lay_no, o, t)
        mrels.append((REL + 'theme', '../theme/theme%d.xml' % m))
        cm = 'bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2"' if t.dark else 'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"'
        parts['ppt/slideMasters/slideMaster%d.xml' % m] = (
            HEAD + '<p:sldMaster %s>%s<p:clrMap %s accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" '
            'accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst>%s</p:sldLayoutIdLst>'
            '<p:txStyles><p:titleStyle>%s</p:titleStyle><p:bodyStyle>%s</p:bodyStyle><p:otherStyle>%s</p:otherStyle></p:txStyles></p:sldMaster>'
            % (NS, d.tree('paper'), cm, ids, title, body, other))
        parts['ppt/slideMasters/_rels/slideMaster%d.xml.rels' % m] = rels(mrels)
        parts['ppt/theme/theme%d.xml' % m] = theme(t, versjon)
        types += [('/ppt/slideMasters/slideMaster%d.xml' % m, CT + 'presentationml.slideMaster+xml'),
                  ('/ppt/theme/theme%d.xml' % m, CT + 'theme+xml')]
        pres_rels.append((REL + 'slideMaster', 'slideMasters/slideMaster%d.xml' % m))
        masters.append('<p:sldMasterId id="%d" r:id="rId%d"/>' % (master_id, len(pres_rels)))

    sld = ''
    for n, (ti, navn, fyll, ekstra) in enumerate(slides, 1):
        lay_no, o, t = layouts[(ti, navn)]
        sd = Del(t, 'slide')
        for s in o['former']:
            if s['k'] == 'ph' and s['key'] in fyll:
                sd.add(s, fyll[s['key']] if isinstance(fyll[s['key']], (str, list)) else None)
        for s in ekstra:
            sd.add(s)
        parts['ppt/slides/slide%d.xml' % n] = HEAD + '<p:sld %s>%s<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>' % (NS, sd.tree())
        parts['ppt/slides/_rels/slide%d.xml.rels' % n] = rels([(REL + 'slideLayout', '../slideLayouts/slideLayout%d.xml' % lay_no)])
        types.append(('/ppt/slides/slide%d.xml' % n, CT + 'presentationml.slide+xml'))
        pres_rels.append((REL + 'slide', 'slides/slide%d.xml' % n))
        sld += '<p:sldId id="%d" r:id="rId%d"/>' % (255 + n, len(pres_rels))
    pres_rels += [(REL + 'theme', 'theme/theme1.xml'), (REL + 'tableStyles', 'tableStyles.xml')]

    # embedTrueTypeFonts: PowerPoint saves Caveat and the two others into every deck made from the template
    parts['ppt/presentation.xml'] = (
        HEAD + '<p:presentation %s embedTrueTypeFonts="1"><p:sldMasterIdLst>%s</p:sldMasterIdLst>%s'
        '<p:sldSz cx="%d" cy="%d"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'
        % (NS, ''.join(masters), '<p:sldIdLst>%s</p:sldIdLst>' % sld if sld else '', W * PX, H * PX))
    parts['ppt/_rels/presentation.xml.rels'] = rels(pres_rels)
    parts['ppt/tableStyles.xml'] = table_styles()
    parts['docProps/core.xml'] = (
        HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Blyant</dc:creator><cp:keywords>blyant %s</cp:keywords>'
        '<dc:description>Laget med presentasjonsmalen til Blyant %s. https://github.com/phareim/blyant</dc:description>'
        '<cp:category>Blyant</cp:category><cp:version>%s</cp:version></cp:coreProperties>' % (versjon, versjon, versjon))
    parts['docProps/app.xml'] = (
        HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
        '<Template>Blyant %s</Template><PresentationFormat>Widescreen</PresentationFormat><Application>Blyant</Application></Properties>' % versjon)
    parts['docProps/custom.xml'] = (
        HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="BlyantVersjon"><vt:lpwstr>%s</vt:lpwstr></property></Properties>' % versjon)
    types += [('/ppt/presentation.xml', CT + 'presentationml.%s.main+xml' % ('template' if mal else 'presentation')),
              ('/ppt/tableStyles.xml', CT + 'presentationml.tableStyles+xml'),
              ('/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'),
              ('/docProps/app.xml', CT + 'extended-properties+xml'), ('/docProps/custom.xml', CT + 'custom-properties+xml')]
    parts['[Content_Types].xml'] = (
        HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>%s</Types>'
        % ''.join('<Override PartName="%s" ContentType="%s"/>' % p for p in sorted(types)))
    parts['_rels/.rels'] = rels([
        (REL + 'officeDocument', 'ppt/presentation.xml'),
        ('http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'),
        (REL + 'extended-properties', 'docProps/app.xml'), (REL + 'custom-properties', 'docProps/custom.xml')])
    return parts


def skriv(rel, parts):
    """Write the package. Stored, not deflated, with a fixed date: the same source gives the same bytes on every machine."""
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    order = ['[Content_Types].xml', '_rels/.rels'] + sorted(p for p in parts if p not in ('[Content_Types].xml', '_rels/.rels'))
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_STORED) as z:
        for name in order:
            zi = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            zi.create_system, zi.external_attr = 0, 0
            z.writestr(zi, parts[name].encode('utf-8'))
    print('  %-34s %7d bytes' % (rel, os.path.getsize(path)))


def bygg(versjon=None):
    versjon = versjon or json.load(open(os.path.join(ROOT, 'package.json')))['version']
    tittel = [(0, 'Tittel', {'kicker': None, 'tittel': None, 'undertittel': None}, [])]
    for _ in (1, 2):          # the first pass collects the strokes, the second writes them
        mal, eks = pakke(versjon, tittel, True), pakke(versjon, eksempel(versjon), False)
        draw()
    skriv('dist/blyant.potx', mal)
    skriv('dist/blyant-eksempel.pptx', eks)


if __name__ == '__main__':
    bygg()
