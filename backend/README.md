# VuelaAmigo — Backend (Cloudflare Worker)

Proxy seguro a la API de Duffel, con búsqueda multi-fecha. Gratis para el volumen esperado (plan free de Workers: 100,000 requests/día; sin cold start).

## Desplegar (una vez)

Requiere Node. Desde esta carpeta `backend/`:

```bash
npx wrangler login              # abre el navegador, autoriza con tu cuenta Cloudflare
npx wrangler secret put DUFFEL_TOKEN   # pega el duffel_test_... cuando lo pida
npx wrangler deploy
```

Al terminar imprime la URL, ej: `https://vuelaamigo.<tu-subdominio>.workers.dev`.
Pégala en `../index.html` (constante `BACKEND_URL`).

## Endpoint

`POST /search`
```json
{ "origin":"GDL", "destination":"MEX", "date":"2026-09-20", "passengers":1, "cabin":"economy", "flex":3 }
```
- `flex`: días +/- alrededor de la fecha (0 = solo ese día, 3 = busca 7 días). Tope 5.

Respuesta:
```json
{
  "byDay":  [ { "date":"2026-09-19", "cheapest":42.1, "currency":"USD" } ],
  "offers": [ { "airline":"...", "price":42.1, "currency":"USD", "depart":"...", "arrive":"...", "stops":0, "date":"2026-09-19" } ]
}
```

## Notas

- **Multi-fecha:** con `flex` busca varios días en paralelo y te dice el día más barato. Es lo que hace fuerte a un buscador de vuelos baratos.
- **Modo test de Duffel:** aerolíneas y precios son de un entorno de pruebas. Para tarifas reales de mercado se necesita el modo live de Duffel (requiere su aprobación).
- **Seguridad:** el token va como secreto del Worker, jamás en el repo.
