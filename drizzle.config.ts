import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

// Миграции (drizzle-kit push/generate) идут через СЕССИОННЫЙ пулер (порт 5432),
// т.к. транзакционный пулер не поддерживает часть DDL-операций.
const url = process.env.DATABASE_URL_SESSION;
if (!url) throw new Error("DATABASE_URL_SESSION не задан в .env.local");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: false,
});
