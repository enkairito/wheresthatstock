"""Materialize shared navigation. Run with --check in CI; no runtime fetching."""
import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAV = re.compile(r'<nav class="topnav">.*?</nav>', re.S)

def render(page, source):
    selected = "/noticias" if page.stem.startswith("noticia-") else "/" + page.stem
    def activate(match):
        tag = match.group()
        if f'href="{selected}"' in tag:
            tag = tag.replace('class="topnav-link"', 'class="topnav-link active" aria-current="page"')
            tag = tag.replace('class="topnav-dropdown-item"', 'class="topnav-dropdown-item active" aria-current="page"')
        return tag
    return re.sub(r'<a\b[^>]*>', activate, source.strip())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    source = (ROOT / 'partials/navigation.html').read_text(encoding='utf-8')
    stale = []
    for page in sorted(ROOT.glob('*.html')):
        old = page.read_text(encoding='utf-8')
        expected, count = NAV.subn(lambda _: render(page, source), old)
        if count != 1:
            raise ValueError(f'{page.name}: se esperaba una navegación')
        if old != expected:
            stale.append(page.name)
            if not args.check: page.write_text(expected, encoding='utf-8')
    if stale and args.check:
        raise SystemExit('Ejecuta python scripts/sync_navigation.py: ' + ', '.join(stale))
    print(f'Navegación comprobada. Archivos actualizados: {len(stale) if not args.check else 0}')

if __name__ == '__main__': main()
