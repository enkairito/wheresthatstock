# Diseño del frontend

Revisión y actualización: 2026-09-19.

Se revisaron la portada, listados, fichas, noticias, artículos, calendario,
navegación, filtros y componentes comunes, en escritorio y móvil.

La identidad mantiene el símbolo aprobado y el nombre en Manrope 500/800,
en mayúsculas y sin acento de color.
El diseño usa una sola familia tipográfica, fondos neutros, bordes finos y
sombras discretas. El color se reserva para los juegos y estados de producto.
Los precios tienen prioridad visual y las acciones de compra una presentación
uniforme. Los logos tienen un fondo claro para conservar su legibilidad.

La portada presenta una introducción breve y seis accesos compactos: cinco
juegos y accesorios. Los filtros empiezan plegados en móvil y conservan una
preferencia independiente de escritorio. El control expone aria-expanded.
Se respetan el modo oscuro, el foco de teclado y la reducción de movimiento.

Los estilos comunes están en styles.css, en el bloque «Diseño común» y sus
reglas adaptativas. No hay una segunda hoja de estilos ni imágenes nuevas.
El aviso público de antigüedad de stock sigue retirado por decisión del usuario.

Validación: pruebas de navegador para búsqueda/listados, filtros, navegación,
fichas y anchuras de 390, 768, 1024 y 1440 píxeles; revisión visual con datos
reales de portada, ofertas, categoría, artículo y modo oscuro.
