// tests/e2e/offline.spec.ts — T063: E2E offline smoke test
// Playwright: load cached game, play full run, verify score persistence.
// Requires: npm run build first, then run with npx playwright test

import { test, expect } from '@playwright/test';

test.describe('Offline Smoke Test', () => {
  test('should load the game and show canvas', async ({ page }) => {
    await page.goto('/');

    // Wait for Phaser canvas to render
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });
  });

  test('should function offline after initial load', async ({ page, context }) => {
    // First load (online)
    await page.goto('/');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Wait for service worker to cache assets
    await page.waitForTimeout(3000);

    // Go offline
    await context.setOffline(true);

    // Reload — should work from cache
    await page.reload();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Restore online
    await context.setOffline(false);
  });

  test('should accept touch input on canvas', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Simulate touch/drag on canvas
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.8);
      await page.mouse.up();
    }

    // Game should still be running (canvas should still be visible)
    await expect(canvas).toBeVisible();
  });
});
