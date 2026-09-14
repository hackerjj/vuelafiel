# VuelaAmigo — Backend (Cloudflare Worker)

Proxy seguro a la API de Duffel. Guarda el token de Duffel como secreto (nunca en el código ni en el front).

## Desplegar (una vez)

Requiere Node instalado. Desde esta carpeta `backend/`:

```bash
# 1. Iniciar sesión en Cloudflare (abre el navegador)
npx wrangler login

# 2. Guardar el token de Duffel como secreto (pega el duffel_test_... cuando lo pida)
npx wrangler secret put DUFFEL_TOKEN

# 3. Desplegar
npx wrangler deploy
```

Al terminar, Wrangler imprime la URL del Worker, algo como:
`https://vuelaamigo.<tu-subdominio>.workers.dev`

Copia esa URL y pégala en `index.html` (constante `BACKEND_URL`).

## Endpoint

`POST /search`
```json
{ "origin": "MEX", "destination": "GDL", "date": "2026-09-20", "passengers": 1, "cabin": "economy" }
```
Respuesta:
```json
{ "offers": [ { "airline": "...", "price": 45.76, "currency": "USD", "depart": "...", "arrive": "...", "stops": 0 } ] }
```

## Nota

En Test mode de Duffel las aerolíneas y precios son de un entorno de pruebas (verás "Duffel Airways", precios en USD). Para precios reales de mercado se necesita el modo live de Duffel (requiere su aprobación).
