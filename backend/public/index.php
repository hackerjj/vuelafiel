<?php
/**
 * VuelaAmigo — backend proxy a la API de Duffel.
 * Desplegado en Render (Docker), mismo patrón que MealLi.
 *
 * El token de Duffel viene de la variable de entorno DUFFEL_TOKEN
 * (se configura como secreto en Render, nunca en el código).
 *
 * Endpoint:  POST /search
 *   { "origin":"MEX", "destination":"GDL", "date":"2026-09-20", "passengers":1, "cabin":"economy" }
 * Respuesta: { "offers": [ { airline, price, currency, depart, arrive, stops } ] }
 */

// ---- CORS: solo orígenes permitidos (GitHub Pages / local) ----
$allowed = [
    'https://hackerjj.github.io',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost',
    'http://127.0.0.1',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allow  = in_array($origin, $allowed, true) ? $origin : $allowed[0];
header("Access-Control-Allow-Origin: $allow");
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

if ($method === 'OPTIONS') { http_response_code(204); exit; }

// Health check para Render
if ($path === '/' || $path === '/health') {
    echo json_encode(['ok' => true, 'service' => 'vuelaamigo-backend']);
    exit;
}

if ($path !== '/search' || $method !== 'POST') {
    http_response_code(404);
    echo json_encode(['error' => 'Usa POST /search']);
    exit;
}

$token = getenv('DUFFEL_TOKEN');
if (!$token) {
    http_response_code(500);
    echo json_encode(['error' => 'Falta DUFFEL_TOKEN en el servidor']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON inválido']);
    exit;
}

$from = strtoupper(trim($body['origin'] ?? ''));
$to   = strtoupper(trim($body['destination'] ?? ''));
$date = trim($body['date'] ?? '');
$pax  = max(1, (int)($body['passengers'] ?? 1));
$cab  = $body['cabin'] ?? 'economy';

if (!$from || !$to || !$date) {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan origin, destination o date']);
    exit;
}

$passengers = array_fill(0, $pax, ['type' => 'adult']);
$payload = ['data' => [
    'slices'      => [['origin' => $from, 'destination' => $to, 'departure_date' => $date]],
    'passengers'  => $passengers,
    'cabin_class' => $cab,
]];

$ch = curl_init('https://api.duffel.com/air/offer_requests?return_offers=true');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        "Authorization: Bearer $token",
        'Duffel-Version: v2',
        'Content-Type: application/json',
        'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
]);
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($resp === false) {
    http_response_code(502);
    echo json_encode(['error' => 'No se pudo contactar a Duffel']);
    exit;
}
curl_close($ch);

$data = json_decode($resp, true);
if ($code >= 400 || isset($data['errors'])) {
    http_response_code($code ?: 502);
    $msg = $data['errors'][0]['message'] ?? 'Error de Duffel';
    echo json_encode(['error' => $msg]);
    exit;
}

$offers = [];
foreach (($data['data']['offers'] ?? []) as $o) {
    $slice = $o['slices'][0];
    $segs  = $slice['segments'];
    $first = $segs[0];
    $last  = $segs[count($segs) - 1];
    $offers[] = [
        'airline'  => $o['owner']['name'],
        'price'    => (float)$o['total_amount'],
        'currency' => $o['total_currency'],
        'depart'   => $first['departing_at'],
        'arrive'   => $last['arriving_at'],
        'stops'    => count($segs) - 1,
    ];
}
usort($offers, fn($a, $b) => $a['price'] <=> $b['price']);

echo json_encode(['offers' => array_slice($offers, 0, 30)]);
