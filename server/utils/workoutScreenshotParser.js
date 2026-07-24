import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const DEFAULT_TIME_ZONE = 'America/Chicago';

const MONTH_NAMES = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11
};

const ACTIVITY_TYPES = [
    { pattern: /\brun(?:ning)?\b/i, value: 'Run' },
    { pattern: /\bwalk(?:ing)?\b/i, value: 'Walk' },
    { pattern: /\b(?:ride|bike|cycling)\b/i, value: 'Ride' },
    { pattern: /\bhike\b/i, value: 'Hike' }
];

const normalizeTimeZone = (timeZone) => {
    const candidate = String(timeZone || '').trim();
    if (!candidate) return DEFAULT_TIME_ZONE;

    try {
        Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
        return candidate;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
};

const getTimeParts = (text) => {
    const timeMatch = text.match(/(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (!timeMatch) return null;

    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] || 0);
    const meridiem = timeMatch[3].toUpperCase();
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    return { hours, minutes };
};

const zonedWallDateToUtc = (year, month, day, timeParts, timeZone) => {
    const wallDate = new Date(year, month, day, timeParts?.hours || 0, timeParts?.minutes || 0, 0, 0);
    return fromZonedTime(wallDate, timeZone);
};

export const parseWorkoutDurationSeconds = (value = '') => {
    const text = String(value).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!text) return null;

    const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);
    const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*m/);
    const secondMatch = text.match(/(\d+(?:\.\d+)?)\s*s/);

    if (hourMatch || minuteMatch || secondMatch) {
        return Math.round(
            (Number(hourMatch?.[1] || 0) * 3600) +
            (Number(minuteMatch?.[1] || 0) * 60) +
            Number(secondMatch?.[1] || 0)
        );
    }

    const clockMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (clockMatch) {
        const first = Number(clockMatch[1]);
        const second = Number(clockMatch[2]);
        const third = clockMatch[3] ? Number(clockMatch[3]) : null;
        return third === null ? (first * 60) + second : (first * 3600) + (second * 60) + third;
    }

    return null;
};

export const formatWorkoutDuration = (seconds = 0) => {
    const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }

    return `${minutes}m ${remainingSeconds}s`;
};

export const parseWorkoutDate = (value = '', referenceDate = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (!text) return null;

    const resolvedTimeZone = normalizeTimeZone(timeZone);
    const referenceWallDate = toZonedTime(referenceDate, resolvedTimeZone);
    const timeParts = getTimeParts(text);

    const lower = text.toLowerCase();
    if (lower.includes('yesterday') || lower.includes('today')) {
        const dayOffset = lower.includes('yesterday') ? -1 : 0;
        const wallDate = new Date(
            referenceWallDate.getFullYear(),
            referenceWallDate.getMonth(),
            referenceWallDate.getDate() + dayOffset,
            timeParts?.hours || 0,
            timeParts?.minutes || 0,
            0,
            0
        );
        return fromZonedTime(wallDate, resolvedTimeZone);
    }

    const absoluteMatch = text.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?/);
    if (absoluteMatch) {
        const month = MONTH_NAMES[absoluteMatch[1].toLowerCase()];
        if (month !== undefined) {
            const year = absoluteMatch[3] ? Number(absoluteMatch[3]) : referenceWallDate.getFullYear();
            return zonedWallDateToUtc(year, month, Number(absoluteMatch[2]), timeParts, resolvedTimeZone);
        }
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const findMetricAfterLabel = (text, label, unitPattern) => {
    const pattern = new RegExp(`${label}\\s+([0-9]+(?:[.,][0-9]+)?)\\s*${unitPattern}`, 'i');
    return text.match(pattern)?.[1] || null;
};

export const parseWorkoutScreenshotText = (ocrText = '', referenceDate = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
    const resolvedTimeZone = normalizeTimeZone(timeZone);
    const text = String(ocrText || '').replace(/\r/g, '\n');
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const compact = text.replace(/\s+/g, ' ').trim();

    const titleMatch = compact.match(/\b((?:Morning|Afternoon|Evening|Night|Lunch|Virtual)?\s*(?:Run|Walk|Ride|Bike|Hike))\b/i);
    const name = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Workout';

    const activityType = ACTIVITY_TYPES.find(({ pattern }) => pattern.test(name) || pattern.test(compact))?.value || 'Workout';

    const distanceValue = findMetricAfterLabel(compact, 'Distance', '(?:km|kilometers?|mi|miles?)') ||
        compact.match(/\b([0-9]+(?:[.,][0-9]+)?)\s*(km|kilometers?|mi|miles?)\b/i)?.[1];
    const rawDistanceUnit = compact.match(/\b[0-9]+(?:[.,][0-9]+)?\s*(km|kilometers?|mi|miles?)\b/i)?.[1]?.toLowerCase() || 'km';
    const distanceUnit = rawDistanceUnit.startsWith('mi') ? 'mi' : 'km';
    const distanceNumber = distanceValue ? Number(distanceValue.replace(',', '.')) : null;
    const distanceMeters = distanceNumber === null
        ? null
        : Math.round(distanceNumber * (distanceUnit.startsWith('mi') ? 1609.344 : 1000));

    const timeValue = compact.match(/\bTime\s+((?:\d+\s*h\s*)?(?:\d+\s*m\s*)?(?:\d+\s*s)?)\b/i)?.[1]?.trim() ||
        compact.match(/\b(\d+\s*m\s*\d+\s*s)\b/i)?.[1]?.trim() ||
        compact.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/)?.[1];
    const movingTimeSeconds = parseWorkoutDurationSeconds(timeValue);

    const paceValue = compact.match(/\bPace\s+([0-9]+:[0-9]{2}\s*\/\s*(?:km|mi))\b/i)?.[1] ||
        compact.match(/\b([0-9]+:[0-9]{2}\s*\/\s*(?:km|mi))\b/i)?.[1] ||
        null;

    const dateText = compact.match(/\b((?:Yesterday|Today)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM))?)\b/i)?.[1] ||
        compact.match(/\b([A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b/i)?.[1] ||
        null;
    const startDate = dateText ? parseWorkoutDate(dateText, referenceDate, resolvedTimeZone) : null;

    const locationLine = lines.find(line => /^[A-Z][A-Za-z .'-]+,\s*[A-Z][A-Za-z .'-]+$/.test(line));
    const locationMatch = compact.match(/\b([A-Z][A-Za-z .'-]+,\s*[A-Z][A-Za-z .'-]+)\b/);
    const deviceLineMatch = lines.map(line => line.match(/\b(Apple Watch[^·\n]+)\b/i)).find(Boolean);
    const deviceMatch = compact.match(/\b(Apple Watch[^·\n]+?)(?:\s+[A-Z][A-Za-z .'-]+,\s*[A-Z]|$)/i);

    const averageSpeed = distanceMeters && movingTimeSeconds ? distanceMeters / movingTimeSeconds : 0;

    return {
        name,
        sport_type: activityType,
        type: activityType,
        distance: distanceMeters || 0,
        distance_value: distanceNumber || 0,
        distance_unit: distanceUnit,
        moving_time: movingTimeSeconds || 0,
        elapsed_time: movingTimeSeconds || 0,
        total_elevation_gain: 0,
        average_speed: averageSpeed,
        max_speed: 0,
        start_date: startDate ? startDate.toISOString() : null,
        start_date_local: startDate ? startDate.toISOString() : null,
        source_timezone: resolvedTimeZone,
        source: 'screenshot',
        location_text: locationLine || locationMatch?.[1] || '',
        device_text: deviceLineMatch?.[1]?.trim() || deviceMatch?.[1]?.trim() || '',
        average_pace_text: paceValue || '',
        ocr_text: text
    };
};
