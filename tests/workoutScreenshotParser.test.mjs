import test from 'node:test';
import assert from 'node:assert/strict';
import {
    formatWorkoutDuration,
    parseWorkoutDurationSeconds,
    parseWorkoutScreenshotText
} from '../server/utils/workoutScreenshotParser.js';

test('parses Strava screenshot OCR text into workout fields', () => {
    const referenceDate = new Date('2026-07-13T12:00:00-05:00');
    const parsed = parseWorkoutScreenshotText(`
        Pete Kim
        Yesterday at 7:29 PM · Apple Watch Series 10
        Memphis, Tennessee
        Evening Run
        Distance
        4.05 km
        Pace
        6:27 /km
        Time
        26m 11s
    `, referenceDate);

    assert.equal(parsed.name, 'Evening Run');
    assert.equal(parsed.sport_type, 'Run');
    assert.equal(parsed.distance, 4050);
    assert.equal(parsed.moving_time, 1571);
    assert.equal(parsed.location_text, 'Memphis, Tennessee');
    assert.equal(parsed.device_text, 'Apple Watch Series 10');
    assert.equal(parsed.average_pace_text, '6:27 /km');
    assert.equal(parsed.start_date, '2026-07-13T00:29:00.000Z');
});

test('parses common workout duration strings', () => {
    assert.equal(parseWorkoutDurationSeconds('26m 11s'), 1571);
    assert.equal(parseWorkoutDurationSeconds('1h 02m 03s'), 3723);
    assert.equal(parseWorkoutDurationSeconds('6:27'), 387);
    assert.equal(formatWorkoutDuration(1571), '26m 11s');
});
