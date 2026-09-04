#!/usr/bin/env bash
# Диагностика доступности cta.quest и хостов ассетов С АБОНЕНТСКОЙ RU-СЕТИ.
#
# Зачем: ни у разработчика (VPN на Финляндию), ни у агента нет RU-точки обзора, а
# check-host.net даёт только хостинговые AS — они не за абонентским ТСПУ. Все выводы
# по этому багу до сих пор строились вслепую и дважды оказывались неверными.
#
# КАК ЗАПУСКАТЬ: выключить VPN ПОЛНОСТЬЮ (система, не только браузер), затем
#   bash scripts/diag-ru-access.sh
# Скрипт ничего никуда не отправляет — только пишет отчёт в файл рядом с собой.
# Внешние сервисы он дёргает, но их недоступность — это тоже результат, он её записывает.
# После прогона VPN можно включать обратно и показать файл.
#
# Ключевой эксперимент — блок 4: один и тот же IP опрашивается с РАЗНЫМИ именами в SNI.
# Различие в результате = фильтр по имени. Одинаковый провал = фильтр по адресу.
set -u

OUT="diag-ru-$(date +%Y%m%d-%H%M%S).txt"
CDN="cdn.cta.quest"
R2="pub-0969d515fb064d119680c2d311607c29.r2.dev"
ICON="/items/eft/512/5449016a4bdc2d6f028b456f.webp"

exec > >(tee "$OUT") 2>&1

echo "=================================================================="
echo " ДИАГНОСТИКА RU-ДОСТУПА — $(date)"
echo "=================================================================="

# ── 1. Откуда уходит трафик ───────────────────────────────────────────
# Если тут покажет loc=FI или чужую страну — VPN не выключен, и весь
# остальной отчёт бессмысленен. Проверять ПЕРВЫМ делом.
echo
echo "### 1. ТОЧКА ВЫХОДА В СЕТЬ (если не RU — VPN не выключен, всё ниже недействительно)"
echo "--- cloudflare trace ---"
curl -s --max-time 10 "https://cloudflare.com/cdn-cgi/trace" 2>&1 | grep -E "^(ip|loc|colo|warp|sni|http)=" || echo "  НЕДОСТУПЕН (само по себе показательно)"
echo "--- запасной источник ---"
curl -s --max-time 10 "https://api.ipify.org?format=text" 2>&1 | head -c 60 || echo "  недоступен"
echo

# ── 2. DNS: что отдают разные резолверы ───────────────────────────────
# Системный резолвер (провайдерский) и публичные. Расхождение здесь —
# главный подозреваемый: у провайдера мог залипнуть старый адрес.
echo
echo "### 2. DNS — что отдаёт каждый резолвер"
for host in cta.quest "$CDN" "$R2"; do
  echo
  echo "  ── $host"
  for rs in "" "1.1.1.1" "8.8.8.8" "77.88.8.8"; do
    label="${rs:-СИСТЕМНЫЙ (провайдер)}"
    ips=$(powershell -NoProfile -Command "
      try {
        \$p = @{Name='$host'; Type='A'; ErrorAction='Stop'}
        if ('$rs') { \$p['Server'] = '$rs' }
        (Resolve-DnsName @p | Where-Object {\$_.IPAddress} | Select-Object -Expand IPAddress) -join ' '
      } catch { 'ОШИБКА: ' + \$_.Exception.Message.Split([char]10)[0] }
    " 2>/dev/null | tr -d '\r')
    printf "     %-24s %s\n" "$label" "${ips:-пусто}"
  done
done

# ── 3. Достижимость каждого адреса ────────────────────────────────────
# Отдельно TCP:443, TCP:80 и полный HTTPS. Если TCP проходит, а HTTPS нет —
# рвут на TLS-рукопожатии (признак фильтра по SNI). Если не проходит и TCP —
# блокировка на уровне адреса.
echo
echo
echo "### 3. ДОСТИЖИМОСТЬ — по каждому адресу отдельно"
probe_ip () {
  local host="$1" ip="$2" path="$3"
  printf "     %-18s " "$ip"
  local t80 t443
  t443=$(powershell -NoProfile -Command "(Test-NetConnection -ComputerName '$ip' -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue)" 2>/dev/null | tr -d '\r ')
  t80=$(powershell -NoProfile -Command "(Test-NetConnection -ComputerName '$ip' -Port 80 -InformationLevel Quiet -WarningAction SilentlyContinue)" 2>/dev/null | tr -d '\r ')
  printf "tcp443=%-5s tcp80=%-5s " "${t443:-?}" "${t80:-?}"
  local r
  # --compressed ОБЯЗАТЕЛЕН: без него сервер шлёт несжатый HTML (220 КБ вместо 21 КБ),
  # и время передачи раздувается вдесятеро — измеряли бы не то, что видит браузер.
  # ttfb отделён от total намеренно: ttfb = задержка/фильтрация, (total-ttfb) = скорость канала.
  r=$(curl -s -o /dev/null --compressed --max-time 30 \
        -w "http=%{http_code} tls=%{time_appconnect}s ttfb=%{time_starttransfer}s total=%{time_total}s size=%{size_download}B" \
        --resolve "${host}:443:${ip}" "https://${host}${path}" 2>&1)
  case "$r" in
    *http=000*|*"error"*|"") echo "HTTPS: ПРОВАЛ ($r)";;
    *) echo "HTTPS: $r";;
  esac
}

for pair in "cta.quest:/eft" "$CDN:$ICON" "$R2:$ICON"; do
  host="${pair%%:*}"; path="${pair#*:}"
  echo
  echo "  ── $host$path"
  ips=$(powershell -NoProfile -Command "
    try { (Resolve-DnsName -Name '$host' -Type A -ErrorAction Stop | Where-Object {\$_.IPAddress} | Select-Object -Expand IPAddress) -join ' ' } catch { '' }
  " 2>/dev/null | tr -d '\r')
  if [ -z "$ips" ]; then echo "     резолв не удался — проверить блок 2"; continue; fi
  for ip in $ips; do probe_ip "$host" "$ip" "$path"; done
done

# ── 4. КЛЮЧЕВОЙ ЭКСПЕРИМЕНТ: тот же IP, разные имена ──────────────────
# Берём адрес, на котором живёт cta.quest, и стучимся в него сначала с именем
# cta.quest, потом с именем cdn.cta.quest. Инфраструктура одна и та же,
# меняется ТОЛЬКО имя в TLS-рукопожатии.
#   различие → фильтруют по ИМЕНИ (SNI)
#   оба провалились → фильтруют по АДРЕСУ
#   оба прошли → блокировки нет, причина в другом
echo
echo
echo "### 4. РАЗВЯЗКА: один адрес — разные имена в SNI"
SITE_IP=$(powershell -NoProfile -Command "
  try { (Resolve-DnsName -Name 'cta.quest' -Type A -ErrorAction Stop | Where-Object {\$_.IPAddress} | Select-Object -First 1 -Expand IPAddress) } catch { '' }
" 2>/dev/null | tr -d '\r')
CDN_IP=$(powershell -NoProfile -Command "
  try { (Resolve-DnsName -Name '$CDN' -Type A -ErrorAction Stop | Where-Object {\$_.IPAddress} | Select-Object -First 1 -Expand IPAddress) } catch { '' }
" 2>/dev/null | tr -d '\r')
echo "  адрес cta.quest = ${SITE_IP:-?} | адрес $CDN = ${CDN_IP:-?}"
for ip in "$SITE_IP" "$CDN_IP"; do
  [ -n "$ip" ] || continue
  echo
  echo "  ── через адрес $ip:"
  printf "     имя cta.quest    -> "
  curl -s -o /dev/null --compressed --max-time 30 -w "http=%{http_code} tls=%{time_appconnect}s ttfb=%{time_starttransfer}s total=%{time_total}s
" --resolve "cta.quest:443:$ip" "https://cta.quest/eft" 2>&1 | tail -1
  printf "     имя $CDN -> "
  curl -s -o /dev/null --compressed --max-time 30 -w "http=%{http_code} tls=%{time_appconnect}s ttfb=%{time_starttransfer}s total=%{time_total}s
" --resolve "${CDN}:443:$ip" "https://${CDN}${ICON}" 2>&1 | tail -1
done

# ── 5. Где рвётся маршрут ─────────────────────────────────────────────
echo
echo
echo "### 5. МАРШРУТ до адреса сайта (обрыв на середине = фильтр в пути)"
if [ -n "${SITE_IP:-}" ]; then
  # tracert на русской Windows пишет в cp866 — без перекодировки отчёт нечитаем.
  tracert -d -h 15 -w 1500 "$SITE_IP" 2>&1 | { iconv -f CP866 -t UTF-8 2>/dev/null || cat; } | tail -20
else
  echo "  адрес неизвестен — пропущено"
fi

# ── 6. Контроль: работает ли интернет вообще ──────────────────────────
# Чтобы отличить «блокируют нас» от «сеть легла целиком».
echo
echo
echo "### 6. КОНТРОЛЬНАЯ ГРУППА (для сравнения)"
for u in "https://ya.ru/" "https://www.cloudflare.com/" "https://github.com/"; do
  printf "     %-32s " "$u"
  curl -s -o /dev/null --compressed --max-time 15 -w "http=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s
" "$u" 2>&1 | tail -1
done

echo
echo "=================================================================="
echo " ГОТОВО. Отчёт: $OUT"
echo " Можно включать VPN обратно и показать этот файл."
echo "=================================================================="
