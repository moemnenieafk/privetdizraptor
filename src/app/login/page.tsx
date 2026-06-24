// Страница входа /login. Если уже авторизован — показывает, кто вошёл, + выход.
import { Suspense } from "react";
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
        <div className="w-full max-w-sm rounded border border-lines-hover bg-card-menu p-7">
          <h1 className="font-blender-medium text-xl uppercase tracking-widest text-(--primary)">
            Вы вошли
          </h1>
          <p className="mt-1 font-blender-book text-sm text-text-secondary">{user.email}</p>
          <form action="/auth/signout" method="post" className="mt-5">
            <button
              type="submit"
              className="rounded border border-lines-hover px-4 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-colors hover:border-danger hover:text-danger"
            >
              Выйти
            </button>
          </form>
        </div>
      ) : (
        <Suspense
          fallback={<div className="font-blender-book text-sm text-text-muted">Загрузка…</div>}
        >
          <LoginForm />
        </Suspense>
      )}
    </main>
  );
}
