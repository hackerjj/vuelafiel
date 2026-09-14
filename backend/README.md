# VuelaAmigo — Backend (Render + Docker)

Proxy seguro a la API de Duffel. Mismo patrón que MealLi: contenedor Docker en Render, token como secreto (nunca en el código ni en el front).

## Desplegar en Render

**Opción A — Blueprint (recomendada):**
1. Sube este repo a GitHub (ya está en `hackerjj/vuelafiel`).
2. En Render: **New > Blueprint**, apunta al repo, subcarpeta `vuelos/backend/` (usa el `render.yaml`).
3. Cuando pida `DUFFEL_TOKEN`, pega el token `duffel_test_...` (queda como secreto, no en el repo).
4. Deploy. Render te da una URL tipo `https://vuelaamigo-backend.onrender.com`.

**Opción B — Manual:**
1. Render: **New > Web Service**, conecta el repo, root directory `vuelos/backend`.
2. Runtime: Docker. Plan: Free.
3. En **Environment**, agrega variable `DUFFEL_TOKEN` = tu token.
4. Deploy.

## Endpoint

`POST /search`
```json
{ "origin": "MEX", "destination": "GDL", "date": "2026-09-20", "passengers": 1, "cabin": "economy" }
```
Respuesta:
```json
{ "offers": [ { "airline": "...", "price": 45.76, "currency": "USD", "depart": "...", "arrive": "...", "stops": 0 } ] }
```
Health check: `GET /health`

## Conectar el frontend

Copia la URL de Render y pégala en `../index.html`, constante `BACKEND_URL`.

## Notas

- **Cold start** (plan free de Render): la primera búsqueda del día puede tardar unos segundos en despertar el servicio. Igual que MealLi.
- **Modo test de Duffel:** aerolíneas y precios son de un entorno de pruebas. Para tarifas reales de mercado se necesita el modo live de Duffel (requiere su aprobación).
- **Seguridad:** el token va como variable de entorno / secreto en Render, jamás en `render.yaml` ni en el repo.
