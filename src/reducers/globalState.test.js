import { vi } from 'vitest';

import reducer from './globalState';
import { ACTION_SELECT_DRIVE } from '../actions/types';

// utils pulls in the store, which isn't needed here
vi.mock('../utils', () => ({ emptyDevice: {} }));

const LOG = '2026-08-06--12-00-00';
const route = { log_id: LOG, duration: 60000 };
const files = { some: 'files' };

const selectDrive = (state, logId, zoom = null) => reducer(
  { routes: [route], selectedRouteId: null, currentRoute: null, zoom: null, files, ...state },
  { type: ACTION_SELECT_DRIVE, logId, zoom },
);

describe('selecting a drive', () => {
  it('opens the whole drive', () => {
    const state = selectDrive({}, LOG);
    expect(state.currentRoute).toBe(route);
    expect(state.zoom).toEqual({ start: 0, end: 60000 });
  });

  it('opens a range, clamped to the drive', () => {
    expect(selectDrive({}, LOG, { start: 10000, end: 61000 }).zoom).toEqual({ start: 10000, end: 60000 });
  });

  it('keeps the requested range until the drive is loaded', () => {
    const state = selectDrive({ routes: null }, LOG, { start: 10000, end: 20000 });
    expect(state.currentRoute).toBeNull();
    expect(state.zoom).toEqual({ start: 10000, end: 20000 });
  });

  it('keeps a drive that is not in the loaded list', () => {
    const opened = { log_id: LOG, duration: 30000 };
    const state = selectDrive({ routes: [], selectedRouteId: LOG, currentRoute: opened }, LOG, { start: 0, end: 10000 });
    expect(state.currentRoute).toBe(opened);
  });

  it('keeps the same zoom object, and files, for an unchanged range', () => {
    const zoom = { start: 10000, end: 20000 };
    const state = selectDrive({ selectedRouteId: LOG, currentRoute: route, zoom }, LOG, { start: 10000, end: 20000 });
    expect(state.zoom).toBe(zoom);
    expect(state.files).toBe(files);
  });

  it('keeps files while zooming in', () => {
    const zoom = { start: 0, end: 60000 };
    expect(selectDrive({ selectedRouteId: LOG, currentRoute: route, zoom }, LOG, { start: 10000, end: 20000 }).files).toBe(files);
  });

  it('drops files while zooming out', () => {
    const zoom = { start: 10000, end: 20000 };
    expect(selectDrive({ selectedRouteId: LOG, currentRoute: route, zoom }, LOG).files).toBeNull();
  });

  it('drops files when switching drive', () => {
    expect(selectDrive({ routes: null, selectedRouteId: 'other' }, LOG).files).toBeNull();
  });

  it('closes the drive', () => {
    const state = selectDrive({ selectedRouteId: LOG, currentRoute: route, zoom: { start: 0, end: 60000 } }, null);
    expect(state.selectedRouteId).toBeNull();
    expect(state.currentRoute).toBeNull();
    expect(state.zoom).toBeNull();
  });
});
