import test from 'node:test';
import assert from 'node:assert/strict';

import { formatStravaApiError } from '../utils/stravaError.js';

test('surfaces inactive application status from Strava details', () => {
  const result = formatStravaApiError({
    error: 'Strava API error: 403',
    details: '{"message":"Forbidden","errors":[{"resource":"Application","field":"Status","code":"Inactive"}]}'
  }, 'Failed to sync activities');

  assert.equal(
    result,
    'Failed to sync activities: Forbidden (Application Status = Inactive)'
  );
});

test('falls back to top-level error when details are missing', () => {
  const result = formatStravaApiError(
    { error: 'Failed to exchange token' },
    'Authorization failed'
  );

  assert.equal(result, 'Authorization failed: Failed to exchange token');
});
