'use server'

import { getAllEftItems } from '@/lib/eft-api';
import { searchItems } from '@/lib/search-engine';

export async function searchEftItemsAction(query: string) {
  console.log(`\n⚡ X-RAY [SERVER ACTION]: Получен запрос "${query}"`);
  if (!query || query.length < 2) return [];
  
  console.log(`⏳ X-RAY [SERVER ACTION]: Обращаюсь к базе (getAllEftItems)...`);
  const items = await getAllEftItems(); 
  console.log(`📊 X-RAY [SERVER ACTION]: База загружена. Всего предметов: ${items.length}`);

  console.log(`🧠 X-RAY [SERVER ACTION]: Запускаю интеллектуальный движок (search-engine)...`);
  const results = searchItems(items, query);
  
  console.log(`🎯 X-RAY [SERVER ACTION]: Найдено ${results.length} совпадений. Отправляю ТОП-12 на клиент.`);
  return results.slice(0, 12); // Отдаем клиенту только топ 12
}