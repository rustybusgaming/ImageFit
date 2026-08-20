const fs = require("node:fs");
const path = require("node:path");

const CODEC_FORMATS = {
  h264: ["mp4"],
  h265: ["mp4"],
  av1: ["mp4"],
  vp8: ["webm"],
  vp9: ["webm"],
  mpeg4: ["mp4"],
  prores: ["mov"],
  dnxhd: ["mov"],
  mjpeg: ["avi"],
  theora: ["ogv"],
};

const ENGINES = new Set(["software", "nvenc", "qsv", "amf", "videotoolbox", "vaapi", "mf"]);
const AUDIO_MODES = new Set(["keep", "reduced", "mute"]);
const FRAME_RATES = new Set([15, 24, 30]);
const HEIGHTS = new Set([480, 720, 1080]);
const FORMATS = new Set(["mp4", "webm", "mov", "avi", "ogv", "gif"]);

/**
 * VAAPI encodes through a DRM render node. Without one the encoders may still be listed by
 * FFmpeg but cannot initialise, so availability is gated on a device actually being present.
 */
function getVaapiDevice(platform = process.platform) {
  if (platform !== "linux") return null;

  try {
    const nodes = fs.readdirSync("/dev/dri").filter((entry) => entry.startsWith("renderD")).sort();
    return nodes.length > 0 ? path.join("/dev/dri", nodes[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Several engines are tied to one operating system or device. FFmpeg lists an encoder whenever
 * the build was compiled with it, which says nothing about whether it can initialise here, so
 * platform-bound engines are checked separately from the encoder listing.
 */
const ENGINE_REQUIREMENTS = {
  vaapi: {
    isAvailable: (platform) => getVaapiDevice(platform) !== null,
    message: "No VAAPI render device was found on this computer.",
  },
  mf: {
    isAvailable: (platform) => platform === "win32",
    message: "Media Foundation encoding is only available on Windows.",
  },
  videotoolbox: {
    isAvailable: (platform) => platform === "darwin",
    message: "VideoToolbox encoding is only available on macOS.",
  },
};

function isEngineSupportedHere(engine, platform = process.platform) {
  return ENGINE_REQUIREMENTS[engine]?.isAvailable(platform) ?? true;
}

/**
 * Size targeting.
 *
 * A single pass often overshoots, because the encoder only approximates the requested bitrate.
 * `planVideoBitrate` picks the opening bitrate and reports whether the target is reachable at
 * all; `retargetVideoBitrate` scales it down from a measured overshoot for the next attempt.
 *
 * `src/lib/videoProcessor.ts` mirrors this maths for the browser encoder and must be kept in
 * step with it — this copy is the tested one.
 */
const MIN_VIDEO_BITRATE = 100_000;
// 4% proved too tight: x264 lands just over the cap on the first pass once container and
// audio overhead are counted, so every encode ran twice. 8% lands first time, which is both
// faster and higher quality than the two-pass result the tighter margin produced.
const USABLE_FRACTION = 0.92;
const MAX_SIZE_ATTEMPTS = 3;

function getAudioBitrate(audio, totalBitrate) {
  if (audio === "keep") return Math.min(96_000, Math.floor(totalBitrate * 0.2));
  if (audio === "reduced") return 48_000;
  return 0;
}

function planVideoBitrate(maxBytes, duration, audio) {
  const usableBytes = Math.floor(maxBytes * USABLE_FRACTION);
  const totalBitrate = Math.floor((usableBytes * 8) / duration);
  const audioBitrate = getAudioBitrate(audio, totalBitrate);
  const videoBitrate = Math.max(MIN_VIDEO_BITRATE, totalBitrate - audioBitrate);

  return {
    videoBitrate,
    audioBitrate,
    // The bitrate floor means some targets are unreachable however many attempts are made;
    // saying so up front beats running an encode that is guaranteed to be rejected.
    isReachable: (MIN_VIDEO_BITRATE + audioBitrate) * duration <= maxBytes * 8,
  };
}

/** Next bitrate to try after `actualBytes` overshot `maxBytes`, or null once at the floor. */
function retargetVideoBitrate(videoBitrate, actualBytes, maxBytes) {
  if (videoBitrate <= MIN_VIDEO_BITRATE) return null;

  // Aim slightly under the proportional correction, since the overshoot includes container
  // and audio overhead that does not shrink with the video bitrate.
  const corrected = Math.floor((videoBitrate * maxBytes) / actualBytes * 0.95);
  const next = Math.max(MIN_VIDEO_BITRATE, corrected);
  return next < videoBitrate ? next : null;
}

function isCodecCompatible(codec, format) {
  return format === "gif" || CODEC_FORMATS[codec]?.includes(format) === true;
}

function assertVideoPayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid video encoding request.");
  if (typeof payload.inputPath !== "string" || !path.isAbsolute(payload.inputPath)) throw new Error("Invalid source video path.");
  if (typeof payload.presetId !== "string" || !payload.presetId) throw new Error("Invalid export preset.");
  if (!Number.isFinite(payload.maxBytes) || payload.maxBytes < 1) throw new Error("Invalid file-size limit.");
  if (!Number.isFinite(payload.duration) || payload.duration <= 0) throw new Error("Invalid video duration.");
  if (!HEIGHTS.has(payload.height) || !FRAME_RATES.has(payload.frameRate)) throw new Error("Invalid video dimensions or frame rate.");
  if (!AUDIO_MODES.has(payload.audio) || !ENGINES.has(payload.encoder)) throw new Error("Invalid audio mode or encoding engine.");
  if (!CODEC_FORMATS[payload.codec] || !FORMATS.has(payload.format)) throw new Error("Invalid video codec or output format.");
  if (payload.format !== "gif" && !isCodecCompatible(payload.codec, payload.format)) throw new Error("The selected codec is not compatible with this output format.");
  if (payload.format === "gif" && payload.audio !== "mute") throw new Error("GIF output must be muted.");
}

function toSafeNameSegment(value, fallback) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|-+$/g, "") || fallback;
}

function getOutputFilename(inputPath, payload) {
  const sourceName = toSafeNameSegment(path.basename(inputPath, path.extname(inputPath)), "video");
  const presetId = toSafeNameSegment(payload.presetId, "export");
  const engineSuffix = payload.encoder === "software" ? "" : `-${payload.encoder}`;
  return `${sourceName}-${presetId}-${payload.codec}${engineSuffix}.${payload.format}`;
}

module.exports = {
  CODEC_FORMATS,
  ENGINE_REQUIREMENTS,
  MAX_SIZE_ATTEMPTS,
  MIN_VIDEO_BITRATE,
  assertVideoPayload,
  getOutputFilename,
  getVaapiDevice,
  isCodecCompatible,
  isEngineSupportedHere,
  planVideoBitrate,
  retargetVideoBitrate,
};
