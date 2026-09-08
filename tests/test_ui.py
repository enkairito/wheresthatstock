"""Pruebas de navegador con tiendas y feeds simulados; sin tráfico externo."""
import json
import threading
import unittest
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from patchright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
if not (ROOT / 'index.html').exists():
    ROOT = ROOT.parent / 'wheresthatstock'
SOURCES = ['products.json', 'onepiece.json', 'magic.json', 'lorcana.json', 'yugioh.json']
GAMES = ['Pokémon', 'One Piece', 'Magic', 'Lorcana', 'Yu-Gi-Oh!']


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path
        if (ROOT / (path.lstrip('/') + '.html')).is_file():
            self.path = path + '.html'
        super().do_GET()

    def log_message(self, *args):
        pass


class WebTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.origin = f'http://127.0.0.1:{cls.server.server_port}'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.page = self.browser.new_page()
        self.addCleanup(self.page.close)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.mode = 'healthy'
        self.now = datetime.now(timezone.utc)
        self.page.route('**/*', self.route)

    def route(self, route):
        url = route.request.url
        name = urlparse(url).path.lstrip('/')
        if not url.startswith(self.origin):
            return route.abort()
        if name in SOURCES:
            index = SOURCES.index(name)
            if self.mode == 'partial' and name == 'yugioh.json':
                return route.fulfill(status=503, body='unavailable')
            stamp = self.now - timedelta(hours=14 if self.mode == 'partial' and name == 'magic.json' else 0)
            product = {'asin': f'B00000000{index}', 'marketplace': 'ES', 'name': GAMES[index] + ' Booster',
                       'status': 'compra_directa', 'price': '10,00 €', 'original_price': '20,00 €',
                       'categories': ['Otros'], 'game': GAMES[index], 'first_seen': stamp.isoformat(),
                       'link': 'https://example.test/product'}
            return route.fulfill(json={'updated_at': stamp.isoformat(), 'products': [] if self.mode == 'missing' else [product]})
        if name.startswith('activity-'):
            index = SOURCES.index(name.removeprefix('activity-'))
            return route.fulfill(json=[{'name': GAMES[index] + ' Restock', 'game': GAMES[index], 'ts': self.now.isoformat(), 'type': 'restock'}])
        if name == 'accesorios.json':
            return route.fulfill(json={'updated_at': self.now.isoformat(), 'products': [],
                                      'source_updates': {'accessories': (self.now - timedelta(hours=52)).isoformat(), 'onepiece': self.now.isoformat()}})
        if name == 'restock_stats.json':
            return route.fulfill(json={})
        return route.continue_()

    def visit(self, path):
        response = self.page.goto(self.origin + path, wait_until='networkidle')
        self.assertEqual(response.status, 200)
        self.assertEqual(self.errors, [])

    def test_home_uses_five_games_for_cards_and_activity(self):
        self.visit('/')
        self.assertEqual(self.page.locator('#newest-grid .card').count(), 5)
        self.assertEqual(self.page.locator('#deals-grid .card').count(), 5)
        self.assertEqual(self.page.locator('#activity-list .activity-item').count(), 5)
        for game in GAMES:
            self.assertIn(game, self.page.locator('#newest-grid').inner_text())
            self.assertIn(game, self.page.locator('#activity-list').inner_text())
        self.assertEqual(self.page.locator('#stock-freshness.is-stale').count(), 0)

    def test_partial_failure_and_stale_source_stay_visible(self):
        self.mode = 'partial'
        self.visit('/ofertas')
        self.assertIn('2 fuentes', self.page.locator('#stock-freshness summary').inner_text())
        self.page.locator('#stock-freshness summary').click()
        panel = self.page.locator('#stock-freshness').inner_text()
        self.assertIn('Magic: hace 14 h · actualización retrasada', panel)
        self.assertIn('Yu-Gi-Oh!: sin datos', panel)
        self.assertEqual(self.page.locator('#grid .card').count(), 4)
        self.page.locator('input[data-game="Magic"]').uncheck()
        self.assertEqual(self.page.locator('#grid .card').count(), 3)

    def test_accessories_uses_each_producers_timestamp(self):
        self.visit('/accesorios')
        self.assertIn('1 fuente', self.page.locator('#stock-freshness summary').inner_text())

    def test_archived_product_has_static_content_and_survives_missing_stock(self):
        catalog = json.loads((ROOT / 'catalog-magic.json').read_text(encoding='utf-8'))
        product = catalog['products'][0]
        key = product['marketplace'] + '-' + product['asin']
        path = ROOT / 'producto' / (key + '.html')
        html = path.read_text(encoding='utf-8')
        self.assertIn('rel="canonical"', html)
        self.assertNotIn('content="noindex"', html)
        self.mode = 'missing'
        self.visit('/producto/' + key)
        self.assertIn(product['name'], self.page.locator('#product-detail h1').inner_text())
        self.assertIn('Disponibilidad sin confirmar', self.page.locator('#product-detail').inner_text())
        self.assertEqual(self.page.locator('#back-link').get_attribute('href'), '/magic')
        response = self.page.goto(self.origin + '/producto/ES-NO-EXISTE', wait_until='networkidle')
        self.assertEqual(response.status, 404)

    def test_mobile_freshness_does_not_overflow(self):
        self.mode = 'partial'
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.visit('/ofertas')
        self.page.locator('#stock-freshness summary').click()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))

    def test_dates_reject_invalid_or_future_observations(self):
        self.visit('/')
        for value in ('bad', None, (self.now + timedelta(days=1)).isoformat()):
            self.assertTrue(self.page.evaluate('(stamp) => stockHealth("products.json", {status: "fulfilled", value: {updated_at: stamp}}).issue', value, isolated_context=False))


if __name__ == '__main__':
    unittest.main()
