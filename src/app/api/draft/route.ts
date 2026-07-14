// Режим черновика (E10, фаза 2).
//
// В отличие от канонического примера Next.js (secret-токен в URL от внешней CMS),
// у нас CMS своя и редактор уже залогинен → гейт по СЕССИИ, а не по секрету:
// включить draft может только admin|editor. Секрет в URL был бы лишней сущностью,
// которую пришлось бы хранить и ротировать.
//
//   POST   /api/draft — включить (cookie __prerender_bypass, httpOnly, подписана Next)
//   DELETE /api/draft — выключить
//
// Пока draft включён, страницы читают НЕопубликованные материалы и не кэшируются
// (Next сам исключает такие запросы из ISR).
import { NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { getCmsUser } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const cms = await getCmsUser();
  if (!cms?.canEditContent) {
    return NextResponse.json({ error: "Нет прав на режим черновика" }, { status: 403 });
  }

  const draft = await draftMode();
  draft.enable();
  return NextResponse.json({ draft: true });
}

export async function DELETE(): Promise<NextResponse> {
  const draft = await draftMode();
  draft.disable();
  return NextResponse.json({ draft: false });
}
