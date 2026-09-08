# Where’s That Stock

Web estática de stock y ofertas de Pokémon, One Piece, Magic, Lorcana y Yu-Gi-Oh!,
con accesorios. Se publica con Cloudflare Workers Builds al actualizar main.

Los snapshots los publica pokestock-tcg-bot. Pokémon y One Piece se consultan
cada hora; Magic, Lorcana y Yu-Gi-Oh! cada seis horas; accesorios diariamente.
La cabecera es discreta, sin avisos públicos de retraso ni desglose por fuente
(decisión del usuario, 2026-09-08). El monitor interno del bot conserva los
controles de antigüedad y fallos. Son comprobaciones periódicas, no stock en tiempo real.

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

Favoritos: los corazones de tarjetas y fichas guardan tienda, identificador y
nombre en localStorage (`wts-favorites-v1`). La página /favoritos recupera el
stock actual; si falta el producto, conserva su nombre y enlace a la ficha,
sin presentar un precio antiguo como actual. No requiere cuenta ni servidor.
Los datos pertenecen a ese navegador y no se sincronizan entre dispositivos.
Se sincronizan entre pestañas; las escrituras fallidas se comunican sin fingir
que el producto se ha guardado. La página personal lleva noindex.

Las imágenes de producto comparten estados de carga, imagen lista y fallo en
portada, listados, favoritos y fichas. Los marcos mantienen su tamaño y muestran
un marcador si falta la imagen o falla. Las visibles se cargan de inmediato
(las primeras dos de cada bloque con prioridad alta); las demás usan carga
diferida. La transición respeta la preferencia de reducir movimiento.

Los listados conservan búsqueda, orden y filtros en la URL (`q`, `sort`, `store`, `status`, `category`, `game`, `price`, `discount`). Los grupos admiten parámetros repetidos y un valor vacío para seleccionar ninguno. Se restauran tras cargar los datos; los valores desconocidos usan los valores por defecto de la página. La búsqueda del catálogo y favoritos ignora mayúsculas y tildes.

Identidad: nombre en Manrope 500/800, mayúsculas y sin acento de color. Fuente alojada en `assets/brand/` con licencia OFL. Símbolo, favicon, imagen social y avatares aprobados en esa carpeta. Las fichas futuras heredan la cabecera de `producto.html`.
