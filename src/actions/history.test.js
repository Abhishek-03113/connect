/* eslint-disable no-import-assign */
import { vi } from 'vitest';
import { LOCATION_CHANGE, replace } from 'connected-react-router';

import { drives as Drives } from '../api';
import { onHistoryMiddleware } from './history';
import * as actions from './index';

vi.mock('../api', () => ({
  account: {},
  auth: {},
  billing: {},
  devices: { fetchDeviceStats: vi.fn() },
  drives: { getRoutesSegments: vi.fn() },
  raw: {},
  video: {},
}));
vi.mock('./index', () => ({
  selectDevice: vi.fn(), selectDrive: vi.fn(), checkRoutesData: vi.fn(), checkLastRoutesData: vi.fn(),
}));

const DONGLE = '0000aaaa0000aaaa';
const OTHER = '1111bbbb1111bbbb';
const LOG = '2026-08-06--12-00-00';
const LEGACY = `/${DONGLE}/1000/2000`;

function create(state = {}, pathname = `/${DONGLE}`) {
  const getState = vi.fn(() => ({
    dongleId: DONGLE, router: { location: { pathname } }, ...state,
  }));
  const dispatch = vi.fn((action) => (typeof action === 'function' ? action(dispatch, getState) : action));
  const next = vi.fn(() => 'next result');
  const visit = (path, historyAction = 'PUSH') => onHistoryMiddleware({ dispatch, getState })(next)({
    type: LOCATION_CHANGE, payload: { action: historyAction, location: { pathname: path } },
  });
  return { dispatch, next, visit };
}

const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });
const replaced = (dispatch) => dispatch.mock.calls.some(([action]) => action?.type === replace('/').type);

beforeEach(() => {
  vi.clearAllMocks();
  for (const name of Object.keys(actions)) {
    actions[name].mockImplementation((...args) => ({ action: name, args }));
  }
});

describe('history middleware', () => {
  it('passes other actions through untouched', () => {
    const { dispatch, next } = create();
    const action = { type: 'TEST' };
    expect(onHistoryMiddleware({ dispatch })(next)(action)).toBe('next result');
    expect(next).toHaveBeenCalledWith(action);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each(['PUSH', 'POP', 'REPLACE'])('applies a %s to state after the router', (historyAction) => {
    const { next, visit } = create();
    visit(`/${OTHER}`, historyAction);
    expect(next).toHaveBeenCalledBefore(actions.selectDevice);
    expect(actions.selectDevice).toHaveBeenCalledWith(OTHER);
    expect(actions.selectDrive).toHaveBeenCalledWith(null, null);
    expect(actions.checkLastRoutesData).toHaveBeenCalledOnce();
  });

  it('keeps the device and its drives when the device is unchanged', () => {
    const { visit } = create();
    visit(`/${DONGLE}`);
    expect(actions.selectDevice).not.toHaveBeenCalled();
    expect(actions.checkLastRoutesData).not.toHaveBeenCalled();
    expect(actions.checkRoutesData).toHaveBeenCalledOnce();
  });

  it('selects the drive before loading routes, so a linked drive is fetched directly', () => {
    const { visit } = create({ dongleId: null });
    visit(`/${DONGLE}/${LOG}/10/20`);
    expect(actions.selectDrive).toHaveBeenCalledWith(LOG, { start: 10000, end: 20000 });
    expect(actions.selectDrive).toHaveBeenCalledBefore(actions.checkLastRoutesData);
  });

  it('keeps the device on pages without one', () => {
    const { visit } = create();
    visit('/referrals');
    expect(actions.selectDevice).not.toHaveBeenCalled();
    expect(actions.selectDrive).toHaveBeenCalledWith(null, null);
  });

  it('replaces home with the selected device', () => {
    const { dispatch, visit } = create();
    visit('/');
    expect(dispatch).toHaveBeenCalledWith(replace(`/${DONGLE}`));
    expect(actions.selectDrive).not.toHaveBeenCalled();
  });

  it('leaves home to init() before a device is selected', () => {
    const { dispatch, visit } = create({ dongleId: null });
    visit('/');
    expect(dispatch).toHaveBeenCalledOnce();
  });
});

describe('legacy links', () => {
  const route = { fullname: `${DONGLE}|${LOG}` };

  it('are replaced by their drive', async () => {
    Drives.getRoutesSegments.mockResolvedValue([route]);
    const { dispatch, visit } = create({}, LEGACY);
    visit(LEGACY);
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledWith(replace(`/${DONGLE}/${LOG}`)));
    expect(Drives.getRoutesSegments).toHaveBeenCalledWith(DONGLE, 1000, 2000);
  });

  it('are left alone once the user has moved on', async () => {
    Drives.getRoutesSegments.mockResolvedValue([route]);
    const { dispatch, visit } = create({}, `/${DONGLE}`);
    visit(LEGACY);
    await flush();
    expect(replaced(dispatch)).toBe(false);
  });

  it.each([null, []])('stay for an empty lookup (%j)', async (routes) => {
    Drives.getRoutesSegments.mockResolvedValue(routes);
    const { dispatch, visit } = create({}, LEGACY);
    visit(LEGACY);
    await flush();
    expect(replaced(dispatch)).toBe(false);
  });

  it('stay when the lookup fails', async () => {
    const error = new Error('lookup failed');
    Drives.getRoutesSegments.mockRejectedValue(error);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { visit } = create({}, LEGACY);
    visit(LEGACY);
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledWith('Error fetching routes data for log ID conversion', error));
    consoleError.mockRestore();
  });
});
