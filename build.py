#!/usr/bin/env python3
"""Bygger dist/ og eksempelet fra src/ og tokens.json.

    python3 build.py

dist/tokens.css   – fargene (Papir/Kull), avstander, strek og skrift som CSS-variabler
dist/blyant.css   – fonter + tokens + komponenter (én fil å lenke til)
dist/blyant-core.css – det samme uten @import av fontene, for sider som leverer fontene selv
dist/blyant.js    – Blyant (streker, komponenter, Sketch3D, HexBoard) + Blyant.chart + Blyant.frames
examples/hex-skisse/index.html – testflaten, ferdig bygget

    python3 build.py --ds

build/ds/project/ – filene til Design System-artefakten i Claude, bygget fra src/,
                    tokens.json, docs/komponenter/ og designsystem/. Se CLAUDE.md.
"""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(os.path.join(ROOT, 'tokens.json')))
FONTS = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Architects+Daughter&family=Cutive+Mono&display=swap'


def colors(theme):
    out, first = [], T['color']['themes'][0]['id']
    for fam in (T['color']['tokens'], T.get('shadow', {}).get('tokens', [])):
        for t in fam:
            v = t['value']
            if isinstance(v, dict):
                v = v.get(theme, v.get(first))
            elif theme != first:
                continue  # aliases are declared once
            m = re.fullmatch(r'\{(.+)\}', v)
            out.append('  --%s: %s;' % (t['name'], 'var(--%s)' % m.group(1) if m else v))
    return '\n'.join(out)


def scalars():
    out = ['  --%s: %s;' % (t['name'], t['value']) for fam in ('spacing', 'radius', 'stroke', 'wobble') for t in T[fam]['tokens']]
    out += ['  --font-%s: %s;' % (k, v) for k, v in T['type']['families'].items()]
    return '\n'.join(out)


def styles():
    out = []
    for g in T['type']['groups']:
        for s in g['styles']:
            css = ['font-family: var(--font-%s)' % s.get('family', g['family']), 'font-size: %s' % s['fontSize'],
                   'line-height: %s' % s['lineHeight'], 'font-weight: %s' % s['fontWeight']]
            if 'letterSpacing' in s:
                css.append('letter-spacing: %s' % s['letterSpacing'])
            out.append('.%s { %s; }' % (s['name'], '; '.join(css)))
    return '\n'.join(out)


def tokens_css():
    dark = colors('dark')
    return ('/* Blyant — generert fra tokens.json. Ikke rediger for hånd. */\n'
            ':root {\n%s\n%s\n}\n'
            '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n%s\n  color-scheme: dark;\n  }\n}\n'
            ':root[data-theme="dark"] {\n%s\n  color-scheme: dark;\n}\n%s\n') % (colors('light'), scalars(), dark, dark, styles())


def read(*p):
    return open(os.path.join(ROOT, *p)).read()


def write(rel, text):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w').write(text)
    print('  %-34s %7d bytes' % (rel, len(text.encode())))


def design_system():
    """Assemble the Design System artifact files. Nothing here is hand-copied: every file comes from the repo."""
    out = os.path.join('build', 'ds', 'project')
    shutil.rmtree(os.path.join(ROOT, 'build', 'ds'), ignore_errors=True)
    comps = os.path.join(out, 'components')
    header = json.loads(re.match(r'/\* @ds-bundle: (\{.*?\}) \*/', read('src', 'blyant.js')).group(1))
    names = [c['name'] for c in header['components']]
    previews = sorted(f[:-5] for f in os.listdir(os.path.join(ROOT, 'designsystem', 'forhandsvisning')) if f.endswith('.html'))
    missing = [n for n in names if n not in previews or not os.path.exists(os.path.join(ROOT, 'docs', 'komponenter', n + '.md'))]
    extra = [n for n in previews if n not in names and n != 'Cover']
    if missing or extra:
        sys.exit('Design System: @ds-bundle i src/blyant.js, designsystem/forhandsvisning/ og docs/komponenter/ er ikke enige.\n'
                 '  mangler forhåndsvisning eller README: %s\n  forhåndsvisning uten komponent: %s' % (missing, extra))
    write(os.path.join(out, 'components', 'bundle.css'), '@import url("%s");\n%s' % (FONTS, read('src', 'blyant.css')))
    write(os.path.join(out, 'components', 'bundle.js'), '\n'.join(read('src', n) for n in JS))
    write(os.path.join(out, 'components', 'index.d.ts'), read('src', 'blyant.d.ts'))
    write(os.path.join(out, 'tokens.json'), read('tokens.json'))
    write(os.path.join(out, 'README.md'), read('designsystem', 'README.md'))
    write(os.path.join(out, 'design-system.json'), read('designsystem', 'design-system.json'))
    for n in previews:
        write(os.path.join(out, 'components', n, 'preview.html'), read('designsystem', 'forhandsvisning', n + '.html'))
        if n != 'Cover':
            write(os.path.join(out, 'components', n, 'README.md'), read('docs', 'komponenter', n + '.md'))


JS = ('blyant.js', 'blyant-chart.js', 'blyant-frames.js')

if __name__ == '__main__':
    tok = tokens_css()
    css = read('src', 'blyant.css')
    js = '\n'.join(read('src', n) for n in JS)
    write('dist/tokens.css', tok)
    write('dist/blyant.css', '@import url("%s");\n\n%s\n%s' % (FONTS, tok, css))
    write('dist/blyant-core.css', '%s\n%s' % (tok, css))
    write('dist/blyant.js', js)
    ex = os.path.join('examples', 'hex-skisse')
    page = read(ex, 'demo.html')
    for k, v in {'TOKENS': tok, 'BLYANT_CSS': css, 'APP_CSS': read(ex, 'app.css'),
                 'BLYANT_JS': read('src', 'blyant.js'), 'CHART_JS': read('src', 'blyant-chart.js'), 'FRAMES_JS': read('src', 'blyant-frames.js'), 'APP_JS': read(ex, 'app.js')}.items():
        page = page.replace('/*{{%s}}*/' % k, v)
    page = ('<!doctype html>\n<html lang="nb">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<style>body { margin: 0; } [hidden] { display: none !important; }</style>\n'
            '</head>\n<body>\n' + page + '\n</body>\n</html>\n')
    write(os.path.join(ex, 'index.html'), page)
    if '--ds' in sys.argv:
        design_system()
