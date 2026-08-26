---
title: Как Google банит Gemini
tags: [gemini, access, research]
status: verified
created: 2026-08-24
---

# Как Google банит Gemini

14 августа 2026 Gemini перестал открываться у пользователей из РФ даже через VPN. Совпало с релизом Gemini 3.7 Flash. Официальных комментариев Google не давал.

Ключевое: блок перестал быть чисто IP-шным. Подбор новых серверов почти ничего не даёт.

## Четыре независимых слоя

Достаточно сработать одному.

### Слой 1 — классификация IP по ASN

Собственная база Google размечает диапазоны как residential / mobile / hosting. Крупные хостеры (Hetzner, DigitalOcean, Vultr, Contabo, OVH) помечены как datacenter. Коммерческие VPN попадают туда же — один exit-IP обслуживает тысячи сессий.

Отдельно: адреса, через которые систематически заходят из РФ, со временем получают российскую ассоциацию, даже если сервер физически в другой стране.

### Слой 2 — country association аккаунта

Главный слой. Страна проживания считается на стороне сервера из платёжного профиля, региона Google Play, длительной истории IP и данных устройств. Проверка eligibility идёт **по account ID**, не по текущему IP.

- Форма привязки: `https://policies.google.com/country-association-form`
- Платёжный профиль: `https://payments.google.com`

> [!success] Статус
> У V4DYA этот слой чистый — в аккаунте Великобритания. Поэтому проблема не здесь, см. [[Чек-лист браузера]].

### Слой 3 — телеметрия устройства

- MCC/MNC симки на Android
- системная локаль и таймзона
- Wi-Fi positioning: устройство отдаёт список BSSID вокруг себя, определяет город точнее любого IP
- геолокация из Google Maps / Timeline

### Слой 4 — утечки на клиенте

Самый частый источник ситуации «VPN работает везде, кроме Gemini».

| Утечка | Механизм |
|---|---|
| WebRTC | STUN отдаёт реальный IP мимо туннеля |
| QUIC | Chrome ходит к Google по UDP/443, конфиги заворачивают только TCP |
| DNS | резолв через 53 порт провайдера |
| IPv6 | провайдерский или датацентровый IPv6 выдаёт локацию мгновенно |
| Split tunnel | VPN исключает `google.com` из туннеля ради скорости поиска и почты |
| Порядок правил | `geosite:google` в direct выше правил Gemini — вспомогательные запросы уходят мимо |

## Домены, которые обязаны идти через прокси

Правило перехватывается **первым**, выше общего `geosite:google`.

```
gemini.google.com
aistudio.google.com
generativelanguage.googleapis.com      # API
alkalimining-pa.googleapis.com         # вспомогательный
proactivebackend-pa.googleapis.com     # без него чат висит в бесконечной загрузке
```

Xray / sing-box:

```json
{
  "type": "field",
  "outboundTag": "proxy",
  "domain": [
    "domain:gemini.google.com",
    "domain:aistudio.google.com",
    "domain:alkalimining-pa.googleapis.com",
    "domain:proactivebackend-pa.googleapis.com",
    "domain:generativelanguage.googleapis.com"
  ]
}
```

В outbound: `"domainStrategy": "UseIPv4"`.

## WARP как второе плечо

Google доверяет AS13335 (Cloudflare) заметно больше, чем мелким хостерам.

```
Клиент → VPS → Cloudflare WARP → Google
```

Нужно только если egress-IP оказался «грязным». Для амстердамского Timeweb на старте не требуется.

## Источники

- Хабр, 3 февраля 2026 — гайд по DNS/IPv6/маршрутизации, список доменов
- Код.ру, 14 августа 2026 — поведенческие сигналы, split-tunnel, ассоциация серверов с РФ
