import { test as base, expect } from '@playwright/test';

const DEMO_DONGLE_ID = 'deadbeefdeadbeef';

// Fail any test that throws an uncaught error in the page.
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await use(page);
    expect(errors, 'uncaught page errors').toEqual([]);
  },
});

test('demo dashboard shows the demo device and its drives', async ({ page }) => {
  await page.goto('/demo');

  // the device list (with the dongle id) is in a closed drawer on mobile, so only check the name
  await expect(page.getByText('demo device').first()).toBeVisible();
  await expect(page.locator('.DriveEntry').first()).toBeVisible();
});

test('opening a drive shows the drive view and timeline', async ({ page }) => {
  await page.goto('/demo');

  const firstDrive = page.locator('.DriveEntry').first();
  await expect(firstDrive).toBeVisible();
  await firstDrive.click();

  await expect(page).toHaveURL(new RegExp(`/${DEMO_DONGLE_ID}/[0-9a-f-]+`));
  await expect(page.locator('.DriveView')).toBeVisible();
  await expect(page.getByText('Video', { exact: true })).toBeVisible();

  await page.getByLabel('Close').click();
  await expect(page.locator('.DriveEntry').first()).toBeVisible();
});
