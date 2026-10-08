import {
  test, expect, serveFixtureVideo, drivePath, DEMO_ROUTES, waitForPlayback, videoState, displayedSeconds,
} from './support/video.js';

const ROUTE = DEMO_ROUTES.missingGps; // a complete route with video, events and thumbnails

async function openDrive(page, logId = ROUTE, options = {}) {
  await serveFixtureVideo(page, options);
  await page.goto(drivePath(logId));
  await expect(page.locator('.DriveView')).toBeVisible();
}

// click the timeline ruler at a fraction of its width
async function clickTimeline(page, fraction) {
  const ruler = page.locator('[class*="Timeline-ruler"]').first();
  await ruler.scrollIntoViewIfNeeded();
  const box = await ruler.boundingBox();
  await page.mouse.click(box.x + (box.width * fraction), box.y + (box.height / 2));
}

test('video plays and the time display follows it', async ({ page }) => {
  await openDrive(page);
  await waitForPlayback(page);

  // the displayed wall-clock time and the video time must advance together
  const gaps = [];
  for (let i = 0; i < 6; i += 1) {
    const [{ time }, shown] = await Promise.all([videoState(page), displayedSeconds(page)]);
    gaps.push(shown - time);
    await page.waitForTimeout(1000);
  }
  const drift = Math.max(...gaps) - Math.min(...gaps);
  console.log(`[sync] display - video gaps: ${gaps.map((g) => g.toFixed(2)).join(', ')} (drift ${drift.toFixed(2)}s)`);
  expect(drift).toBeLessThan(1.5);
  await expect(page.getByText('Unable to load video')).toHaveCount(0);
});

test('pause and resume control the video', async ({ page }) => {
  await openDrive(page);
  await waitForPlayback(page);

  await page.getByLabel('Pause').click();
  await expect.poll(async () => (await videoState(page)).paused).toBe(true);
  const { time } = await videoState(page);
  await page.waitForTimeout(1000);
  expect((await videoState(page)).time).toBeCloseTo(time, 1);

  await page.getByLabel('Unpause').click();
  await expect.poll(async () => (await videoState(page)).time, { timeout: 5000 }).toBeGreaterThan(time + 0.5);
});

test('clicking the timeline seeks the video quickly', async ({ page }) => {
  await openDrive(page);
  await waitForPlayback(page);
  const { duration } = await videoState(page);

  const started = Date.now();
  await clickTimeline(page, 0.5);
  await expect.poll(async () => Math.abs((await videoState(page)).time - (duration / 2)), {
    timeout: 5000, intervals: [25],
  }).toBeLessThan(15);
  const latency = Date.now() - started;
  console.log(`[seek] timeline click -> video at target in ${latency}ms`);
  expect(latency).toBeLessThan(2000);
  await waitForPlayback(page, (duration / 2) - 15);
});

test('jump buttons move the video by 10 seconds', async ({ page }) => {
  await openDrive(page);
  await waitForPlayback(page, 2);
  await page.getByLabel('Pause').click();
  await expect.poll(async () => (await videoState(page)).paused).toBe(true);

  const before = (await videoState(page)).time;
  await page.getByLabel('Jump forward 10 seconds').click();
  await expect.poll(async () => (await videoState(page)).time - before).toBeCloseTo(10, 0);

  const middle = (await videoState(page)).time;
  await page.getByLabel('Jump back 10 seconds').click();
  await expect.poll(async () => middle - (await videoState(page)).time).toBeCloseTo(10, 0);
});

test('play speed changes the video rate', async ({ page }) => {
  await openDrive(page);
  await waitForPlayback(page);

  await page.getByLabel('Increase play speed by 1 step').click();
  await expect.poll(async () => (await videoState(page)).rate).toBeGreaterThan(1.5);
  await page.getByLabel('Decrease play speed by 1 step').click();
  await page.getByLabel('Decrease play speed by 1 step').click();
  await expect.poll(async () => (await videoState(page)).rate).toBeLessThan(0.75);
});

test('a route without video shows why', async ({ page }) => {
  await openDrive(page, DEMO_ROUTES.missingQcamera);
  await expect(page.getByText(/not uploaded|Unable to load video/)).toBeVisible({ timeout: 15000 });
});

test('a segment that fails to load shows an error instead of spinning forever', async ({ page }) => {
  await openDrive(page, ROUTE, { missingSegments: [0] });
  await expect(page.getByText(/not uploaded|Unable to load video/)).toBeVisible({ timeout: 15000 });
});

test('a slow network shows the loading state, then plays', async ({ page }) => {
  await openDrive(page, ROUTE, { segmentDelayMs: 2500 });
  await expect(page.getByRole('progressbar').or(page.locator('[role="status"]')).first()).toBeVisible();
  await waitForPlayback(page);
});

for (const [name, logId] of Object.entries(DEMO_ROUTES)) {
  test(`demo route "${name}" opens without errors`, async ({ page }) => {
    await openDrive(page, logId);
    await page.waitForTimeout(3000);
  });
}

test('the playback rate is not adjusted while playing', async ({ page }) => {
  await openDrive(page);
  await waitForPlayback(page, 2);

  const rates = new Set();
  for (let i = 0; i < 20; i += 1) {
    rates.add((await videoState(page)).rate);
    await page.waitForTimeout(200);
  }
  console.log(`[rate] observed playbackRate values: ${[...rates].join(', ')}`);
  expect([...rates]).toEqual([1]);
});

test('seeking while paused shows the new position and stays paused', async ({ page }) => {
  await openDrive(page);
  await waitForPlayback(page);
  await page.getByLabel('Pause').click();
  await expect.poll(async () => (await videoState(page)).paused).toBe(true);
  const { duration } = await videoState(page);

  await clickTimeline(page, 0.25);
  await expect.poll(async () => Math.abs((await videoState(page)).time - (duration / 4))).toBeLessThan(15);
  const { time } = await videoState(page);
  await page.waitForTimeout(1500);
  const after = await videoState(page);
  expect(after.paused).toBe(true);
  expect(after.time).toBeCloseTo(time, 1);
});

test('a deep link to a section plays only that section', async ({ page }) => {
  await serveFixtureVideo(page);
  await page.goto(`${drivePath(ROUTE)}/120/126`);
  await waitForPlayback(page, 110);
  const seen = [];
  for (let i = 0; i < 10; i += 1) {
    seen.push((await videoState(page)).time);
    await page.waitForTimeout(1000);
  }
  console.log(`[loop] video times: ${seen.map((t) => t.toFixed(1)).join(', ')}`);
  expect(Math.min(...seen)).toBeGreaterThan(119);
  expect(Math.max(...seen)).toBeLessThan(127.5);
});
