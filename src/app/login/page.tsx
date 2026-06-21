// Страница входа /login. Если уже авторизован — показывает, кто вошёл, + выход.
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-[60vh] w-full flex-col items-center justify-center px-4 py-14">
      {user ? (
        <div className="flex w-full max-w-sm flex-col gap-4">
          <h1 className="font-blender-medium text-xl uppercase tracking-widest text-(--primary)">
            Вы вошли
          </h1>
          <p className="font-blender-book text-sm text-white/70">{user.email}</p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-xs border border-white/15 px-3 py-2 font-blender-medium text-xs uppercase tracking-widest hover:border-(--primary)"
            >
              Выйти
            </button>
          </form>
        </div>
      ) : (
        <LoginForm />
      )}
    </main>
  );
}
