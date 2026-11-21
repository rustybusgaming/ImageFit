export const KB = 1024;
export const MB = 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < MB) {
    return `${Math.max(1, Math.round(bytes / KB))} KB`;
  }
  // Whole megabytes read better without a trailing ".0".
  const megabytes = bytes / MB;
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}
