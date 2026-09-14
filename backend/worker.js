/**
 * VuelaAmigo — backend (Cloudflare Worker) proxy a Duffel (+ Amadeus opcional).
 *
 * Secretos del Worker (nunca en el código):
 *   npx wrangler secret put DUFFEL_TOKEN
 *   (opcional, 2ª fuente)  npx wrangler secret put AMADEUS_ID
 *                          npx wrangler secret put AMADEUS_SECRET
 *   (opcional, afiliado)   npx wrangler secret put TP_MARKER   (Travelpayouts/Aviasales)
 *
 * Endpoints:
 *   GET  /places?q=guadal      -> [ { city, name, iata, country } ]  (autocompletar)
 *   POST /search               -> { byDay, offers }  (ida o redondo, multi-fecha)
 *   GET  /health
 */

const DUFFEL_BASE = "https://api.duffel.com";
const DUFFEL_SEARCH = DUFFEL_BASE + "/air/offer_requests?return_offers=true";
const DUFFEL_PLACES = DUFFEL_BASE + "/places/suggestions";

const ALLOWED_ORIGINS = [
  "https://hackerjj.github.io",
  "http://localhost",
  "http://127.0.0.1",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.some((o) => (origin || "").startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function duffelHeaders(env) {
  return {
    Authorization: `Bearer ${env.DUFFEL_TOKEN}`,
    "Duffel-Version": "v2",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// ---- Autocompletado de lugares (ciudad / aeropuerto) ----
async function places(env, q) {
  const url = DUFFEL_PLACES + "?query=" + encodeURIComponent(q);
  const resp = await fetch(url, { headers: duffelHeaders(env) });
  const raw = await resp.json();
  if (!resp.ok || raw.errors) return [];
  const list = [];
  for (const p of raw.data || []) {
    if (p.type === "airport" && p.iata_code) {
      list.push({ city: p.city_name || p.name, name: p.name, iata: p.iata_code, country: p.iata_country_code });
    } else if (p.type === "city" && p.iata_code) {
      list.push({ city: p.name, name: p.name + " (todos los aeropuertos)", iata: p.iata_code, country: p.iata_country_code });
      // aeropuertos dentro de la ciudad
      for (const a of p.airports || []) {
        if (a.iata_code) list.push({ city: p.name, name: a.name, iata: a.iata_code, country: a.iata_country_code });
      }
    }
  }
  return list.slice(0, 8);
}

// ---- Una búsqueda (ida sola o ida+vuelta) para una fecha de salida dada ----
async function searchOnce(env, from, to, departDate, returnDate, pax, cabin) {
  const slices = [{ origin: from, destination: to, departure_date: departDate }];
  if (returnDate) slices.push({ origin: to, destination: from, departure_date: returnDate });

  const payload = {
    data: {
      slices,
      passengers: Array.from({ length: pax }, () => ({ type: "adult" })),
      cabin_class: cabin,
    },
  };
  const resp = await fetch(DUFFEL_SEARCH, {
    method: "POST",
    headers: duffelHeaders(env),
    body: JSON.stringify(payload),
  });
  const raw = await resp.json();
  if (!resp.ok || raw.errors) {
    return { date: departDate, error: raw.errors ? raw.errors[0].message : `Error ${resp.status}`, offers: [] };
  }
  const offers = (raw.data.offers || []).map((o) => {
    const out = o.slices[0];
    const outSegs = out.segments;
    const res = {
      source: "Duffel",
      airline: o.owner.name,
      price: Number(o.total_amount),
      currency: o.total_currency,
      depart: outSegs[0].departing_at,
      arrive: outSegs[outSegs.length - 1].arriving_at,
      stops: outSegs.length - 1,
      date: departDate,
      roundtrip: !!returnDate,
      origin: from,
      destination: to,
    };
    if (o.slices[1]) {
      const back = o.slices[1].segments;
      res.retDepart = back[0].departing_at;
      res.retArrive = back[back.length - 1].arriving_at;
      res.retStops = back.length - 1;
      res.returnDate = returnDate;
    }
    return res;
  });
  return { date: departDate, offers };
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

    // ---- Autocompletar lugares ----
    if (url.pathname === "/places" && request.method === "GET") {
      const q = (url.searchParams.get("q") || "").trim();
      if (q.length < 2) return new Response(JSON.stringify([]), { headers: cors });
      try {
        return new Response(JSON.stringify(await places(env, q)), { headers: cors });
      } catch {
        return new Response(JSON.stringify([]), { headers: cors });
      }
    }

    // ---- Búsqueda ----
    if (url.pathname === "/search" && request.method === "POST") {
      let body;
      try { body = await request.json(); }
      catch { return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors }); }

      const from = String(body.origin || "").trim().toUpperCase();
      const to = String(body.destination || "").trim().toUpperCase();
      const date = String(body.date || "").trim();
      const returnDate = body.returnDate ? String(body.returnDate).trim() : null;
      const pax = Math.max(1, Number(body.passengers) || 1);
      const cabin = body.cabin || "economy";
      const flex = Math.min(5, Math.max(0, Number(body.flex) || 0));

      if (!from || !to || !date) {
        return new Response(JSON.stringify({ error: "Faltan origin, destination o date" }), { status: 400, headers: cors });
      }

      // fechas de salida a probar; si es redondo, la fecha de regreso se desplaza igual
      const dates = [];
      for (let i = -flex; i <= flex; i++) dates.push(i);

      let days;
      try {
        days = await Promise.all(dates.map((off) => {
          const dep = addDays(date, off);
          const ret = returnDate ? addDays(returnDate, off) : null;
          return searchOnce(env, from, to, dep, ret, pax, cabin);
        }));
      } catch {
        return new Response(JSON.stringify({ error: "No se pudo contactar a Duffel" }), { status: 502, headers: cors });
      }

      const anyOk = days.some((d) => d.offers.length > 0);
      if (!anyOk) {
        const main = days.find((d) => d.date === date) || days[0];
        return new Response(JSON.stringify({ error: (main && main.error) || "Sin vuelos", byDay: [], offers: [] }), { headers: cors });
      }

      const byDay = days
        .filter((d) => d.offers.length)
        .map((d) => {
          const min = d.offers.reduce((a, b) => (a.price < b.price ? a : b));
          return { date: d.date, cheapest: min.price, currency: min.currency };
        })
        .sort((a, b) => a.cheapest - b.cheapest);

      const offers = days.flatMap((d) => d.offers).sort((a, b) => a.price - b.price).slice(0, 30);

      return new Response(JSON.stringify({ byDay, offers }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: "Ruta no encontrada" }), { status: 404, headers: cors });
  },
};
