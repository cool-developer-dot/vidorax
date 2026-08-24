/**
 * Formats an ISO-8601 date for account "Member since" display.
 * Returns a stable fallback when the value is missing or invalid.
 */
export function formatMemberSince(isoDate?: string | null): string {
  if (!isoDate) {
    return 'Unavailable';
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
