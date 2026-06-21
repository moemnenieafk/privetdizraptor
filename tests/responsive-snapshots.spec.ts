import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'fullhd-1920', width: 1920, height: 1080 },
  { name: 'macbook-1440', width: 1440, height: 900 },
  { name: '2k-2560', width: 2560, height: 1440 },
  { name: '4k-3840', width: 3840, height: 2160 },
];

const routes = [
  { name: 'home', path: '/' },
  { name: 'eft-hub', path: '/eft' },
  { name: 'items-helmets', path: '/eft/items/gear/helmets' },
  { name: 'progress', path: '/eft/progress' },
  { name: 'gamesetting', path: '/eft/gamesetting' },
  { name: 'videos', path: '/eft/videos' },
];

for (const viewport of viewports) {
  for (const route of routes) {
    test(`${route.name} @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route.path, { waitUntil: 'load' });
      // Disable animations for stable screenshots
      await page.addStyleTag({
        content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }',
      });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
        fullPage: true,
      });
    });
  }
}
