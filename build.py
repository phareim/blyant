#!/usr/bin/env python3
"""Bygger dist/ og eksempelet fra src/ og tokens.json.

    python3 build.py

dist/tokens.css   – fargene (Papir/Kull), avstander, strek og skrift som CSS-variabler
dist/blyant.css   – fonter + tokens + komponenter (én fil å lenke til)
dist/blyant.js    – Blyant (streker, komponenter, Sketch3D, HexBoard) + Blyant.chart
examples/hex-skisse/index.html – testflaten, ferdig bygget
index.html        – samme testflate, som forside på https://phareim.github.io/blyant/
"""
import json, os, re

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


if __name__ == '__main__':
    tok = tokens_css()
    css = read('src', 'blyant.css')
    js = read('src', 'blyant.js') + '\n' + read('src', 'blyant-chart.js')
    write('dist/tokens.css', tok)
    write('dist/blyant.css', '@import url("%s");\n\n%s\n%s' % (FONTS, tok, css))
    write('dist/blyant.js', js)
    ex = os.path.join('examples', 'hex-skisse')
    page = read(ex, 'demo.html')
    for k, v in {'TOKENS': tok, 'BLYANT_CSS': css, 'APP_CSS': read(ex, 'app.css'),
                 'BLYANT_JS': read('src', 'blyant.js'), 'CHART_JS': read('src', 'blyant-chart.js'), 'APP_JS': read(ex, 'app.js')}.items():
        page = page.replace('/*{{%s}}*/' % k, v)
    page = ('<!doctype html>\n<html lang="nb">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<style>body { margin: 0; } [hidden] { display: none !important; }</style>\n'
            '</head>\n<body>\n' + page + '\n</body>\n</html>\n')
    write(os.path.join(ex, 'index.html'), page)
    write('index.html', page)   # forsiden på GitHub Pages (deploy fra main, rotmappen)
