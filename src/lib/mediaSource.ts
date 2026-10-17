/**
 * Where an uploaded file's bytes actually live.
 *
 * Browser uploads and desktop-opened images are ordinary `File`s backed by memory. Desktop-opened
 * videos are not: their bytes never cross IPC (a multi-gigabyte copy that also fails past 2 GiB),
 * so the renderer holds an empty placeholder `File` and this module maps it to the path the
 * native encoder reads and the `imagefit-media:` URL main streams it from for playback.
 */

interface DesktopFileSource {
  path: string;
  /** Streaming URL for files whose bytes stayed on disk. */
  url?: string;
}

const desktopSources = new WeakMap<File, DesktopFileSource>();

export function registerDesktopFile(file: File, source: DesktopFileSource): void {
  if (source.path) desktopSources.set(file, source);
}

/**
 * Disk path behind a desktop-opened file. Files dropped onto the window resolve through
 * `getPathForFile` instead; this covers the ones rebuilt from IPC, for which it returns "".
 */
export function getDesktopFilePath(file: File): string | undefined {
  return desktopSources.get(file)?.path;
}

/**
 * A URL a media element can load `source` from, plus how to release it. Streamed desktop files
 * reuse their scheme URL (nothing to revoke); everything else gets an object URL.
 */
export function openMediaUrl(source: Blob): { url: string; release: () => void } {
  const streamed = source instanceof File ? desktopSources.get(source)?.url : undefined;
  if (streamed) return { url: streamed, release: () => undefined };

  const url = URL.createObjectURL(source);
  return { url, release: () => URL.revokeObjectURL(url) };
}
