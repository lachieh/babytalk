export function formatRelativeAge(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.floor(minutes % 60);
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m ago`
    : `${hours}h ago`;
}
