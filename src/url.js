// Every URL connect understands. parseUrl() is the only code that reads one
// and urlFor() the only code that writes one.
//
//   /                               home, replaced by the selected device
//   /referrals                      referrals
//   /:dongleId                      device dashboard
//   /:dongleId/prime                comma prime
//   /:dongleId/stream               live stream
//   /:dongleId/:logId               drive
//   /:dongleId/:logId/:start/:end   part of a drive, in seconds from its start
//   /:dongleId/:start/:end          legacy time range in unix ms, replaced by its drive

const DONGLE_ID = /^[a-f0-9]{16}$/;
const LOG_ID = /^[a-f0-9-]{20}$/;
const DEVICE_PAGES = ['prime', 'stream'];

// whole numbers with start < end, scaled to milliseconds
function parseRange(start, end, scale) {
  if (!/^\d+$/.test(start) || !/^\d+$/.test(end)) {
    return null;
  }
  const range = { start: Number(start) * scale, end: Number(end) * scale };
  // a safe end bounds the start too
  return Number.isSafeInteger(range.end) && range.start < range.end ? range : null;
}

/**
 * @typedef {object} Location
 * @property {string} page home, referrals, dashboard, prime, stream, drive or legacy
 * @property {string|null} dongleId
 * @property {string|null} logId the open drive
 * @property {{ start: number, end: number }|null} zoom part of the drive, in ms from its start
 * @property {{ start: number, end: number }|null} legacyRange in unix ms
 */

/** @returns {Location} */
export function parseUrl({ pathname }) {
  const [first, ...rest] = pathname.split('/').filter(Boolean);
  const home = { page: 'home', dongleId: null, logId: null, zoom: null, legacyRange: null };

  if (first === 'referrals' && rest.length === 0) {
    return { ...home, page: 'referrals' };
  }
  if (!DONGLE_ID.test(first)) {
    return home;
  }

  const device = { ...home, dongleId: first };
  if (rest.length === 1 && DEVICE_PAGES.includes(rest[0])) {
    return { ...device, page: rest[0] };
  }
  if (LOG_ID.test(rest[0])) {
    const zoom = rest.length === 3 ? parseRange(rest[1], rest[2], 1000) : null;
    return { ...device, page: 'drive', logId: rest[0], zoom };
  }
  const legacyRange = rest.length === 2 ? parseRange(rest[0], rest[1], 1) : null;
  if (legacyRange) {
    return { ...device, page: 'legacy', legacyRange };
  }
  return { ...device, page: 'dashboard' };
}

/** @param {Partial<Location>} location */
export function urlFor({ page, dongleId, logId, zoom }) {
  if (page === 'referrals') {
    return '/referrals';
  }
  if (!dongleId) {
    return '/';
  }
  if (DEVICE_PAGES.includes(page)) {
    return `/${dongleId}/${page}`;
  }
  if (!logId) {
    return `/${dongleId}`;
  }
  if (!zoom) {
    return `/${dongleId}/${logId}`;
  }
  // round outwards, so a short selection keeps a non-empty range
  return `/${dongleId}/${logId}/${Math.floor(zoom.start / 1000)}/${Math.ceil(zoom.end / 1000)}`;
}
