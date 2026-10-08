import { vi } from 'vitest';

import { getPageViewEventLocation } from './analytics';

// utils pulls in the store, which isn't needed here
vi.mock('./utils', () => ({ deviceIsOnline: vi.fn() }));

const DONGLE = '0000aaaa0000aaaa';
const LOG = '2026-08-06--12-00-00';

describe('page view location', () => {
  it.each([
    ['/', ''],
    ['/referrals', '/referrals'],
    ['/auth/', '/auth'],
    [`/${DONGLE}/`, '/<dongleId>'],
    [`/${DONGLE}/prime`, '/<dongleId>/prime'],
    [`/${DONGLE}/${LOG}`, `/<dongleId>/${LOG}`],
    [`/${DONGLE}/${LOG}/10/20`, `/<dongleId>/${LOG}/<zoomStart>/<zoomEnd>`],
    [`/${DONGLE}/1000/2000`, '/<dongleId>/<zoomStart>/<zoomEnd>'],
  ])('hides ids and times in %s', (pathname, expected) => {
    expect(getPageViewEventLocation({ pathname })).toBe(expected);
  });
});
