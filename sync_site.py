"""Update assets in an existing static export without reading the database or deleting media."""
import hashlib
import re
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parent
bundles = runpy.run_path(str(ROOT / 'build_assets.py'))['bundles']


def digest_media():
    return {str(p.relative_to(ROOT / 'site')): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (ROOT / 'site').rglob('*') if p.is_file() and p.name != 'index.html'}


def main():
    page = ROOT / 'site' / 'index.html'
    text = page.read_text(encoding='utf-8')
    style = re.search(r'<style>(.*?)</style>', text, re.S)
    scripts = list(re.finditer(r'<script>(.*?)</script>', text, re.S))
    heat = re.search(r'<div class="heat">.*?(?=<footer>)', text, re.S)
    template = (ROOT / 'export_static.py').read_text(encoding='utf-8')
    new_heat = re.search(r'<div class="heat">.*?(?=<footer>)', template, re.S)
    readers = list(re.finditer(r'<dialog\b[^>]*\bid="reader"[^>]*>.*?</dialog>', text, re.S))
    new_readers = list(re.finditer(r'<dialog\b[^>]*\bid="reader"[^>]*>.*?</dialog>', template, re.S))
    if not style or len(scripts) != 3 or not heat or not new_heat or len(readers) != 1 or len(new_readers) != 1:
        raise SystemExit('Unrecognized static export; nothing written.')
    if not scripts[0].group(1).startswith('window.__DATA__='):
        raise SystemExit('Public data script not found; nothing written.')
    assets = bundles()
    for name, expected in assets.items():
        if (ROOT / name).read_text(encoding='utf-8') != expected:
            raise SystemExit('Build assets before syncing: python build_assets.py')
    before = digest_media()
    changes = [
        (style.start(1), style.end(1), (ROOT / 'style.css').read_text(encoding='utf-8')),
        (scripts[1].start(1), scripts[1].end(1), assets['sky.js']),
        (scripts[2].start(1), scripts[2].end(1), assets['static_app.js']),
        (heat.start(), heat.end(), new_heat.group(0)),
        (readers[0].start(), readers[0].end(), new_readers[0].group(0)),
    ]
    updated = text
    for start, end, replacement in sorted(changes, reverse=True):
        updated = updated[:start] + replacement + updated[end:]
    after_scripts = list(re.finditer(r'<script>(.*?)</script>', updated, re.S))
    if after_scripts[0].group(0) != scripts[0].group(0):
        raise SystemExit('Public data changed unexpectedly; nothing written.')
    page.write_text(updated, encoding='utf-8')
    if digest_media() != before:
        raise SystemExit('Unexpected media change detected.')
    print('PASS: static assets/chart updated; public data and all media unchanged')


if __name__ == '__main__':
    main()
