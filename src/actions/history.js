import { LOCATION_CHANGE } from 'connected-react-router';
import { parseUrl } from '../url';
import { checkRoutesData, primeNav, streamNav, selectDevice, pushTimelineRange } from './index';
import { api } from '../api/backend';

export const onHistoryMiddleware = ({ dispatch, getState }) => (next) => async (action) => {
  if (!action) {
    return;
  }

  if (action.type === LOCATION_CHANGE && ['POP', 'REPLACE'].includes(action.payload.action)) {
    const state = getState();

    next(action); // must be first, otherwise breaks history

    const { page, dongleId, logId, zoom, legacyRange } = parseUrl(action.payload.location);
    if (dongleId && dongleId !== state.dongleId) {
      dispatch(selectDevice(dongleId, false, false));
    }

    if (legacyRange) {
      api.routes.getRoutesSegments(dongleId, legacyRange.start, legacyRange.end).then((routesData) => {
        if (routesData && routesData.length > 0) {
          const log_id = routesData[0].fullname.split('|')[1];
          const duration = routesData[0].end_time_utc_millis - routesData[0].start_time_utc_millis;

          dispatch(pushTimelineRange(log_id, 0, duration, true));
        }
      }).catch((err) => {
        console.error('Error fetching routes data for log ID conversion', err);
      });
    }

    if (logId || state.selectedRouteId) {
      dispatch(pushTimelineRange(logId, zoom?.start ?? null, zoom?.end ?? null, false));
    }

    if (dongleId && dongleId !== state.dongleId) {
      dispatch(checkRoutesData());
    }

    const pathPrimeNav = page === 'prime';
    if (pathPrimeNav !== state.primeNav) {
      dispatch(primeNav(pathPrimeNav));
    }

    const pathStreamNav = page === 'stream';
    if (pathStreamNav !== state.streamNav) {
      dispatch(streamNav(pathStreamNav, false));
    }
  } else {
    next(action);
  }
};
