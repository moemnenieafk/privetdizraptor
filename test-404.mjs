/**
 * Скрипт-краулер для проверки всех внутренних ссылок сайта на ошибки 404.
 * Запускать только при включенном сервере (npm run dev или npm run start).
 */

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log(`\n🚀 Запуск тактического сканера ссылок на: ${BASE_URL}`);
  console.log(`⏳ Собираю карту маршрутов...\n`);

  const visited = new Set();
  const queue = ['/']; // Начинаем с корня
  const brokenLinks = [];
  const workingLinks = [];

  while (queue.length > 0) {
    const currentPath = queue.shift();
    
    if (visited.has(currentPath)) continue;
    visited.add(currentPath);

    const url = `${BASE_URL}${currentPath}`;
    
    try {
      // Делаем запрос к текущему URL
      const res = await fetch(url);
      
      if (res.status === 404) {
        console.log(`❌ [404] БИТАЯ ССЫЛКА: ${currentPath}`);
        brokenLinks.push(currentPath);
        continue;
      }

      if (!res.ok) {
        console.log(`⚠️ [${res.status}] ОШИБКА: ${currentPath}`);
        continue;
      }

      console.log(`✅ [200] OK: ${currentPath}`);
      workingLinks.push(currentPath);

      // Если это HTML, парсим новые ссылки
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = await res.text();
        
        // Регулярка для поиска внутренних ссылок (начинаются с /)
        const linkRegex = /<a[^>]+href=["'](\/[^"']+)["']/g;
        let match;
        
        while ((match = linkRegex.exec(html)) !== null) {
          let newPath = match[1];
          // Отрезаем якоря и параметры
          newPath = newPath.split('#')[0].split('?')[0]; 
          
          // Добавляем в очередь, если еще не были там
          if (!visited.has(newPath) && !queue.includes(newPath)) {
            queue.push(newPath);
          }
        }
      }
    } catch (err) {
      console.log(`🔌 ОШИБКА СЕТИ [${currentPath}]: Убедитесь, что сервер запущен.`);
      return;
    }
  }

  console.log(`\n======================================`);
  console.log(`🏁 СКАНИРОВАНИЕ ЗАВЕРШЕНО`);
  console.log(`Проверено ссылок: ${visited.size}`);
  console.log(`Рабочих: ${workingLinks.length}`);
  console.log(`Битых (404): ${brokenLinks.length}`);
  if (brokenLinks.length > 0) {
    console.log(`\nСписок ссылок "В разработке":\n- ${brokenLinks.join('\n- ')}`);
  }
}

main();
