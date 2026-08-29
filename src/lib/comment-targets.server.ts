// Проверка «цель обсуждения существует и опубликована» — только сервер.
//
// Нужна, потому что FK на полиморфную цель поставить нельзя: entity_comments
// ссылается на сборки, статьи, боссов и торговцев разом. Без этой проверки
// в таблицу можно налить комментарии к несуществующим id прямым запросом.
import "server-only";
import { getArticle } from "@/db/articles";
import { getCodex } from "@/db/codex";
import { getBoss } from "@/data/bosses";
import { getTrader } from "@/data/traders";
import { buildIdBySlug } from "@/db/entity-comments";
import { seasonBuildExists } from "@/db/season-build-social";
import type { CommentTargetType } from "@/lib/comment-targets";

export async function targetExists(type: CommentTargetType, id: string): Promise<boolean> {
  switch (type) {
    case "build":
      return (await buildIdBySlug(id)) !== null;
    case "season-build":
      return await seasonBuildExists(id);
    case "patch": {
      const a = await getArticle(id);
      return a !== null && a.kind === "patch";
    }
    case "codex":
      return (await getCodex(id)) !== null;
    case "boss":
      return getBoss(id) !== null;
    case "trader":
      return getTrader(id) !== null;
  }
}
