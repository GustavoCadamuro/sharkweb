<?php
/* Shark Lab - rastreamento: recebe visitas e cliques no checkout (so ate onde a pagina informa) */
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(204); exit; }
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|java\/|go-http|monitor|uptime|scan|archive|phantom|selenium/i', $ua)) { http_response_code(204); exit; }
$d = json_decode((string)file_get_contents('php://input', false, null, 0, 6144), true);
if (!is_array($d)) { http_response_code(204); exit; }
$cl = function ($s, $n = 200) { return substr(preg_replace('/[\x00-\x1f]/', '', (string)$s), 0, $n); };
$v = substr(preg_replace('/[^a-z0-9]/', '', strtolower((string)($d['v'] ?? ''))), 0, 24);
if (strlen($v) < 8) { http_response_code(204); exit; }
$ev = (($d['e'] ?? '') === 'ck') ? 'ck' : 'pv';
$u = [];
foreach (['s', 'm', 'c', 'n', 't', 'src', 'sck'] as $k) { $u[$k] = $cl($d['u'][$k] ?? '', 160); }
$ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ip = trim(explode(',', $ip)[0]);
$row = ['t' => time(), 'v' => $v, 'e' => $ev, 'u' => $u, 'fbp' => $cl($d['fbp'] ?? '', 80), 'fbc' => $cl($d['fbc'] ?? '', 160), 'p' => $cl($d['p'] ?? '', 120), 'r' => $cl($d['r'] ?? '', 80), 'ip' => $cl($ip, 45), 'ua' => $cl($ua, 220), 'dv' => (($d['dv'] ?? '') === 'm') ? 'm' : 'd'];
$dir = __DIR__ . '/data';
if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
$fn = $dir . '/visits.jsonl';
if (@filesize($fn) > 30 * 1024 * 1024) { http_response_code(204); exit; }
@file_put_contents($fn, json_encode($row, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND | LOCK_EX);
http_response_code(204);
