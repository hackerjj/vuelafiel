/**
 * VuelaAmigo — backend proxy a la API de Duffel (Cloudflare Worker).
 *
 * Token de Duffel = secreto del Worker (nunca en el código ni en el front):
 *   npx wrangler secret put DUFFEL_TOKEN
 *
 * POST /search
 *   { origin, destination, date, passengers, cabin, flex }
 *   flex = días +/- alrededor de la fecha (0 = solo ese día; 3 = busca 7 días).
 * Respuesta:
 *   {
 *     byDay:  [ { date, cheapest, currency } ],   // día más barato primero
 *     offers: [ { airline, price, currency, depart, arrive, stops, date } ]  // top 30 global
 *   }
 */

const DUFFEL_URL = "https://api.duffel.com/air/offer_requests?return_offers=true";

const ALLOWED_ORIGINS = [
  "https://hackerjj.github.io",
  "http://localhost",
  "http://127.0.0.1",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.some((o) => (origin || "").startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function searchOneDay(env, from, to, date, pax, cabin) {
  const payload = {
    data: {
      slices: [{ origin: from, destination: to, departure_date: date }],
      passengers: Array.from({ length: pax }, () => ({ type: "adult" })),
      cabin_class: cabin,
    },
  };
  const resp = await fetch(DUFFEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DUFFEL_TOKEN}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const raw = await resp.json();
  if (!resp.ok || raw.errors) {
    return { date, error: raw.errors ? raw.errors[0].message : `Error ${resp.status}`, offers: [] };
  }
  const offers = (raw.data.offers || []).map((o) => {
    const slice = o.slices[0];
    const segs = slice.segments;
    return {
      airline: o.owner.name,
      price: Number(o.total_amount),
      currency: o.total_currency,
      depart: segs[0].departing_at,
      arrive: segs[segs.length - 1].arriving_at,
      stops: segs.length - 1,
      date,
    };
  });
  return { date, offers };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, service: "vuelaamigo" }), { headers: cors });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Usa POST /search" }), { status: 405, headers: cors });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors }); }

    const from = String(body.origin || "").trim().toUpperCase();
    const to = String(body.destination || "").trim().toUpperCase();
    const date = String(body.date || "").trim();
    const pax = Math.max(1, Number(body.passengers) || 1);
    const cabin = body.cabin || "economy";
    const flex = Math.min(5, Math.max(0, Number(body.flex) || 0)); // tope 5 para no abusar

    if (!from || !to || !date) {
      return new Response(JSON.stringify({ error: "Faltan origin, destination o date" }), { status: 400, headers: cors });
    }

    // Fechas a buscar: date-flex ... date+flex
    const dates = [];
    for (let i = -flex; i <= flex; i++) dates.push(addDays(date, i));

    let days;
    try {
      days = await Promise.all(dates.map((d) => searchOneDay(env, from, to, d, pax, cabin)));
    } catch {
      return new Response(JSON.stringify({ error: "No se pudo contactar a Duffel" }), { status: 502, headers: cors });
    }

    // Si TODOS fallaron, regresa el error del día pedido.
    const anyOk = days.some((d) => d.offers.length > 0);
    if (!anyOk) {
      const main = days.find((d) => d.date === date) || days[0];
      return new Response(JSON.stringify({ error: main.error || "Sin vuelos", byDay: [], offers: [] }), { headers: cors });
    }

    // Resumen por día (día más barato primero)
    const byDay = days
      .filter((d) => d.offers.length)
      .map((d) => {
        const min = d.offers.reduce((a, b) => (a.price < b.price ? a : b));
        return { date: d.date, cheapest: min.price, currency: min.currency };
      })
      .sort((a, b) => a.cheapest - b.cheapest);

    // Todas las ofertas juntas, ordenadas por precio (top 30)
    const offers = days.flatMap((d) => d.offers).sort((a, b) => a.price - b.price).slice(0, 30);

    return new Response(JSON.stringify({ byDay, offers }), { headers: cors });
  },
};
