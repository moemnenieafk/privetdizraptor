"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface KeepItem {
  id: string;
  name: string;
  desc: string;
  rarity: string;
  type: string;
  image: string;
  category: string;
  price: number;
}

export default function KeepItemsPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [items, setItems] = useState<KeepItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadItems() {
      try {
        const query = `
          {
            items(types: [barter, medical, keys], lang: ru) {
              id
              name
              description
              gridImageLink
              types
              sellFor {
                price
                vendor { normalizedName }
              }
            }
          }
        `;
        const res = await fetch("https://api.tarkov.dev/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query })
        });
        const { data } = await res.json();

        if (data && data.items) {
          const processed = data.items.map((item: any) => {
            const fleaPrice = item.sellFor?.find((s: any) => s.vendor.normalizedName === 'flea-market')?.price || 0;
            
            let rarity = "ОБЫЧНОЕ";
            if (fleaPrice > 1000000) rarity = "ЛЕГЕНДАРНОЕ";
            else if (fleaPrice > 200000) rarity = "ЭПИЧЕСКОЕ";
            else if (fleaPrice > 50000) rarity = "РЕДКОЕ";

            // Имитация распределения по категориям (в реальности требует маппинга с квестами)
            const category = fleaPrice > 300000 ? "kappa" : "hideout";
            const typeMap: Record<string, string> = { barter: "БАРТЕР", medical: "МЕДИЦИНА", keys: "КЛЮЧИ" };
            const type = item.types[0] ? (typeMap[item.types[0]] || "ПРЕДМЕТ") : "ПРЕДМЕТ";

            return {
              id: item.id,
              name: item.name,
              desc: item.description ? item.description.substring(0, 90) + '...' : 'Описание отсутствует',
              rarity, type, image: item.gridImageLink, category, price: fleaPrice
            };
          })
          .filter((item: KeepItem) => item.price > 40000) // Оставляем только ценный лут
          .sort((a: KeepItem, b: KeepItem) => b.price - a.price)
          .slice(0, 30); // Берем топ-30

          setItems(processed);
        }
      } catch (error) {
        console.error("Ошибка загрузки нужных предметов:", error);
      } finally {
        setLoading(false);
      }
    }
    loadItems();
  }, []);

  const filteredItems = items.filter(item => activeCategory === "all" || item.category === activeCategory);

  return (
    <div className="w-full max-w-[1100px] mx-auto py-10 px-4 selection:bg-primary selection:text-black">
      
      {/* Шапка */}
      <div className="mb-8 border-b border-lines-hover pb-6 animate-[fade-in-up_0.4s_both]">
        <h1 className="text-2xl font-blender-medium tracking-[0.3em] uppercase text-text-primary mb-2">
          НУЖНЫЕ ПРЕДМЕТЫ <span className="text-primary">EFT</span>
        </h1>
        <p className="text-[10px] font-bold tracking-widest text-text-muted uppercase">
          Списки лута, который необходимо сохранить для выполнения заданий (Каппа) и постройки убежища
        </p>
      </div>

      {/* Панель управления */}
      <div className="mb-8 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-card-menu border border-lines-hover p-4 rounded-lg animate-[fade-in-up_0.5s_both]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-blender-medium tracking-wider text-text-muted uppercase mr-2">КАТЕГОРИИ:</span>
          {[
            { id: "all", label: "ВСЕ ПРЕДМЕТЫ" },
            { id: "kappa", label: "ДЛЯ КАППЫ" },
            { id: "hideout", label: "ДЛЯ УБЕЖИЩА" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`text-[10px] font-blender-medium tracking-widest px-3 py-1.5 border rounded-md transition-all uppercase ${
                activeCategory === tab.id
                  ? "bg-primary text-black border-primary"
                  : "bg-transparent text-text-secondary border-lines-hover hover:border-primary/50 hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Сортировка */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 border-lines-hover pt-3 lg:pt-0">
          <span className="text-[10px] font-blender-medium tracking-wider text-text-muted uppercase mr-2">ОТОБРАЖЕНИЕ:</span>
          <button className="text-[10px] font-blender-medium tracking-widest px-4 py-1.5 border rounded-md bg-transparent text-text-primary border-lines-hover hover:border-primary/50 flex items-center gap-2 uppercase">
            СЕТКОЙ ⊞
          </button>
        </div>
      </div>

      {/* Сетка предметов (Стиль как в Достижениях) */}
      {loading ? (
        <div className="w-full h-[40vh] flex flex-col items-center justify-center text-text-secondary">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <div className="font-blender-medium text-[12px] tracking-[0.4em] uppercase animate-pulse">
            СИНХРОНИЗАЦИЯ БАЗЫ...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[28px]">
          {filteredItems.map((item, i) => {
            // Подбираем стили для плашки редкости
            let rarityStyle = "border-white/5 bg-white/[0.02] text-white/40"; // ОБЫЧНОЕ
            if (item.rarity === "ЛЕГЕНДАРНОЕ") rarityStyle = "border-orange-500/20 bg-orange-500/5 text-orange-500";
            if (item.rarity === "ЭПИЧЕСКОЕ") rarityStyle = "border-pink-500/20 bg-pink-500/5 text-fuchsia-400";
            if (item.rarity === "РЕДКОЕ") rarityStyle = "border-blue-400/20 bg-blue-400/5 text-blue-400";

            return (
              <div
                key={item.id}
                className="flex flex-col bg-card-menu border border-lines-hover rounded-lg p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_8px_30px_rgba(230,142,37,0.15)] group animate-[fade-in-up_0.6s_both]"
                style={{ animationDelay: `${(i % 10) * 100}ms` }}
              >
                <div className="flex items-start gap-6">
                  {/* Иконка */}
                  <div className="relative w-[80px] h-[80px] border border-lines-hover bg-base rounded-md overflow-hidden flex-shrink-0 p-2 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="max-w-full max-h-full object-contain opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 drop-shadow-md" 
                      loading="lazy"
                    />
                  </div>
                  {/* Текст */}
                  <div className="flex flex-col gap-1 flex-grow">
                    <h2 className="text-sm font-blender-medium tracking-wider text-text-primary uppercase group-hover:text-primary transition-colors">
                      {item.name}
                    </h2>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
                {/* Мета-информация */}
                <div className="flex items-center justify-between border-t border-lines-hover pt-4 mt-4">
                  <span className={`text-[10px] font-black tracking-[0.2em] px-2 py-0.5 border rounded-sm ${rarityStyle}`}>
                    {item.rarity}
                  </span>
                  <span className="text-xs font-mono text-text-muted">
                    ТИП: <strong className="text-text-primary font-blender-medium">{item.type}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}