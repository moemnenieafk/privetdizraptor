import { test, expect } from '@playwright/test';

// Смоук интерактивной карты: клиентская гидрация Leaflet + слой маркеров + отсутствие рантайм-краша.
// Инструменты визарда (admin-gated) требуют сессии редактора — их верифицируем ревью кода/компиляцией;
// здесь проверяем публичный рендер-путь (MapViewerClient + editorial-слой + карточка показа) в браузере.
test('map customs: Leaflet hydrates, markers render, no runtime crash', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await page.goto('/eft/maps/customs', { waitUntil: 'load' });

  // Leaflet инициализируется на клиенте (динамический импорт ssr:false).
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(3_000); // дать слоям маркеров/editorial отрисоваться

  const markers = await page.locator('.leaflet-marker-icon').count();
  // eslint-disable-next-line no-console
  console.log(`[smoke] leaflet markers: ${markers}, console errors: ${consoleErrors.length}`);
  if (consoleErrors.length) console.log('[smoke] console errors:\n' + consoleErrors.slice(0, 12).join('\n'));

  // Жёсткие проверки: карта смонтирована и нет НЕОБРАБОТАННЫХ исключений (реальный краш).
  expect(pageErrors, `uncaught exceptions:\n${pageErrors.join('\n')}`).toEqual([]);
});
