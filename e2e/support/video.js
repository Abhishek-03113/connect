import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';

const VIDEO_DIR = fileURLToPath(new URL('../fixtures/video/', import.meta.url));
const FIXTURE_ORIGIN = 'https://video.fixture.test';
const CORS = { 'access-control-allow-origin': '*' };

export const DEMO_DONGLE_ID = 'deadbeefdeadbeef';
// demo route ids, see TEST_CASES in src/api/demo.js
export const DEMO_ROUTES = {
  epoch: '00000000--0000000001',
  epochSegment: '00000000--0000000002',
  missingGps: '00000000--0000000003',
  missingGpsSegment: '00000000--0000000004',
  missingQlog: '00000000--0000000005',
  missingQlogSegment: '00000000--0000000006',
  missingQcamera: '00000000--0000000007',
  missingQcameraSegment: '00000000--0000000008',
  missingThumbnails: '00000000--0000000009',
  missingThumbnailsSegment: '00000000--0000000010',
};

export const drivePath = (logId) => `/${DEMO_DONGLE_ID}/${logId}`;

/**
 * Serve the qcamera stream from the local VP9/Opus fixture (see fixtures/make-video.sh).
 * Playwright's Chromium cannot decode the real H.264 stream.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ segmentDelayMs?: number, missingSegments?: number[] }} [options]
 */
export async function serveFixtureVideo(page, { segmentDelayMs = 0, missingSegments = [] } = {}) {
  const master = [
    '#EXTM3U',
    '#EXT-X-STREAM-INF:BANDWIDTH=80000,CODECS="vp09.00.10.08,opus",RESOLUTION=320x200',
    `${FIXTURE_ORIGIN}/media.m3u8`,
    '',
  ].join('\n');
  const media = readFileSync(`${VIDEO_DIR}media.m3u8`, 'utf8')
    .replace('URI="init.mp4"', `URI="${FIXTURE_ORIGIN}/init.mp4"`)
    .replace(/^(\d+\.m4s)$/gm, `${FIXTURE_ORIGIN}/$1`);

  await page.route('**/v1/route/*/qcamera.m3u8*', (route) => {
    const url = new URL(route.request().url());
    // like the real API: a stream without share credentials does not resolve
    if (!url.searchParams.get('sig')) {
      return route.fulfill({ status: 404, headers: CORS, json: { error: 1, status_code: 404 } });
    }
    return route.fulfill({ headers: CORS, contentType: 'application/vnd.apple.mpegurl', body: master });
  });

  await page.route(`${FIXTURE_ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (name === 'media.m3u8') {
      return route.fulfill({ headers: CORS, contentType: 'application/vnd.apple.mpegurl', body: media });
    }
    const segment = Number.parseInt(name, 10);
    if (missingSegments.includes(segment)) {
      return route.fulfill({ status: 404, headers: CORS, body: 'not found' });
    }
    if (segmentDelayMs && !Number.isNaN(segment)) {
      await new Promise((resolve) => { setTimeout(resolve, segmentDelayMs); });
    }
    return route.fulfill({ headers: CORS, contentType: 'video/mp4', body: readFileSync(`${VIDEO_DIR}${name}`) });
  });
}

/** @param {import('@playwright/test').Page} page */
export function videoState(page) {
  return page.locator('video').evaluate((v) => ({
    time: v.currentTime,
    paused: v.paused,
    rate: v.playbackRate,
    readyState: v.readyState,
    duration: v.duration,
  }));
}

/**
 * Seconds of day shown by the time display ("HH:mm:ss – segment"), or null.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function displayedSeconds(page) {
  const text = await page.getByText(/^\d\d:\d\d:\d\d/).first().textContent();
  const match = text && text.match(/^(\d\d):(\d\d):(\d\d)/);
  if (!match) return null;
  return (Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3]);
}

/** Wait until the video is actually advancing. */
export async function waitForPlayback(page, minTime = 1) {
  await expect.poll(async () => (await videoState(page)).time, { timeout: 20000 }).toBeGreaterThan(minTime);
}

// Fail any test that throws an uncaught error in the page.
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await use(page);
    expect(errors, 'uncaught page errors').toEqual([]);
  },
});

export { expect };
