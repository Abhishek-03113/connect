// Captures screenshots of the key playback states (not part of the regular suite).
import {
  test, expect, serveFixtureVideo, drivePath, DEMO_ROUTES, waitForPlayback, videoState,
} from './support/video.js';

const OUT = process.env.SHOWCASE_DIR;
test.skip(!OUT, 'set SHOWCASE_DIR to capture screenshots');

const shot = (page, name) => page.screenshot({ path: `${OUT}/${test.info().project.name}-${name}.png`, fullPage: true });

test('playing', async ({ page }) => {
  await serveFixtureVideo(page);
  await page.goto(drivePath(DEMO_ROUTES.missingGps));
  await waitForPlayback(page, 3);
  await shot(page, '1-playing');
});

test('paused after seeking on the timeline', async ({ page }) => {
  await serveFixtureVideo(page);
  await page.goto(drivePath(DEMO_ROUTES.missingGps));
  await waitForPlayback(page);
  await page.getByLabel('Pause').click();
  const ruler = page.locator('[class*="Timeline-ruler"]').first();
  await ruler.scrollIntoViewIfNeeded();
  const box = await ruler.boundingBox();
  await page.mouse.click(box.x + (box.width * 0.6), box.y + (box.height / 2));
  await expect.poll(async () => (await videoState(page)).time).toBeGreaterThan(400);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '2-paused-after-seek');
});

test('map tab keeps playing', async ({ page }) => {
  await serveFixtureVideo(page);
  await page.goto(drivePath(DEMO_ROUTES.missingGps));
  await waitForPlayback(page);
  await page.getByText('Map', { exact: true }).click();
  await page.waitForTimeout(3000);
  await shot(page, '3-map-tab');
});

test('deep linked section', async ({ page }) => {
  await serveFixtureVideo(page);
  await page.goto(`${drivePath(DEMO_ROUTES.missingGps)}/120/126`);
  await waitForPlayback(page, 121);
  await shot(page, '4-deep-link-section');
});

test('slow network loading', async ({ page }) => {
  await serveFixtureVideo(page, { segmentDelayMs: 4000 });
  await page.goto(drivePath(DEMO_ROUTES.missingGps));
  await expect(page.getByRole('progressbar').first()).toBeVisible();
  await shot(page, '5-loading');
});

test('segment not uploaded', async ({ page }) => {
  await serveFixtureVideo(page, { missingSegments: [0] });
  await page.goto(drivePath(DEMO_ROUTES.missingGps));
  await expect(page.getByText('not uploaded', { exact: false })).toBeVisible({ timeout: 15000 });
  await shot(page, '6-segment-not-uploaded');
});

test('route without video', async ({ page }) => {
  await serveFixtureVideo(page);
  await page.goto(drivePath(DEMO_ROUTES.missingQcamera));
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible({ timeout: 15000 });
  await shot(page, '7-no-video-retry');
});
