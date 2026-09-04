# Диагностика доступности cta.quest с российского абонентского подключения.
#
# Версия на PowerShell — работает на любой Windows без установки чего-либо
# (bash-вариант diag-ru-access.sh требует Git Bash, которого может не быть).
#
# ЗАПУСК:  правой кнопкой по файлу -> "Выполнить с помощью PowerShell"
#          либо в PowerShell:  powershell -ExecutionPolicy Bypass -File diag-ru-access.ps1
#
# Скрипт НИЧЕГО НИКУДА НЕ ОТПРАВЛЯЕТ — только опрашивает сайт и пишет отчёт
# в текстовый файл на рабочем столе. Права администратора не нужны.
#
# ⚠️ В отчёт попадает ваш IP-адрес и маршрут до сервера (список промежуточных
# узлов провайдера). Если это нежелательно — эти строки можно удалить из файла
# перед отправкой, на пользу остальных данных это не повлияет.

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

$CDN  = 'cdn.cta.quest'
$R2   = 'pub-0969d515fb064d119680c2d311607c29.r2.dev'
$ICON = '/items/eft/512/5449016a4bdc2d6f028b456f.webp'

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out   = Join-Path ([Environment]::GetFolderPath('Desktop')) "diag-cta-$stamp.txt"
$lines = New-Object System.Collections.Generic.List[string]

function Say($t) { Write-Host $t; $lines.Add($t) | Out-Null }

# curl.exe, а НЕ alias curl -> Invoke-WebRequest: нужен именно нативный клиент,
# он умеет --resolve (принудительный IP) и честно отдаёт тайминги.
$curl = "$env:SystemRoot\System32\curl.exe"
if (-not (Test-Path $curl)) { $curl = 'curl.exe' }

# --compressed обязателен: без него сервер шлёт несжатый HTML и время передачи
# раздувается в разы — измеряли бы не то, что реально получает браузер.
$fmt = 'http=%{http_code} tls=%{time_appconnect}s ttfb=%{time_starttransfer}s total=%{time_total}s size=%{size_download}B'

function Probe($hostname, $ip, $path) {
    $r = & $curl -s -o NUL --compressed --max-time 30 -w $fmt `
                 --resolve "${hostname}:443:${ip}" "https://${hostname}${path}" 2>&1
    if (-not $r -or "$r" -match 'http=000') { return "ПРОВАЛ ($r)" }
    return "$r"
}

function IPsOf($hostname, $server) {
    try {
        $p = @{ Name = $hostname; Type = 'A'; ErrorAction = 'Stop' }
        if ($server) { $p['Server'] = $server }
        return (Resolve-DnsName @p | Where-Object { $_.IPAddress } | Select-Object -Expand IPAddress)
    } catch { return @() }
}

Say '=================================================================='
Say " ДИАГНОСТИКА ДОСТУПА К cta.quest — $(Get-Date)"
Say '=================================================================='

# ── 1. Откуда выходим ─────────────────────────────────────────────────
# Если тут не RU — значит включён VPN/прокси, и остальной отчёт не отражает
# реальную картину провайдера. Проверять первым делом.
Say ''
Say '### 1. ТОЧКА ВЫХОДА В СЕТЬ (если страна не RU — работает VPN, отчёт недействителен)'
$trace = & $curl -s --max-time 10 'https://cloudflare.com/cdn-cgi/trace' 2>&1
if ($trace) { ($trace -split "`n") | Where-Object { $_ -match '^(ip|loc|colo|warp|sni|http)=' } | ForEach-Object { Say "     $_" } }
else        { Say '     недоступно (само по себе показательно)' }

# ── 2. DNS с разных резолверов ────────────────────────────────────────
# Расхождение между провайдерским и публичными — признак подмены или
# залипшей старой записи.
Say ''
Say '### 2. DNS — что отдаёт каждый резолвер'
foreach ($h in @('cta.quest', $CDN, $R2)) {
    Say ''
    Say "  -- $h"
    foreach ($rs in @($null, '1.1.1.1', '8.8.8.8', '77.88.8.8')) {
        $label = if ($rs) { $rs } else { 'СИСТЕМНЫЙ (провайдер)' }
        $ips = IPsOf $h $rs
        $val = if ($ips.Count) { $ips -join ' ' } else { 'НЕ РЕЗОЛВИТСЯ' }
        Say ("     {0,-24} {1}" -f $label, $val)
    }
}

# ── 3. Достижимость каждого адреса ────────────────────────────────────
# TCP отдельно от HTTPS: если TCP проходит, а HTTPS нет — рвут на TLS
# (признак фильтра по имени). Если не проходит TCP — блокируют адрес.
Say ''
Say ''
Say '### 3. ДОСТИЖИМОСТЬ — по каждому адресу отдельно'
foreach ($pair in @(@('cta.quest', '/eft'), @($CDN, $ICON), @($R2, $ICON))) {
    $h = $pair[0]; $p = $pair[1]
    Say ''
    Say "  -- $h$p"
    $ips = IPsOf $h $null
    if (-not $ips.Count) { Say '     резолв не удался — см. блок 2'; continue }
    foreach ($ip in $ips) {
        $t443 = (Test-NetConnection -ComputerName $ip -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue)
        $t80  = (Test-NetConnection -ComputerName $ip -Port 80  -InformationLevel Quiet -WarningAction SilentlyContinue)
        Say ("     {0,-18} tcp443={1,-5} tcp80={2,-5} HTTPS: {3}" -f $ip, $t443, $t80, (Probe $h $ip $p))
    }
}

# ── 4. Развязка: тот же адрес, разные имена ───────────────────────────
# Инфраструктура одна, меняется ТОЛЬКО имя в TLS-рукопожатии.
#   разный результат  -> фильтруют по ИМЕНИ
#   оба провалились   -> фильтруют по АДРЕСУ
#   оба прошли        -> блокировки нет, причина в другом
Say ''
Say ''
Say '### 4. РАЗВЯЗКА: один адрес — разные имена в SNI'
$siteIp = (IPsOf 'cta.quest' $null | Select-Object -First 1)
$cdnIp  = (IPsOf $CDN        $null | Select-Object -First 1)
Say "  адрес cta.quest = $siteIp | адрес $CDN = $cdnIp"
foreach ($ip in @($siteIp, $cdnIp) | Where-Object { $_ } | Select-Object -Unique) {
    Say ''
    Say "  -- через адрес ${ip}:"
    Say ("     имя cta.quest -> {0}" -f (Probe 'cta.quest' $ip '/eft'))
    Say ("     имя $CDN -> {0}"      -f (Probe $CDN        $ip $ICON))
}

# ── 5. Маршрут ────────────────────────────────────────────────────────
Say ''
Say ''
Say '### 5. МАРШРУТ до адреса сайта (обрыв на середине = фильтр в пути)'
if ($siteIp) { (tracert -d -h 15 -w 1500 $siteIp 2>&1) | ForEach-Object { Say "     $_" } }
else         { Say '     адрес неизвестен — пропущено' }

# ── 6. Контрольная группа ─────────────────────────────────────────────
# Чтобы отличить «блокируют нас» от «у канала проблемы вообще».
Say ''
Say ''
Say '### 6. КОНТРОЛЬНАЯ ГРУППА (для сравнения)'
foreach ($u in @('https://ya.ru/', 'https://www.cloudflare.com/', 'https://github.com/')) {
    $r = & $curl -s -o NUL --compressed --max-time 15 -w 'http=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s' $u 2>&1
    Say ("     {0,-32} {1}" -f $u, $r)
}

Say ''
Say '=================================================================='
Say ' ГОТОВО'
Say '=================================================================='

$lines -join "`r`n" | Out-File -FilePath $out -Encoding utf8
Write-Host ''
Write-Host "Отчёт сохранён на рабочий стол: $out" -ForegroundColor Green
Write-Host 'Пришлите этот файл.' -ForegroundColor Green
Write-Host ''
Read-Host 'Нажмите Enter, чтобы закрыть'
