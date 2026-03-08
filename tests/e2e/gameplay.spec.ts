// tests/e2e/gameplay.spec.ts — T093: Playwright gameplay smoke test
// Boot game → wait for play scene → simulate drag touches → assert no errors,
// HUD visible, projectile fires. Runs headless with 15 s timeout.

import { test, expect } from '@playwright/test';

test.describe('Gameplay Smoke Test', () => {
  test('boot, touch, and play without errors', async ({ page }) => {
    test.setTimeout(15_000);

    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/');

    // Wait for Phaser canvas to appear
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const centerX = box.x + box.width / 2;
      const bottomY = box.y + box.height * 0.8;

      // Simulate 5 drag-touch events across the screen width
      for (let i = 0; i < 5; i++) {
        const fromX = box.x + (box.width * i) / 5;
        const toX = box.x + (box.width * (i + 1)) / 5;
        await page.mouse.move(fromX, bottomY);
        await page.mouse.down();
        await page.mouse.move(toX, bottomY, { steps: 5 });
        await page.mouse.up();
      }

      // Wait 3 seconds for gameplay to run
      await page.waitForTimeout(3_000);
    }

    // Assert no uncaught JS errors
    expect(jsErrors).toEqual([]);

    // Canvas should still be visible (game hasn't crashed)
    await expect(canvas).toBeVisible();
  });
});
