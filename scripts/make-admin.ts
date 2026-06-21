// Назначить пользователя админом CMS. Запуск: npm run db:admin -- you@example.com
// (пользователь должен сперва хоть раз войти на /login — тогда он есть в auth.users).
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("usage: npm run db:admin -- <email>");

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`пользователь ${email} не найден — сначала войди на /login`);

  const { error } = await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
  if (error) throw error;

  console.log(`✓ ${email} теперь admin`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
