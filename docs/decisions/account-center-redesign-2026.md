# Аккаунт-центр `/account` → редизайн 2026: тренды + план

> Статус: 🚧 Итерация 1 реализована локально (tsc+eslint зелёные) — ждёт live-verify V4DYA, НЕ запушено
> Дата: 2026-08-28
> Источник данных: deep-research (5 веток, 22 источника, 103 факта, 12 подтверждено 3-0, 13 собрано но не доголосовано из-за лимита сессии — синтез досведён вручную)
> Привязка: текущий `/account` — 6-табовый хаб (Профиль · Трекинг · Безопасность · Спецсвязь · Платежи · PRO-статус), Next.js App Router + Tailwind v4 + Zustand + NIGHTFALL

---

## 0. TL;DR

Текущий `/account` — **аккуратная панель управления, но не dashboard**: это вертикальные списки настроек, у которых нет «командного центра» на первом экране. Тренд 2026 для игровых аккаунт-центров — **bento-grid «command center»**: hero-зона профиля игрока сверху, at-a-glance KPI-плитки (уровень, K/D, рейды, престиж, streak) с **анимированными числами и живыми мини-графиками**, размер плитки = важность данных. Яркость даём через **motion, а не через хаос**: entrance-stagger при входе, spring-счётчики (odometer-style), glow-бордеры и light-follow на hover — но строго на `transform`/`opacity`, с `prefers-reduced-motion` и без жертвы контрастом тёмной темы.

---

## 1. Что говорят тренды 2026 (синтез с источниками)

### 1.1. Layout: bento-grid как язык дашборда
- **Bento-grid — эталон для дашбордов**, потому что позволяет показать разнородные данные (числа, графики, списки) одновременно без визуального хаоса; НЕ годится, когда нужен линейный порядок или длинное чтение. ✓ подтверждено 3-0 — [saasframe.io](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide)
- **Размер плитки кодирует важность** — крупная плитка = более важные данные, «сам layout говорит, куда смотреть, без лишних подписей». ✓ подтверждено 3-0 — [orbix.studio](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)
- Иерархия должна идти **от масштаба, а не от позиции**: самое важное — в самый большой блок, даже если он не в левом-верхнем углу. ⚠️ собрано, не доголосовано — [saasframe.io](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide)
- Рекомендуемый каркас bento-дашборда — **12 колонок на десктопе / 4 на планшете**; смесь: крупные hero-плитки под KPI, средние — под аналитику, компактные — утилитарные. ⚠️ собрано, не доголосовано — [baltech.in](https://baltech.in/blog/bento-grids-for-ai-dashboards/)

### 1.2. Иерархия «первого экрана» (at-a-glance)
- **Правило 5 секунд**: дашборд должен донести главное за ≤5 сек; ключевые метрики/алерты — сверху или в центре, контрастом или размером. ⚠️ собрано, не доголосовано — [uxpilot.ai](https://uxpilot.ai/blogs/dashboard-design-principles)
- **Инвертированная пирамида / F-паттерн**: верхний ряд — сводные метрики, средний — тренды-графики, низ — детальные таблицы; сетка 12–16 колонок, базовый юнит 8px. ⚠️ собрано, не доголосовано — [uxpilot.ai](https://uxpilot.ai/blogs/dashboard-design-principles)

### 1.3. Игровые трекеры / companion-приложения
- **tracker.gg (Valorant, 120M+ игроков)** строит подачу вокруг **at-a-glance**: «Profile Overview» — быстрая сводка (peak rating, accuracy, число эйсов), плюс история матчей «одним взглядом» с drill-down в детали. ✓ подтверждено 3-0 — [tracker.gg](https://tracker.gg/valorant)
- Ядро data-viz у них — **тренд по времени**: «ключевые статы за последние 20 матчей на таймлайне, чтобы понять сильные и слабые стороны». ✓ подтверждено 3-0 — [tracker.gg](https://tracker.gg/valorant)
- Есть готовый **open-source gamification UI-kit (Trophy)** ровно под наши примитивы: Streak Card/Calendar/Badge, Achievement Badge/Card/Grid/List/Unlocked, Leaderboard Rankings/Podium/Card, Points Badge/Boost/Chart/Levels. ✓ подтверждено 3-0 — [ui.trophy.so](https://ui.trophy.so/)

### 1.4. Motion — яркий, но управляемый
- **Motion (ex-Framer Motion)** — рекомендованная React-библиотека 2026 для сложных/scroll-интеракций: hardware-accelerated, жесты, scroll, SSR. ⚠️ собрано, не доголосовано — [logrocket](https://blog.logrocket.com/best-react-animation-libraries/)
- **Анимированные счётчики — прямо под дашборды**: «Perfect for dashboards, statistics displays, pricing animations — anywhere numbers need to feel dynamic and alive». ✓ подтверждено 3-0 — [shadcn.io/sliding-number](https://www.shadcn.io/text/sliding-number)
- Модель — **odometer/spring**: каждая цифра катится независимо через промежуточные значения, как механический счётчик (useSpring). ✓ подтверждено 3-0 — [shadcn.io](https://www.shadcn.io/text/sliding-number)
- Готовые примитивы счётчика: **`AnimateNumber` от Motion (2.5kb)** ✓ [motion.dev](https://motion.dev/docs/react-animate-number) и **NumberFlow** — dependency-free, accessible, customizable ✓ [number-flow.barvian.me](https://number-flow.barvian.me/). Оба подтверждены 3-0.
- **Awwwards-эстетика dashboard 2026**: glowing border animations, gradient light-follow cursors, animated data-viz — именно motion/микроинтеракции и живые графики в тренде. ✓ подтверждено 3-0 — [awwwards](https://www.awwwards.com/inspiration/interactive-bento-grid-paradigm-solutions)
- **Микроинтеракции** (hover, submit, toggle) и **scroll-triggered** появления — ведущий motion-тренд 2026. ⚠️ собрано, не доголосовано — [medium/allclonescript](https://medium.com/@allclonescript/20-best-dashboard-ui-ux-design-principles-you-need-in-2025-30b661f2f795)

### 1.5. Производительность и доступность (граница, за которой motion вредит)
- **Анимировать только `transform` (x/y/scale/rotate) и `opacity`**, никогда `width/height/top/left/padding/margin` — они триггерят layout recalculation. ⚠️ собрано, не доголосовано (2 источника согласны) — [dev.to/framer-motion-perf](https://dev.to/whoffagents/framer-motion-animations-that-dont-kill-performance-patterns-and-pitfalls-5cki), [animation-addons](https://animation-addons.com/blog/optimize-animation-for-page-speed/)
- Бюджет кадра ~**16ms на 60fps**. ⚠️ собрано — [animation-addons](https://animation-addons.com/blog/optimize-animation-for-page-speed/)
- **Stagger/entrance ограничивать ~20 элементами**, остальное виртуализировать — не анимировать сотни элементов разом. ⚠️ собрано, не доголосовано — [dev.to](https://dev.to/whoffagents/framer-motion-animations-that-dont-kill-performance-patterns-and-pitfalls-5cki)
- **`prefers-reduced-motion` — не опция, а необходимость**: до 35% взрослых 40+ имеют вестибулярную чувствительность; движение триггерит головокружение/тошноту; вредит также при фотосенситивной эпилепсии, слабом зрении, СДВГ. ⚠️ собрано — [joshwcomeau](https://www.joshwcomeau.com/react/prefers-reduced-motion/), [pope.tech](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/)
- **Glassmorphism в тёмных дашбордах часто проваливает контраст 4.5:1** — использовать осторожно, не на несущем тексте. ✓ подтверждено 3-0 — [orbix.studio](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)

---

## 2. Что из этого ложится на NIGHTFALL и наш `/account`

Принцип: **не ломаем 6-табовую навигацию как таковую** — она про управление аккаунтом (безопасность/платежи/линковки и т.д.). Меняем **вкладку по умолчанию**: вместо «Профиль-как-форма» первым экраном становится **«Командный центр» игрока** — bento-dashboard. Остальные табы остаются функциональными панелями, но перенимают визуальный язык (плитки, живые числа, glow-акценты).

### Зона A — Hero профиля игрока (новый первый экран)
- Крупная плитка слева-сверху: аватар + ник + PRO-бейдж + **уровень с XP-баром** и текущий **prestige-ранг**. Это «профиль-карточка» в духе tracker.gg / Battle.net.
- Данные уже есть: `usePlayerStore` (level, prestige, experience, streak) + Supabase (tier).
- NIGHTFALL: рамка `border-lines-hover`, акцент `var(--primary)` на прогресс-баре, заголовок `font-blender-medium uppercase tracking-widest`.

### Зона B — KPI-плитки (at-a-glance, ряд крупных чисел)
- 4–6 плиток: **Рейды · K/D · Часы · Survival % · Квесты · Бартеры**. Размер плитки = важность (правило bento).
- **Яркость = анимированные числа**: `NumberFlow` или Motion `AnimateNumber`, odometer-spring при входе и при апдейте (сравнение с прошлым снапшотом → счётчик «докручивает»).
- Числа — по канону NIGHTFALL: `font-blender-medium text-xs` для подписи, крупный размер кратен 4 для значения.

### Зона C — Тренд-график (по образцу «last 20 matches»)
- Средняя плитка: **живой мини-график** прогресса (уровень/рейды/выживаемость по времени) — эталон tracker.gg trends. Дельта-подсветка ↑/↓.
- Тяжёлый чарт — через `next/dynamic` `ssr:false` (§4.6).

### Зона D — Трекинг-дайджесты как плитки
- Существующие `TrackingQuestsDigest / PrestigeDigest / ItemsDigest / FavoritesDigest / StoryDigest` — переупаковать из вертикального списка в **bento-плитки** с прогресс-барами и «next action» (что делать дальше к цели).
- Геймификация по Trophy-паттернам: streak-бейдж, achievement-grid, «до следующего ранга N XP».

### Зона E — Motion-слой (яркий, но безопасный)
- **Entrance**: stagger-появление плиток при входе на страницу (≤20 элементов, `transform`+`opacity`).
- **Hover**: glow-бордер + light-follow градиент на плитках (Awwwards-паттерн) — на `--primary`, только для интерактивных карточек.
- **Live**: счётчики докручиваются при смене данных; при сравнении снапшотов — вспышка дельты.
- **Обязательно**: обёртка `useReducedMotion` → при `prefers-reduced-motion` отключаем катание чисел и stagger (мгновенное значение, fade без сдвига). 60fps-бюджет, не анимировать layout-свойства.

### Чего НЕ делать
- Не тащить glassmorphism на несущий текст (провал контраста в тёмной теме).
- Не анимировать сотни элементов (виртуализация уже есть в проекте — переиспользовать).
- Не хардкодить HEX/`bg-[var()]` — только токены NIGHTFALL (§6, gotcha tailwind-content-scan).
- Не ломать HubNav-канон (§ hubnav-canon) — командный центр это контент внутри страницы, не переверстка навигации.

---

## 3. Технические кандидаты
- **Счётчики**: `NumberFlow` (dependency-free, a11y из коробки) — предпочтителен; либо Motion `AnimateNumber` (2.5kb, если уже тянем Motion).
- **Motion-движок**: Motion (ex-Framer Motion) — жесты/scroll/spring; проверить, нет ли уже в проекте, прежде чем добавлять зависимость.
- **Геймификация**: подсмотреть паттерны у Trophy UI-kit (не тащить пакет — снять паттерны streak/achievement/rank и реализовать на наших атомах).

---

## 4. Открытые развилки для V4DYA
1. **Дефолтный таб**: делаем «Командный центр» новым первым экраном перед «Профиль», или встраиваем dashboard-hero внутрь таба «Профиль»?
2. **Глубина bento**: полноценная 12-колоночная перетасовка или консервативно — hero + ряд KPI поверх текущей структуры?
3. **Набор KPI**: какие 4–6 метрик выносим в крупные плитки (что важнее для игрока EFT — K/D, survival, престиж, kappa-прогресс)?
4. **Яркость motion**: light-follow glow на всех плитках или только на hero + KPI?

---

## 5. Что реализовано — Итерация 1 (2026-08-28)

Канон по 4 развилкам (§4) взят на себя, все решения зафиксированы в коде:
1. Командный центр = **первый экран таба «Профиль»** (навигацию/HubNav не трогали).
2. Глубина — **bento «консервативно-плюс»**: hero + ряд из 6 KPI-плиток.
3. KPI: hero (уровень + престиж + streak + XP-бар до макс.79) · плитки **Рейды · K/D · Выживаемость % · Часы · Квесты · Бартеры**.
4. Motion: glow + light-follow на hero и KPI; stagger-entrance на всех; счётчики odometer с 0→value.

**Файлы:**
- `src/app/account/CommandCenter.tsx` — новый клиентский компонент (hero + KPI-bento + `AnimatedNumber` + скелетон mount-guard).
- `src/hooks/useReducedMotion.ts` — SSR-safe хук (гейтит энтранс).
- `src/hooks/useCountUp.ts` — **переиспользован** (rAF-счётчик, уже уважает reduced-motion).
- `src/app/globals.css` — добавлены `.cc-tile` (курсор-follow radial glow) + `.cc-glow` (ореол рамки на hover), корневой слой, токен `--primary`.
- `src/app/account/AccountCenter.tsx` — врезка `<CommandCenter>` в начало `ProfilePanel` + разделитель «Управление учётной записью».

**Motion-слой без тяжёлых зависимостей** (в проекте нет framer-motion/motion — не тащили 85кб и не рисковали Turbopack/babel-гочей): CSS-keyframes (`fade-in-up`, `shimmer`) + rAF-счётчик. Двойная защита reduced-motion: глобальный `*`-guard в globals.css (уже был) + хук снимает класс.

**Данные:** только зеркало — `usePlayerStore` (level/prestige/raids/kd/survivalRate/hoursPlayed/streak/kills/deaths) + серверный `AccountStats` (quests/barters). Null → «—» без счётчика, без выдумки (§7).

**Осознанно отложено:**
- **Тренд-график «last 20 matches»** (зона C плана) — нет тайм-серии в зеркале; фабриковать не стали (§7). Долг: завести снапшот-историю профиля → тогда живой график.
- Трекинг-дайджесты пока НЕ переупакованы в плитки (зона D) — остаются в табе «Трекинг». Кандидат на итерацию 2.
- Live-verify (скрин зоны 1:1) — за V4DYA (страница под auth-гардом).

**Проверка:** `npx tsc --noEmit` — чисто; eslint — только warnings (mount-guard set-state + unused img-disable), идентичные уже существующим в `AccountCenter.tsx`.

---

## Источники (по качеству)
- **primary**: motion.dev/react-animate-number · number-flow.barvian.me · tracker.gg/valorant
- **secondary**: shadcn.io/sliding-number · ui.trophy.so · awwwards (interactive bento grid)
- **blog**: orbix.studio · saasframe.io · baltech.in · mydesigner.gg · logrocket · dev.to (framer perf) · animation-addons · uxpilot.ai · joshwcomeau · pope.tech · muz.li · lucky.graphics · webpeak · medium/allclonescript
- ⚠️ отброшен как unreliable: aniq-ui.com

> Оговорка о доверии: пометка ✓ 3-0 = факт прошёл единогласную adversarial-верификацию. Пометка ⚠️ «собрано, не доголосовано» = факт извлечён из источника с прямой цитатой, но голосование не завершилось из-за лимита сессии (НЕ опровергнут). При исполнении спорные ⚠️-пункты (особенно 12/16-колоночные сетки и точные пороги) перепроверить.
