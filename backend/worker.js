/**
 * VuelaAmigo — backend proxy a la API de Duffel (Cloudflare Worker).
 *
 * El token de Duffel se guarda como SECRETO del Worker (nunca en el código ni en el front):
 *   npx wrangler secret put DUFFEL_TOKEN
 *
 * Recibe:  POST /search  { origin, destination, date, passengers, cabin }
 * Devuelve: { offers: [ { airline, price, currency, depart, arrive, stops, duration } ] }
 */

const DUFFEL_URL = "https://api.duffel.com/air/offer_requests?return_offers=true";

// Ajusta a tu dominio de GitHub Pages para restringir quién puede llamar al backend.
const ALLOWED_ORIGINS = [
  "https://hackerjj.github.io",
  "http://localhost",
  "http://127.0.0.1",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.some((o) => (origin || "").startsWith(o))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Usa POST /search" }), { status: 405, headers: cors });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors });
    }

    const { origin: from, destination: to, date, passengers = 1, cabin = "economy" } = body;
    if (!from || !to || !date) {
      return new Response(JSON.stringify({ error: "Faltan origin, destination o date" }), { status: 400, headers: cors });
    }

    const pax = Array.from({ length: Math.max(1, Number(passengers) || 1) }, () => ({ type: "adult" }));

    const duffelReq = {
      data: {
        slices: [{ origin: from, destination: to, departure_date: date }],
        passengers: pax,
        cabin_class: cabin,
      },
    };

    let resp;
    try {
      resp = await fetch(DUFFEL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.DUFFEL_TOKEN}`,
          "Duffel-Version": "v2",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(duffelReq),
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "No se pudo contactar a Duffel" }), { status: 502, headers: cors });
    }

    const raw = await resp.json();
    if (!resp.ok || raw.errors) {
      const msg = raw.errors ? raw.errors[0].message : "Error de Duffel";
      return new Response(JSON.stringify({ error: msg }), { status: resp.status, headers: cors });
    }

    const offers = (raw.data.offers || []).map((o) => {
      const slice = o.slices[0];
      const segs = slice.segments;
      const first = segs[0];
      const last = segs[segs.length - 1];
      return {
        airline: o.owner.name,
        price: Number(o.total_amount),
        currency: o.total_currency,
        depart: first.departing_at,
        arrive: last.arriving_at,
        stops: segs.length - 1,
        duration: slice.duration || null,
      };
    });

    offers.sort((a, b) => a.price - b.price);

    return new Response(JSON.stringify({ offers: offers.slice(0, 30) }), { headers: cors });
  },
};
