import { redirect } from "next/navigation";

// ⏸️ ВРЕМЕННО: главной сделан раздел EFT (на время отсутствия других игр и
// полировки Escape from Tarkov). Мультиигровой хаб живёт в HomeClient и с роута
// НЕ удалён — чтобы вернуть хаб на главную, убери redirect ниже и верни рендер:
//   import { HomeClient } from "@/components/features/home/HomeClient";
//   return <div className="flex min-h-screen flex-col bg-base"><HomeClient /></div>;
export default function HomePage() {
  redirect("/eft"); // 307 (временный) — не кэшируется браузером намертво
}
