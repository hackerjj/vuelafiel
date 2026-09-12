# VuelaFiel

**Encuentra tu vuelo al mejor precio.**

VuelaFiel reúne los tramos de un itinerario y lleva directo a comparar precios en vivo (Google Flights, Skyscanner, Kayak y aerolíneas), con ruta y fecha ya cargadas. Prototipo funcional, pensado para crecer como plataforma.

## Demo

Sitio en GitHub Pages: `https://hackerjj.github.io/vuelafiel/`

## Ideología / Visión

Hoy VuelaFiel te acerca la búsqueda; el objetivo es que la **haga por ti**. El motor será una capa de conectores de datos de vuelo (MCP — Model Context Protocol) que tu asistente de IA usa por debajo para encontrar el tramo más barato comparando decenas de fechas y aerolíneas en segundos.

Tres MCP forman ese motor:

| MCP | Qué aporta |
|-----|------------|
| **Duffel Flights MCP** (`ravinahp/flights-mcp` con API Duffel) | Búsqueda de vuelos reales en vivo por lenguaje natural, rangos de fechas flexibles, memoria de búsquedas. |
| **ravinahp/flights-mcp** | Buscar a través de múltiples días para el mejor precio sin revisar fecha por fecha. |
| **Flight Finder AI (Google Flights MCP)** | Rutas más baratas y tendencias de precio desde Google Flights. |

**Nota de arquitectura (honesta):** estos MCP corren junto al asistente (Claude/Cursor/Kiro), no dentro de esta página estática. Una página en GitHub Pages es cliente puro y no puede llamar a un MCP ni a Duffel directo (necesita backend + API key). Por eso el sitio muestra el itinerario y links de búsqueda; el "buscar por mí" ocurre en el asistente con el MCP conectado. El siguiente paso natural para búsqueda real embebida sería un pequeño backend (función serverless) que proxee a Duffel.

## Estructura

- `index.html` — la app (sitio de GitHub Pages)
- `buscador-vuelos.html` — copia de trabajo
- `contexto-vuelos.md` — contexto del itinerario Sep/Oct 2026
- `README.md` — este archivo

## Roadmap

- [ ] Formulario para agregar tramos propios (no solo el itinerario fijo)
- [ ] Guardar itinerarios en el navegador (localStorage)
- [ ] Calculadora de total + aplicar vouchers Volaris
- [ ] Backend serverless que proxee Duffel para búsqueda real en la página
- [ ] Empatar escalas entre viajeros (campo de horario del acompañante)

## Licencia

MIT.
