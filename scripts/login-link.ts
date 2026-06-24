// Дев-инструмент: генерит готовую ссылку входа/сброса БЕЗ отправки письма
// (через сервис-ключ admin.generateLink). Обходит лимит писем Supabase при тестах.
// Ссылка ведёт на /auth/confirm?token_hash=... — verifyOtp, без PKCE-верификатора,
// поэтому работает в любом браузере. Одноразовая, живёт ~1 час.
//
// Запуск:
//   npm run db:login-link -- you@example.com            (magiclink, → /)
//   npm run db:login-link -- you@example.com recovery   (сброс пароля, → /reset-password)
//   LOGIN_LINK_BASE=http://localhost:3000 npm run db:login-link -- you@example.com
import { config } from "dotenv";
config({ path: ".env.local" });

type LinkType = "magiclink" | "recovery";

async function main() {
  const email = process.argv[2];
  const kind: LinkType = process.argv[3] === "recovery" ? "recovery" : "magiclink";
  if (!email) {
    console.error("Использование: npm run db:login-link -- <email> [magiclink|recovery]");
    process.exit(1);
  }

  const base =
    process.env.LOGIN_LINK_BASE ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://privetdizraptor.vercel.app";

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Если юзера нет (новый/удалённый email) — создаём подтверждённым, без письма.
  let res = await admin.auth.admin.generateLink({ type: kind, email });
  if (res.error) {
    await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => {});
    res = await admin.auth.admin.generateLink({ type: kind, email });
  }
  if (res.error) {
    console.error("Ошибка:", res.error.message);
    process.exit(1);
  }
  const data = res.data;
  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    console.error("Не получили hashed_token из generateLink");
    process.exit(1);
  }

  const next = kind === "recovery" ? "/reset-password" : "/";
  const url = `${base}/auth/confirm?token_hash=${tokenHash}&type=${kind}&next=${encodeURIComponent(next)}`;

  console.log(`\n[${kind}] для ${email} — вставь в браузер (одноразовая, ~1 час):\n`);
  console.log(url);
  console.log("");
  // Без process.exit(0): даём undici-сокетам закрыться, иначе на Windows
  // libuv роняет assert при резком выходе. Процесс завершится сам.
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
