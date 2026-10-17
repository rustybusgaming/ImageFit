const path = require("node:path");

/**
 * Streaming opened media from disk to the renderer.
 *
 * Videos are not sent over IPC as bytes: a multi-gigabyte file would be copied into the main
 * process, across IPC and into the renderer, and `fs.readFileSync` cannot read one past 2 GiB at
 * all. Instead the renderer gets a URL on a privileged scheme that main serves straight from disk.
 * Like `video-config.cjs`, this module is Electron-free so it can be tested under `node --test`.
 */

const MEDIA_SCHEME = "imagefit-media";
const MEDIA_HOST = "media";

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"]);

const VIDEO_CONTENT_TYPES = {
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
};

function isVideoPath(filePath) {
  return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function getVideoContentType(filePath) {
  return VIDEO_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Resolves a `Range` header against a file of `size` bytes.
 *
 * Returns null when the whole file should be sent (no header, or a form this server does not
 * honour, such as several ranges), "unsatisfiable" for a range outside the file, and otherwise
 * the inclusive byte span. Media elements seek by requesting ranges, so without this a video
 * could only be played from the start.
 */
function parseByteRange(header, size) {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, startText, endText] = match;
  if (!startText && !endText) return null;

  if (!startText) {
    // Suffix form: the last N bytes.
    const length = Number(endText);
    if (length === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(startText);
  const end = endText ? Math.min(Number(endText), size - 1) : size - 1;
  if (start >= size || end < start) return "unsatisfiable";

  return { start, end };
}

/**
 * Hands out opaque tokens for files the user opened, so the scheme can only ever serve those —
 * a renderer-supplied path is never read. The same path keeps the same token, so reopening a
 * file does not grow the table.
 */
function createMediaRegistry(createToken) {
  const pathsByToken = new Map();
  const tokensByPath = new Map();

  return {
    register(filePath) {
      let token = tokensByPath.get(filePath);
      if (!token) {
        token = createToken();
        tokensByPath.set(filePath, token);
        pathsByToken.set(token, filePath);
      }
      return `${MEDIA_SCHEME}://${MEDIA_HOST}/${token}`;
    },
    resolve(url) {
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return null;
      }
      if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.hostname !== MEDIA_HOST) return null;
      return pathsByToken.get(parsed.pathname.slice(1)) ?? null;
    },
  };
}

module.exports = {
  MEDIA_SCHEME,
  createMediaRegistry,
  getVideoContentType,
  isVideoPath,
  parseByteRange,
};
