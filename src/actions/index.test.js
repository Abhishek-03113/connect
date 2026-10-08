import { vi } from 'vitest';
import { push } from 'connected-react-router';

import { navigate, selectDrive } from './index';
import { resetPlayback, selectLoop } from '../timeline/playback';

vi.mock('../timeline/playback', () => ({
  reducer: (state) => state,
  resetPlayback: vi.fn(() => ({ type: 'reset' })),
  selectLoop: vi.fn(() => ({ type: 'loop' })),
}));

const DONGLE = '0000aaaa0000aaaa';
const LOG = '2026-08-06--12-00-00';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('navigate', () => {
  const run = (location, pathname, search = '') => {
    const dispatch = vi.fn();
    navigate(location)(dispatch, () => ({ dongleId: DONGLE, router: { location: { pathname, search } } }));
    return dispatch;
  };

  it.each([
    ['the current device', {}, `/${DONGLE}`],
    ['another device', { dongleId: '1111bbbb1111bbbb' }, '/1111bbbb1111bbbb'],
    ['a drive', { logId: LOG }, `/${DONGLE}/${LOG}`],
    ['a drive range', { logId: LOG, zoom: { start: 1000, end: 2000 } }, `/${DONGLE}/${LOG}/1/2`],
    ['prime', { page: 'prime' }, `/${DONGLE}/prime`],
  ])('pushes %s', (_name, location, expected) => {
    expect(run(location, '/referrals')).toHaveBeenCalledWith(push(expected));
  });

  it('does nothing when already there', () => {
    expect(run({ logId: LOG }, `/${DONGLE}/${LOG}`)).not.toHaveBeenCalled();
  });

  it('leaves the query behind', () => {
    expect(run({}, `/${DONGLE}`, '?settings')).toHaveBeenCalledWith(push(`/${DONGLE}`));
  });
});

describe('selectDrive', () => {
  const run = (zoomBefore, zoomAfter) => {
    const dispatch = vi.fn();
    const getState = vi.fn()
      .mockReturnValueOnce({ zoom: zoomBefore })
      .mockReturnValueOnce({ zoom: zoomAfter });
    selectDrive(LOG, zoomAfter)(dispatch, getState);
    return dispatch;
  };

  it('restarts playback over a new range', () => {
    const range = { start: 1000, end: 2000 };
    const dispatch = run(null, range);
    expect(dispatch).toHaveBeenCalledWith({ type: 'ACTION_SELECT_DRIVE', logId: LOG, zoom: range });
    expect(resetPlayback).toHaveBeenCalledOnce();
    expect(selectLoop).toHaveBeenCalledWith(1000, 2000);
  });

  it('keeps playback when the range is unchanged', () => {
    const range = { start: 1000, end: 2000 };
    run(range, range);
    expect(resetPlayback).not.toHaveBeenCalled();
  });
});
