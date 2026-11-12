#!/usr/bin/env python3
"""Gi ut en ny versjon av Blyant på npm.

    python3 release.py patch       # 0.4.0 -> 0.4.1: rettelser og justeringer
    python3 release.py minor       # 0.4.0 -> 0.5.0: ny komponent, nytt valg, endret API
    python3 release.py 1.0.0       # en bestemt versjon
    python3 release.py minor --no-push   # stopp etter commit og tag

Skriptet øker `version` i package.json og jsDelivr-lenkene i README, bygger
(PowerPoint-malen i dist/ får den nye versjonen), committer, lager taggen v<versjon>, pusher main og taggen, og venter til npm
viser den nye versjonen. Workflowen .github/workflows/npm.yml publiserer.
"""
import json, os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.abspath(__file__))


def git(*args, capture=True):
    r = subprocess.run(['git', *args], cwd=ROOT, text=True, capture_output=capture)
    if r.returncode:
        sys.exit('git %s feilet:\n%s' % (' '.join(args), (r.stderr or r.stdout or '').strip()))
    return (r.stdout or '').strip()


def bump(old, how):
    if re.fullmatch(r'\d+\.\d+\.\d+', how):
        return how
    major, minor, patch = map(int, old.split('.'))
    if how == 'patch':
        return '%d.%d.%d' % (major, minor, patch + 1)
    if how == 'minor':
        return '%d.%d.0' % (major, minor + 1)
    if how == 'major':
        return '%d.0.0' % (major + 1)
    sys.exit('Bruk: python3 release.py patch|minor|major|X.Y.Z [--no-push]')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    push = '--no-push' not in sys.argv
    if len(args) != 1:
        sys.exit(__doc__)

    if git('rev-parse', '--abbrev-ref', 'HEAD') != 'main':
        sys.exit('Gi ut fra main. Merge grenen først.')
    if git('status', '--porcelain'):
        sys.exit('Arbeidstreet har endringer som ikke er committet. Commit dem først.')
    git('fetch', '--quiet', 'origin', 'main', '--tags')
    if git('rev-list', '--count', 'HEAD..origin/main') != '0':
        sys.exit('origin/main har commits du ikke har. Kjør git pull --rebase først.')

    pkg_path = os.path.join(ROOT, 'package.json')
    pkg_text = open(pkg_path).read()
    old = json.loads(pkg_text)['version']
    new = bump(old, args[0])
    tag = 'v' + new
    if git('tag', '--list', tag):
        sys.exit('Taggen %s finnes allerede.' % tag)

    # Bygg før versjonen endres: dist/ må allerede være committet i takt med src/.
    subprocess.run([sys.executable, 'build.py'], cwd=ROOT, check=True)
    if git('status', '--porcelain'):
        sys.exit('dist/ eller eksempelet var ikke i takt med src/. Commit byggeresultatet først:\n'
                 + git('status', '--short'))

    open(pkg_path, 'w').write(pkg_text.replace('"version": "%s"' % old, '"version": "%s"' % new, 1))
    readme_path = os.path.join(ROOT, 'README.md')
    readme = open(readme_path).read()
    open(readme_path, 'w').write(readme.replace('npm/blyant@%s/' % old, 'npm/blyant@%s/' % new))

    # Bygg en gang til: PowerPoint-malen har versjonen i seg.
    subprocess.run([sys.executable, 'build.py'], cwd=ROOT, check=True)

    unpushed = git('log', '--oneline', 'origin/main..HEAD')
    git('add', 'package.json', 'README.md', 'dist')
    git('commit', '--quiet', '-m', 'Gi ut %s' % new)
    git('tag', tag)
    print('%s -> %s, tagget %s.' % (old, new, tag))
    if unpushed:
        print('Disse commitene blir også med:\n' + unpushed)

    if not push:
        print('Ikke pushet. Kjør: git push origin main %s' % tag)
        return
    git('push', '--quiet', 'origin', 'main', tag, capture=False)
    print('Pushet main og %s. Venter på npm …' % tag)

    for _ in range(40):
        r = subprocess.run(['npm', 'view', 'blyant@' + new, 'version'], text=True, capture_output=True)
        if r.stdout.strip() == new:
            print('blyant@%s ligger på npm.' % new)
            return
        time.sleep(15)
    sys.exit('blyant@%s er ikke på npm etter ti minutter. Se: gh run list --workflow npm.yml' % new)


if __name__ == '__main__':
    main()
