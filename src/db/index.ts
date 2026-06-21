import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Рантайм-клиент базы. Ходит через ТРАНЗАКЦИОННЫЙ пулер Supabase (порт 6543).
// prepare: false — обязательно для pgbouncer в transaction mode.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL не задан");

// Singleton: в dev Next.js перезагружает модули и иначе плодит соединения.
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.client ??
  postgres(connectionString, { prepare: false });

if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
