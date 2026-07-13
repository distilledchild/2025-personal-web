function parseDetails(details) {
  if (!details) return null;

  if (typeof details === 'object') {
    return details;
  }

  if (typeof details !== 'string') {
    return null;
  }

  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

function buildErrorSummary(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return '';

  return errors
    .map((entry) => {
      const label = [entry?.resource, entry?.field].filter(Boolean).join(' ');
      if (!label && !entry?.code) return '';
      if (!entry?.code) return label;
      return label ? `${label} = ${entry.code}` : entry.code;
    })
    .filter(Boolean)
    .join(', ');
}

export function formatStravaApiError(payload, fallbackMessage) {
  const topLevelError = payload?.error;
  const details = parseDetails(payload?.details);
  const detailMessage = details?.message;
  const errorSummary = buildErrorSummary(details?.errors);

  if (detailMessage && errorSummary) {
    return `${fallbackMessage}: ${detailMessage} (${errorSummary})`;
  }

  if (detailMessage) {
    return `${fallbackMessage}: ${detailMessage}`;
  }

  if (topLevelError) {
    return `${fallbackMessage}: ${topLevelError}`;
  }

  return fallbackMessage;
}
