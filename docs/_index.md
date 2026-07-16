---
type: index
---

# CTA — Карта проекта

Мыслительная среда проекта **Centre Tactical Adaptation** (ЦТА) — портал-агрегатор для extraction-шутеров.
Здесь раскладываю проект по пунктам: что есть, что решить, куда дальше. Код живёт в `../src`, правки — через Claude Code.

> Открой **Graph View** (Ctrl+G), чтобы видеть связи между решениями и фичами.

## 📍 Текущее состояние
- ⭐ **[[release-readiness-2026-07-16]]** — актуальный срез готовности к релизу (16.07.2026, релиз-гейт почти закрыт).
- [[release-readiness-2026-07]] — предыдущий срез (14.07.2026), заменён свежим.
- [[snapshot-2026-06]] — старый срез (стек, долги). Частично устарел.

## 🧭 Решения — пройтись по за/против
Каждая заметка: контекст → варианты → за/против → вывод.

> **Статус-борд** — авто из фронтматтера заметок (Dataview). Единственный источник правды по статусам; ниже — навигация по темам.

```dataview
TABLE WITHOUT ID file.link AS "Решение", status AS "Статус", affects AS "Зона", date AS "Заведено"
FROM "decisions"
SORT status ASC, date ASC
```

**Релиз-блокеры (14.07)**
- [[pre-mvp-release-audit]] — Проход 2: SEO/robots/sitemap, 500-страница, RLS-аудит Comlink, `/security-review`
- [[cta-footer-redesign]] — ЧП4: реальные URL вместо `#` + реальный юр-текст

**Монетизация**
- [[monetization-subscriptions]] — E4 разметка paywall (инфра есть, применена только к сборкам) + E5 рельс оплаты

**Развитие**
- [[maps-marker-render]] — карты: иконки выходов/боссов, рез спавнов, dev-tool маркеров
- [[maps-v2-scope]] — карты: объём v2
- [[story-content-assets]] — галереи скриншотов 9 историй
- [[multigaming-second-game]] — когда и как добавить вторую игру

## 🎯 Видение
- [[roadmap]] — горизонт и приоритеты: что разрабатываю/улучшаю дальше

## 🗂 Шаблоны
- [[decision]] — шаблон решения (за/против)
- [[feature]] — шаблон фичи

## ✅ Сделано
Архив исполненных решений — файлы в `decisions/done/`, статусы дублирует борд выше.

> [!success]- Развернуть архив · свежие сверху
> **Закрыто ревизией 14.07.2026 (12):**
> - [[the-lab-parity]] — Лаба на своём арте (статик) · 2026-07-14
> - [[fsd-lite-normalize]] · [[mobile-first-audit]] · [[loot-contaier-table-page]] · [[player-position-tracking]] · [[deep-research-subscription-monetization]] · [[deep-research-payment-rails]] — 2026-07-08
> - [[footer-v2]] · [[feedback-form]] · [[player-tracking-tab]] · [[tracking-favorite-items]] — 2026-07-04
> - [[supabase-jwt-fix]] — 2026-06-28
>
> **Ранее (10):**
> - [[maps-floor-hotkeys]] — Карты: хоткеи переключения этажей · 2026-06-29
> - [[css-consolidation]] — Собрать раздробленный CSS · 2026-06-29
> - [[account-real-data]] — AccountCenter: реальные данные · 2026-06-29
> - [[dead-routes-cleanup]] — Снести мёртвые route-папки · 2026-06-28
> - [[style-debt]] — Стиль-долг (NIGHTFALL) · 2026-06-28
> - [[claude-md-version]] — CLAUDE.md: Next 14 → 16 · 2026-06-28
> - [[icon-hosting-r2]] — Иконки предметов → Cloudflare R2 · 2026-06-28
> - [[db-egress-reduction]] — Снижение DB-egress (кэш + пререндер) · 2026-06-28
> - [[maps-ui-fixes]] — Карты: быстрые UI-фиксы · 2026-06-28
> - [[vercel-skip-docs-builds]] — Vercel: пропуск билда для docs-пушей · 2026-06-28
