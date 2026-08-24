/**
 * Derives display initials from a person's name.
 * "Ada Lovelace" → "AL", "Prince" → "PR", empty → "?".
 */
export function getInitials(name?: string | null, maxLength = 2): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return '?';
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, maxLength).toUpperCase();
  }

  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return `${first}${last}`.toUpperCase().slice(0, maxLength);
}
