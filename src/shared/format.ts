const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function formatResetsIn(resetsAtIso: string | null, now: Date): string {
  if (resetsAtIso === null) {
    return "Reset date unknown";
  }
  const resetsAt = new Date(resetsAtIso);
  if (Number.isNaN(resetsAt.getTime())) {
    return "Reset date unknown";
  }
  const remainingMs = resetsAt.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return "Resets soon";
  }
  const days = Math.floor(remainingMs / DAY_MS);
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS);
  if (days >= 1) {
    return `Resets in ${days}d`;
  }
  if (hours >= 1) {
    return `Resets in ${hours}h`;
  }
  const minutes = Math.max(1, Math.floor(remainingMs / MINUTE_MS));
  return `Resets in ${minutes}m`;
}

export function formatUpdatedAgo(fetchedAtIso: string, now: Date): string {
  const fetchedAt = new Date(fetchedAtIso);
  if (Number.isNaN(fetchedAt.getTime())) {
    return "Updated —";
  }
  const elapsedMs = Math.max(0, now.getTime() - fetchedAt.getTime());
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 5) {
    return "Updated just now";
  }
  if (seconds < 60) {
    return `Updated ${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Updated ${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h`;
}

export function remainingLabel(remainingPercentLabel: number): string {
  return `${remainingPercentLabel}% remaining`;
}
