// Медиа-библиотека CMS: загрузка и управление изображениями контента.
import { redirect } from "next/navigation";
import { getCmsUser } from "@/lib/auth/admin";
import { MediaLibrary } from "@/components/features/media/MediaLibrary";

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  const cms = await getCmsUser();
  if (!cms?.canEditContent) redirect("/admin");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-blender-medium text-xl uppercase tracking-widest">Медиа</h1>
        <p className="font-blender-book text-sm text-white/50">
          Изображения для статей, гайдов и обложек. Файл попадает в общее хранилище — ссылку
          можно скопировать и вставить куда угодно, либо выбрать картинку прямо из формы редактора.
        </p>
      </header>

      <MediaLibrary />
    </div>
  );
}
