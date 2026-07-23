import { MyLoadoutsClient } from '@/components/features/loadouts/MyLoadoutsClient';

// Мои сборки. Статический сегмент перебивает динамический [action] — раньше /my падал
// туда и рендерил SectionPlaceholder («раздел в разработке»), из-за чего сохранённые
// сборки было негде показать.
//
// Сборки лежат в localStorage, поэтому весь экран клиентский: сервер отдаёт только шапку.

export default function MyLoadoutsPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <MyLoadoutsClient />
      </div>
    </main>
  );
}
