import { describe, expect, it } from 'vitest';

import { parseUrl, settingsUrl, urlFor } from './url';

const DONGLE = '0000aaaa0000aaaa';
const LOG = '2026-08-06--12-00-00';

const home = { page: 'home', dongleId: null, logId: null, zoom: null, legacyRange: null, settings: null };
const device = { ...home, dongleId: DONGLE };

describe('parseUrl', () => {
  it.each([
    ['/', home],
    ['/auth/code/provider', home],
    ['/demo', home],
    ['/referrals', { ...home, page: 'referrals' }],
    ['/referrals/extra', home],
    [`/${DONGLE}`, { ...device, page: 'dashboard' }],
    [`/${DONGLE}/`, { ...device, page: 'dashboard' }],
    [`/${DONGLE}/prime`, { ...device, page: 'prime' }],
    [`/${DONGLE}/stream`, { ...device, page: 'stream' }],
    [`/${DONGLE}/prime/extra`, { ...device, page: 'dashboard' }],
    [`/${DONGLE}/unknown`, { ...device, page: 'dashboard' }],
    [`/${DONGLE}/${LOG}`, { ...device, page: 'drive', logId: LOG }],
    [`/${DONGLE}/${LOG}/556/610`, { ...device, page: 'drive', logId: LOG, zoom: { start: 556000, end: 610000 } }],
    [`/${DONGLE}/${LOG}/0/20`, { ...device, page: 'drive', logId: LOG, zoom: { start: 0, end: 20000 } }],
    [`/${DONGLE}/1000/2000`, { ...device, page: 'legacy', legacyRange: { start: 1000, end: 2000 } }],
  ])('reads %s', (pathname, expected) => {
    expect(parseUrl({ pathname })).toEqual(expected);
  });

  it.each([
    ['reversed', '20/10'],
    ['empty', '10/10'],
    ['negative', '-10/20'],
    ['fractional', '1.5/20'],
    ['non-numeric', 'a/b'],
    ['unsafe', `0/${'9'.repeat(20)}`],
    ['incomplete', '10'],
  ])('opens the whole drive for a %s range', (_name, range) => {
    expect(parseUrl({ pathname: `/${DONGLE}/${LOG}/${range}` })).toEqual({ ...device, page: 'drive', logId: LOG });
  });

  it.each([
    ['reversed', '2000/1000'],
    ['unsafe', `0/${'9'.repeat(20)}`],
    ['extra segment', '1000/2000/3000'],
  ])('opens the dashboard for a %s legacy range', (_name, range) => {
    expect(parseUrl({ pathname: `/${DONGLE}/${range}` })).toEqual({ ...device, page: 'dashboard' });
  });

  it.each([
    ['too short', DONGLE.slice(1)],
    ['too long', `${DONGLE}0`],
    ['uppercase', DONGLE.toUpperCase()],
  ])('ignores a %s dongle id', (_name, dongleId) => {
    expect(parseUrl({ pathname: `/${dongleId}/${LOG}` })).toEqual(home);
  });

  it.each([
    [`?settings=${DONGLE}`, DONGLE],
    [`?r=x&settings=${DONGLE}`, DONGLE],
    ['?settings=nope', null],
    ['?settings', null],
    ['', null],
  ])('reads settings from %j', (search, expected) => {
    expect(parseUrl({ pathname: `/${DONGLE}/${LOG}`, search }).settings).toBe(expected);
  });
});

describe('settingsUrl', () => {
  it.each([
    ['opens over a drive', { pathname: `/${DONGLE}/${LOG}`, search: '' }, DONGLE, `/${DONGLE}/${LOG}?settings=${DONGLE}`],
    ['keeps other params', { pathname: '/referrals', search: '?r=x' }, DONGLE, `/referrals?r=x&settings=${DONGLE}`],
    ['closes', { pathname: `/${DONGLE}`, search: `?settings=${DONGLE}` }, null, `/${DONGLE}`],
    ['closes and keeps other params', { pathname: `/${DONGLE}`, search: `?settings=${DONGLE}&r=x` }, null, `/${DONGLE}?r=x`],
  ])('%s', (_name, location, dongleId, expected) => {
    expect(settingsUrl(location, dongleId)).toBe(expected);
  });
});

describe('urlFor', () => {
  it.each([
    [{ page: 'home' }, '/'],
    [{ page: 'referrals', dongleId: DONGLE }, '/referrals'],
    [{ page: 'dashboard', dongleId: DONGLE }, `/${DONGLE}`],
    [{ page: 'prime', dongleId: DONGLE, logId: LOG }, `/${DONGLE}/prime`],
    [{ page: 'stream', dongleId: DONGLE }, `/${DONGLE}/stream`],
    [{ dongleId: DONGLE, logId: LOG }, `/${DONGLE}/${LOG}`],
    [{ dongleId: DONGLE, logId: LOG, zoom: { start: 1000, end: 2000 } }, `/${DONGLE}/${LOG}/1/2`],
    [{ dongleId: DONGLE, logId: LOG, zoom: { start: 1500, end: 1700 } }, `/${DONGLE}/${LOG}/1/2`],
  ])('writes %j', (location, expected) => {
    expect(urlFor(location)).toBe(expected);
  });

  it.each([
    '/',
    '/referrals',
    `/${DONGLE}`,
    `/${DONGLE}/prime`,
    `/${DONGLE}/stream`,
    `/${DONGLE}/${LOG}`,
    `/${DONGLE}/${LOG}/556/610`,
  ])('writes back what it reads for %s', (pathname) => {
    expect(urlFor(parseUrl({ pathname }))).toBe(pathname);
  });
});
