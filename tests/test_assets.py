"""Check critical local resources; generated product data need not be fetched."""
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]

class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'img') and attrs.get('src'): self.urls.append(attrs['src'])
        if tag == 'link' and attrs.get('rel') in ('stylesheet', 'icon', 'preload') and attrs.get('href'): self.urls.append(attrs['href'])

class ResourceTests(unittest.TestCase):
    def test_local_resources_exist_in_root_pages(self):
        for page in ROOT.glob('*.html'):
            parser = References()
            parser.feed(page.read_text(encoding='utf-8'))
            for url in parser.urls:
                parsed = urlsplit(url)
                if parsed.scheme or parsed.netloc: continue
                path = unquote(parsed.path)
                target = ROOT / path.lstrip('/') if path.startswith('/') else page.parent / path
                with self.subTest(page=page.name, resource=url): self.assertTrue(target.is_file(), str(target))

    def test_stylesheet_resources_and_web_font(self):
        css = (ROOT / 'styles.css').read_text(encoding='utf-8')
        for url in re.findall(r'url\([\'"]?([^\)\'"]+)', css):
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc: continue
            self.assertTrue((ROOT / parsed.path.lstrip('/')).is_file(), url)
        font = ROOT / 'assets/brand/manrope-latin.woff2'
        self.assertEqual(font.read_bytes()[:4], b'wOF2')
        self.assertLess(font.stat().st_size, (ROOT / 'assets/brand/manrope.ttf').stat().st_size)
