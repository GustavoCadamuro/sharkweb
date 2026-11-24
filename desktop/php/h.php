<?php
/* Shark Lab - rastreamento: recebe as vendas (webhook) de Cakto, Kiwify, Ticto, Kirvano, Hotmart e outras */
header('Cache-Control: no-store');
$c = include __DIR__ . '/config.php';
$p = strtolower(preg_replace('/[^a-z0-9_-]/i', '', (string)($_GET['p'] ?? 'outra')));
$s = (string)($_GET['s'] ?? '');
if (!is_array($c) || !hash_equals((string)$c['hs'], $s)) { http_response_code(403); echo '{"ok":0}'; exit; }
$raw = (string)file_get_contents('php://input', false, null, 0, 262144);
$j = json_decode($raw, true);
if (!is_array($j)) { parse_str($raw, $j); }
if (!is_array($j) || !$j) { $j = $_POST ?: []; }
if (!$j) { http_response_code(200); echo '{"ok":1,"vazio":1}'; exit; }
$dir = __DIR__ . '/data';
if (!is_dir($dir)) { @mkdir($dir, 0755, true); }

function slx_flat($a, $pre = '', &$o = []) { foreach ($a as $k => $v) { $key = $pre === '' ? (string)$k : $pre . '.' . $k; if (is_array($v)) slx_flat($v, $key, $o); else $o[$key] = $v; } return $o; }
$F = []; slx_flat($j, '', $F);
$L = []; foreach ($F as $k => $v) { $L[strtolower($k)] = $v; }
/* primeiro valor nao vazio cujo nome termina com um dos nomes pedidos */
function slx_pick($L, $names) { foreach ($names as $n) { foreach ($L as $k => $v) { if (($k === $n || substr($k, -strlen($n) - 1) === '.' . $n) && $v !== '' && $v !== null && $v !== false) return $v; } } return null; }
function slx_num($v) {
  if ($v === null || $v === '') return null;
  if (is_int($v) || is_float($v)) return (float)$v;
  $s = trim(preg_replace('/[^0-9,.\-]/', '', (string)$v));
  if ($s === '' || $s === '-') return null;
  $lc = strrpos($s, ','); $ld = strrpos($s, '.');
  if ($lc !== false && $ld !== false) { $s = ($lc > $ld) ? str_replace(',', '.', str_replace('.', '', $s)) : str_replace(',', '', $s); }
  elseif ($lc !== false) { $s = str_replace(',', '.', $s); }
  return (float)$s;
}
function slx_time($v) {
  if ($v === null || $v === '') return null;
  if (is_numeric($v)) { $n = (float)$v; if ($n > 1e12) $n /= 1000; return $n > 1e8 ? (int)$n : null; }
  $t = strtotime((string)$v); return $t ? $t : null;
}
/* estado: o status manda; se ele nao diz nada, vale o nome do evento */
$evs = strtolower((string)slx_pick($L, ['webhook_event_type', 'event', 'evento', 'event_type', 'type', 'custom_id']));
$sts = strtolower((string)slx_pick($L, ['order_status', 'purchase.status', 'sale_status', 'status', 'situacao']));
$both = $evs . ' ' . $sts;
function slx_cls($t) {
  if (preg_match('/refus|recus|declin|cancel|expir|failed|falh|negad|denied|reject/', $t)) return 'refused';
  if (preg_match('/waiting|pending|pendente|aguard|pix_g|pix_c|billet|boleto|generated|gerado|delayed|processing|started|iniciad|created/', $t)) return 'waiting_payment';
  if (preg_match('/approved|aprovad|paid|pago|authorized|autorizad|complete|conclu|confirm|success|captured|settled/', $t)) return 'paid';
  return null;
}
if (preg_match('/cart|abandon|carrinho/', $both)) { $st = 'skip'; }
elseif (preg_match('/charge.?back|chargedback|contest|disput/', $both)) { $st = 'chargedback'; }
elseif (preg_match('/refund|reembols|estorn|devolv/', $both)) { $st = 'refunded'; }
else { $st = slx_cls($sts) ?: slx_cls($evs) ?: 'waiting_payment'; }

/* valores: plataformas que mandam em centavos */
$cents = in_array($p, ['kiwify', 'ticto'], true);
$amt = null; $fee = 0.0;
if ($p === 'kiwify') { $a = slx_num(slx_pick($L, ['commissions.charge_amount', 'charge_amount', 'full_price'])); if ($a !== null) $amt = $a / 100; $f = slx_num(slx_pick($L, ['commissions.kiwify_fee', 'kiwify_fee'])); if ($f !== null) $fee = $f / 100; }
if ($p === 'hotmart') { $amt = slx_num(slx_pick($L, ['purchase.price.value', 'purchase.full_price.value', 'price.value'])); $m = 0.0; foreach ($L as $k => $v) { if (preg_match('/^data\.commissions\.(\d+)\.source$/', $k, $mm) && strtoupper((string)$v) === 'MARKETPLACE') { $cv = slx_num($L['data.commissions.' . $mm[1] . '.value'] ?? null); if ($cv !== null) $m += $cv; } } $fee = $m; }
if ($amt === null) {
  $a = slx_pick($L, ['paid_amount', 'amount_paid', 'total_price', 'total_amount', 'amount', 'valor', 'price', 'value', 'total', 'charge_amount']);
  $amt = slx_num($a);
  if ($amt !== null && $cents && is_int($a)) $amt = $amt / 100;
  elseif ($amt !== null && $cents && is_string($a) && ctype_digit($a)) $amt = $amt / 100;
}
if ($fee == 0) { $f = slx_num(slx_pick($L, ['fees', 'fee', 'taxa', 'platform_fee'])); if ($f !== null) $fee = ($cents && is_int(slx_pick($L, ['fees', 'fee', 'taxa', 'platform_fee']))) ? $f / 100 : $f; }
$id = (string)slx_pick($L, ['order_id', 'transaction', 'transaction_id', 'sale_id', 'order.hash', 'hash', 'order_ref', 'purchase.transaction', 'data.id', 'id']);
if ($id === '') { $id = 'x' . substr(sha1($raw), 0, 16); }
$pm = strtolower((string)slx_pick($L, ['payment_method', 'payment.type', 'payment_type', 'paymentmethod', 'method', 'metodo_pagamento']));
$pm = preg_match('/pix/', $pm) ? 'pix' : (preg_match('/bolet|billet/', $pm) ? 'boleto' : (preg_match('/card|cart|credit/', $pm) ? 'credit_card' : $pm));
$ts = slx_time(slx_pick($L, ['approved_date', 'paid_at', 'paidat', 'approved_at', 'purchase.approved_date', 'confirmed_at', 'data_pagamento']));
$cr = slx_time(slx_pick($L, ['created_at', 'createdat', 'order_date', 'purchase.order_date', 'date', 'data']));
$now = time();
$u = [];
foreach (['utm_source' => 's', 'utm_medium' => 'm', 'utm_campaign' => 'c', 'utm_content' => 'n', 'utm_term' => 't', 'src' => 'src', 'sck' => 'sck'] as $name => $key) {
  $x = slx_pick($L, [$name]); $u[$key] = $x === null ? '' : substr((string)$x, 0, 200);
}
if ($u['c'] === '') { foreach ($L as $k => $v) { if (preg_match('/utm.?campaign/', $k) && $v) { $u['c'] = substr((string)$v, 0, 200); break; } } }
$email = strtolower(trim((string)slx_pick($L, ['email', 'customer.email', 'buyer.email', 'client.email'])));
$phone = preg_replace('/\D/', '', (string)slx_pick($L, ['phone', 'phone_number', 'mobile', 'telefone', 'customer.phone', 'customer.mobile', 'buyer.phone', 'checkout_phone']));
$name = (string)slx_pick($L, ['customer.full_name', 'customer.name', 'buyer.name', 'client.name', 'name', 'nome']);
$prod = (string)slx_pick($L, ['product.name', 'product_name', 'offer.name', 'produto', 'data.product.name']);
$row = ['t' => $now, 'p' => $p, 'id' => $id, 'st' => $st, 'ev' => substr($evs, 0, 40), 'amount' => round((float)$amt, 2), 'fees' => round((float)$fee, 2), 'created' => $cr ?: $now, 'paid' => ($st === 'paid') ? ($ts ?: $now) : null, 'pm' => $pm, 'u' => $u, 'prod' => substr($prod, 0, 90), 'em' => $email ? hash('sha256', $email) : '', 'ph' => strlen($phone) >= 10 ? hash('sha256', (strlen($phone) <= 11 ? '55' : '') . $phone) : '', 'nm' => ''];
/* guarda o JSON cru dos ultimos envios para conferir (sem e-mail/telefone completos nao ha como: so os 30 ultimos) */
$rf = $dir . '/raw.json';
$R = []; if (is_file($rf)) { $R = json_decode((string)@file_get_contents($rf), true); if (!is_array($R)) $R = []; }
array_unshift($R, ['t' => $now, 'p' => $p, 'st' => $st, 'id' => $id, 'amount' => $row['amount'], 'raw' => json_decode(substr($raw, 0, 20000), true) ?: substr($raw, 0, 4000)]);
$R = array_slice($R, 0, 30);
@file_put_contents($rf, json_encode($R, JSON_UNESCAPED_UNICODE), LOCK_EX);
if ($st === 'skip') { echo '{"ok":1,"ignorado":1}'; exit; }
@file_put_contents($dir . '/orders.jsonl', json_encode($row, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND | LOCK_EX);

/* devolve a compra para a Meta (API de Conversoes), uma vez por pedido */
if ($st === 'paid' && !empty($c['px']) && !empty($c['ct']) && $row['amount'] > 0) {
  $sf = $dir . '/capi.json';
  $sent = is_file($sf) ? json_decode((string)@file_get_contents($sf), true) : [];
  if (!is_array($sent)) $sent = [];
  $key = $p . ':' . $id;
  if (empty($sent[$key]['ok'])) {
    $vis = null; $vid = $u['sck'];
    $vf = $dir . '/visits.jsonl';
    if ($vid !== '' && is_file($vf) && @filesize($vf) < 40 * 1024 * 1024) {
      $h = @fopen($vf, 'r');
      if ($h) { while (($ln = fgets($h)) !== false) { if (strpos($ln, $vid) === false) continue; $r = json_decode($ln, true); if (is_array($r) && ($r['v'] ?? '') === $vid) $vis = $r; } fclose($h); }
    }
    $ud = [];
    if ($row['em']) $ud['em'] = [$row['em']];
    if ($row['ph']) $ud['ph'] = [$row['ph']];
    if ($vis) { if (!empty($vis['fbp'])) $ud['fbp'] = $vis['fbp']; if (!empty($vis['fbc'])) $ud['fbc'] = $vis['fbc']; if (!empty($vis['ip'])) $ud['client_ip_address'] = $vis['ip']; if (!empty($vis['ua'])) $ud['client_user_agent'] = $vis['ua']; }
    if ($ud) {
      $ev = ['event_name' => 'Purchase', 'event_time' => (int)$row['paid'], 'event_id' => 'sl_' . $p . '_' . $id, 'action_source' => 'website', 'user_data' => $ud, 'custom_data' => ['currency' => 'BRL', 'value' => $row['amount']]];
      $url = 'https://graph.facebook.com/v21.0/' . rawurlencode((string)$c['px']) . '/events?access_token=' . rawurlencode((string)$c['ct']);
      $body = json_encode(['data' => [$ev]]);
      $res = null;
      if (function_exists('curl_init')) { $ch = curl_init($url); curl_setopt_array($ch, [CURLOPT_POST => 1, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_RETURNTRANSFER => 1, CURLOPT_TIMEOUT => 8]); $res = curl_exec($ch); curl_close($ch); }
      else { $res = @file_get_contents($url, false, stream_context_create(['http' => ['method' => 'POST', 'header' => 'Content-Type: application/json', 'content' => $body, 'timeout' => 8]])); }
      $ok = $res && strpos((string)$res, 'events_received') !== false;
      $sent[$key] = ['t' => $now, 'ok' => $ok ? 1 : 0, 'r' => substr((string)$res, 0, 200)];
      if (count($sent) > 3000) $sent = array_slice($sent, -2000, null, true);
      @file_put_contents($sf, json_encode($sent), LOCK_EX);
    }
  }
}
echo '{"ok":1}';
