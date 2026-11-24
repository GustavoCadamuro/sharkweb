<?php
/* Shark Lab - rastreamento: relatorio para o painel (so com a chave do Shark Lab) */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$c = include __DIR__ . '/config.php';
$t = (string)($_GET['t'] ?? '');
if (!is_array($c) || !hash_equals((string)$c['kh'], hash('sha256', $t))) { http_response_code(403); echo '{"ok":0,"e":"chave"}'; exit; }
$dir = __DIR__ . '/data';
$from = strtotime((string)($_GET['from'] ?? '') . ' 00:00:00 America/Sao_Paulo') ?: (time() - 30 * 86400);
$to = strtotime((string)($_GET['to'] ?? '') . ' 23:59:59 America/Sao_Paulo') ?: time();
function slx_lines($fn, $cb) { if (!is_file($fn)) return; $h = @fopen($fn, 'r'); if (!$h) return; flock($h, LOCK_SH); while (($ln = fgets($h)) !== false) { $r = json_decode($ln, true); if (is_array($r)) $cb($r); } flock($h, LOCK_UN); fclose($h); }
$rank = ['waiting_payment' => 1, 'refused' => 1, 'paid' => 2, 'refunded' => 3, 'chargedback' => 4];
$O = [];
slx_lines($dir . '/orders.jsonl', function ($r) use (&$O, $rank) {
  $k = $r['p'] . ':' . $r['id'];
  $o = $O[$k] ?? null;
  if (!$o) { $O[$k] = $r; return; }
  $nr = $rank[$r['st']] ?? 1; $or = $rank[$o['st']] ?? 1;
  if ($nr >= $or) { if (empty($r['u']['c']) && !empty($o['u']['c'])) $r['u'] = $o['u']; if (!$r['paid'] && $o['paid']) $r['paid'] = $o['paid']; if (!$r['amount'] && $o['amount']) $r['amount'] = $o['amount']; if (!$r['fees'] && $o['fees']) $r['fees'] = $o['fees']; if ($r['st'] === 'refunded' || $r['st'] === 'chargedback') { $r['rf'] = $r['t']; } $O[$k] = $r; }
  else { if (empty($o['u']['c']) && !empty($r['u']['c'])) $O[$k]['u'] = $r['u']; }
});
/* visitas: ultimo toque pago de cada visitante + contagem por dia/campanha */
$V = []; $pv = []; $ck = [];
slx_lines($dir . '/visits.jsonl', function ($r) use (&$V, &$pv, &$ck, $from, $to) {
  $v = $r['v']; $u = $r['u'] ?? [];
  if (!empty($u['c']) || !empty($u['s']) || !isset($V[$v])) { if (!isset($V[$v]) || !empty($u['c']) || !empty($u['s'])) $V[$v] = $r; }
  elseif (isset($V[$v]) && empty($V[$v]['fbp']) && !empty($r['fbp'])) { $V[$v]['fbp'] = $r['fbp']; }
  if ($r['t'] < $from || $r['t'] > $to) return;
  $d = (new DateTime('@' . $r['t']))->setTimezone(new DateTimeZone('America/Sao_Paulo'))->format('Y-m-d');
  $key = $d . "\x1f" . ($u['c'] ?? '') . "\x1f" . ($u['s'] ?? '');
  if ($r['e'] === 'ck') { $ck[$key][$v] = 1; } else { $pv[$key][$v] = 1; }
});
$out = ['ok' => 1, 'orders' => [], 'visits' => [], 'raw' => [], 'plat' => [], 'capi' => ['ok' => 0, 'err' => 0]];
foreach ($O as $o) {
  $u = $o['u'] ?? [];
  if (empty($u['c']) && !empty($u['sck']) && isset($V[$u['sck']])) { $vu = $V[$u['sck']]['u'] ?? []; $u['s'] = $vu['s'] ?? ''; $u['m'] = $vu['m'] ?? ''; $u['c'] = $vu['c'] ?? ''; $u['n'] = $vu['n'] ?? ''; $u['t'] = $vu['t'] ?? ''; }
  $t = max($o['created'] ?? 0, $o['paid'] ?? 0, $o['rf'] ?? 0);
  if (($o['created'] ?? 0) < $from - 6 * 86400 && $t < $from) continue;
  if (($o['created'] ?? 0) > $to) continue;
  $iso = function ($x) { return $x ? (new DateTime('@' . $x))->setTimezone(new DateTimeZone('America/Sao_Paulo'))->format('c') : null; };
  $out['orders'][] = ['id' => $o['p'] . ':' . $o['id'], 'plat' => $o['p'], 'st' => $o['st'], 'amount' => $o['amount'], 'fees' => $o['fees'], 'created' => $iso($o['created']), 'paid' => $iso($o['paid']), 'refunded' => $o['st'] === 'refunded' ? $iso($o['rf'] ?? $o['t']) : null, 'cb' => $o['st'] === 'chargedback' ? $iso($o['rf'] ?? $o['t']) : null, 'pm' => $o['pm'], 'prod' => $o['prod'], 'camp' => $u['c'] ?? '', 'src' => $u['s'] ?? '', 'med' => $u['m'] ?? '', 'cont' => $u['n'] ?? '', 'sck' => $u['sck'] ?? ''];
  $out['plat'][$o['p']] = ($out['plat'][$o['p']] ?? 0) + 1;
}
foreach ($pv as $key => $vs) { list($d, $c, $s) = explode("\x1f", $key, 3); $out['visits'][] = ['d' => $d, 'camp' => $c, 'src' => $s, 'n' => count($vs), 'ck' => count($ck[$key] ?? [])]; }
foreach ($ck as $key => $vs) { if (isset($pv[$key])) continue; list($d, $c, $s) = explode("\x1f", $key, 3); $out['visits'][] = ['d' => $d, 'camp' => $c, 'src' => $s, 'n' => 0, 'ck' => count($vs)]; }
$rf = $dir . '/raw.json'; if (is_file($rf)) { $R = json_decode((string)@file_get_contents($rf), true); if (is_array($R)) $out['raw'] = array_slice($R, 0, 12); }
$sf = $dir . '/capi.json'; if (is_file($sf)) { $S = json_decode((string)@file_get_contents($sf), true); if (is_array($S)) foreach ($S as $x) { if (!empty($x['ok'])) $out['capi']['ok']++; else $out['capi']['err']++; } }
echo json_encode($out, JSON_UNESCAPED_UNICODE);
