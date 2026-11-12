#!/usr/bin/env python3
"""Lager en Blyant-presentasjon (.pptx) fra en definisjon i JSON.

    python3 lag_presentasjon.py presentasjon.json            # skriver presentasjon.pptx
    python3 lag_presentasjon.py presentasjon.json -o ut.pptx
    python3 lag_presentasjon.py --oppsett                    # oppsettene og feltene i malen

Definisjonen er det Claude og du blir enige om i samtalen: hvilke slides, hvilket oppsett
hver har, og hva som står i feltene. Skriptet fyller ut PowerPoint-malen til Blyant
(blyant-eksempel.pptx) og rører ikke utseendet: alt som har med farger, skrifter og
streker å gjøre, ligger i malen. Feltene heter det samme som plassholderne i PowerPoint.

    {
      "tittel": "Navnet på presentasjonen",
      "tema": "papir",
      "bunntekst": "Hex-skisse · eksempeldata",
      "slides": [
        {"oppsett": "Tittel", "stikkord": "…", "tittel": "…", "undertittel": "…"},
        {"oppsett": "Tittel og innhold", "tittel": "…",
         "innhold": ["Et avsnitt.", ["et punkt", "et punkt til", ["et underpunkt"]]],
         "notater": "Det du sier."},
        {"oppsett": "Bilde", "tittel": "…", "bilde": "figur.png", "bildetekst": "…"},
        {"oppsett": "Tittel og innhold", "tittel": "…", "innhold": {"tabell": [["Runde", "Hopp"], ["R1", 14]]}}
      ]
    }

"tema" er "papir" eller "kull", og kan også settes på én slide. Tekst: en streng er ett avsnitt, en liste er flere, og en liste inni en liste er punkter.
==ord== får gul tusj, **ord** blir fet. Malen finner skriptet ved siden av seg selv, i
dist/ i Blyant-repoet eller i node_modules; ellers lastes den ned fra npm.

Bare standardbiblioteket i Python. Se SKILL.md og docs/presentasjonsmal.md i Blyant.
"""
import argparse, hashlib, io, json, os, posixpath, re, struct, sys, tarfile, urllib.request, zipfile
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape, quoteattr

MAL = 'blyant-eksempel.pptx'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
NS = ('xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"')
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
CT = 'application/vnd.openxmlformats-officedocument.presentationml.'
LANG = 'nb-NO'
PX = 9525
FOT = ('dt', 'ftr', 'sldNum')
FASTE = ('oppsett', 'tema', 'notater', 'bunntekst', 'dato', 'nummer')
BILDETYPER = {'png': 'image/png', 'jpeg': 'image/jpeg', 'gif': 'image/gif'}


class Feil(Exception):
    pass


def norm(s):
    """«Innhold venstre», «innhold_venstre» og «innholdVenstre» er samme felt."""
    return re.sub(r'[\s_]+', '', str(s).lower())


# ---------------------------------------------------------------------------
# Malen
# ---------------------------------------------------------------------------
def versjon_i(sti):
    try:
        with zipfile.ZipFile(sti) as z:
            m = re.search(r'name="BlyantVersjon"><vt:lpwstr>([^<]+)<', z.read('docProps/custom.xml').decode('utf-8'))
            return m.group(1) if m else None
    except (OSError, KeyError, zipfile.BadZipFile):
        return None


def hent(versjon):
    """Laster ned malen fra npm (jsDelivr, så npm-registeret) og legger den i ~/.cache/blyant."""
    v = versjon or 'latest'
    cache = os.path.join(os.path.expanduser('~'), '.cache', 'blyant', 'blyant-eksempel-%s.pptx' % v)
    if versjon and os.path.exists(cache):
        return cache
    data, feil = None, []
    try:
        data = urllib.request.urlopen('https://cdn.jsdelivr.net/npm/blyant@%s/dist/%s' % (v, MAL), timeout=30).read()
    except Exception as e:
        feil.append('jsDelivr: %s' % e)
    if data is None:
        try:
            meta = json.load(urllib.request.urlopen('https://registry.npmjs.org/blyant/%s' % v, timeout=30))
            tgz = urllib.request.urlopen(meta['dist']['tarball'], timeout=60).read()
            data = tarfile.open(fileobj=io.BytesIO(tgz)).extractfile('package/dist/' + MAL).read()
        except Exception as e:
            feil.append('npm: %s' % e)
    if data is None:
        if os.path.exists(cache):
            print('Advarsel: fikk ikke lastet ned malen, bruker den som ligger i %s' % cache, file=sys.stderr)
            return cache
        raise Feil('Fant ikke malen %s, og fikk ikke lastet den ned (%s).\nGi stien med --mal, eller legg fila ved siden av skriptet.'
                   % (MAL, '; '.join(feil)))
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    with open(cache, 'wb') as f:
        f.write(data)
    return cache


def finn_mal(sti=None, versjon=None):
    if sti:
        if not os.path.exists(sti):
            raise Feil('Fant ikke malen: %s' % sti)
        return sti
    her = os.path.dirname(os.path.realpath(__file__))
    for k in (os.environ.get('BLYANT_MAL'), os.path.join(her, MAL), os.path.join(her, '..', '..', 'dist', MAL),
              os.path.join(os.getcwd(), 'node_modules', 'blyant', 'dist', MAL),
              os.path.join(os.path.expanduser('~'), 'github', 'blyant', 'dist', MAL)):
        if k and os.path.exists(k) and (not versjon or versjon_i(k) == versjon):
            return os.path.normpath(k)
    return hent(versjon)


class Felt:
    def __init__(self, sp):
        nv = sp.find(P + 'nvSpPr')
        ph = nv.find(P + 'nvPr').find(P + 'ph')
        self.navn = nv.find(P + 'cNvPr').get('name')
        self.type, self.idx, self.sz = ph.get('type'), ph.get('idx'), ph.get('sz')
        x = sp.find(P + 'spPr').find(A + 'xfrm')
        self.boks = tuple(int(x.find(A + t).get(k)) for t, k in (('off', 'x'), ('off', 'y'), ('ext', 'cx'), ('ext', 'cy')))
        self.slag = {'pic': 'bilde', 'media': 'video', None: 'innhold'}.get(self.type, 'tekst')

    def ph(self):
        return '<p:ph%s/>' % ''.join(' %s="%s"' % (k, v) for k, v in (('type', self.type), ('sz', self.sz), ('idx', self.idx)) if v)


class Mal:
    """Leser temaene, oppsettene og plassholderne ut av malen, så skriptet følger den versjonen det får."""

    def __init__(self, sti):
        self.sti = sti
        with zipfile.ZipFile(sti) as z:
            self.parts = {n: z.read(n) for n in z.namelist()}
        self.versjon = versjon_i(sti) or '?'
        self.temaer = {}          # 'papir' → {'navn', 'farger', 'oppsett': {norm(navn): (navn, part, [Felt])}}
        pres = ET.fromstring(self.parts['ppt/presentation.xml'])
        prels = self.rels('ppt/presentation.xml')
        for m in pres.find(P + 'sldMasterIdLst'):
            mpart = prels[m.get(R + 'id')][1]
            mrels = self.rels(mpart)
            tema = ET.fromstring(self.parts[[t for typ, t in mrels.values() if typ.endswith('/theme')][0]])
            navn = tema.find(A + 'themeElements').find(A + 'clrScheme').get('name').replace('Blyant', '').strip()
            farger = {c.get('name'): c[0].get('val') for c in tema.iter(A + 'custClr')}
            oppsett = {}
            for l in ET.fromstring(self.parts[mpart]).find(P + 'sldLayoutIdLst'):
                lpart = mrels[l.get(R + 'id')][1]
                rot = ET.fromstring(self.parts[lpart])
                felt = [Felt(sp) for sp in rot.iter(P + 'sp') if sp.find(P + 'nvSpPr').find(P + 'nvPr').find(P + 'ph') is not None]
                lnavn = rot.find(P + 'cSld').get('name')
                oppsett[norm(lnavn)] = (lnavn, lpart, felt)
            self.temaer[norm(navn)] = dict(navn=navn, farger=farger, oppsett=oppsett)
        ts = self.parts.get('ppt/tableStyles.xml', b'').decode('utf-8')
        m = re.search(r'def="([^"]+)"', ts)
        self.tabellstil = m.group(1) if m else None
        m = re.search(r'<a:firstRow>.*?<a:latin typeface="([^"]+)"', ts)
        self.hodeskrift = m.group(1) if m else None
        self.har_notater = 'ppt/notesMasters/notesMaster1.xml' in self.parts

    def rels(self, part):
        """{rId: (type, part)} for en del av pakken."""
        d, f = posixpath.split(part)
        rot = ET.fromstring(self.parts['%s/_rels/%s.rels' % (d, f)])
        return {r.get('Id'): (r.get('Type'), posixpath.normpath(posixpath.join(d, r.get('Target')))) for r in rot}

    def liste(self):
        ut = ['Blyant %s · temaer: %s · %s' % (self.versjon, ', '.join(t['navn'] for t in self.temaer.values()), self.sti), '']
        for navn, _, felt in next(iter(self.temaer.values()))['oppsett'].values():
            ut.append(navn)
            for f in felt:
                if f.type not in FOT:
                    ut.append('    %-18s %s' % (f.navn.lower(), {'innhold': 'tekst, {"tabell": …} eller {"bilde": …}'}.get(f.slag, f.slag)))
            if any(f.type in FOT for f in felt):
                ut.append('    %-18s %s' % ('(bunn)', 'bunntekst, dato, nummer'))
            else:
                ut.append('    %-18s %s' % ('(bunn)', 'ingen'))
            ut.append('')
        ut.append('Alle slides kan også ha "tema" og "notater".')
        return '\n'.join(ut)


# ---------------------------------------------------------------------------
# Tekst
# ---------------------------------------------------------------------------
def avsnitt(v, niv=0):
    """Streng → ett avsnitt. Liste → flere. Liste i liste → ett nivå inn (punkter)."""
    if not isinstance(v, list):
        return [(niv, str(v))]
    ut = []
    for x in v:
        ut += avsnitt(x, niv + 1) if isinstance(x, list) else [(niv, str(x))]
    return ut


def loep(tekst, farger, rpr=''):
    """Runs for én linje: ==tusj== og **fet**."""
    ut = ''
    for bit in re.split(r'(==.+?==|\*\*.+?\*\*)', tekst):
        if not bit:
            continue
        if bit.startswith('==') and bit.endswith('==') and len(bit) > 4:
            fyll = '<a:solidFill><a:srgbClr val="%s"/></a:solidFill>' % farger['on-marker'] if 'on-marker' in farger else ''
            ut += '<a:r><a:rPr lang="%s"%s>%s<a:highlight><a:srgbClr val="%s"/></a:highlight></a:rPr><a:t>%s</a:t></a:r>' % (
                LANG, rpr, fyll, farger.get('marker', 'FFE14D'), escape(bit[2:-2]))
        elif bit.startswith('**') and bit.endswith('**') and len(bit) > 4:
            ut += '<a:r><a:rPr lang="%s"%s b="1"/><a:t>%s</a:t></a:r>' % (LANG, rpr, escape(bit[2:-2]))
        else:
            ut += '<a:r><a:rPr lang="%s"%s/><a:t>%s</a:t></a:r>' % (LANG, rpr, escape(bit))
    return ut


def tekst_xml(v, farger):
    ut = ''
    for niv, t in avsnitt(v):
        linjer = ('<a:br><a:rPr lang="%s"/></a:br>' % LANG).join(loep(l, farger) for l in t.split('\n'))
        ut += '<a:p>%s%s</a:p>' % ('<a:pPr lvl="%d"/>' % min(niv, 8) if niv else '', linjer or '<a:endParaRPr lang="%s"/>' % LANG)
    return ut or '<a:p><a:endParaRPr lang="%s"/></a:p>' % LANG


def ren(v):
    return re.sub(r'==|\*\*', '', ' '.join(t for _, t in avsnitt(v)))


# ---------------------------------------------------------------------------
# Bilder
# ---------------------------------------------------------------------------
def bildemaal(b, sti):
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', b[16:24]) + ('png',)
    if b[:6] in (b'GIF87a', b'GIF89a'):
        return struct.unpack('<HH', b[6:10]) + ('gif',)
    if b[:2] == b'\xff\xd8':
        i = 2
        while i + 9 < len(b):
            if b[i] != 0xFF:
                i += 1
                continue
            m = b[i + 1]
            if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack('>HH', b[i + 5:i + 9])
                return (w, h, 'jpeg')
            if m in (0xD8, 0x01) or 0xD0 <= m <= 0xD7:
                i += 2
            else:
                i += 2 + struct.unpack('>H', b[i + 2:i + 4])[0]
    raise Feil('%s: bare PNG, JPEG og GIF kan settes inn. Gjør SVG og andre formater om til PNG først.' % sti)


# ---------------------------------------------------------------------------
# En slide
# ---------------------------------------------------------------------------
class Slide:
    def __init__(self, bygg, nr, s):
        self.b, self.nr, self.s = bygg, nr, s
        self.n, self.xml, self.rels = 1, [], []
        self.advarsler = []

    def nv(self, navn, ph, tag='p:nvSpPr', c='<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>', descr=''):
        self.n += 1
        return '<%s><p:cNvPr id="%d" name=%s%s/>%s<p:nvPr>%s</p:nvPr></%s>' % (
            tag, self.n, quoteattr(navn), ' descr=%s' % quoteattr(descr) if descr else '', c, ph, tag)

    def rel(self, typ, target):
        self.rels.append((typ, target))
        return 'rId%d' % len(self.rels)

    def tekst(self, f, v, farger):
        self.xml.append('<p:sp>%s<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>%s</p:txBody></p:sp>' % (self.nv(f.navn, f.ph()), tekst_xml(v, farger)))

    def tom(self, f):
        if f.slag in ('bilde', 'video'):
            self.xml.append('<p:sp>%s<p:spPr/></p:sp>' % self.nv(f.navn, f.ph()))
        else:
            self.tekst(f, '', {})

    def bilde(self, f, v, fyll):
        """fyll: bildet beskjæres så det fyller plassholderen. Ellers legges hele bildet inni boksen."""
        v = {'fil': v} if isinstance(v, str) else v
        sti = os.path.join(self.b.mappe, v['fil'])
        if not os.path.exists(sti):
            raise Feil('fant ikke bildet %s' % sti)
        data = open(sti, 'rb').read()
        w, h, ext = bildemaal(data, sti)
        rid = self.rel(REL + 'image', '../media/' + self.b.media(data, ext))
        x, y, bw, bh = f.boks
        locks = '<p:cNvPicPr><a:picLocks noGrp="1" noChangeAspect="1"/></p:cNvPicPr>'
        if fyll:
            q = (w / h) / (bw / bh)          # > 1: the picture is wider than the box
            l = round((1 - 1 / q) / 2 * 100000) if q > 1 else 0
            t = round((1 - q) / 2 * 100000) if q < 1 else 0
            src = '<a:srcRect l="%d" t="%d" r="%d" b="%d"/>' % (l, t, l, t) if l or t else ''
            self.xml.append('<p:pic>%s<p:blipFill><a:blip r:embed="%s"/>%s<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr/></p:pic>'
                            % (self.nv(f.navn, f.ph(), 'p:nvPicPr', locks, v.get('alt', '')), rid, src))
        else:
            k = min(bw / w, bh / h)
            pw, ph = round(w * k), round(h * k)
            self.xml.append(
                '<p:pic>%s<p:blipFill><a:blip r:embed="%s"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="%d" y="%d"/>'
                '<a:ext cx="%d" cy="%d"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
                % (self.nv(f.navn, '', 'p:nvPicPr', '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>', v.get('alt', '')),
                   rid, x + (bw - pw) // 2, y + (bh - ph) // 2, pw, ph))

    def tabell(self, f, v):
        rader = v['tabell']
        if not rader or not all(isinstance(r, list) and len(r) == len(rader[0]) for r in rader):
            raise Feil('en tabell er en liste med rader som er like lange. Første rad er hodet.')
        kol = v.get('kolonner') or [1] * len(rader[0])
        if len(kol) != len(rader[0]):
            raise Feil('"kolonner" må ha ett tall per kolonne')
        x, y, w, h = f.boks
        rh = min(h // len(rader), 54 * PX)
        tall = [all(re.fullmatch(r'[-+−–]?[\d\s.,]+\s*\S{0,3}', str(r[i]).strip()) for r in rader[1:]) and len(rader) > 1 for i in range(len(kol))]
        grid = ''.join('<a:gridCol w="%d"/>' % round(w * c / sum(kol)) for c in kol)
        skrift = '<a:latin typeface=%s/>' % quoteattr(self.b.mal.hodeskrift) if self.b.mal.hodeskrift else ''
        ut = ''
        for r, rad in enumerate(rader):
            rpr = ('<a:rPr lang="%s" sz="1400" b="0" cap="all" spc="84"><a:solidFill><a:schemeClr val="tx2"/></a:solidFill>%s</a:rPr>' % (LANG, skrift)
                   if r == 0 else '<a:rPr lang="%s" sz="2200"/>' % LANG)
            ut += '<a:tr h="%d">%s</a:tr>' % (rh, ''.join(
                '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="%s"/><a:r>%s<a:t>%s</a:t></a:r></a:p></a:txBody>'
                '<a:tcPr marL="%d" marR="%d" marT="%d" marB="%d" anchor="ctr"/></a:tc>'
                % ('r' if tall[i] else 'l', rpr, escape(str(c)), 12 * PX, 12 * PX, 6 * PX, 6 * PX) for i, c in enumerate(rad)))
        self.n += 1
        stil = '<a:tableStyleId>%s</a:tableStyleId>' % self.b.mal.tabellstil if self.b.mal.tabellstil else ''
        self.xml.append(
            '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="%d" name="Tabell"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/>'
            '</p:cNvGraphicFramePr><p:nvPr>%s</p:nvPr></p:nvGraphicFramePr><p:xfrm><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></p:xfrm>'
            '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1">%s</a:tblPr>'
            '<a:tblGrid>%s</a:tblGrid>%s</a:tbl></a:graphicData></a:graphic></p:graphicFrame>'
            % (self.n, f.ph(), x, y, w, rh * len(rader), stil, grid, ut))

    def bunn(self, f, farger):
        d, s = self.b.d, self.s
        if f.type == 'ftr':
            v = s.get('bunntekst', d.get('bunntekst'))
            if v:
                self.tekst(f, v, farger)
        elif f.type == 'sldNum':
            if s.get('nummer', d.get('nummer', True)):
                self.xml.append(
                    '<p:sp>%s<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{6B1A7A47-0001-4B1E-9A5C-0B17A47B17A4}" type="slidenum">'
                    '<a:rPr lang="%s"/><a:t>‹#›</a:t></a:fld><a:endParaRPr lang="%s"/></a:p></p:txBody></p:sp>' % (self.nv(f.navn, f.ph()), LANG, LANG))
        else:
            v = s.get('dato', d.get('dato'))
            if v is True:
                self.xml.append(
                    '<p:sp>%s<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{6B1A7A47-0002-4B1E-9A5C-0B17A47B17A4}" type="datetime1">'
                    '<a:rPr lang="%s"/><a:t></a:t></a:fld><a:endParaRPr lang="%s"/></a:p></p:txBody></p:sp>' % (self.nv(f.navn, f.ph()), LANG, LANG))
            elif v:
                self.tekst(f, v, farger)

    def bygg(self):
        s, mal = self.s, self.b.mal
        if not isinstance(s, dict) or 'oppsett' not in s:
            raise Feil('mangler "oppsett"')
        tid = norm(s.get('tema', self.b.d.get('tema', next(iter(mal.temaer)))))
        if tid not in mal.temaer:
            raise Feil('ukjent tema «%s». Malen har: %s' % (s.get('tema', self.b.d.get('tema')), ', '.join(mal.temaer)))
        tema = mal.temaer[tid]
        if norm(s['oppsett']) not in tema['oppsett']:
            raise Feil('ukjent oppsett «%s». Malen har: %s' % (s['oppsett'], ', '.join(o[0] for o in tema['oppsett'].values())))
        navn, lpart, felt = tema['oppsett'][norm(s['oppsett'])]
        self.rel(REL + 'slideLayout', '../' + lpart[4:])
        kjente = {norm(f.navn): f for f in felt if f.type not in FOT}
        ukjente = [k for k in s if k not in FASTE and norm(k) not in kjente]
        if ukjente:
            raise Feil('oppsettet «%s» har ikke feltet %s. Det har: %s' % (
                navn, ', '.join('«%s»' % k for k in ukjente), ', '.join(f.navn.lower() for f in kjente.values()) or 'ingen felt'))
        verdier = {norm(k): v for k, v in s.items() if k not in FASTE}
        for f in felt:
            v = verdier.get(norm(f.navn))
            try:
                if f.type in FOT:
                    self.bunn(f, tema['farger'])
                elif v is None or v == '' or v == []:
                    self.tom(f)
                elif f.slag == 'video':
                    raise Feil('video kan ikke settes inn herfra. La feltet stå tomt, og sett inn videoen i PowerPoint.')
                elif f.slag == 'bilde':
                    self.bilde(f, v, fyll=True)
                elif isinstance(v, dict):
                    if f.slag != 'innhold' or not ('tabell' in v or 'bilde' in v):
                        raise Feil('bare innholdsfelt tar {"tabell": …} eller {"bilde": …}')
                    if 'tabell' in v:
                        self.tabell(f, v)
                    else:
                        self.bilde(f, v['bilde'], fyll=False)
                else:
                    self.tekst(f, v, tema['farger'])
            except Feil as e:
                raise Feil('feltet «%s»: %s' % (f.navn.lower(), e))

        # the guidelines the script can check
        tekster = [ren(v) for k, v in verdier.items() if isinstance(v, (str, list))]
        tusj = sum(len(re.findall(r'==.+?==', t)) for k, v in verdier.items() if isinstance(v, (str, list)) for _, t in avsnitt(v))
        if tusj > 1:
            self.advarsler.append('tusj %d ganger. Bruk den én gang per slide, på det øyet skal finne.' % tusj)
        if 'tittel' in kjente and not verdier.get('tittel'):
            self.advarsler.append('mangler tittel. Tittelen er påstanden sliden gjør.')
        if len(ren(verdier.get('tittel', ''))) > 80:
            self.advarsler.append('tittelen er lang (%d tegn) og får neppe plass på to linjer.' % len(ren(verdier['tittel'])))
        if sum(len(t) for t in tekster) > 600:
            self.advarsler.append('mye tekst (%d tegn). Én tanke per slide: del den, eller flytt noe til notatene.' % sum(len(t) for t in tekster))

        tree = ('<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/>'
                '<a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>%s</p:spTree></p:cSld>')
        deler = {}
        if s.get('notater'):
            if not mal.har_notater:
                raise Feil('denne versjonen av malen (%s) har ikke notatside. Bruk Blyant 0.12.0 eller nyere.' % mal.versjon)
            sp = '<p:sp><p:nvSpPr><p:cNvPr id="%d" name="%s"/><p:cNvSpPr><a:spLocks noGrp="1"%s/></p:cNvSpPr><p:nvPr>%s</p:nvPr></p:nvSpPr><p:spPr/>%s</p:sp>'
            deler['ppt/notesSlides/notesSlide%d.xml' % self.nr] = (
                HEAD + '<p:notes %s>%s<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>' % (NS, tree % (
                    sp % (2, 'Lysbilde', ' noRot="1" noChangeAspect="1"', '<p:ph type="sldImg"/>', '')
                    + sp % (3, 'Notater', '', '<p:ph type="body" idx="1"/>', '<p:txBody><a:bodyPr/><a:lstStyle/>%s</p:txBody>' % tekst_xml(s['notater'], {})))))
            deler['ppt/notesSlides/_rels/notesSlide%d.xml.rels' % self.nr] = rels_xml([
                (REL + 'notesMaster', '../notesMasters/notesMaster1.xml'), (REL + 'slide', '../slides/slide%d.xml' % self.nr)])
            self.rel(REL + 'notesSlide', '../notesSlides/notesSlide%d.xml' % self.nr)
        deler['ppt/slides/slide%d.xml' % self.nr] = HEAD + '<p:sld %s>%s<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>' % (
            NS, tree % ''.join(self.xml))
        deler['ppt/slides/_rels/slide%d.xml.rels' % self.nr] = rels_xml(self.rels)
        return deler


def rels_xml(items):
    return HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">%s</Relationships>' % ''.join(
        '<Relationship Id="rId%d" Type="%s" Target="%s"/>' % (i + 1, typ, target) for i, (typ, target) in enumerate(items))


# ---------------------------------------------------------------------------
# Presentasjonen
# ---------------------------------------------------------------------------
class Bygg:
    def __init__(self, mal, d, mappe):
        self.mal, self.d, self.mappe = mal, d, mappe
        self.bilder = {}          # sha1 → file name in ppt/media

    def media(self, data, ext):
        h = hashlib.sha1(data).hexdigest()
        if h not in self.bilder:
            self.bilder[h] = ('bilde%d.%s' % (len(self.bilder) + 1, ext), data)
        return self.bilder[h][0]

    def pakke(self):
        d = self.d
        if not isinstance(d, dict) or not isinstance(d.get('slides'), list) or not d['slides']:
            raise Feil('definisjonen må ha "slides": en liste med minst én slide')
        # the template without its example slides
        parts = {n: b for n, b in self.mal.parts.items() if not re.match(r'ppt/(slides|notesSlides)/', n)}
        feil, advarsler = [], []
        for nr, s in enumerate(d['slides'], 1):
            sl = Slide(self, nr, s)
            try:
                parts.update({n: x.encode('utf-8') for n, x in sl.bygg().items()})
            except Feil as e:
                feil.append('Slide %d: %s' % (nr, e))
            advarsler += ['Slide %d: %s' % (nr, a) for a in sl.advarsler]
        if feil:
            raise Feil('\n'.join(feil))
        for navn, data in self.bilder.values():
            parts['ppt/media/' + navn] = data

        n = len(d['slides'])
        rel = parts['ppt/_rels/presentation.xml.rels'].decode('utf-8')
        rel = re.sub(r'<Relationship [^>]*Type="[^"]*/slide"[^>]*/>', '', rel)
        start = max(int(i) for i in re.findall(r'Id="rId(\d+)"', rel)) + 1
        rel = rel.replace('</Relationships>', ''.join(
            '<Relationship Id="rId%d" Type="%sslide" Target="slides/slide%d.xml"/>' % (start + i, REL, i + 1) for i in range(n)) + '</Relationships>')
        parts['ppt/_rels/presentation.xml.rels'] = rel.encode('utf-8')

        pres = parts['ppt/presentation.xml'].decode('utf-8')
        pres = re.sub(r'<p:sldIdLst>.*?</p:sldIdLst>', '', pres, flags=re.S)
        lst = '<p:sldIdLst>%s</p:sldIdLst>' % ''.join('<p:sldId id="%d" r:id="rId%d"/>' % (256 + i, start + i) for i in range(n))
        parts['ppt/presentation.xml'] = pres.replace('<p:sldSz', lst + '<p:sldSz', 1).encode('utf-8')

        ct = parts['[Content_Types].xml'].decode('utf-8')
        ct = re.sub(r'<Override PartName="/ppt/(slides|notesSlides)/[^>]*/>', '', ct)
        nye = ''.join('<Override PartName="/%s" ContentType="%s%s+xml"/>' % (p, CT, 'notesSlide' if 'notesSlides' in p else 'slide')
                      for p in sorted(parts) if re.match(r'ppt/(slides|notesSlides)/[^/]+\.xml$', p))
        std = ''.join('<Default Extension="%s" ContentType="%s"/>' % (e, BILDETYPER[e])
                      for e in sorted({navn.rsplit('.', 1)[1] for navn, _ in self.bilder.values()}) if 'Extension="%s"' % e not in ct)
        ct = ct.replace('<Override', std + '<Override', 1).replace('</Types>', nye + '</Types>')
        parts['[Content_Types].xml'] = ct.encode('utf-8')

        if d.get('tittel'):
            core = parts['docProps/core.xml'].decode('utf-8')
            parts['docProps/core.xml'] = re.sub(r'(<cp:coreProperties[^>]*>)', lambda m: m.group(1) + '<dc:title>%s</dc:title>' % escape(d['tittel']),
                                                core, count=1).encode('utf-8')
        return parts, advarsler


def laget_av_blyant(sti):
    """Sant hvis fila kommer rett fra dette skriptet. PowerPoint skriver sitt eget navn når den lagrer."""
    try:
        with zipfile.ZipFile(sti) as z:
            return b'<Application>Blyant</Application>' in z.read('docProps/app.xml')
    except (OSError, KeyError, zipfile.BadZipFile):
        return False


def skriv(sti, parts):
    forst = ['[Content_Types].xml', '_rels/.rels']
    with zipfile.ZipFile(sti, 'w', zipfile.ZIP_DEFLATED) as z:
        for n in forst + sorted(p for p in parts if p not in forst):
            z.writestr(n, parts[n])


def main(argv=None):
    ap = argparse.ArgumentParser(description='Lager en Blyant-presentasjon (.pptx) fra en definisjon i JSON.')
    ap.add_argument('definisjon', nargs='?', help='JSON-fila med presentasjonen')
    ap.add_argument('-o', '--ut', help='fila som skal skrives (standard: samme navn som definisjonen, med .pptx)')
    ap.add_argument('--mal', help='stien til blyant-eksempel.pptx (standard: letes opp, eller lastes ned)')
    ap.add_argument('--versjon', help='Blyant-versjonen malen skal ha, for eksempel 0.12.0 (standard: den som finnes, eller den nyeste)')
    ap.add_argument('--oppsett', action='store_true', help='vis oppsettene og feltene i malen')
    ap.add_argument('--overskriv', action='store_true', help='skriv over en fil som er lagret fra PowerPoint')
    a = ap.parse_args(argv)
    try:
        d = None
        if a.definisjon:
            try:
                d = json.load(open(a.definisjon, encoding='utf-8'))
            except (OSError, ValueError) as e:
                raise Feil('Kan ikke lese %s: %s' % (a.definisjon, e))
        elif not a.oppsett:
            ap.error('gi en definisjon, eller --oppsett')
        mal = Mal(finn_mal(a.mal, a.versjon or (d or {}).get('blyant')))
        if a.oppsett:
            print(mal.liste())
            return 0
        ut = a.ut or os.path.splitext(a.definisjon)[0] + '.pptx'
        if os.path.exists(ut) and not a.overskriv and not laget_av_blyant(ut):
            raise Feil('%s er lagret fra PowerPoint siden den ble laget, så den skrives ikke over.\n'
                       'Skriv til en annen fil med -o, eller bruk --overskriv hvis endringene der kan forsvinne.' % ut)
        parts, advarsler = Bygg(mal, d, os.path.dirname(os.path.abspath(a.definisjon))).pakke()
        skriv(ut, parts)
        print('%s: %d slides, Blyant %s' % (ut, len(d['slides']), mal.versjon))
        for x in advarsler:
            print('Advarsel: ' + x)
        return 0
    except Feil as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
