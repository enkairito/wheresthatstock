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

Las tarjetas y fichas identifican los precios históricos y ocultan sus descuentos
y mensajes de pocas unidades. Las fichas muestran la fecha de observación
cuando existe; los sets usan sus datos incrustados y no la fecha de otro juego.
Las ofertas sin confirmar no se publican como agotadas ni como comprables en JSON-LD.
Los filtros resuelven su estado guardado antes del primer renderizado, y los
listados reservan espacio durante la carga para evitar saltos en móvil.

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
Al actualizar los catálogos dentro de la misma pestaña se sustituye la observación
completa: los productos ausentes o de fuentes fallidas pasan a «sin confirmar»,
sin conservar un precio antiguo como comprable. Las respuestas de cargas anteriores
no pueden sustituir una actualización más reciente.
Se sincronizan entre pestañas; las escrituras fallidas se comunican sin fingir
que el producto se ha guardado. La página personal lleva noindex.

Ofertas incluye todas las tiendas soportadas, también GAME, MediaMarkt y
TodoConsolas. Los fallos de carga se indican dentro del contenido, sin modificar
la política de cabecera discreta: listados, portada, actividad y favoritos
permiten reintentar. Una carga parcial se distingue de cero coincidencias;
el reintento conserva los filtros y las respuestas antiguas no sustituyen las
nuevas. Las pruebas cubren estos estados con fuentes simuladas.

En móvil, las tarjetas muestran el nombre completo y el comparador dedica
una fila al precio y su fecha. Los campos de precio tienen nombre accesible
y error asociado. Menús y filtros conservan el foco al cerrarse o eliminarse;
los desplegables admiten flechas, Inicio/Fin, Escape y la tabulación habitual.
Se han ampliado los controles pequeños y reforzado el contraste de formularios
y textos que antes se atenuaban con opacidad.

Los feeds validan la identidad, el nombre y las categorías de cada producto.
Un registro mal formado no oculta los demás: se descarta y se comunica carga
incompleta. Un feed no vacío sin ningún registro válido se trata como un error,
no como un catálogo sin productos. Los estados desconocidos son «sin confirmar».
Las preferencias de vista o filtros dañadas recuperan sus valores por defecto.
La actividad describe comprobaciones pasadas, no disponibilidad actual; los
eventos sin fecha válida, futuros o de tipo desconocido no se presentan como
reposiciones confirmadas. La FAQ visible y sus datos estructurados explican
también que ofertas y precios proceden de comprobaciones periódicas.

Las imágenes de producto comparten estados de carga, imagen lista y fallo en
portada, listados, favoritos y fichas. Los marcos mantienen su tamaño y muestran
un marcador si falta la imagen o falla. Las visibles se cargan de inmediato
(las primeras dos de cada bloque con prioridad alta); las demás usan carga
diferida. La transición respeta la preferencia de reducir movimiento.

Los listados conservan búsqueda, orden y filtros en la URL (`q`, `sort`, `store`, `status`, `category`, `game`, `price`, `discount`). Los grupos admiten parámetros repetidos y un valor vacío para seleccionar ninguno. Se restauran tras cargar los datos; los valores desconocidos usan los valores por defecto de la página. La búsqueda del catálogo y favoritos ignora mayúsculas y tildes.

Identidad: nombre en Manrope 500/800, mayúsculas y sin acento de color. Fuente alojada en `assets/brand/` con licencia OFL. Símbolo, favicon, imagen social y avatares aprobados en esa carpeta. Las fichas futuras heredan la cabecera de `producto.html`.

La navegación común se edita en `partials/navigation.html`. Ejecutar `python scripts/sync_navigation.py` antes de hacer commit; CI comprueba que los HTML están sincronizados. Las fichas generadas heredan la navegación de `producto.html`. Las fuentes y los iconos relevantes activan las pruebas si cambian. Manrope se sirve en WOFF2 latino con caracteres españoles; se conserva su licencia y el TTF original para diseño.

Los listados muestran cero resultados y permiten restablecer los valores iniciales de cada página. Los límites de precio usan euros; descuentos solo comparan precios de la misma moneda. Una entrada de precio inválida se marca y recupera el último valor válido al salir del campo. Las fichas llevan un retorno validado al listado de origen y comparten su URL canónica. Consultan primero la fuente incrustada; estadísticas y otros juegos no bloquean la actualización principal.

Favoritos permite descargar una copia JSON e importar hasta 2000 entradas (archivo de hasta 1 MB), con vista previa, deduplicación y fusión que conserva lo guardado. No incluye enlaces o precios del archivo importado ni añade cuentas. Los errores de lectura o almacenamiento se muestran sin afirmar que se han guardado cambios.
