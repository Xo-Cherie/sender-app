export function getMessagePreview(message: string | undefined, maxLength = 120): string {
  const trimmed = (message || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'No message';
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

export function formatCardTimelineDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
