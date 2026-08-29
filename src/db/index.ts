import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Рантайм-клиент базы. Ходит через ТРАНЗАКЦИОННЫЙ пулер Supabase (порт 6543).
// prepare: false — обязательно для pgbouncer в transaction mode.
//
// ЛЕНИВАЯ инициализация: реальный клиент создаётся при ПЕРВОМ обращении к `db`,
// а не при импорте модуля. Иначе `next build` (он импортирует роуты на этапе
// "collect page data") падал бы там, где DATABASE_URL недоступен на сборке.

type DrizzleDb = PostgresJsDatabase<typeof schema>;

// Singleton: в dev Next перезагружает модули и иначе плодит соединения.
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

let cachedDb: DrizzleDb | undefined;

function getDb(): DrizzleDb {
  if (cachedDb) return cachedDb;

  // ⛔ Сборка НЕ ходит в БД. На автономном стеке порт 5432 закрыт наружу
  // (§4.11 hosting-autonomy), поэтому `next build` не имеет доступа к Postgres.
  // Любой build-time запрос — ошибка проектирования страницы: пометь её
  // `export const dynamic = "force-dynamic"` (статический роут) или верни []
  // из generateStaticParams (динамический роут → ленивая ISR-генерация).
  // Guard делает промах детерминированным: сборка упадёт ровно на нарушителе.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    throw new Error(
      "[db] Обращение к БД во время `next build` запрещено (порт 5432 закрыт наружу). " +
        'Пометь страницу `export const dynamic = "force-dynamic"` ' +
        "или верни [] из generateStaticParams.",
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL не задан");

  const client =
    globalForDb.client ?? postgres(connectionString, { prepare: false });
  if (process.env.NODE_ENV !== "production") globalForDb.client = client;

  cachedDb = drizzle(client, { schema });
  return cachedDb;
}

// Прокси: импорт `db` ничего не открывает; клиент поднимается при первом
// вызове метода (в рантайме), не при сборке.
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
