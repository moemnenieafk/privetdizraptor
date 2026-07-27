---
status: ✅ сделано (код) — остался ручной шаг V4DYA
affects: account, auth
date: 2026-07-17
done: 2026-07-27
---
# Вход через Discord и Twitch (OAuth)

## Что сделано в коде
- **Логин** (`LoginForm`): кнопки Discord/Twitch с бренд-иконами, состоянием загрузки и
  **явной ошибкой** вместо молчаливого bounce. `/login?error=oauth|link` теперь показывает баннер.
- **Callback** (`/auth/callback`): уже обменивал `code` → сессию (было).
- **Профиль OAuth-юзера**: создаёт триггер `handle_new_user` (`supabase/auth-setup.sql`) —
  ник из метаданных провайдера (`user_name`/`name`), при коллизии — суффикс. Отдельной регистрации не нужно.
- **Аккаунт Центр → Спецсвязь**: блок «Вход через сервисы» (`OAuthLogins`) — РЕАЛЬНЫЕ
  идентичности через `getUserIdentities` + `linkIdentity`/`unlinkIdentity`. Ручные хендлы
  соцсетей переименованы в «Публичные хендлы» (витрина для Комлинка, не способ входа).

## Что настроить в дашбордах (иначе кнопки вернут «пока не подключён»)
1. **Discord Developer Portal** → New Application → OAuth2 → добавить Redirect:
   `https://<project-ref>.supabase.co/auth/v1/callback`. Скопировать Client ID + Secret.
2. **Twitch Developer Console** → Register Your Application → OAuth Redirect URL:
   `https://<project-ref>.supabase.co/auth/v1/callback`. Скопировать Client ID + Secret.
3. **Supabase → Authentication → Providers** → включить Discord и Twitch, вставить Client ID/Secret.
4. **Supabase → Authentication → URL Configuration → Redirect URLs** — добавить в allowlist:
   `https://privetdizraptor.vercel.app/auth/callback`, `https://privetdizraptor.vercel.app/account`
   и `http://localhost:3000/**` для локалки.
5. Для привязки/отвязки в кабинете — **Supabase → Authentication → включить Manual Linking**
   (иначе `OAuthLogins` покажет «привязка отключена»).

## Проверка после конфига
- `/login` → кнопка Discord/Twitch → редирект на провайдера → назад на `/account` залогиненным.
- Новый OAuth-юзер получает строку в `profiles` (ник из провайдера), кабинет открывается.
- `/account` → Спецсвязь → «Вход через сервисы»: привязать второй провайдер, отвязать (нужно ≥2 входов).

---

## Закрытие (ревизия 2026-07-27)

Код на месте: `src/app/api/account/social/route.ts`, `api/twitch-status`, `api/cron/set-streamer`.
Со стороны разработки задача закрыта.

> **ОСТАЛОСЬ ЗА V4DYA:** прописать OAuth-приложения Discord и Twitch в дашбордах провайдеров
> и в Supabase Auth. Пока не сделано — кнопки входа не заработают. Чек-лист проверки выше.
