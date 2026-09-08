# Where’s That Stock

Web estática de stock y ofertas de Pokémon, One Piece, Magic, Lorcana y Yu-Gi-Oh!,
con accesorios. Se publica con Cloudflare Workers Builds al actualizar main.

Los snapshots los publica pokestock-tcg-bot. Pokémon y One Piece se consultan
cada hora; Magic, Lorcana y Yu-Gi-Oh! cada seis horas; accesorios diariamente.
La interfaz muestra la antigüedad por fuente y advierte tras dos intervalos
más 30 minutos de margen. Son comprobaciones periódicas, no stock en tiempo real.

La portada combina los cinco juegos. Los archivos activity-*.json guardan los
últimos 200 eventos de cada fuente; los catalog-*.json conservan productos
que dejan de aparecer. Su ausencia significa disponibilidad sin confirmar.

El bot ejecuta build_catalog.py al publicar: genera producto/{tienda}-{id}.html
con contenido inicial, metadatos, URL canónica y entrada en el sitemap. Son
fichas estáticas con HTTP 200, también después de desaparecer del listado.
Las rutas desconocidas siguen devolviendo 404. No editar a mano los archivos
generados. La plantilla es producto.html y el comportamiento es producto.js.

La migración a una API y almacenamiento persistente sigue aplazada.

Pruebas de navegador (también en GitHub Actions al cambiar la interfaz):
```
pip install patchright==1.62.1
patchright install chromium
python -B -m unittest discover -s tests -v
```
Las pruebas simulan los feeds y bloquean el tráfico externo.
