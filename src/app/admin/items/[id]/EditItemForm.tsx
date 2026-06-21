"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ItemProperties } from "@/db/schema";

interface EditItem {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  basePrice: number | null;
  categoryId: string | null;
  properties: ItemProperties | null;
}
interface Category {
  id: string;
  slug: string;
}
type Status = "idle" | "saving" | "saved" | "error";

const field =
  "rounded-xs border border-white/15 bg-white/5 px-3 py-2 font-blender-book text-sm outline-none focus:border-(--primary)";
const label = "font-blender-medium text-xs uppercase tracking-widest text-white/50";

export function EditItemForm({
  item,
  categories,
}: {
  item: EditItem;
  categories: Category[];
}) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [shortName, setShortName] = useState(item.shortName ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [basePrice, setBasePrice] = useState(item.basePrice?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(item.categoryId ?? "");
  const [status, setStatus] = useState<Status>("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch(`/api/admin/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        shortName: shortName || null,
        description: description || null,
        basePrice: basePrice === "" ? null : Number(basePrice),
        categoryId: categoryId || null,
      }),
    });
    if (res.ok) {
      setStatus("saved");
      router.refresh();
    } else {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={save} className="flex max-w-xl flex-col gap-4">
      <Link href="/admin/items" className="font-blender-book text-xs text-white/40 hover:text-(--primary)">
        ← к списку
      </Link>

      <label className="flex flex-col gap-1">
        <span className={label}>Название</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required className={field} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={label}>Короткое имя</span>
        <input value={shortName} onChange={(e) => setShortName(e.target.value)} className={field} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={label}>Описание</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={field}
        />
      </label>

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1">
          <span className={label}>Базовая цена (₽)</span>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className={label}>Категория</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
            <option value="">— нет —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.slug}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-xs border border-(--primary) px-4 py-2 font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-50"
        >
          {status === "saving" ? "Сохраняю…" : "Сохранить"}
        </button>
        {status === "saved" && <span className="font-blender-book text-sm text-green-400">Сохранено ✓</span>}
        {status === "error" && <span className="font-blender-book text-sm text-red-400">Ошибка сохранения</span>}
      </div>

      {/* properties пока read-only: типизированный JSONB правим отдельным редактором позже */}
      <details className="mt-2">
        <summary className={label}>properties (read-only)</summary>
        <pre className="mt-2 overflow-auto rounded-xs border border-white/10 bg-black/30 p-3 font-blender-book text-xs text-white/60">
          {JSON.stringify(item.properties, null, 2)}
        </pre>
      </details>
    </form>
  );
}
