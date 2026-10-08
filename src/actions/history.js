import { LOCATION_CHANGE, replace } from 'connected-react-router';
import { parseUrl, urlFor } from '../url';
import { checkRoutesData, checkLastRoutesData, primeNav, streamNav, selectDevice, selectDrive } from './index';
import { api } from '../api/backend';

// Legacy links name a time range instead of a drive. Look the drive up and
// replace the URL, so going back doesn't land on the legacy link again.
function replaceLegacyUrl(pathname, dongleId, { start, end }) {
  return async (dispatch, getState) => {
    try {
      const routes = await api.routes.getRoutesSegments(dongleId, start, end);
      // the user may have moved on while the lookup ran
      if (routes?.length && getState().router.location.pathname === pathname) {
        dispatch(replace(urlFor({ dongleId, logId: routes[0].fullname.split('|')[1] })));
      }
    } catch (err) {
      console.error('Error fetching routes data for log ID conversion', err);
    }
  };
}

// The URL decides what is on screen. The UI calls navigate(), which changes
// the URL, and every location change (typed, linked, back/forward or pushed)
// is applied here. Whatever the URL doesn't change is kept.
export function applyUrl(location) {
  return (dispatch, getState) => {
    const { page, dongleId, logId, zoom, legacyRange } = parseUrl(location);
    const state = getState();

    if (page === 'home') {
      // on the first load, init() picks the device
      if (state.dongleId) {
        dispatch(replace(urlFor({ dongleId: state.dongleId })));
      }
      return;
    }

    const deviceChanged = dongleId && dongleId !== state.dongleId;
    if (deviceChanged) {
      dispatch(selectDevice(dongleId));
    }
    // select the drive before loading routes, so a linked drive is fetched directly
    dispatch(selectDrive(logId, zoom));
    dispatch(deviceChanged ? checkLastRoutesData() : checkRoutesData());

    if (legacyRange) {
      dispatch(replaceLegacyUrl(location.pathname, dongleId, legacyRange));
    }

    if ((page === 'prime') !== state.primeNav) {
      dispatch(primeNav(page === 'prime', false));
    }
    if ((page === 'stream') !== state.streamNav) {
      dispatch(streamNav(page === 'stream', false));
    }
  };
}

export const onHistoryMiddleware = ({ dispatch }) => (next) => (action) => {
  const result = next(action); // the router state has to update first
  if (action?.type === LOCATION_CHANGE) {
    dispatch(applyUrl(action.payload.location));
  }
  return result;
};
