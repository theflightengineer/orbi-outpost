<?php
// OPTIONAL live DONKI proxy for "Today's mission". OFF by default (data/config.json "liveDonki": false).
// - Reads the NASA API key from api/private/config.php (blocked from the web by api/private/.htaccess).
// - Caches the response in api/cache/donki_latest.json for 1 hour (respects InfinityFree limits).
// - On any problem, returns the newest event from the archived data/donki_events.json with source "archived".
// The game works perfectly without this file.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$CACHE_FILE = __DIR__ . '/cache/donki_latest.json';
$CACHE_TTL = 3600;
$ARCHIVE = __DIR__ . '/../data/donki_events.json';

function archived_response($archive, $why) {
  $j = @json_decode(@file_get_contents($archive), true);
  $ev = null;
  if ($j && !empty($j['events'])) {
    $events = $j['events'];
    usort($events, function ($a, $b) { return strcmp($b['date'], $a['date']); });
    $ev = $events[0];
  }
  echo json_encode(['source' => 'archived', 'reason' => $why, 'fetched' => $j['retrieved'] ?? null, 'event' => $ev]);
  exit;
}

// 1) fresh cache?
if (is_file($CACHE_FILE) && (time() - filemtime($CACHE_FILE)) < $CACHE_TTL) {
  readfile($CACHE_FILE);
  exit;
}

// 2) config
$cfgFile = __DIR__ . '/private/config.php';
if (!is_file($cfgFile)) archived_response($ARCHIVE, 'no config');
$cfg = include $cfgFile;
$key = isset($cfg['NASA_API_KEY']) ? $cfg['NASA_API_KEY'] : 'DEMO_KEY';
if (empty($cfg['ENABLED'])) archived_response($ARCHIVE, 'disabled');

function http_get_json($url) {
  $ctx = stream_context_create(['http' => ['timeout' => 8, 'header' => "User-Agent: junior-astronaut-trainer\r\n"]]);
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => 'junior-astronaut-trainer']);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200) return null;
  } else {
    $body = @file_get_contents($url, false, $ctx);
  }
  if ($body === false || $body === null) return null;
  $j = json_decode($body, true);
  return is_array($j) ? $j : null;
}

$end = gmdate('Y-m-d');
$start = gmdate('Y-m-d', time() - 30 * 86400);
$best = null;
foreach (['SEP', 'FLR', 'CME'] as $type) {
  $list = http_get_json("https://api.nasa.gov/DONKI/$type?startDate=$start&endDate=$end&api_key=" . urlencode($key));
  if ($list === null) $list = http_get_json("https://ccmc.gsfc.nasa.gov/DONKI/WS/get/$type?startDate=$start&endDate=$end");
  if (!$list) continue;
  foreach ($list as $e) {
    if ($type === 'FLR' && !empty($e['classType'])) {
      $ev = ['id' => $e['flrID'], 'type' => 'FLR', 'date' => $e['peakTime'] ?: $e['beginTime'], 'classType' => $e['classType'], 'link' => $e['link']];
    } elseif ($type === 'CME') {
      $speed = 0;
      foreach (($e['cmeAnalyses'] ?? []) as $an) { if (!empty($an['isMostAccurate']) || !$speed) $speed = (float)($an['speed'] ?? 0); }
      if ($speed <= 0) continue;
      $ev = ['id' => $e['activityID'], 'type' => 'CME', 'date' => $e['startTime'], 'speed' => (int)round($speed), 'link' => $e['link']];
    } elseif ($type === 'SEP') {
      $ev = ['id' => $e['sepID'], 'type' => 'SEP', 'date' => $e['eventTime'], 'link' => $e['link']];
    } else continue;
    if (!$best || strcmp($ev['date'], $best['date']) > 0) $best = $ev;
  }
}
if (!$best) archived_response($ARCHIVE, 'live fetch failed');

$out = json_encode(['source' => 'live', 'fetched' => gmdate('Y-m-d H:i'), 'event' => $best]);
if (!is_dir(dirname($CACHE_FILE))) @mkdir(dirname($CACHE_FILE), 0755, true);
@file_put_contents($CACHE_FILE, $out, LOCK_EX);
echo $out;
