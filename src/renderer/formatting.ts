/**
 * Owns: small presentation formatters for writing time and snapshot labels.
 * Out of scope: DOM rendering and locale-specific formatting beyond simple labels.
 * Inputs/Outputs: numeric counters or timestamp strings in, formatted labels out.
 * Side effects: none.
 */
/**
 * Formats accumulated writing time for the footer.
 *
 * @param totalSeconds Total tracked writing seconds.
 * @returns A compact hours/minutes string.
 */
export function formatWritingTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Formats elapsed milliseconds into a relative label for snapshot status.
 *
 * @param milliseconds Elapsed time since the snapshot.
 * @returns A compact human-readable relative string.
 */
export function formatRelativeElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));

  if (seconds < 10) {
    return "just now";
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Parses a snapshot filename timestamp into epoch milliseconds.
 *
 * @param snapshotName Snapshot base name in the app's timestamp format.
 * @returns Epoch milliseconds, or `null` when the name is invalid.
 */
export function parseSnapshotTimestamp(snapshotName: string): number | null {
  const matches = snapshotName.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?Z$/
  );

  if (!matches) {
    return null;
  }

  const [, year, month, day, hour, minute, second, millisecond] = matches;
  const timestamp = Date.UTC(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
    Number.parseInt(hour, 10),
    Number.parseInt(minute, 10),
    Number.parseInt(second, 10),
    Number.parseInt(millisecond ?? "0", 10)
  );

  return Number.isFinite(timestamp) ? timestamp : null;
}
