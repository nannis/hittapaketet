<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metod ej tillåten']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$number = trim($body['number'] ?? '');
$carrier = $body['carrier'] ?? null;

if (empty($number)) {
    http_response_code(400);
    echo json_encode(['error' => 'Spårningsnummer saknas']);
    exit;
}

$payload = [['number' => $number]];
if ($carrier) {
    $payload[0]['carrier'] = (int)$carrier;
}

$ch = curl_init('https://api.17track.net/track/v2.2/register');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => [
        '17token: ' . API_KEY_17TRACK,
        'Content-Type: application/json',
    ],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $response;
