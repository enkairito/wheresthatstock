"""Pruebas de navegador con tiendas y feeds simulados; sin tráfico externo."""
import json
import threading
import unittest
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from patchright.sync_api import sync_playwright, expect

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
        context = self.browser.new_context()
        self.addCleanup(context.close)
        self.page = context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.mode = 'healthy'
        self.image_behavior = 'ready'
        self.pending_images = []
        self.now = datetime.now(timezone.utc)
        self.page.route('**/*', self.route)

    def route(self, route):
        url = route.request.url
        name = urlparse(url).path.lstrip('/')
        if not url.startswith(self.origin):
            return route.abort()
        if name == 'test-product-image.jpg':
            if self.image_behavior == 'hold':
                self.pending_images.append(route)
                return
            if self.image_behavior == 'broken':
                return route.fulfill(status=200, content_type='image/jpeg', body='not an image')
            return route.fulfill(path=str(ROOT / 'assets' / 'logo.jpg'), content_type='image/jpeg')
        if name in SOURCES:
            index = SOURCES.index(name)
            if self.mode == 'partial' and name == 'yugioh.json':
                return route.fulfill(status=503, body='unavailable')
            stamp = self.now - timedelta(hours=14 if self.mode == 'partial' and name == 'magic.json' else 0)
            product = {'asin': f'B00000000{index}', 'marketplace': 'ES', 'name': GAMES[index] + ' Booster',
                       'status': 'compra_directa', 'price': '10,00 €', 'original_price': '20,00 €',
                       'categories': ['Otros'], 'game': GAMES[index], 'first_seen': stamp.isoformat(),
                       'link': 'https://example.test/product'}
            if self.mode == 'images':
                product['image'] = self.origin + '/test-product-image.jpg?game=' + str(index)
            return route.fulfill(json={'updated_at': 'bad-date' if self.mode == 'invalid' else stamp.isoformat(), 'products': [] if self.mode == 'missing' else [product]})
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
        self.assertEqual(self.page.locator('#stock-freshness').count(), 0)

    def test_partial_failure_keeps_products_without_public_health_notice(self):
        self.mode = 'partial'
        self.visit('/ofertas')
        self.assertEqual(self.page.locator('#stock-freshness').count(), 0)
        self.assertEqual(self.page.locator('#live-text').inner_text(), 'catálogo de productos')
        self.assertEqual(self.page.locator('#grid .card').count(), 4)
        self.page.locator('input[data-game="Magic"]').uncheck()
        self.assertEqual(self.page.locator('#grid .card').count(), 3)

    def test_accessories_uses_a_discreet_header(self):
        self.visit('/accesorios')
        self.assertEqual(self.page.locator('#stock-freshness').count(), 0)
        self.assertEqual(self.page.locator('#live-text').inner_text(), 'catálogo de productos')

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

    def test_mobile_listing_does_not_overflow(self):
        self.mode = 'partial'
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.visit('/ofertas')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))

    def test_mobile_filters_start_closed_and_remember_choice(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.visit('/ofertas')
        toggle = self.page.locator('#filter-toggle')
        self.assertEqual(toggle.get_attribute('aria-expanded'), 'false')
        self.assertFalse(self.page.locator('.sidebar').is_visible())
        toggle.click()
        self.assertTrue(self.page.locator('.sidebar').is_visible())
        self.page.reload(wait_until='networkidle')
        expect(toggle).to_have_attribute('aria-expanded', 'true')
        toggle.click()
        self.page.set_viewport_size({'width': 1440, 'height': 1000})
        expect(toggle).to_have_attribute('aria-expanded', 'true')

    def test_navigation_and_page_types_at_multiple_widths(self):
        for width in (390, 768, 1024, 1440):
            self.page.set_viewport_size({'width': width, 'height': 900})
            self.page.emulate_media(color_scheme='dark' if width == 1024 else 'light')
            for path in ('/', '/cajas-de-coleccion', '/noticias', '/calendario-lanzamientos', '/noticia-delta-reign'):
                with self.subTest(width=width, path=path):
                    self.visit(path)
                    self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            self.page.locator('.topnav-dropdown-trigger').click()
            menu = self.page.locator('.topnav-dropdown-menu')
            self.assertTrue(menu.is_visible())
            rect = menu.bounding_box()
            self.assertGreaterEqual(rect['x'], 0)
            self.assertLessEqual(rect['x'] + rect['width'], width)
            self.page.keyboard.press('Escape')
            self.assertFalse(menu.is_visible())

    def test_favorites_persist_filter_and_remove_without_navigation(self):
        self.visit('/')
        button = self.page.locator('#newest-grid [data-favorite]').first
        name = button.get_attribute('data-product-name')
        button.click()
        expect(button).to_have_attribute('aria-pressed', 'true')
        self.assertEqual(urlparse(self.page.url).path, '/')
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('#newest-grid [data-favorite]').first).to_have_attribute('aria-pressed', 'true')
        self.visit('/favoritos')
        self.assertEqual(self.page.locator('#favorite-grid .card').count(), 1)
        self.assertIn(name, self.page.locator('#favorite-grid').inner_text())
        self.assertIn('10,00', self.page.locator('#favorite-grid').inner_text())
        self.page.locator('#favorite-search').fill('no-coincide')
        self.assertEqual(self.page.locator('#favorite-grid .card').count(), 0)
        self.page.locator('#favorite-search').fill('')
        self.page.locator('#favorite-grid [data-favorite]').click()
        self.assertTrue(self.page.locator('#favorite-empty').is_visible())
        expect(self.page.locator('#favorite-search')).to_be_focused()

    def test_missing_product_remains_saved_without_old_price_or_purchase_claim(self):
        self.visit('/')
        self.page.locator('#newest-grid [data-favorite]').first.click()
        self.mode = 'missing'
        self.visit('/favoritos')
        self.assertEqual(self.page.locator('#favorite-grid .card').count(), 1)
        self.assertEqual(self.page.locator('#favorite-grid .price').count(), 0)
        self.assertEqual(self.page.locator('#favorite-grid .buy-btn').inner_text(), 'Ver ficha')
        self.assertTrue(self.page.locator('#favorite-grid .buy-btn').get_attribute('href').startswith('/producto/'))

    def test_favorites_sync_between_tabs_and_from_product_detail(self):
        self.visit('/')
        self.page.context.route('**/*', self.route)
        other = self.page.context.new_page()
        try:
            other.goto(self.origin + '/', wait_until='networkidle')
            self.page.locator('#newest-grid [data-favorite]').first.click()
            expect(other.locator('#newest-grid [data-favorite]').first).to_have_attribute('aria-pressed', 'true')
        finally:
            other.close()
        product = json.loads((ROOT / 'catalog-magic.json').read_text(encoding='utf-8'))['products'][0]
        self.visit('/producto/' + product['marketplace'] + '-' + product['asin'])
        self.page.locator('.detail-actions [data-favorite]').click()
        expect(self.page.locator('.detail-actions [data-favorite]')).to_have_attribute('aria-pressed', 'true')

    def test_unavailable_storage_does_not_pretend_to_save(self):
        self.page.add_init_script("Storage.prototype.setItem = function() { throw new DOMException('Full', 'QuotaExceededError'); };")
        self.visit('/')
        self.page.locator('#newest-grid [data-favorite]').first.click()
        expect(self.page.locator('#newest-grid [data-favorite]').first).to_have_attribute('aria-pressed', 'false')
        self.assertIn('No se pudo guardar', self.page.locator('#favorite-notice').inner_text())

    def test_corrupt_favorites_do_not_break_the_page(self):
        self.page.add_init_script("localStorage.setItem('wts-favorites-v1', '{bad-json');")
        self.visit('/favoritos')
        self.assertTrue(self.page.locator('#favorite-empty').is_visible())

    def test_missing_and_broken_images_show_a_placeholder(self):
        self.visit('/ofertas')
        self.assertEqual(self.page.locator('#grid [data-image-state="missing"]').count(), 5)
        self.assertEqual(self.page.locator('#grid [data-stock-image]').count(), 0)
        self.mode = 'images'
        self.image_behavior = 'broken'
        self.visit('/ofertas')
        frame = self.page.locator('#grid .product-image-frame').first
        expect(frame).to_have_attribute('data-image-state', 'error')
        self.assertIn('Imagen no disponible', frame.inner_text())
        self.assertFalse(frame.locator('img').is_visible())

    def test_loading_image_keeps_card_size_and_prioritizes_visible_images(self):
        self.mode = 'images'
        self.image_behavior = 'hold'
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.goto(self.origin + '/ofertas', wait_until='domcontentloaded')
        frame = self.page.locator('#grid .product-image-frame').first
        expect(frame).to_have_attribute('data-image-state', 'loading')
        before = frame.bounding_box()
        first = frame.locator('img')
        expect(first).to_have_attribute('loading', 'eager')
        expect(first).to_have_attribute('fetchpriority', 'high')
        self.assertGreater(self.page.locator('#grid img[loading="lazy"]').count(), 0)
        self.page.wait_for_timeout(100)
        for request in self.pending_images[:]:
            request.fulfill(path=str(ROOT / 'assets' / 'logo.jpg'), content_type='image/jpeg')
        expect(frame).to_have_attribute('data-image-state', 'ready')
        after = frame.bounding_box()
        self.assertEqual((before['width'], before['height']), (after['width'], after['height']))
        self.page.emulate_media(reduced_motion='reduce')
        self.assertEqual(first.evaluate('(img) => getComputedStyle(img).transitionDuration'), '0s')

    def test_filter_link_restores_reload_shared_link_and_back(self):
        self.visit('/ofertas')
        self.page.locator('#search').fill('pokemon')
        self.page.locator('#sort-select').select_option('price-asc')
        self.page.locator('#price-input').fill('30')
        for game in GAMES[1:]:
            self.page.locator(f'input[data-game="{game}"]').uncheck()
        expect(self.page.locator('#grid .card')).to_have_count(1)
        shared = self.page.url
        params = parse_qs(urlparse(shared).query)
        self.assertEqual(params['game'], ['Pokémon'])
        self.assertEqual(params['q'], ['pokemon'])
        self.assertEqual(params['price'], ['30'])
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('#search')).to_have_value('pokemon')
        expect(self.page.locator('#price-input')).to_have_value('30')
        expect(self.page.locator('#sort-select')).to_have_value('price-asc')
        expect(self.page.locator('#grid .card')).to_have_count(1)
        self.visit('/favoritos')
        self.page.go_back(wait_until='networkidle')
        expect(self.page.locator('#search')).to_have_value('pokemon')
        expect(self.page.locator('#grid .card')).to_have_count(1)
        self.visit('/ofertas')
        self.page.goto(shared, wait_until='networkidle')
        expect(self.page.locator('#grid .card')).to_have_count(1)
        expect(self.page.locator('input[data-game="Magic"]')).not_to_be_checked()
        self.assertEqual(self.errors, [])

    def test_filter_url_validates_values_and_preserves_empty_selection(self):
        self.visit('/ofertas?store=invalid&sort=invalid&price=-3&discount=bad&utm_source=test')
        expect(self.page.locator('#grid .card')).to_have_count(5)
        expect(self.page.locator('#discount-range')).to_have_value('1')
        self.assertEqual(parse_qs(urlparse(self.page.url).query), {'utm_source': ['test']})
        for game in GAMES:
            self.page.locator(f'input[data-game="{game}"]').uncheck()
        self.assertIn('game=', self.page.url)
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('#grid .card')).to_have_count(0)
        expect(self.page.locator('input[data-game]:checked')).to_have_count(0)
        self.page.locator('#active-filters button').click()
        expect(self.page.locator('#grid .card')).to_have_count(5)
        self.assertNotIn('game=', self.page.url)

    def test_all_filter_groups_and_history_restore(self):
        self.visit('/cajas-de-coleccion?status=preventa&store=ES&category=Otros&discount=25&price=5')
        expect(self.page.locator('input[data-status="preventa"]')).to_be_checked()
        expect(self.page.locator('input[data-status="compra_directa"]')).not_to_be_checked()
        expect(self.page.locator('#discount-range')).to_have_value('25')
        expect(self.page.locator('#price-input')).to_have_value('5')
        expect(self.page.locator('#grid .card')).to_have_count(0)
        self.page.evaluate("history.pushState(null, '', location.pathname); dispatchEvent(new PopStateEvent('popstate'))")
        expect(self.page.locator('#price-input')).to_have_value('10')
        expect(self.page.locator('input[data-status="compra_directa"]')).to_be_checked()
        self.page.go_back(wait_until='networkidle')
        expect(self.page.locator('#price-input')).to_have_value('5')
        expect(self.page.locator('input[data-status="compra_directa"]')).not_to_be_checked()
        self.assertEqual(self.errors, [])

    def test_favorite_search_ignores_accents(self):
        self.visit('/')
        self.page.locator('#newest-grid [data-favorite]').first.click()
        self.visit('/favoritos')
        self.page.locator('#favorite-search').fill('POKEMON')
        expect(self.page.locator('#favorite-grid .card')).to_have_count(1)

    def test_price_parsing_and_invalid_limit_recovery(self):
        self.visit('/ofertas')
        parsed = self.page.evaluate("['1234,56 €', '1.234,56 €', 'EUR 1234.56', '-12,00 €', '12,34,56 €', '$12.34'].map(parsePrice)", isolated_context=False)
        self.assertEqual(parsed, [1234.56, 1234.56, 1234.56, None, None, None])
        self.assertEqual(self.page.evaluate("discountPercent({price:'10,00 €',original_price:'$20.00'})", isolated_context=False), 0)
        field = self.page.locator('#price-input')
        field.fill('5.25')
        expect(self.page.locator('#grid .card')).to_have_count(0)
        field.fill('-1')
        expect(field).to_have_attribute('aria-invalid', 'true')
        self.page.locator('#search').click()
        expect(field).to_have_value('5.25')
        expect(self.page.locator('#price-range')).to_have_value('5.25')
        field.fill('1234.56')
        self.page.reload(wait_until='networkidle')
        expect(field).to_have_value('1234.56')
        expect(self.page.locator('#price-range')).to_have_value('1234.56')

    def test_zero_results_reset_keeps_page_defaults(self):
        self.visit('/ofertas?q=missing&price=5')
        expect(self.page.locator('#count')).to_have_text('0 productos')
        self.page.locator('#reset-empty-filters').click()
        expect(self.page.locator('#grid .card')).to_have_count(5)
        expect(self.page.locator('#discount-range')).to_have_value('1')
        self.assertEqual(urlparse(self.page.url).query, '')
        self.visit('/cajas-de-coleccion?q=missing&category=Otros')
        self.page.locator('#reset-filters').click()
        expect(self.page.locator('input[data-category="Cajas de Colección"]')).to_be_checked()
        expect(self.page.locator('input[data-category="Otros"]')).not_to_be_checked()
        expect(self.page.locator('#search')).to_have_value('')
        self.assertEqual(urlparse(self.page.url).query, '')

    def test_product_return_link_and_safe_share_fallback(self):
        self.visit('/ofertas?q=pokemon&price=30')
        href = self.page.locator('#grid .card-img').first.get_attribute('href')
        self.assertEqual(parse_qs(urlparse(href).query)['return'], ['/ofertas?q=pokemon&price=30'])
        self.visit('/producto.html?mp=ES&asin=B000000000&return=%2Fofertas%3Fq%3Dpokemon%26price%3D30')
        expect(self.page.locator('#back-link')).to_have_attribute('href', '/ofertas?q=pokemon&price=30')
        self.page.evaluate("Object.defineProperty(navigator,'share',{value:undefined,configurable:true}); Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied')}},configurable:true})", isolated_context=False)
        self.page.locator('#share-product').click()
        expect(self.page.locator('#share-link')).to_have_value(self.origin + '/producto/ES-B000000000')
        self.assertNotIn('Enlace copiado', self.page.locator('#share-status').inner_text())
        self.visit('/producto.html?mp=ES&asin=B000000000&return=https%3A%2F%2Fevil.example')
        expect(self.page.locator('#back-link')).to_have_attribute('href', '/pokemontcg')

    def test_set_hub_renders_matched_products_and_return_link(self):
        self.visit('/set/op17')
        self.assertNotEqual(self.page.locator('#set-name').inner_text(), '')
        self.assertGreaterEqual(self.page.locator('#grid .card').count(), 1)
        href = self.page.locator('#grid .card-img').first.get_attribute('href')
        self.assertEqual(parse_qs(urlparse(href).query)['return'], ['/set/op17'])

    def test_known_product_refresh_does_not_request_other_games(self):
        template = (ROOT / 'producto.html').read_text(encoding='utf-8')
        product = {'asin':'B000000000','marketplace':'ES','name':'Old name','status':'compra_directa','price':'99,00 €','_src':'products.json'}
        template = template.replace('<script src="/producto.js"></script>', '<script id="product-data" type="application/json">' + json.dumps(product) + '</script><script src="/producto.js"></script>')
        self.page.route('**/producto/ES-B000000000', lambda route: route.fulfill(body=template, content_type='text/html'))
        requested = []
        self.page.on('request', lambda request: requested.append(urlparse(request.url).path.lstrip('/')))
        self.visit('/producto/ES-B000000000')
        expect(self.page.locator('#product-detail h1')).to_have_text('Pokémon Booster')
        self.assertIn('products.json', requested)
        for other in SOURCES[1:] + ['accesorios.json']:
            self.assertNotIn(other, requested)

    def test_favorites_export_import_preview_and_merge(self):
        self.visit('/')
        self.page.locator('#newest-grid [data-favorite]').first.click()
        self.visit('/favoritos')
        with self.page.expect_download() as download_info:
            self.page.locator('#export-favorites').click()
        exported = json.loads(Path(download_info.value.path()).read_text(encoding='utf-8'))
        self.assertEqual(exported['version'], 1)
        self.assertEqual(len(exported['favorites']), 1)
        self.assertEqual(set(exported['favorites'][0]), {'asin', 'marketplace', 'name'})
        incoming = {'version':1, 'favorites': exported['favorites'] + [{'asin':'B000000002','marketplace':'ES','name':'Magic Booster'}] * 2}
        self.page.locator('#import-favorites').set_input_files({'name':'favorites.json','mimeType':'application/json','buffer':json.dumps(incoming).encode()})
        expect(self.page.locator('#import-summary')).to_contain_text('1 favoritos nuevos; 1 ya guardados')
        expect(self.page.locator('#favorite-count')).to_have_text('1 producto guardado')
        self.page.locator('#confirm-import').click()
        expect(self.page.locator('#favorite-count')).to_have_text('2 productos guardados')
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('#favorite-count')).to_have_text('2 productos guardados')

    def test_favorites_invalid_import_and_failed_write_preserve_saved(self):
        self.visit('/')
        self.page.locator('#newest-grid [data-favorite]').first.click()
        self.visit('/favoritos')
        self.page.locator('#import-favorites').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{invalid'})
        expect(self.page.locator('#transfer-status')).to_contain_text('No se pudo leer')
        expect(self.page.locator('#import-preview')).not_to_be_visible()
        incoming={'version':1,'favorites':[{'asin':'B000000002','marketplace':'ES','name':'Magic Booster'}]}
        self.page.locator('#import-favorites').set_input_files({'name':'valid.json','mimeType':'application/json','buffer':json.dumps(incoming).encode()})
        expect(self.page.locator('#confirm-import')).to_be_visible()
        self.page.evaluate("() => { Storage.prototype.setItem = function(){ throw new DOMException('Full','QuotaExceededError'); }; }", isolated_context=False)
        self.page.locator('#confirm-import').click()
        expect(self.page.locator('#transfer-status')).to_contain_text('No se pudo guardar')
        expect(self.page.locator('#favorite-count')).to_have_text('1 producto guardado')

    def test_brand_resources_and_favorites_controls_fit_mobile(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.visit('/favoritos')
        self.page.evaluate('document.fonts.ready')
        self.assertTrue(self.page.evaluate("font => document.fonts.check(font)", '500 18px "WTS Manrope"'))
        self.assertTrue(self.page.locator('.brand-logo').evaluate('(i)=>i.complete && i.naturalWidth>0'))
        self.assertEqual(self.page.locator('.brand-name .accent').evaluate('(e)=>getComputedStyle(e).fontWeight'), '800')
        expect(self.page.locator('#choose-favorites')).to_be_visible()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    def test_invalid_timestamp_does_not_claim_a_recent_update(self):
        self.mode = 'invalid'
        self.visit('/magic')
        self.assertEqual(self.page.locator('#live-text').inner_text(), 'catálogo de productos')


if __name__ == '__main__':
    unittest.main()
