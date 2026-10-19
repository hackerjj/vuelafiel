# Changelog — VuelaAmigo

Historial de cambios del sitio. Lo más reciente arriba. Cada versión también aparece
dentro del sitio al dar clic en el chip de versión junto al logo.

## v1.2.1 — 12 sep 2026 · 15:10

### Corregido
- Cambio de idioma de verdad. El título del hero estaba invisible encima del menú (problema de z-index) y se comía los clics en las opciones. Verificado con navegador real (Chrome headless): ahora al dar clic cambia a español, inglés y alemán.

## v1.2 — 12 sep 2026 · 14:40

### Corregido
- Las etiquetas de color del historial ya no tapan las primeras letras del texto. Ahora van al lado y se lee todo completo.

## v1.1 — 12 sep 2026 · 14:05

### Agregado
- Historial de cambios dentro del sitio. El chip de versión junto al logo abre una ventana con todo lo que se ha ido haciendo.

### Corregido
- Cambio de idioma. Antes se quedaba en portugués al elegir otro idioma. Ahora cambia bien a español, inglés y alemán.

### Cambiado
- El menú de idioma marca cuál está activo y recuerda tu preferencia la próxima vez que entras.

## v1.0 — versión inicial

### Agregado
- Buscador de vuelos con datos reales vía Duffel (backend en Cloudflare Worker).
- Autocompletar de ciudades y aeropuertos al escribir.
- Viaje solo ida o redondo, con búsqueda flexible de ± 1, 2 o 3 días.
- Resultados ordenados del más barato al más caro, con el más barato marcado arriba.
- Precios convertidos a tu moneda (MXN, USD, EUR, BRL) según el idioma.
- Búsquedas guardadas y tramos rápidos de un clic (MEX-GDL, GDL-TRC, TRC-GDL).
- Botón Comprar que lleva a completar la reserva (afiliado Travelpayouts).
- Sitio en 4 idiomas: portugués, español, inglés y alemán.
