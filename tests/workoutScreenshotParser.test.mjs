import test from 'node:test';
import assert from 'node:assert/strict';
import {
    formatWorkoutDuration,
    parseWorkoutDurationSeconds,
    parseWorkoutDate,
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
    assert.equal(parsed.distance_value, 4.05);
    assert.equal(parsed.distance_unit, 'km');
    assert.equal(parsed.moving_time, 1571);
    assert.equal(parsed.location_text, 'Memphis, Tennessee');
    assert.equal(parsed.device_text, 'Apple Watch Series 10');
    assert.equal(parsed.average_pace_text, '6:27 /km');
    assert.equal(parsed.start_date, '2026-07-13T00:29:00.000Z');
    assert.equal(parsed.source_timezone, 'America/Chicago');
});

test('parses common workout duration strings', () => {
    assert.equal(parseWorkoutDurationSeconds('26m 11s'), 1571);
    assert.equal(parseWorkoutDurationSeconds('1h 02m 03s'), 3723);
    assert.equal(parseWorkoutDurationSeconds('6:27'), 387);
    assert.equal(formatWorkoutDuration(1571), '26m 11s');
});

test('resolves Today and Yesterday relative to the upload reference date', () => {
    const referenceDate = new Date('2026-07-20T12:00:00-05:00');

    const today = parseWorkoutScreenshotText(`
        Today at 7:36 PM · Apple Watch Series 10
        Evening Run
        Distance 5.42 km
        Pace 6:37 /km
        Time 35m 56s
    `, referenceDate);
    const yesterday = parseWorkoutScreenshotText(`
        Yesterday
        Evening Run
        Distance 6.56 km
        Pace 6:36 /km
        Time 43m 21s
    `, referenceDate);

    assert.equal(new Date(today.start_date).getDate(), 20);
    assert.equal(new Date(yesterday.start_date).getDate(), 19);
    assert.equal(today.distance, 5420);
    assert.equal(yesterday.distance, 6560);
    assert.equal(today.distance_unit, 'km');
    assert.equal(yesterday.distance_unit, 'km');
});

test('resolves relative OCR dates in the selected browser timezone, not the server timezone', () => {
    const referenceDate = new Date('2026-07-24T00:38:00.000Z');
    const parsed = parseWorkoutScreenshotText(`
        Today at 7:38 PM · Apple Watch Series 10
        Memphis, Tennessee
        Evening Run
        Distance 5.42 km
        Pace 6:37 /km
        Time 35m 56s
    `, referenceDate, 'America/Chicago');

    assert.equal(parsed.start_date, '2026-07-24T00:38:00.000Z');
    assert.equal(parsed.source_timezone, 'America/Chicago');
});

test('parses absolute screenshot dates in the selected browser timezone', () => {
    const parsed = parseWorkoutDate(
        'July 23, 2026 at 7:38 PM',
        new Date('2026-07-24T12:00:00.000Z'),
        'America/Chicago'
    );

    assert.equal(parsed.toISOString(), '2026-07-24T00:38:00.000Z');
});

test('normalizes mile distances while preserving the source unit', () => {
    const parsed = parseWorkoutScreenshotText(`
        Today at 7:36 PM · Apple Watch Series 10
        Evening Run
        Distance 3.10 mi
        Pace 10:14 /mi
        Time 31m 43s
    `, new Date('2026-07-20T12:00:00-05:00'));

    assert.equal(parsed.distance_unit, 'mi');
    assert.equal(parsed.distance_value, 3.1);
    assert.equal(parsed.distance, 4989);
});
